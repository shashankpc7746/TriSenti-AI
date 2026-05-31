# ─────────────────────────────────────────────────────────────────────────────
# TriSenti AI — backend (FastAPI) container
#
# Targets Hugging Face Spaces (Docker SDK), which:
#   • routes public traffic to port 7860
#   • runs the container as a non-root user (uid 1000)
#   • requires all writable paths to be under a dir that user owns
#
# It also works on any other container host (Render, Railway, Fly, local):
# the server binds to ${PORT:-7860}.
#
# Build:  docker build -t trisenti-api .
# Run:    docker run -p 7860:7860 -e CORS_ALLOW_ORIGINS="https://your-frontend" trisenti-api
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.10-slim

# System deps: ffmpeg for moviepy/audio conversion; libgl/libglib for opencv.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root user (matches HF Spaces' uid 1000 convention).
RUN useradd -m -u 1000 appuser

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/appuser \
    HF_HOME=/home/appuser/.cache/huggingface \
    PYTHONPATH=/app \
    PORT=7860

WORKDIR /app

# Install Python deps first (better layer caching). Torch CPU wheels come from
# the dedicated CPU index to avoid pulling huge CUDA packages.
COPY --chown=appuser:appuser requirements-backend.txt .
RUN pip install --upgrade pip && \
    pip install --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements-backend.txt

# Copy only what the backend needs at runtime.
COPY --chown=appuser:appuser api/ ./api/
COPY --chown=appuser:appuser preprocessing/ ./preprocessing/
COPY --chown=appuser:appuser models/ ./models/

USER appuser

EXPOSE 7860

# Honour the platform-injected PORT (HF Spaces sets 7860); default to 7860.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860} --app-dir api"]
