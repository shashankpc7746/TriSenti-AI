<p align="center">
  <img src="frontend/src/assets/TriSenti logo.png" alt="TriSenti AI Logo" width="130" />
</p>

<h1 align="center">🧠 TriSenti AI</h1>

<p align="center">
  <strong>Multimodal Sentiment Analysis — read emotion from Video, Audio &amp; Text</strong><br/>
  <em>React · FastAPI · TensorFlow · HuggingFace Transformers</em>
</p>

<p align="center">
  <a href="https://tri-senti-ai.vercel.app"><img src="https://img.shields.io/badge/🚀_Live_Demo-tri--senti--ai.vercel.app-7c3aed?style=for-the-badge" alt="Live Demo" /></a>
  <a href="https://huggingface.co/spaces/Shashank7746/trisenti-ai-backend"><img src="https://img.shields.io/badge/🤗_Backend_API-HuggingFace_Space-ffd21e?style=for-the-badge&logoColor=black" alt="Backend API" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-success" />
  <img src="https://img.shields.io/badge/Whisper-99_languages-8A2BE2" />
  <img src="https://img.shields.io/badge/Python-3.10-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/TensorFlow-2.11-ff6f00?logo=tensorflow&logoColor=white" />
  <img src="https://img.shields.io/badge/HuggingFace-RoBERTa-ffd21e?logo=huggingface&logoColor=black" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

<p align="center">
  <a href="#-try-it-live">Try it</a> ·
  <a href="#-what-is-trisenti-ai">About</a> ·
  <a href="#-dual-engine">Engines</a> ·
  <a href="#-features">Features</a> ·
  <a href="#️-run-locally">Run locally</a> ·
  <a href="#-api-reference">API</a> ·
  <a href="#-deployment">Deploy</a>
</p>

---

## 🎬 Try It Live

> **No install needed** — open the app and analyze text, audio, or video right in your browser.

### 👉 **[tri-senti-ai.vercel.app](https://tri-senti-ai.vercel.app)**

```
1. Type some text  →  "I'm so happy it finally rained in Mumbai!"
2. Keep RoBERTa selected (the recommended engine)
3. Hit Analyze  →  Positive · 98% confidence ✅
```

> ⏳ **First request may take a few seconds** — the free Hugging Face backend
> sleeps after inactivity and wakes on the first call. Subsequent calls are instant.

---

## 🎯 What is TriSenti AI?

TriSenti AI is an end-to-end **multimodal sentiment analysis platform** that predicts whether a piece of content is **Positive**, **Negative**, or **Neutral** — by analyzing up to **three modalities at once**:

| Modality | How it works | Tech |
|----------|-------------|------|
| 🎬 **Video** | Visual features from frames | ResNet18 (CNN) |
| 🎵 **Audio** | Acoustic features from the audio track | MFCC |
| 📝 **Text** | Meaning from (transcribed) speech | DistilBERT / RoBERTa |

For video & audio, speech is auto-transcribed with **Whisper**, features from each
modality are **fused** (early fusion), and a dense network produces the final prediction.

### 🌍 Multilingual speech (new in v1.1)

Speech-to-text now runs on **Whisper (faster-whisper)** with automatic language
detection across **99 languages** — Hindi, Marathi, Tamil, Telugu, Spanish,
Japanese, and more. Upload a video in any language and TriSenti will:

1. **Detect** the spoken language (e.g. `Marathi · 92%`)
2. **Transcribe** it natively (e.g. `मला हा चित्रपट खूप आवडला...`)
3. **Translate** it to English (shown in the UI)
4. **Analyze sentiment** on the English text with your chosen engine

---

## ⚡ Dual Engine

Pick your engine before analyzing — the result is badged with the one that produced it.

| Engine | What it is | Best for |
|--------|-----------|----------|
| ⚡ **RoBERTa (HuggingFace)** ⭐ _default_ | `cardiffnlp/twitter-roberta-base-sentiment-latest`, trained on 124M tweets | Fast, highly accurate text sentiment |
| 🧠 **TriSenti Custom Model** | ResNet18 + MFCC + DistilBERT early-fusion, trained on CMU-MOSI | Full multimodal (video + audio + text) experiments |

---

## ✨ Features

