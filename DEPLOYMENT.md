# Deployment Guide

TriSenti AI deploys as two pieces, each watching your GitHub repo:

| Part | Platform | Auto-deploys on `git push`? | URL shape |
|------|----------|-----------------------------|-----------|
| Backend (FastAPI + models) | **Hugging Face Spaces** (Docker) | Yes — via GitHub Action | `https://<user>-<space>.hf.space` |
| Frontend (React/Vite) | **Vercel** (static site) | Yes — Vercel watches GitHub natively | `https://<project>.vercel.app` |

Once set up, your whole update workflow is just **`git push origin main`**:
- Vercel rebuilds the frontend automatically.
- The GitHub Action mirrors the backend into the HF Space, which rebuilds.

> The HF Space is a **separate git repo** from GitHub. The two never overlap.
> The GitHub Action is what keeps the Space in sync — you don't push to it by hand.

---

## One-time setup

### Step 1 — Create the HF Space (once)

1. Go to https://huggingface.co/new-space
2. **Owner**: your account · **Space name**: e.g. `trisenti-ai-backend`
3. **SDK**: **Docker** → **Blank**
4. **Hardware**: `CPU basic` (free tier, 16 GB RAM — enough for TF + RoBERTa)
5. Create it. The Space starts empty with its own git repo. You don't push to it
   manually — the GitHub Action (Step 3) does that.

### Step 2 — Create a Hugging Face write token (once)

1. https://huggingface.co/settings/tokens → **New token** → role **Write** → copy it.

### Step 3 — Add GitHub repo secrets (once)

In GitHub: repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add three:

| Secret name | Value |
|-------------|-------|
| `HF_TOKEN` | the write token from Step 2 |
| `HF_USERNAME` | your HF username (e.g. `Shashank7746`) |
| `HF_SPACE` | the Space name (e.g. `trisenti-ai-backend`) |

### Step 4 — Trigger the first backend deploy

The workflow `.github/workflows/deploy-hf.yml` runs automatically when backend
files change. To kick off the first deploy now, either push any backend change,
or run it manually: GitHub repo → **Actions** tab → **Deploy backend to Hugging
Face Space** → **Run workflow**.

Watch progress:
- GitHub **Actions** tab — the sync job (should finish in ~1 min).
- Then your HF Space → **Logs** tab — the Docker build (first build ~10-15 min,
  it installs TF + Torch). When you see `Application startup complete`, test:

```
https://<user>-<space>.hf.space/api/health
```

### Step 5 — Deploy the frontend to Vercel (once)

1. https://vercel.com/new → import the GitHub repo `shashankpc7746/TriSenti-AI`.
2. **Root Directory**: set to **`frontend`** (the app lives in a subfolder).
3. Framework auto-detects **Vite**. `frontend/vercel.json` sets build command,
   output dir (`build`), and SPA rewrites.
4. **Environment Variables** → add:

   ```
   VITE_API_URL = https://<user>-<space>.hf.space
   ```

   (your HF Space URL from Step 4, no trailing slash)
5. **Deploy**. Copy the resulting `https://<project>.vercel.app` URL.

### Step 6 — Connect them (once)

1. HF Space → **Settings** → **Variables and secrets** → **New variable**:

   ```
   CORS_ALLOW_ORIGINS = https://<project>.vercel.app
   ```

   (exact origin: scheme + host, no trailing slash; comma-separate multiple origins)
2. The Space restarts. Reload the frontend — the header badge should read
   **API Online**. Test a text analysis with the default RoBERTa engine.

---

## After setup — the everyday workflow

Just work in this project and push:

```powershell
git add .
git commit -m "your change"
git push origin main
```

- **Frontend change** → Vercel auto-rebuilds.
- **Backend change** (`api/`, `preprocessing/`, `models/`, `Dockerfile`,
  `requirements-backend.txt`) → the GitHub Action mirrors it to the Space, which
  rebuilds. No manual copying.

The Action is **path-scoped**, so frontend-only pushes don't trigger a backend
rebuild, and vice-versa.

---

## Manual fallback (no GitHub Action)

If you ever want to push to the Space by hand (e.g. Actions is down), clone the
Space as a **sibling folder** and use the helper script:

```powershell
cd d:\SHASHANK\Vs-code
git clone https://huggingface.co/spaces/<user>/<space>
cd d:\SHASHANK\Vs-code\TriSenti-AI
.\deploy\huggingface\sync_to_space.ps1 -SpacePath "d:\SHASHANK\Vs-code\<space>"
cd d:\SHASHANK\Vs-code\<space>
git add .; git commit -m "Deploy TriSenti backend"; git push
```

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
VITE_API_URL=https://<user>-<space>.hf.space
```

---

## Notes & gotchas

- **Backend env vars** (HF Space → Settings → Variables and secrets):
  - `CORS_ALLOW_ORIGINS` — comma-separated allowed origins (your Vercel URL).
  - `EAGER_LOAD_HF` — optional; `1` loads RoBERTa at startup instead of warming
    it in the background.
- **First request after idle**: free Spaces sleep when unused; the next request
  wakes the container (a few seconds) plus the RoBERTa warm-up. Then it's fast.
- **Transcription needs internet**: video/audio transcription uses Google Speech
  Recognition, reached over the Space's outbound network.
- **Model size**: artifacts are ~4 MB total and commit as plain git (no LFS).
- **CORS errors in the browser console**: almost always mean `CORS_ALLOW_ORIGINS`
  doesn't exactly match the frontend origin (scheme + host, no path).
- **The Action force-pushes** to the Space: the Space mirrors the backend subset
  of this repo, so don't hand-edit files directly in the Space — they'd be
  overwritten on the next sync. Make changes here and push.
