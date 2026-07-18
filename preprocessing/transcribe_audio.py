"""
Multilingual speech-to-text built on faster-whisper (OpenAI Whisper, CTranslate2).

- Auto-detects the spoken language (99 languages, incl. Hindi/Marathi/Tamil/...)
- Returns the transcript in the original language
- For non-English speech, also produces an English translation so downstream
  sentiment models (RoBERTa / DistilBERT — both English) get usable input.

Configuration (env vars):
  WHISPER_MODEL         model size: tiny | base | small | medium | large-v3
                        (default: small — best quality/speed trade-off on CPU)
  WHISPER_DEVICE        cpu | cuda            (default: cpu)
  WHISPER_COMPUTE_TYPE  int8 | int8_float16 | float16 | float32 (default: int8)
  WHISPER_BEAM_SIZE     beam search width     (default: 1 = greedy, fastest)

If faster-whisper is not installed (e.g. an old local env), the module falls
back to Google Web Speech via SpeechRecognition (English-only) so nothing
breaks — but multilingual support requires faster-whisper.
"""

import logging
import os
import threading

logger = logging.getLogger(__name__)

WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_BEAM_SIZE = int(os.environ.get("WHISPER_BEAM_SIZE", "1"))
# 0 lets CTranslate2 pick; default to the machine's cores (capped at 8) for
# much faster CPU decoding than the library's conservative default of 4.
WHISPER_CPU_THREADS = int(
    os.environ.get("WHISPER_CPU_THREADS", str(min(8, os.cpu_count() or 4)))
)

# Whisper's language codes → human-readable names (from the Whisper tokenizer).
LANGUAGE_NAMES = {
    "en": "English", "zh": "Chinese", "de": "German", "es": "Spanish",
    "ru": "Russian", "ko": "Korean", "fr": "French", "ja": "Japanese",
    "pt": "Portuguese", "tr": "Turkish", "pl": "Polish", "ca": "Catalan",
    "nl": "Dutch", "ar": "Arabic", "sv": "Swedish", "it": "Italian",
    "id": "Indonesian", "hi": "Hindi", "fi": "Finnish", "vi": "Vietnamese",
    "he": "Hebrew", "uk": "Ukrainian", "el": "Greek", "ms": "Malay",
    "cs": "Czech", "ro": "Romanian", "da": "Danish", "hu": "Hungarian",
    "ta": "Tamil", "no": "Norwegian", "th": "Thai", "ur": "Urdu",
    "hr": "Croatian", "bg": "Bulgarian", "lt": "Lithuanian", "la": "Latin",
    "mi": "Maori", "ml": "Malayalam", "cy": "Welsh", "sk": "Slovak",
    "te": "Telugu", "fa": "Persian", "lv": "Latvian", "bn": "Bengali",
    "sr": "Serbian", "az": "Azerbaijani", "sl": "Slovenian", "kn": "Kannada",
    "et": "Estonian", "mk": "Macedonian", "br": "Breton", "eu": "Basque",
    "is": "Icelandic", "hy": "Armenian", "ne": "Nepali", "mn": "Mongolian",
    "bs": "Bosnian", "kk": "Kazakh", "sq": "Albanian", "sw": "Swahili",
    "gl": "Galician", "mr": "Marathi", "pa": "Punjabi", "si": "Sinhala",
    "km": "Khmer", "sn": "Shona", "yo": "Yoruba", "so": "Somali",
    "af": "Afrikaans", "oc": "Occitan", "ka": "Georgian", "be": "Belarusian",
    "tg": "Tajik", "sd": "Sindhi", "gu": "Gujarati", "am": "Amharic",
    "yi": "Yiddish", "lo": "Lao", "uz": "Uzbek", "fo": "Faroese",
    "ht": "Haitian Creole", "ps": "Pashto", "tk": "Turkmen", "nn": "Nynorsk",
    "mt": "Maltese", "sa": "Sanskrit", "lb": "Luxembourgish", "my": "Myanmar",
    "bo": "Tibetan", "tl": "Tagalog", "mg": "Malagasy", "as": "Assamese",
    "tt": "Tatar", "haw": "Hawaiian", "ln": "Lingala", "ha": "Hausa",
    "ba": "Bashkir", "jw": "Javanese", "su": "Sundanese", "yue": "Cantonese",
}

_whisper_model = None
_whisper_load_failed = False
_whisper_lock = threading.Lock()


