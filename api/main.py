"""
FastAPI backend for Multimodal Sentiment Analysis
Exposes REST API endpoints for the React frontend
Supports two engines: Custom Fusion Model & HuggingFace RoBERTa
"""

import sys
import os
from pathlib import Path

# Fix Windows console encoding (cp1252 can't handle emoji)
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add project root to Python path
api_dir = Path(__file__).parent
project_root = api_dir.parent
sys.path.insert(0, str(project_root))

from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import numpy as np
import pickle
from tensorflow.keras.models import load_model  # type: ignore
import tensorflow as tf  # type: ignore

# Import preprocessing utilities
from preprocessing.extract_all_video_features import extract_all_video_features
from preprocessing.extract_audio import extract_audio
from preprocessing.extract_all_audio_features import extract_mfcc_features
from preprocessing.transcribe_audio import transcribe_audio
from preprocessing.extract_all_text_features import extract_text_features

# ─── Model globals ────────────────────────────────────────────────────────────
MODEL_DIR = project_root / "models"

# Custom fusion model
model = None
scaler_v = None
scaler_a = None
scaler_t = None
le = None

# HuggingFace RoBERTa pipeline
hf_pipeline = None
import threading
_hf_load_lock = threading.Lock()
HF_MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"

# Label mapping for HF model → our labels
HF_LABEL_MAP = {
    "positive": "Positive",
    "negative": "Negative",
    "neutral": "Neutral",
}

