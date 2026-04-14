<p align="center">
  <img src="frontend/src/assets/TriSenti logo.png" alt="TriSenti AI Logo" width="120" />
</p>

<h1 align="center">🧠 TriSenti AI — Multimodal Sentiment Analysis</h1>

<p align="center">
  <strong>Analyze emotions from Video, Audio & Text using deep learning</strong><br/>
  Built with React · FastAPI · TensorFlow · HuggingFace Transformers
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/TensorFlow-2.x-ff6f00?logo=tensorflow&logoColor=white" />
  <img src="https://img.shields.io/badge/HuggingFace-RoBERTa-ffd21e?logo=huggingface&logoColor=black" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## 🎯 What is TriSenti AI?

TriSenti AI is an end-to-end **multimodal sentiment analysis platform** that predicts whether the emotion in a piece of content is **Positive**, **Negative**, or **Neutral**. It does this by analyzing **three modalities simultaneously**:

| Modality | How it works | Tech Used |
|----------|-------------|-----------|
| 🎬 **Video** | Extracts visual features from video frames | ResNet18 (CNN) |
| 🎵 **Audio** | Extracts acoustic features from the audio track | MFCC Features |
| 📝 **Text** | Understands meaning from transcribed speech | DistilBERT Embeddings |

These features are **fused together** (early fusion) and passed through a dense neural network to produce a final sentiment prediction.

---

## ⚡ Dual Engine — Choose Your Model

> **NEW!** Users can now choose between two analysis engines before running prediction.

| Engine | Description | Best For |
|--------|-------------|----------|
| 🧠 **TriSenti Custom Model** | ResNet18 + MFCC + DistilBERT fusion model trained on CMU-MOSI | Full multimodal analysis (video + audio + text) |
| ⚡ **RoBERTa (HuggingFace)** | `cardiffnlp/twitter-roberta-base-sentiment-latest` — trained on 124M tweets | Fast & highly accurate text-based sentiment |

After uploading content or typing text, a **"Choose Analysis Engine"** panel appears with two selectable cards. Pick your engine and hit Analyze — the result shows which engine was used with a colored badge.

---

## ✨ Key Features

- 🎥 **Video Analysis** — Upload MP4, MOV, AVI, MKV files
- 🎵 **Audio Analysis** — Upload MP3, WAV, M4A, OGG files
- 📝 **Text Analysis** — Type or paste text directly
- 🔀 **Dual Engine Selection** — Switch between Custom Model and HuggingFace RoBERTa
- 💬 **Automatic Transcription** — Speech-to-text via Google Speech Recognition
- 📊 **Multimodal Breakdown** — See individual Video / Audio / Text contribution scores
- 🏷️ **Engine Badge** — Results clearly show which model produced the prediction
- 📋 **Analysis History** — Review past analyses in the session
- 🎨 **Modern UI** — Dark-mode glassmorphism design with smooth animations

---

## 📂 Project Structure

```
Multimodal Sentiment Analysis by Shashank/
│
├── 🖥️  frontend/                         # React + TypeScript (Vite) frontend
│   ├── src/
│   │   ├── App.tsx                       # Main app with dual-engine routing
│   │   ├── components/
│   │   │   ├── MultimodalInput.tsx       # File upload + model selector cards
│   │   │   ├── SentimentResult.tsx       # Result display with engine badge
│   │   │   ├── ResultAfterTick.tsx       # Animated result reveal
│   │   │   ├── ProgressStepper.tsx       # Step-by-step analysis progress
│   │   │   ├── HistoryList.tsx           # Analysis history sidebar
│   │   │   ├── InputPreview.tsx          # Live preview of uploaded content
│   │   │   ├── AnimatedBackground.tsx    # Particle background
│   │   │   └── ...                       # HowItWorks, UseCases, Footer
│   │   └── index.css                     # Global styles
│   └── package.json
│
├── ⚙️  api/
│   └── main.py                           # FastAPI server (dual engine endpoints)
│
├── 🔧 preprocessing/
│   ├── extract_audio.py                  # FFmpeg audio extraction
│   ├── extract_all_audio_features.py     # MFCC feature extraction
│   ├── extract_all_video_features.py     # ResNet18 video features
│   ├── extract_all_text_features.py      # DistilBERT text embeddings
│   └── transcribe_audio.py              # Google Speech Recognition
│
├── 🧪 models/
│   ├── final_multimodal_logits_model.h5  # Trained fusion model weights
│   ├── multimodal_model.py               # Model architecture & training
│   ├── label_encoder.pkl                 # Label encoder
│   ├── scaler_audio.pkl                  # Audio feature scaler
│   ├── scaler_text.pkl                   # Text feature scaler
│   └── scaler_video.pkl                  # Video feature scaler
│
├── 📁 training/
│   └── evaluate_model.py                 # Model evaluation script
│
├── 📁 data/
│   ├── mini_dataset/                     # CMU-MOSI segmented clips
│   └── processed_dataset.csv            # Processed annotations
│
├── run_backend.ps1                       # ✅ Recommended backend start script
├── START_BACKEND.bat                     # Windows BAT alternative
├── START_FRONTEND.bat                    # Frontend start script
├── requirements.txt                      # Python dependencies
└── INTEGRATION_GUIDE.md                  # Detailed integration docs
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10 | Backend & ML models |
| Node.js | v18+ | Frontend dev server |
| FFmpeg | Latest | Audio/video processing |

> **FFmpeg Install:**
> - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html), add `bin/` to PATH
> - Linux: `sudo apt install ffmpeg`
> - macOS: `brew install ffmpeg`

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/shashankpc7746/Multimodal-Sentiment-Analysis-by-Shashank.git
cd Multimodal-Sentiment-Analysis-by-Shashank
```

