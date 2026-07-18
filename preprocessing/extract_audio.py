# preprocessing/extract_audio.py
"""
Audio extraction / conversion via ffmpeg.

Converts any video or audio container to 16 kHz mono WAV — the format every
downstream consumer (Whisper, MFCC/librosa) expects. Uses the system ffmpeg
when available, otherwise the binary bundled with imageio-ffmpeg.
"""

import logging
import os
import shutil
import subprocess

logger = logging.getLogger(__name__)

FFMPEG_TIMEOUT_SECONDS = 300  # hard cap so a corrupt file can't hang a worker


def get_ffmpeg_exe():
    """Return a usable ffmpeg executable path, or None if none is available."""
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        logger.error("No ffmpeg found on PATH and imageio-ffmpeg is not installed.")
        return None


def convert_to_wav(input_path, output_path, sample_rate=16000):
    """
    Convert any audio/video file to mono WAV at the given sample rate.
    Returns True on success, False on failure.
    """
    if not os.path.exists(input_path):
        logger.error("Input file not found: '%s'", input_path)
        return False

    ffmpeg = get_ffmpeg_exe()
    if not ffmpeg:
        return False

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-vn",                      # drop video stream
        "-acodec", "pcm_s16le",
        "-ar", str(sample_rate),
        "-ac", "1",
        output_path,
    ]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_SECONDS
        )
        if proc.returncode != 0:
            stderr_tail = proc.stderr.decode(errors="replace")[-500:]
            logger.error("ffmpeg failed for '%s': %s", input_path, stderr_tail)
            return False
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            logger.error("ffmpeg produced no output for '%s' (no audio track?)", input_path)
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out after %ss for '%s'", FFMPEG_TIMEOUT_SECONDS, input_path)
        return False
    except Exception:
        logger.exception("Unexpected error running ffmpeg for '%s'", input_path)
        return False


def extract_audio(video_input_path, audio_output_path):
    """
    Extract the audio track from a video file as 16 kHz mono WAV.
    Returns True on success, False on failure. (Kept for backward compatibility;
    convert_to_wav handles audio inputs too.)
    """
    return convert_to_wav(video_input_path, audio_output_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    test_video_path = os.path.join("data", "raw_video_clips", "sample_video.mp4")
    test_audio_output_path = os.path.join("data", "processed_audio", "sample_audio.wav")

    if os.path.exists(test_video_path):
        print(f"--- Test: extracting audio from '{test_video_path}' ---")
        ok = extract_audio(test_video_path, test_audio_output_path)
        print("--- Test:", "success ---" if ok else "failed ---")
    else:
        print(f"--- Test skipped: '{test_video_path}' not found ---")
