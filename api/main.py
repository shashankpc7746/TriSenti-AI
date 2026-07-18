"""
FastAPI backend for Multimodal Sentiment Analysis
Exposes REST API endpoints for the React frontend
Supports two engines: Custom Fusion Model & HuggingFace RoBERTa
Speech-to-text: faster-whisper (multilingual, auto language detection).
Non-English speech is transcribed natively and translated to English for the
sentiment models (RoBERTa / DistilBERT are English models).
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

import logging
import pickle
import tempfile
import threading
from contextlib import asynccontextmanager
from typing import Literal, Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from tensorflow.keras.models import load_model  # type: ignore
import tensorflow as tf  # type: ignore

# Import preprocessing utilities
from preprocessing.extract_all_video_features import extract_all_video_features
from preprocessing.extract_audio import convert_to_wav
from preprocessing.extract_all_audio_features import extract_mfcc_features
from preprocessing.transcribe_audio import (
    transcribe_audio_detailed,
    WHISPER_MODEL_SIZE,
    _get_whisper_model,
)
from preprocessing.extract_all_text_features import extract_text_features

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("trisenti.api")

API_VERSION = "1.1.0"

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

VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.flac', '.ogg']
ALLOWED_EXTENSIONS = VIDEO_EXTENSIONS + AUDIO_EXTENSIONS


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Load ML models on startup, clean up on shutdown."""
    await _load_models()
    yield
    # shutdown: nothing to clean up for now


app = FastAPI(
    title="Multimodal Sentiment Analysis API",
    description=(
        "API for analyzing sentiment from video, audio, and text. "
        "Multilingual speech-to-text via Whisper; sentiment via a custom "
        "fusion model or HuggingFace RoBERTa."
    ),
    version=API_VERSION,
    lifespan=lifespan,
)