- 🎥 **Video analysis** — MP4, MOV, AVI, MKV, WebM
- 🎵 **Audio analysis** — MP3, WAV, M4A, OGG, FLAC
- 📝 **Text analysis** — type or paste directly
- 🔀 **Dual-engine selector** — RoBERTa or the custom fusion model
- 🌍 **Multilingual transcription** — Whisper auto-detects 99 languages and translates to English
- 💬 **Auto transcription** — native transcript + detected language + translation shown in the UI
- 📊 **Modality breakdown** — see video / audio / text contributions
- 🏷️ **Engine badge** — every result shows which model produced it
- 📋 **Session history** — revisit past analyses
- 🎨 **Modern UI** — dark glassmorphism with smooth motion
- ☁️ **Live & auto-deployed** — push to `main`, both halves redeploy themselves

---

## 🖼️ How It Works

```
   ┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────┐
   │  Upload  │ ──▶ │  AI Processing │ ──▶ │   Fusion /   │ ──▶ │  Result  │
   │ video /  │     │ extract video, │     │  classify    │     │ sentiment│
   │ audio /  │     │ audio, text    │     │  (chosen     │     │  + scores│
   │  text    │     │ features       │     │   engine)    │     │ + badge  │
   └──────────┘     └───────────────┘     └──────────────┘     └──────────┘
```

---

## 🛠️ Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind · Framer Motion |
| **Backend** | FastAPI · Uvicorn · Python 3.10 |
| **ML** | TensorFlow 2.11 · PyTorch · HuggingFace Transformers · scikit-learn · librosa · OpenCV |
| **Speech** | faster-whisper (Whisper · CTranslate2) — multilingual STT + translation |
| **Media** | FFmpeg |
| **Deploy** | Vercel (frontend) · Hugging Face Spaces / Docker (backend) · GitHub Actions (CI) |

---

## 📂 Project Structure

```
TriSenti-AI/
├── frontend/                       # React + TypeScript (Vite)
│   ├── src/
│   │   ├── App.tsx                 # Main app + dual-engine routing
│   │   ├── config.ts               # API URL from VITE_API_URL env
│   │   ├── components/             # MultimodalInput, SentimentResult, …
│   │   └── index.css               # Global styles
│   ├── vercel.json                 # Vercel build config
│   └── package.json
│
├── api/
│   └── main.py                     # FastAPI server (dual-engine, env-driven CORS/port)
│
├── preprocessing/                  # Feature extraction + transcription
│   ├── extract_audio.py            #   FFmpeg audio extraction
│   ├── extract_all_audio_features.py   # MFCC
│   ├── extract_all_video_features.py   # ResNet18
│   ├── extract_all_text_features.py    # DistilBERT
│   └── transcribe_audio.py             # Whisper multilingual STT + translation
│
├── models/                         # Trained artifacts (.h5 + scalers + encoder)
├── training/
│   ├── train_model.py              # Retraining w/ modality-dropout augmentation
│   └── evaluate_model.py
├── data/mini_dataset/              # CMU-MOSI segmented clips
│
├── Dockerfile                      # Backend container (HF Spaces / any host)
├── requirements-backend.txt        # Focused backend runtime deps
├── run_backend.ps1                 # Local backend start script
├── .github/workflows/deploy-hf.yml # Auto-sync backend → HF Space
├── DEPLOYMENT.md                   # Full deployment guide
└── README.md
```

---

## ▶️ Run Locally

### Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Python | 3.10 | Backend & ML |
| Node.js | 18+ | Frontend |
| FFmpeg | latest | Audio/video processing |

