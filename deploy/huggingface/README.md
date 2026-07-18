---
title: TriSenti AI Backend
emoji: 🧠
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Multimodal sentiment analysis API (FastAPI + RoBERTa)
---

# TriSenti AI — Backend API

FastAPI backend for [TriSenti AI](https://github.com/shashankpc7746/TriSenti-AI),
a multimodal sentiment analysis platform. Serves two engines:

- **RoBERTa (HuggingFace)** — `cardiffnlp/twitter-roberta-base-sentiment-latest`
- **TriSenti custom fusion model** — ResNet18 + MFCC + DistilBERT (CMU-MOSI)

Speech-to-text is **multilingual** (faster-whisper): the spoken language is
auto-detected (99 languages, incl. Hindi, Marathi, Tamil...), transcribed
natively, and translated to English for sentiment analysis.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/`                | Health / engine status |
| GET  | `/api/health`      | Detailed model load status |
| POST | `/api/analyze`     | Custom model — video/audio upload |
| POST | `/api/analyze-hf`  | RoBERTa — video/audio upload (transcribe → classify) |
| POST | `/api/analyze-text`| JSON body `{"text": "...", "model_engine": "custom"\|"hf"}` |

Interactive docs at `/docs`.

## Configuration (Space → Settings → Variables and secrets)

| Variable | Purpose |
|----------|---------|
| `CORS_ALLOW_ORIGINS` | Comma-separated allowed origins (your Vercel URL) |
| `EAGER_LOAD_HF` | Set to `1` to load RoBERTa/Whisper at startup instead of warming in background |
| `WHISPER_MODEL` | Whisper size: `tiny` / `base` / `small` (default) / `medium` |
| `WHISPER_BEAM_SIZE` | Beam width for decoding (default `1` = fastest) |
| `VIDEO_MAX_FRAMES` | Frames sampled per video for the custom engine (default `32`) |

> This Space is built from the Dockerfile at the repo root.