# Configure CORS to allow the React frontend.
# Origins come from the CORS_ALLOW_ORIGINS env var (comma-separated) so the
# deployed frontend domain can be added without code changes. Falls back to the
# common local dev ports. Example:
#   CORS_ALLOW_ORIGINS="https://trisenti.vercel.app,https://www.trisenti.app"
_default_origins = "http://localhost:3000,http://localhost:3001,http://localhost:5173"
_cors_origins = [
    o.strip()
    for o in os.environ.get("CORS_ALLOW_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Set EAGER_LOAD_HF=1 to load RoBERTa at startup (old behaviour). By default we
# lazy-load it on first use so the API becomes ready quickly — a background
# thread then warms up RoBERTa and Whisper so the first request is fast.
EAGER_LOAD_HF = os.environ.get("EAGER_LOAD_HF", "0") == "1"


async def _load_models():
    """Load the custom fusion model on startup. RoBERTa/Whisper warm up in the
    background so the API is ready in seconds."""
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

        logger.info("✅ Custom fusion model loaded successfully")
    except Exception:
        logger.exception("❌ Error loading custom model")

    # ── HuggingFace RoBERTa — optional eager load ───────────────────────────
    if EAGER_LOAD_HF:
        _get_hf_pipeline()
        _get_whisper_model()
    else:
        # RoBERTa is the default UI engine and Whisper handles all speech, so
        # warm both in a background thread: startup stays fast but the models
        # are usually ready before the first user request.
        logger.info(
            "Warming up RoBERTa + Whisper in the background "
            "(set EAGER_LOAD_HF=1 to block on them at startup)."
        )

        def _warm_up():
            _get_hf_pipeline()
            _get_whisper_model()

        threading.Thread(target=_warm_up, daemon=True).start()


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
            logger.info("⏳ Loading HuggingFace model: %s ...", HF_MODEL_NAME)
            hf_pipeline = hf_pipe(
                "text-classification",
                model=HF_MODEL_NAME,
                top_k=None,          # return all scores
                truncation=True,
                max_length=512,
            )
            logger.info("✅ HuggingFace RoBERTa pipeline loaded successfully")
        except Exception:
            logger.exception("❌ Error loading HuggingFace pipeline")
            hf_pipeline = None
    return hf_pipeline


# ─── Helpers ──────────────────────────────────────────────────────────────────

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


def _run_custom_inference(mfcc_scaled, video_scaled, text_scaled) -> dict:
    """Run the custom fusion model on scaled features, return result dict."""
    X_aud = np.expand_dims(mfcc_scaled, 0)
    X_vid = np.expand_dims(video_scaled, 0)
    X_txt = np.expand_dims(text_scaled, 0)

    preds = model.predict([X_aud, X_vid, X_txt], verbose=0)
    idx = int(np.argmax(preds, axis=1)[0])
    sentiment = le.inverse_transform([idx])[0]

    probabilities = tf.nn.softmax(preds[0]).numpy()
    prob_dict = {label: float(prob) for label, prob in zip(le.classes_, probabilities)}
    confidence = float(np.max(probabilities))
    return {"sentiment": sentiment, "confidence": confidence, "probabilities": prob_dict}


async def _save_upload(file: UploadFile):
    """
    Validate and stream the uploaded file to a temp file (never buffering the
    whole upload in memory). Returns (path, file_ext, is_audio_only).
    Caller is responsible for cleanup of the returned path.
    """
    file_ext = Path(file.filename or "upload").suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file_ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    total = 0
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
    try:
        with tmp:
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
                tmp.write(chunk)
    except Exception:
        _cleanup(tmp.name)
        raise

    if total == 0:
        _cleanup(tmp.name)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return tmp.name, file_ext, file_ext in AUDIO_EXTENSIONS


def _prepare_audio_and_transcribe(src_path: str, file_ext: str, is_audio_only: bool):
    """
    Sync helper (run in a worker thread): convert the upload to 16 kHz mono
    WAV and transcribe it with Whisper (auto language detection + English
    translation for non-English speech).

    Returns (audio_wav_path, asr) where asr is the dict from
    transcribe_audio_detailed(). Caller cleans up audio_wav_path if it
    differs from src_path.
    """
    if file_ext == '.wav':
        audio_wav_path = src_path
    else:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_a:
            audio_wav_path = tmp_a.name
        if not convert_to_wav(src_path, audio_wav_path):
            _cleanup(audio_wav_path)
            if is_audio_only:
                # Whisper / librosa can decode most audio containers natively.
                audio_wav_path = src_path
            else:
                raise HTTPException(
                    status_code=422,
                    detail="Could not extract audio from the video. Does it have an audio track?"
                )

    asr = transcribe_audio_detailed(audio_wav_path)
    if asr["text"]:
        logger.info(
            "📝 Transcript (%s, %s): %s",
            asr.get("language_name") or "unknown language",
            asr.get("engine"),
            asr["text"][:300],
        )
    return audio_wav_path, asr


def _asr_response_fields(asr: dict) -> dict:
    """Shared multilingual fields for API responses."""
    is_english = (asr.get("language") or "en") == "en"
    return {
        "transcript": asr["text"] or "No speech detected",
        "language": asr.get("language"),
        "language_name": asr.get("language_name"),
        "language_probability": asr.get("language_probability"),
        # English translation shown only when the source language differs
        "translation": None if is_english else (asr.get("text_english") or None),
        "transcription_engine": asr.get("engine"),
    }


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
        "version": API_VERSION,
        "engines": {
            "custom_model": model is not None,
            "huggingface_roberta": hf_pipeline is not None,
        }
    }


@app.get("/api/health")
async def health():
    """Detailed health check — returns model load status for each engine."""
    from preprocessing.transcribe_audio import _whisper_model, _whisper_load_failed
    return {
        "status": "ok",
        "version": API_VERSION,
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
            "whisper_stt": {
                "loaded": _whisper_model is not None,
                "fallback_active": _whisper_load_failed,
                "model_size": WHISPER_MODEL_SIZE,
                "description": "faster-whisper multilingual speech-to-text "
                               "(auto language detection + English translation)",
            },
        },
    }


# ─── Custom model endpoint ────────────────────────────────────────────────────

