# TriSenti AI — Frontend/Backend Integration

> Part of **TriSenti AI v1.0**. For deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 🎉 Setup Complete!

Your frontend is now connected to a real Python backend that performs actual sentiment analysis.

## 🚀 How to Run

### 1. Start the Backend API (Port 8000)

Open a **new terminal** and run:

```powershell
cd "d:\SHASHANK\Vs-code\TriSenti-AI\api"
$env:PYTHONPATH = "d:\SHASHANK\Vs-code\TriSenti-AI\multimodal_env\Lib\site-packages;d:\SHASHANK\Vs-code\TriSenti-AI"
py -3.10 -m uvicorn main:app --reload --port 8000
```

> Tip: prefer `.\run_backend.ps1` from the project root — it resolves paths automatically and works regardless of the folder name.

You should see:

```
✅ Models loaded successfully
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 2. Start the React Frontend (Port 3000)

In another terminal (or use the existing one):

```powershell
cd "d:\SHASHANK\Vs-code\TriSenti-AI\frontend"
npm run dev
```

### 3. Open in Browser

- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs

## 🔧 What Changed

### Backend — Dual Engine

- `api/main.py` — FastAPI server with **three** endpoints:
  - `POST /api/analyze` — Custom fusion model (video + audio + text)
  - `POST /api/analyze-hf` — HuggingFace RoBERTa (transcribe → classify)
  - `POST /api/analyze-text` — Text-only, both engines (JSON body)
- Loads two models on startup: TensorFlow custom model + HuggingFace pipeline
- CORS enabled for React frontend

### Frontend — Model Selector UI

- `MultimodalInput.tsx` — "Choose Analysis Engine" card selector
- `SentimentResult.tsx` — Engine badge showing which model produced the result
- `App.tsx` — Routes to correct backend endpoint based on selection

## 🎯 What You'll Get

When you upload content:

1. **Choose your engine** — Custom Model or HuggingFace RoBERTa
2. **Real transcription** from actual audio (Whisper — multilingual, auto
   language detection, with English translation for non-English speech)
3. **Real sentiment prediction** with confidence scores
4. **Engine badge** showing which model produced the result
5. **Multimodal breakdown** showing video/audio/text contributions

## 📝 API Endpoints

### POST /api/analyze

Analyzes video/audio files

**Request**: `multipart/form-data` with file
**Response**:

```json
{
  "success": true,
  "sentiment": "Positive",
  "confidence": 0.89,
  "transcript": "Hello everyone! I'm excited to share...",
  "language": "en",
  "language_name": "English",
  "language_probability": 0.97,
  "translation": null,
  "transcription_engine": "whisper",
  "probabilities": {
    "Positive": 0.89,
    "Negative": 0.05,
    "Neutral": 0.06
  },
  "breakdown": {
    "video": 0.35,
    "audio": 0.38,
    "text": 0.27
  }
}
```

### POST /api/analyze-hf

Analyzes video/audio using HuggingFace RoBERTa (transcribes then classifies).

**Request**: `multipart/form-data` with file  
**Response**: Same format, `"engine": "huggingface"`

### POST /api/analyze-text

Analyzes text input with either engine.

**Body (JSON)**: `{"text": "...", "model_engine": "custom"|"hf"}`
(legacy query params `?text=...&model_engine=...` still accepted)
**Response**: Same format

## ✅ Dependencies Installed

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
python-multipart==0.0.20
```

## 🐛 Troubleshooting

**Backend won't start?**

- Make sure port 8000 is free
- Check if all models exist in `models/` folder
- Verify virtual environment is activated

**Frontend can't connect?**

- Check backend is running on http://localhost:8000
- Check browser console for CORS errors
- Verify both servers are running

**Transcription not working?**

- Whisper runs locally — no internet needed after the model downloads once
- Audio must have clear speech
- Video must have audio track

## 🎬 Ready to Test!

1. Upload a video, audio file, or type text
2. Select your analysis engine (Custom Model or RoBERTa)
3. Watch real-time progress
4. See transcription + sentiment result with engine badge
