# Deployment Guide

TriSenti AI deploys as two pieces:

| Part | Platform | URL shape |
|------|----------|-----------|
| Backend (FastAPI + models) | **Hugging Face Spaces** (Docker) | `https://<user>-trisenti-ai-backend.hf.space` |
| Frontend (React/Vite) | **Vercel** (static site) | `https://<project>.vercel.app` |

Deploy the **backend first** so you know its URL, then point the frontend at it.

---

## Part 1 — Backend on Hugging Face Spaces

The backend is containerised via the `Dockerfile` at the repo root. It listens on
port **7860** (the HF Spaces convention) and reads two env vars:

- `CORS_ALLOW_ORIGINS` — comma-separated allowed origins (your Vercel URL)
- `EAGER_LOAD_HF` — optional; `1` loads RoBERTa at startup instead of in the background

### Option A — create the Space via the website (simplest)

1. Go to https://huggingface.co/new-space
2. **Owner**: your account · **Space name**: `trisenti-ai-backend`
3. **SDK**: select **Docker** → **Blank**
4. **Hardware**: `CPU basic` (free tier, 16 GB RAM — enough for TF + RoBERTa)
5. Create the Space. It starts empty with its own git repo.
6. Push the backend files into the Space repo (see **"Pushing files"** below).

### Option B — push from your machine with the CLI

```bash
pip install -U "huggingface_hub[cli]"
huggingface-cli login            # paste a token from https://huggingface.co/settings/tokens
huggingface-cli repo create trisenti-ai-backend --type space --space_sdk docker
```

### Pushing files to the Space

The Space needs these files at **its** repo root:

```
Dockerfile
requirements-backend.txt
README.md                 ← use deploy/huggingface/README.md (has the Spaces frontmatter)
api/
preprocessing/
models/
```

> ⚠️ HF Spaces reads its config from the **frontmatter** at the top of the Space's
> `README.md`. Use the one in `deploy/huggingface/README.md` — do **not** copy this
> repo's main README (it has no frontmatter and would fail to configure the Space).

Quickest path — clone the Space repo and copy files in:

```bash
git clone https://huggingface.co/spaces/<user>/trisenti-ai-backend
cd trisenti-ai-backend

# from your TriSenti-AI checkout, copy the needed files:
cp ../TriSenti-AI/Dockerfile .
cp ../TriSenti-AI/requirements-backend.txt .
cp ../TriSenti-AI/deploy/huggingface/README.md ./README.md
cp -r ../TriSenti-AI/api ./api
cp -r ../TriSenti-AI/preprocessing ./preprocessing
cp -r ../TriSenti-AI/models ./models

git add .
git commit -m "Deploy TriSenti backend"
git push
```

The Space will build the Docker image (first build ~10-15 min — it installs TF +
Torch). Watch the **Logs** tab. When you see `Application startup complete`, hit:

```
https://<user>-trisenti-ai-backend.hf.space/api/health
```

### Set the backend env vars

Space → **Settings** → **Variables and secrets** → add:

```
CORS_ALLOW_ORIGINS = https://<your-vercel-project>.vercel.app
```

(You can add this after the frontend is deployed and you know its URL. You can
list multiple origins comma-separated, e.g. your `.vercel.app` URL plus a custom domain.)

---

## Part 2 — Frontend on Vercel

1. Go to https://vercel.com/new and import the GitHub repo `shashankpc7746/TriSenti-AI`.
2. **Root Directory**: set to `frontend` (important — the app lives in a subfolder).
3. Framework preset auto-detects **Vite**. The included `frontend/vercel.json`
   sets the build command, output dir (`build`), and SPA rewrites.
4. **Environment Variables** → add:

   ```
   VITE_API_URL = https://<user>-trisenti-ai-backend.hf.space
   ```

   (no trailing slash — the backend Space URL from Part 1)
5. **Deploy**. Vercel builds and serves the site at `https://<project>.vercel.app`.

### After both are live

1. Copy your Vercel URL → add it to the Space's `CORS_ALLOW_ORIGINS` (Part 1).
2. Reload the frontend. The header badge should read **API Online**.
3. Test a text analysis with the default RoBERTa engine.

---

## Local development (unchanged)

```powershell
# Backend
.\run_backend.ps1

# Frontend (uses http://localhost:8000 by default)
cd frontend; npm run dev
```

To point a local frontend at a deployed backend, create `frontend/.env.local`:

```
VITE_API_URL=https://<user>-trisenti-ai-backend.hf.space
```

---

## Notes & gotchas

- **First request after idle**: free Spaces sleep when unused; the next request
  wakes the container (a few seconds) plus the RoBERTa warm-up. Subsequent calls are fast.
- **Transcription needs internet**: video/audio transcription uses Google Speech
  Recognition, which the Space reaches over its normal outbound network.
- **Model size**: model artifacts are ~4 MB total and commit normally (no git-LFS).
- **CORS errors in the browser console**: almost always mean `CORS_ALLOW_ORIGINS`
  on the Space doesn't exactly match the frontend origin (scheme + host, no path).