def _analyze_custom_sync(vid_path: str, file_ext: str, is_audio_only: bool) -> dict:
    """Full custom-engine pipeline (runs in a worker thread)."""
    audio_wav_path = None
    try:
        audio_wav_path, asr = _prepare_audio_and_transcribe(vid_path, file_ext, is_audio_only)

        if is_audio_only:
            logger.info("🎵 Audio-only mode — zero vector for video features")
            video_feat_scaled = np.zeros(scaler_v.n_features_in_)
        else:
            logger.info("🎬 Extracting video features...")
            video_feat_raw = extract_all_video_features(vid_path)
            if video_feat_raw is None:
                raise HTTPException(status_code=422, detail="Could not extract video features")
            video_feat_scaled = scaler_v.transform(video_feat_raw.reshape(1, -1))[0]

        logger.info("🎙️ Extracting audio (MFCC) features...")
        mfcc_vec_raw = extract_mfcc_features(audio_wav_path)
        if mfcc_vec_raw is None:
            raise HTTPException(status_code=422, detail="Could not extract audio features")
        mfcc_vec_scaled = scaler_a.transform(mfcc_vec_raw.reshape(1, -1))[0]

        logger.info("📝 Extracting text features...")
        # Sentiment features come from the English text: the original
        # transcript for English speech, Whisper's translation otherwise
        # (DistilBERT is an English model).
        text_for_model = asr.get("text_english") or ""
        text_feat_scaled = np.zeros(768)
        if text_for_model:
            text_feat_raw = extract_text_features(text_for_model)
            if text_feat_raw is not None:
                text_feat_scaled = scaler_t.transform(text_feat_raw.reshape(1, -1))[0]

        logger.info("🤖 Running custom model prediction...")
        result = _run_custom_inference(mfcc_vec_scaled, video_feat_scaled, text_feat_scaled)

        video_score = float(np.mean(np.abs(video_feat_scaled)))
        audio_score = float(np.mean(np.abs(mfcc_vec_scaled)))
        text_score = float(np.mean(np.abs(text_feat_scaled)))
        total = video_score + audio_score + text_score + 1e-6

        logger.info("✅ Custom model result: %s (%.2f%%)",
                    result["sentiment"], result["confidence"] * 100)

        return {
            "success":       True,
            "sentiment":     result["sentiment"],
            "confidence":    result["confidence"],
            "probabilities": result["probabilities"],
            "engine":        "custom",
            **_asr_response_fields(asr),
            "breakdown": {
                "video": video_score / total,
                "audio": audio_score / total,
                "text":  text_score / total,
            }
        }
    finally:
        if audio_wav_path and audio_wav_path != vid_path:
            _cleanup(audio_wav_path)


