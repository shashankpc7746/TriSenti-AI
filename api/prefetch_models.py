"""
Download all runtime ML models into the local cache.

Run at Docker build time so the image ships with every model baked in —
container cold starts then never depend on (or wait for) model downloads.
Safe to re-run: everything is cached under HF_HOME / TORCH_HOME.
"""

import os

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")


def main():
    print(f"⏬ Prefetching Whisper '{WHISPER_MODEL}' (speech-to-text)...")
    from faster_whisper import WhisperModel
    WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

    print("⏬ Prefetching RoBERTa sentiment model...")
    from transformers import pipeline
    pipeline(
        "text-classification",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    )

    print("⏬ Prefetching DistilBERT (text features)...")
    from transformers import DistilBertModel, DistilBertTokenizer
    DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    DistilBertModel.from_pretrained("distilbert-base-uncased")

    print("⏬ Prefetching ResNet18 weights (video features)...")
    from torchvision import models
    models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)

    print("✅ All models prefetched.")


if __name__ == "__main__":
    main()