def _get_whisper_model():
    """Lazy-load the Whisper model once (thread-safe). Returns None if
    faster-whisper is unavailable so callers can fall back."""
    global _whisper_model, _whisper_load_failed
    if _whisper_model is not None or _whisper_load_failed:
        return _whisper_model
    with _whisper_lock:
        if _whisper_model is not None or _whisper_load_failed:
            return _whisper_model
        try:
            from faster_whisper import WhisperModel
            logger.info(
                "Loading Whisper model '%s' (device=%s, compute=%s)...",
                WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE,
            )
            _whisper_model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE_TYPE,
                cpu_threads=WHISPER_CPU_THREADS,
            )
            logger.info("Whisper model loaded.")
        except Exception:
            logger.exception(
                "Could not load faster-whisper — falling back to Google "
                "Web Speech (English only)."
            )
            _whisper_load_failed = True
    return _whisper_model


# Serialize Whisper passes: two concurrent CPU transcriptions thrash the
# cores and both crawl; queueing them is strictly faster overall.
_transcribe_lock = threading.Lock()


def _run_whisper(model, audio_path, task, language=None):
    """Run one Whisper pass and return (joined_text, info)."""
    with _transcribe_lock:
        segments, info = model.transcribe(
            audio_path,
            task=task,
            language=language,
            beam_size=WHISPER_BEAM_SIZE,
            vad_filter=True,  # skip silence: faster + avoids hallucinated text
            # Big CPU speed-ups with negligible quality cost for sentiment use:
            # not conditioning on previous text prevents the slow repetition
            # loops Whisper falls into on non-English speech, and skipping
            # timestamp tokens shrinks the decode length.
            condition_on_previous_text=False,
            without_timestamps=True,
            # Single decode per chunk. The default temperature ladder retries
            # low-confidence chunks up to 6x, which makes noisy real-world
            # recordings take 5-10x longer on CPU for marginal quality gain.
            temperature=0.0,
        )
        # segments is a lazy generator — the actual decoding happens here,
        # so the join must stay inside the lock.
        text = " ".join(seg.text.strip() for seg in segments).strip()
    return text, info


def transcribe_audio_detailed(audio_path):
    """
    Transcribe an audio file with automatic language detection.

    Returns a dict:
      {
        "text":                 transcript in the original spoken language ("" if no speech),
        "language":             ISO code detected, e.g. "mr"            (None if unknown),
        "language_name":        e.g. "Marathi"                          (None if unknown),
        "language_probability": detection confidence 0-1                (None if unknown),
        "text_english":         English text for sentiment models — the original
                                transcript if English, else a Whisper translation,
        "engine":               "whisper" or "google-sr-fallback",
      }
    """
    result = {
        "text": "",
        "language": None,
        "language_name": None,
        "language_probability": None,
        "text_english": "",
        "engine": "whisper",
    }

    model = _get_whisper_model()
    if model is None:
        return _transcribe_google_fallback(audio_path, result)

    try:
        text, info = _run_whisper(model, audio_path, task="transcribe")
        lang = getattr(info, "language", None)
        result["text"] = text
        result["language"] = lang
        result["language_name"] = LANGUAGE_NAMES.get(lang, lang.title() if lang else None)
        prob = getattr(info, "language_probability", None)
        result["language_probability"] = float(prob) if prob is not None else None

        if not text:
            return result

        if lang == "en":
            result["text_english"] = text
        else:
            # Second pass: Whisper's built-in speech→English translation, so
            # the (English) sentiment models understand the content.
            try:
                translated, _ = _run_whisper(
                    model, audio_path, task="translate", language=lang
                )
                result["text_english"] = translated or text
            except Exception:
                logger.exception("Whisper translation pass failed; using original text.")
                result["text_english"] = text
        return result

    except Exception:
        logger.exception("Whisper transcription failed; trying Google fallback.")
        return _transcribe_google_fallback(audio_path, result)


def _transcribe_google_fallback(audio_path, result):
    """English-only fallback via SpeechRecognition (needs internet)."""
    try:
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        with sr.AudioFile(audio_path) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio)
        result.update({
            "text": text,
            "text_english": text,
            "language": "en",
            "language_name": "English",
            "engine": "google-sr-fallback",
        })
    except Exception as e:
        # sr.UnknownValueError (no speech) and network errors both end here;
        # an empty transcript is a valid outcome, not a crash.
        logger.warning("Google fallback transcription failed: %s", e)
    return result


def transcribe_audio(audio_path):
    """Backward-compatible wrapper: returns the transcript string or None."""
    detailed = transcribe_audio_detailed(audio_path)
    return detailed["text"] or None


if __name__ == "__main__":
    import json
    import sys

    logging.basicConfig(level=logging.INFO)
    path = sys.argv[1] if len(sys.argv) > 1 else "data/processed_audio/sample_audio.wav"
    print(json.dumps(transcribe_audio_detailed(path), ensure_ascii=False, indent=2))