> **FFmpeg:** Windows → [ffmpeg.org](https://ffmpeg.org/download.html) (add `bin/` to PATH) · Linux → `sudo apt install ffmpeg` · macOS → `brew install ffmpeg`

### 1. Clone

```bash
git clone https://github.com/shashankpc7746/TriSenti-AI.git
cd TriSenti-AI
```

### 2. Backend

```bash
python -m venv multimodal_env
multimodal_env\Scripts\activate        # Windows
pip install -r requirements.txt
```

```powershell
.\run_backend.ps1
```

The custom model loads at startup (~20-30s); **RoBERTa warms up in the background**.
Flags: `.\run_backend.ps1 -Reload` (hot-reload) · `$env:EAGER_LOAD_HF="1"` (preload RoBERTa).

You should see:
```
✅ Custom fusion model loaded successfully
✅ HuggingFace RoBERTa pipeline loaded successfully
INFO:     Application startup complete.
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** 🎉 (it talks to `http://localhost:8000` by default).

> To point the local frontend at a deployed backend, create `frontend/.env.local`
> with `VITE_API_URL=https://<your-space>.hf.space`.

---

## 📡 API Reference

Base URL (local): `http://localhost:8000` · Live: the Hugging Face Space URL · Docs: `/docs`

### `POST /api/analyze` — custom fusion model (video/audio)
```bash
curl -X POST -F "file=@video.mp4" http://localhost:8000/api/analyze
```

### `POST /api/analyze-hf` — RoBERTa (transcribe → classify)
```bash
curl -X POST -F "file=@audio.wav" http://localhost:8000/api/analyze-hf
```

### `POST /api/analyze-text` — text, either engine
```bash
curl -X POST http://localhost:8000/api/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this", "model_engine": "hf"}'
```
(Legacy `?text=...&model_engine=...` query parameters are still accepted.)

### `GET /api/health` — model load status (custom model, RoBERTa, Whisper)

<details>
<summary><strong>Sample response (Marathi video, RoBERTa engine)</strong></summary>

```json
{
  "success": true,
  "sentiment": "Positive",
  "confidence": 0.974,
  "transcript": "मला हा चित्रपट खूप आवडला तो अप्रतिम होता",
  "language": "mr",
  "language_name": "Marathi",
  "language_probability": 0.92,
  "translation": "I loved this movie a lot. It was amazing.",
  "transcription_engine": "whisper",
  "engine": "huggingface",
  "probabilities": { "Positive": 0.974, "Negative": 0.006, "Neutral": 0.020 },
  "breakdown": { "video": 0.0, "audio": 0.33, "text": 0.67 }
}
```
</details>

---

## 📈 Model Performance

### Custom Fusion Model (CMU-MOSI)

Trained on 400 clips with **modality-dropout augmentation** — the model sees every
modality combination it will meet at inference (full, text-only, audio-only,
video-only, audio+video), which fixed a large accuracy drop on single-modality inputs.

| Scenario | Accuracy |
|----------|----------|
| Full multimodal (video+audio+text) | **78.8%** |
| Text-only | **67.5%** |
| Video-only | 60.0% |
| Audio+Video (no speech) | 58.8% |
| Audio-only | 56.3% |

> **Note on Neutral:** the mini dataset has only 18 Neutral clips out of 400, so
> Neutral is effectively unlearnable (F1 ≈ 0). This is a dataset limitation, not a
> tuning issue — for reliable sentiment, prefer the RoBERTa engine.

### RoBERTa (HuggingFace)

| Metric | Value |
|--------|-------|
| Model | `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| Training data | ~124M tweets (Cardiff NLP) |
| Typical confidence | **95–99%** on clear text |

---

## ☁️ Deployment

TriSenti AI runs as two auto-deploying halves:

| Part | Platform | Deploys on `git push` |
|------|----------|------------------------|
| **Frontend** | [Vercel](https://tri-senti-ai.vercel.app) | Vercel watches GitHub natively |
| **Backend** | [Hugging Face Space](https://huggingface.co/spaces/Shashank7746/trisenti-ai-backend) (Docker) | A GitHub Action mirrors backend files to the Space |

After setup, the whole workflow is just:

```bash
git push origin main
# → Vercel rebuilds the frontend
# → GitHub Action syncs the backend → the HF Space rebuilds
```

📖 **Full step-by-step in [DEPLOYMENT.md](DEPLOYMENT.md)** — including the one-time
HF Space + Vercel + GitHub-secrets setup, CORS wiring, and a manual fallback.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| Live demo shows "API Offline" | Backend Space is waking up — wait ~10-20s and retry |
| Backend won't start locally | Ensure `.pkl` + `.h5` files exist in `models/` |
| Frontend can't connect | Backend running on `:8000`? Check `VITE_API_URL` and CORS |
| CORS error in console | Add your frontend origin to the Space's `CORS_ALLOW_ORIGINS` |
| Transcription slow on long videos | Whisper runs on CPU; try shorter clips or set `WHISPER_MODEL=base` for speed |
| Wrong language detected | Rare on clear speech; noisy/short clips reduce detection confidence |
| `npm run dev` not found | Install Node.js from [nodejs.org](https://nodejs.org) |

---

## 👨‍💻 Author

**Shashank Gupta** — [@shashankpc7746](https://github.com/shashankpc7746)

<p align="center">
  <sub>Built with ❤️ using Python, React, TensorFlow &amp; HuggingFace Transformers · v1.1.0</sub>
</p>