@app.post("/api/analyze")
async def analyze_video(file: UploadFile = File(...)):
    """
    Analyze sentiment from video/audio using the custom multimodal fusion model.
    """
    if model is None or scaler_v is None or scaler_a is None or scaler_t is None or le is None:
        raise HTTPException(status_code=503, detail="Custom model not loaded")

    vid_path, file_ext, is_audio_only = await _save_upload(file)
    try:
        # Heavy CPU work runs in a worker thread so the event loop (and
        # health checks) stay responsive.
        payload = await run_in_threadpool(_analyze_custom_sync, vid_path, file_ext, is_audio_only)
        return JSONResponse(payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Custom analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed due to an internal error.")
    finally:
        _cleanup(vid_path)


# ─── HuggingFace RoBERTa endpoint ─────────────────────────────────────────────

def _analyze_hf_sync(vid_path: str, file_ext: str, is_audio_only: bool) -> dict:
    """Transcribe + RoBERTa pipeline (runs in a worker thread)."""
    audio_wav_path = None
    try:
        audio_wav_path, asr = _prepare_audio_and_transcribe(vid_path, file_ext, is_audio_only)

        if not asr["text"]:
            raise HTTPException(
                status_code=422,
                detail="No speech detected in the file. The RoBERTa engine requires spoken content."
            )

        # RoBERTa is an English model — analyze the English text (original
        # transcript for English speech, Whisper translation otherwise).
        text_for_model = asr.get("text_english") or asr["text"]
        logger.info("⚡ Running HuggingFace RoBERTa on transcript (%d words)...",
                    len(text_for_model.split()))
        result = _run_hf_inference(text_for_model)

        logger.info("✅ HuggingFace result: %s (%.2f%%)",
                    result["sentiment"], result["confidence"] * 100)

        return {
            "success":       True,
            "sentiment":     result["sentiment"],
            "confidence":    result["confidence"],
            "probabilities": result["probabilities"],
            "engine":        "huggingface",
            **_asr_response_fields(asr),
            "breakdown": {
                "video": 0.0,
                "audio": 0.33,
                "text":  0.67,
            }
        }
    finally:
        if audio_wav_path and audio_wav_path != vid_path:
            _cleanup(audio_wav_path)


@app.post("/api/analyze-hf")
async def analyze_hf(file: UploadFile = File(...)):
    """
    Analyze sentiment using HuggingFace twitter-roberta-base-sentiment-latest.
    For video/audio: transcribes speech (any language) then classifies.
    """
    if not _get_hf_pipeline():
        raise HTTPException(status_code=503, detail="HuggingFace pipeline not loaded")

    vid_path, file_ext, is_audio_only = await _save_upload(file)
    try:
        payload = await run_in_threadpool(_analyze_hf_sync, vid_path, file_ext, is_audio_only)
        return JSONResponse(payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("HuggingFace analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed due to an internal error.")
    finally:
        _cleanup(vid_path)


# ─── Text-only endpoints ──────────────────────────────────────────────────────

class TextAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=20000)
    model_engine: Literal["custom", "hf"] = "hf"


def _analyze_text_custom_sync(text: str) -> dict:
    text_feat_raw = extract_text_features(text)
    if text_feat_raw is None:
        raise HTTPException(status_code=500, detail="Could not extract text features")

    text_feat_scaled = scaler_t.transform(text_feat_raw.reshape(1, -1))[0]
    video_feat_scaled = np.zeros(scaler_v.n_features_in_)
    mfcc_vec_scaled = np.zeros(scaler_a.n_features_in_)

    result = _run_custom_inference(mfcc_vec_scaled, video_feat_scaled, text_feat_scaled)
    return {
        "success":       True,
        "sentiment":     result["sentiment"],
        "confidence":    result["confidence"],
        "probabilities": result["probabilities"],
        "engine":        "custom",
        "breakdown":     {"video": 0.0, "audio": 0.0, "text": 1.0}
    }


@app.post("/api/analyze-text")
async def analyze_text(
    payload: Optional[TextAnalysisRequest] = None,
    text: Optional[str] = Query(default=None, min_length=3),
    model_engine: str = Query(default="hf", pattern="^(custom|hf)$"),
):
    """
    Analyze sentiment from raw text.
    Preferred: POST a JSON body {"text": "...", "model_engine": "custom"|"hf"}.
    Legacy query parameters (?text=...&model_engine=...) are still accepted.
    """
    if payload is not None:
        text = payload.text
        model_engine = payload.model_engine
    if not text or len(text.strip()) < 3:
        raise HTTPException(status_code=422, detail="Provide at least 3 characters of text.")
    text = text.strip()

    # ── HuggingFace path ─────────────────────────────────────────────────────
    if model_engine == "hf":
        if not _get_hf_pipeline():
            raise HTTPException(status_code=503, detail="HuggingFace pipeline not loaded")
        try:
            result = await run_in_threadpool(_run_hf_inference, text)
            return JSONResponse({
                "success":       True,
                "sentiment":     result["sentiment"],
                "confidence":    result["confidence"],
                "probabilities": result["probabilities"],
                "engine":        "huggingface",
                "breakdown":     {"video": 0.0, "audio": 0.0, "text": 1.0}
            })
        except Exception:
            logger.exception("HuggingFace text analysis failed")
            raise HTTPException(status_code=500, detail="Text analysis failed due to an internal error.")

    # ── Custom model path ────────────────────────────────────────────────────
    if model is None or scaler_v is None or scaler_a is None or scaler_t is None or le is None:
        raise HTTPException(status_code=503, detail="Custom model not loaded")
    try:
        payload_out = await run_in_threadpool(_analyze_text_custom_sync, text)
        return JSONResponse(payload_out)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Custom text analysis failed")
        raise HTTPException(status_code=500, detail="Text analysis failed due to an internal error.")


if __name__ == "__main__":
    import uvicorn
    # Deployment platforms (Render, Railway, Heroku, etc.) inject the port via
    # the PORT env var. Fall back to 8000 for local runs.
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"🚀 Starting Multimodal Sentiment Analysis API v{API_VERSION} ...")
    print(f"📍 http://{host}:{port}  |  Docs: http://{host}:{port}/docs")
    uvicorn.run(app, host=host, port=port, log_level="info")