**2. Set up Python environment**
```bash
python -m venv multimodal_env
multimodal_env\Scripts\activate    # Windows
pip install -r requirements.txt
```

**3. Install frontend dependencies**
```bash
cd frontend
npm install
cd ..
```

---

### ▶️ Run the Backend (Port 8000)

```powershell
.\run_backend.ps1
```

Or manually:
```powershell
cd api
$env:PYTHONPATH = "<project-path>\multimodal_env\Lib\site-packages;<project-path>"
py -3.10 -m uvicorn main:app --reload --port 8000
```

You should see:
```
✅ Custom fusion model loaded successfully
✅ HuggingFace RoBERTa pipeline loaded successfully
INFO:     Application startup complete.
```

### ▶️ Run the Frontend (Port 3000)

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3000** in your browser 🎉

---

## 📡 API Endpoints

### `POST /api/analyze`
Analyze video/audio using the **Custom Fusion Model**.

```bash
curl -X POST -F "file=@video.mp4" http://localhost:8000/api/analyze
```

### `POST /api/analyze-hf`
Analyze video/audio using **HuggingFace RoBERTa** (transcribes → classifies text).

```bash
curl -X POST -F "file=@audio.wav" http://localhost:8000/api/analyze-hf
```

### `POST /api/analyze-text`
Analyze raw text input. Supports both engines via `model_engine` param.

```bash
# Custom model
curl -X POST "http://localhost:8000/api/analyze-text?text=I+love+this&model_engine=custom"

# HuggingFace RoBERTa
curl -X POST "http://localhost:8000/api/analyze-text?text=I+love+this&model_engine=hf"
```

### Response Format

```json
{
  "success": true,
  "sentiment": "Positive",
  "confidence": 0.978,
  "transcript": "I love this project so much!",
  "engine": "huggingface",
  "probabilities": {
    "Positive": 0.978,
    "Negative": 0.011,
    "Neutral": 0.011
  },
  "breakdown": {
    "video": 0.0,
    "audio": 0.33,
    "text": 0.67
  }
}
```

> 📖 Interactive API docs available at **http://localhost:8000/docs**

---

## 📈 Model Performance

### Custom Fusion Model (CMU-MOSI)

Trained on 400 clips from the CMU-MOSI mini dataset:

| Metric | Value |
|--------|-------|
| Test Accuracy | **76.25%** |
| Positive F1 | 0.83 |
| Negative F1 | 0.71 |
| Neutral F1 | 0.44 |

### HuggingFace RoBERTa

Pre-trained on ~124 million tweets by Cardiff NLP:

| Metric | Value |
|--------|-------|
| Model | `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| Approach | Text classification (transcribed speech) |
| Typical Confidence | **95–99%** on clear text |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│        (Vite + TypeScript + Tailwind CSS)            │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │  Upload   │ │  Model   │ │  Sentiment Result │   │
│  │  Input    │ │ Selector │ │  + Engine Badge   │   │
│  └────┬─────┘ └────┬─────┘ └───────────────────┘   │
│       │             │                                │
└───────┼─────────────┼────────────────────────────────┘
        │             │
        ▼             ▼
┌─────────────────────────────────────────────────────┐
│               FastAPI Backend (:8000)                 │
│                                                       │
│  ┌─────────────┐        ┌──────────────────────┐    │
│  │ /api/analyze │        │  /api/analyze-hf     │    │
│  │ Custom Model │        │  HuggingFace RoBERTa │    │
│  └──────┬──────┘        └──────────┬───────────┘    │
│         │                          │                  │
│  ┌──────▼──────────────────────────▼───────────┐    │
│  │         Preprocessing Pipeline               │    │
│  │  FFmpeg → MFCC + ResNet18 + Transcription   │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │              ML Models                         │  │
│  │  TensorFlow (.h5)  │  HuggingFace Pipeline    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't start | Check that all `.pkl` and `.h5` files exist in `models/` |
| Unicode/emoji crash on Windows | The `api/main.py` auto-fixes this with UTF-8 reconfiguration |
| Frontend can't connect | Ensure backend is running on port `8000`; check CORS in browser console |
| Transcription fails | Requires internet — uses Google Speech Recognition API |
| HuggingFace model slow first time | First run downloads ~500MB model weights; subsequent runs use cache |
| `npm run dev` not found | Install Node.js from [nodejs.org](https://nodejs.org) |

---

## 👨‍💻 Author

**Shashank Gupta** — [@shashankpc7746](https://github.com/shashankpc7746)

---

<p align="center">
  <sub>Built with ❤️ using Python, React, TensorFlow & HuggingFace Transformers</sub>
</p>
