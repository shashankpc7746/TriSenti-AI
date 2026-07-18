import logging
import os
import pickle
import threading

import torch
from tqdm import tqdm

logger = logging.getLogger(__name__)

# Paths (dataset batch mode)
TEXT_FOLDER = 'data/mini_dataset/segmented_transcripts'
OUTPUT_PATH = 'data/mini_dataset/mini_text_features.pkl'

# Device configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

_tokenizer = None
_model = None
_model_lock = threading.Lock()


def _get_model():
    """Lazy-load DistilBERT once (thread-safe) so importing this module
    stays cheap for the API process."""
    global _tokenizer, _model
    if _model is not None:
        return _tokenizer, _model
    with _model_lock:
        if _model is not None:
            return _tokenizer, _model
        from transformers import DistilBertModel, DistilBertTokenizer
        logger.info("Loading DistilBERT for text feature extraction...")
        _tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')
        model = DistilBertModel.from_pretrained('distilbert-base-uncased')
        model.eval()
        model.to(device)
        _model = model
        logger.info("DistilBERT loaded.")
    return _tokenizer, _model


def extract_text_features(text):
    """Return a 768-dim mean-pooled DistilBERT embedding for the text."""
    tokenizer, model = _get_model()

    inputs = tokenizer(
        text, return_tensors='pt', truncation=True, padding=True, max_length=512
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()

    return embeddings


def main():
    text_feature_dict = {}

    print("Extracting text features from all transcripts...\n")

    for filename in tqdm(os.listdir(TEXT_FOLDER)):
        if filename.endswith('.txt'):
            clip_id = filename.replace('.txt', '')
            text_path = os.path.join(TEXT_FOLDER, filename)

            with open(text_path, 'r', encoding='utf-8') as f:
                transcript = f.read()

            features = extract_text_features(transcript)
            text_feature_dict[clip_id] = features

    # Save all extracted features
    with open(OUTPUT_PATH, 'wb') as f:
        pickle.dump(text_feature_dict, f)

    print(f"\n✅ Extracted text features for {len(text_feature_dict)} clips.")
    print(f"🔸 Saved to: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
