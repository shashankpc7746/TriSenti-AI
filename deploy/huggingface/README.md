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

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/`                | Health / engine status |
| GET  | `/api/health`      | Detailed model load status |
| POST | `/api/analyze`     | Custom model — video/audio upload |
| POST | `/api/analyze-hf`  | RoBERTa — video/audio upload (transcribe → classify) |
| POST | `/api/analyze-text`| Text, `?text=...&model_engine=custom|hf` |

Interactive docs at `/docs`.

## Configuration (Space → Settings → Variables and secrets)

| Variable | Purpose |
|----------|---------|
| `CORS_ALLOW_ORIGINS` | Comma-separated allowed origins (your Vercel URL) |
| `EAGER_LOAD_HF` | Set to `1` to load RoBERTa at startup instead of warming in background |

> This Space is built from the Dockerfile at the repo root.