# Maximum upload size: 200 MB (matches frontend validation)
MAX_UPLOAD_BYTES = 200 * 1024 * 1024


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Load ML models on startup, clean up on shutdown."""
    await _load_models()
    yield
    # shutdown: nothing to clean up for now


app = FastAPI(
    title="Multimodal Sentiment Analysis API",
    description="API for analyzing sentiment from video, audio, and text. Supports custom fusion model and HuggingFace RoBERTa.",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS to allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Set EAGER_LOAD_HF=1 to load RoBERTa at startup (old behaviour). By default we
# lazy-load it on first use so the API becomes ready in ~20-30s instead of
# ~2-3min — the first RoBERTa request then pays a one-time ~30-60s cost.
EAGER_LOAD_HF = os.environ.get("EAGER_LOAD_HF", "0") == "1"


async def _load_models():
    """Load the custom fusion model on startup. RoBERTa loads lazily by default."""
    global model, scaler_v, scaler_a, scaler_t, le

    # ── Load custom fusion model (fast) ──────────────────────────────────────
    try:
        model = load_model(str(MODEL_DIR / "final_multimodal_logits_model.h5"))

        with open(MODEL_DIR / "scaler_video.pkl", "rb") as f:
            scaler_v = pickle.load(f)
        with open(MODEL_DIR / "scaler_audio.pkl", "rb") as f:
            scaler_a = pickle.load(f)
        with open(MODEL_DIR / "scaler_text.pkl", "rb") as f:
            scaler_t = pickle.load(f)
        with open(MODEL_DIR / "label_encoder.pkl", "rb") as f:
            le = pickle.load(f)

        print("✅ Custom fusion model loaded successfully")
    except Exception as e:
        print(f"❌ Error loading custom model: {e}")

    # ── HuggingFace RoBERTa — optional eager load ───────────────────────────
    if EAGER_LOAD_HF:
        _get_hf_pipeline()
    else:
        # RoBERTa is the default UI engine, so warm it up in a background thread:
        # startup stays fast (~20-30s) but the pipeline is usually ready before
        # the first user request, avoiding a slow first analysis.
        print("ℹ️  Warming up RoBERTa in the background (set EAGER_LOAD_HF=1 to "
              "block on it at startup).")
        threading.Thread(target=_get_hf_pipeline, daemon=True).start()


def _get_hf_pipeline():
    """Return the RoBERTa pipeline, loading it on first call. A lock guards
    against the background warm-up thread and a request thread loading it twice."""
    global hf_pipeline
    if hf_pipeline is not None:
        return hf_pipeline
    with _hf_load_lock:
        if hf_pipeline is not None:   # re-check inside the lock
            return hf_pipeline
        try:
            from transformers import pipeline as hf_pipe
            print(f"⏳ Loading HuggingFace model: {HF_MODEL_NAME} ...")
            hf_pipeline = hf_pipe(
                "text-classification",
                model=HF_MODEL_NAME,
                top_k=None,          # return all scores
                truncation=True,
                max_length=512,
            )
            print("✅ HuggingFace RoBERTa pipeline loaded successfully")
        except Exception as e:
            print(f"❌ Error loading HuggingFace pipeline: {e}")
            hf_pipeline = None
    return hf_pipeline


# ─── Helper ───────────────────────────────────────────────────────────────────

def _run_hf_inference(text: str) -> dict:
    """Run HuggingFace RoBERTa on text, return standardised result dict."""
    pipe = _get_hf_pipeline()
    if not pipe:
        raise RuntimeError("HuggingFace pipeline not loaded")

    raw = pipe(text)[0]   # list of {label, score}
    prob_dict = {}
    for item in raw:
        mapped = HF_LABEL_MAP.get(item["label"].lower(), item["label"].capitalize())
        prob_dict[mapped] = float(item["score"])

    # Ensure all three keys exist
    for k in ("Positive", "Negative", "Neutral"):
        prob_dict.setdefault(k, 0.0)

    sentiment = max(prob_dict, key=lambda k: prob_dict[k])
    confidence = prob_dict[sentiment]
    return {"sentiment": sentiment, "confidence": confidence, "probabilities": prob_dict}


async def _extract_audio_and_transcribe(file: UploadFile):
    """
    Shared helper: saves uploaded file, extracts / converts audio to WAV,
    transcribes it, and returns (vid_path, audio_wav_path, transcript, is_audio_only).
    Caller is responsible for cleanup.
    """
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    audio_extensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg']
    allowed_extensions = video_extensions + audio_extensions
    file_ext = Path(file.filename or "upload").suffix.lower()
    is_audio_only = file_ext in audio_extensions

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file_ext}'. Allowed: {', '.join(allowed_extensions)}"
        )

    # Server-side size guard — read in chunks and reject early if too large
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)  # 1 MB at a time
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024*1024)} MB."
            )
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    vid_path = None
    audio_wav_path = None

    # Save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
        vid_path = tmp.name
        tmp.write(file_bytes)

    # Get / convert audio to WAV
    if is_audio_only:
        if file_ext == '.wav':
            audio_wav_path = vid_path
        else:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_a:
                audio_wav_path = tmp_a.name
            import subprocess
            try:
                subprocess.run(
                    ['ffmpeg', '-y', '-i', vid_path, '-ar', '16000', '-ac', '1', audio_wav_path],
                    capture_output=True, check=True
                )
            except Exception:
                audio_wav_path = vid_path
    else:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_a:
            audio_wav_path = tmp_a.name
        if not extract_audio(vid_path, audio_wav_path):
            raise HTTPException(status_code=500, detail="Could not extract audio from video")

    # Transcribe
    transcript = transcribe_audio(audio_wav_path) or ""

    return vid_path, audio_wav_path, transcript, is_audio_only


def _cleanup(*paths):
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Multimodal Sentiment Analysis API",
        "version": "2.0.0",
        "engines": {
            "custom_model": model is not None,
            "huggingface_roberta": hf_pipeline is not None,
        }
    }


@app.get("/api/health")
async def health():
    """Detailed health check — returns model load status for each engine."""
    return {
        "status": "ok",
        "version": "2.0.0",
        "models": {
            "custom_fusion": {
                "loaded": model is not None and scaler_v is not None,
                "description": "ResNet18 + MFCC + DistilBERT early fusion (CMU-MOSI)",
            },
            "huggingface_roberta": {
                "loaded": hf_pipeline is not None,
                "lazy": not EAGER_LOAD_HF,
                "note": None if hf_pipeline is not None else "Loads on first request",
                "description": HF_MODEL_NAME,
            },
        },
    }


# ─── Custom model endpoint ────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze_video(file: UploadFile = File(...)):
    """
    Analyze sentiment from video/audio using the custom multimodal fusion model.
    """
    if not model or not scaler_v or not scaler_a or not scaler_t or not le:
        raise HTTPException(status_code=503, detail="Custom model not loaded")

    vid_path = audio_wav_path = None
    try:
        vid_path, audio_wav_path, transcript, is_audio_only = await _extract_audio_and_transcribe(file)

        if is_audio_only:
            print("🎵 Audio-only mode — zero vector for video features")
            video_feat_scaled = np.zeros(scaler_v.n_features_in_)
        else:
            print("🎬 Extracting video features...")
            video_feat_raw = extract_all_video_features(vid_path)
            if video_feat_raw is None:
                raise HTTPException(status_code=500, detail="Could not extract video features")
            video_feat_scaled = scaler_v.transform(video_feat_raw.reshape(1, -1))[0]

        print("🎙️ Extracting audio (MFCC) features...")
        mfcc_vec_raw = extract_mfcc_features(audio_wav_path)
        if mfcc_vec_raw is None:
            raise HTTPException(status_code=500, detail="Could not extract audio features")
        mfcc_vec_scaled = scaler_a.transform(mfcc_vec_raw.reshape(1, -1))[0]

        print("📝 Extracting text features...")
        text_feat_scaled = np.zeros(768)
        if transcript:
            text_feat_raw = extract_text_features(transcript)
            if text_feat_raw is not None:
                text_feat_scaled = scaler_t.transform(text_feat_raw.reshape(1, -1))[0]

        print("🤖 Running custom model prediction...")
        X_aud = np.expand_dims(mfcc_vec_scaled, 0)
        X_vid = np.expand_dims(video_feat_scaled, 0)
        X_txt = np.expand_dims(text_feat_scaled, 0)

        preds = model.predict([X_aud, X_vid, X_txt], verbose=0)
        idx = np.argmax(preds, axis=1)[0]
        sentiment = le.inverse_transform([idx])[0]

        probabilities = tf.nn.softmax(preds[0]).numpy()
        prob_dict = {label: float(prob) for label, prob in zip(le.classes_, probabilities)}
        confidence = float(np.max(probabilities))

        video_score = float(np.mean(np.abs(video_feat_scaled)))
        audio_score = float(np.mean(np.abs(mfcc_vec_scaled)))
        text_score  = float(np.mean(np.abs(text_feat_scaled)))
        total = video_score + audio_score + text_score + 1e-6

        print(f"✅ Custom model result: {sentiment} ({confidence:.2%})")
        if transcript:
            print(f"📝 Transcript: {transcript}")

        return JSONResponse({
            "success":     True,
            "sentiment":   sentiment,
            "confidence":  confidence,
            "transcript":  transcript or "No speech detected",
            "probabilities": prob_dict,
            "engine":      "custom",
            "breakdown": {
                "video": video_score / total,
                "audio": audio_score / total,
                "text":  text_score  / total,
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        _cleanup(vid_path)
        if audio_wav_path != vid_path:
            _cleanup(audio_wav_path)


# ─── HuggingFace RoBERTa endpoint ─────────────────────────────────────────────

@app.post("/api/analyze-hf")
async def analyze_hf(file: UploadFile = File(...)):
    """
    Analyze sentiment using HuggingFace twitter-roberta-base-sentiment-latest.
    For video/audio: transcribes speech then classifies transcript.
    """
    if not _get_hf_pipeline():
        raise HTTPException(status_code=503, detail="HuggingFace pipeline not loaded")

    vid_path = audio_wav_path = None
    try:
        vid_path, audio_wav_path, transcript, is_audio_only = await _extract_audio_and_transcribe(file)

        if not transcript:
            raise HTTPException(
                status_code=422,
                detail="No speech detected in the file. HuggingFace engine requires spoken content."
            )

        print(f"⚡ Running HuggingFace RoBERTa on transcript ({len(transcript.split())} words)...")
        result = _run_hf_inference(transcript)

        print(f"✅ HuggingFace result: {result['sentiment']} ({result['confidence']:.2%})")
        print(f"📝 Transcript: {transcript}")

        return JSONResponse({
            "success":       True,
            "sentiment":     result["sentiment"],
            "confidence":    result["confidence"],
            "transcript":    transcript,
            "probabilities": result["probabilities"],
            "engine":        "huggingface",
            "breakdown": {
                "video": 0.0,
                "audio": 0.33,
                "text":  0.67,
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"HuggingFace analysis failed: {str(e)}")
    finally:
        _cleanup(vid_path)
        if audio_wav_path != vid_path:
            _cleanup(audio_wav_path)


# ─── Text-only endpoints ──────────────────────────────────────────────────────

@app.post("/api/analyze-text")
async def analyze_text(
    text: str = Query(..., min_length=3),
    model_engine: str = Query(default="custom", regex="^(custom|hf)$")
):
    """
    Analyze sentiment from raw text.
    model_engine: 'custom' (fusion model, text-only) or 'hf' (RoBERTa).
    """
    text = text.strip()

    # ── HuggingFace path ─────────────────────────────────────────────────────
    if model_engine == "hf":
        if not _get_hf_pipeline():
            raise HTTPException(status_code=503, detail="HuggingFace pipeline not loaded")
        try:
            result = _run_hf_inference(text)
            return JSONResponse({
                "success":       True,
                "sentiment":     result["sentiment"],
                "confidence":    result["confidence"],
                "probabilities": result["probabilities"],
                "engine":        "huggingface",
                "breakdown":     {"video": 0.0, "audio": 0.0, "text": 1.0}
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"HuggingFace text analysis failed: {str(e)}")

    # ── Custom model path ────────────────────────────────────────────────────
    if not model or not scaler_v or not scaler_a or not scaler_t or not le:
        raise HTTPException(status_code=503, detail="Custom model not loaded")
    try:
        text_feat_raw = extract_text_features(text)
        if text_feat_raw is None:
            raise HTTPException(status_code=500, detail="Could not extract text features")

        text_feat_scaled = scaler_t.transform(text_feat_raw.reshape(1, -1))[0]
        video_feat_scaled = np.zeros(scaler_v.n_features_in_)
        mfcc_vec_scaled   = np.zeros(scaler_a.n_features_in_)

        X_aud = np.expand_dims(mfcc_vec_scaled, 0)
        X_vid = np.expand_dims(video_feat_scaled, 0)
        X_txt = np.expand_dims(text_feat_scaled, 0)

        preds = model.predict([X_aud, X_vid, X_txt], verbose=0)
        idx = np.argmax(preds, axis=1)[0]
        sentiment = le.inverse_transform([idx])[0]

        probabilities = tf.nn.softmax(preds[0]).numpy()
        prob_dict = {label: float(prob) for label, prob in zip(le.classes_, probabilities)}
        confidence = float(np.max(probabilities))

        return JSONResponse({
            "success":       True,
            "sentiment":     sentiment,
            "confidence":    confidence,
            "probabilities": prob_dict,
            "engine":        "custom",
            "breakdown":     {"video": 0.0, "audio": 0.0, "text": 1.0}
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custom text analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Multimodal Sentiment Analysis API v2.0 ...")
    print("📍 http://localhost:8000  |  Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
