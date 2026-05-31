"""
Diagnostic: measure the CURRENT model's accuracy on the same test split,
comparing full-multimodal vs the zero-padded single-modality paths the app
actually uses at inference time.

Run from project root:
  .\multimodal_env\Scripts\python.exe training\diagnose_baseline.py
"""
import pickle
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
from tensorflow.keras.models import load_model  # type: ignore

DATA = "data/mini_dataset"
MODELS = "models"

with open(f"{DATA}/mini_audio_features.pkl", "rb") as f: audio = pickle.load(f)
with open(f"{DATA}/mini_video_features.pkl", "rb") as f: video = pickle.load(f)
with open(f"{DATA}/mini_text_features.pkl", "rb") as f: text = pickle.load(f)
df = pd.read_csv("data/processed_dataset.csv")

Xa, Xv, Xt, labels = [], [], [], []
for _, row in df.iterrows():
    try:
        key = f"{row['video_id']}_{int(row['clip_id'])}"
    except Exception:
        continue
    if key in audio and key in video and key in text:
        Xa.append(np.asarray(audio[key]))
        Xv.append(np.asarray(video[key]))
        Xt.append(np.asarray(text[key]))
        labels.append(row["annotation"])

Xa, Xv, Xt = np.stack(Xa), np.stack(Xv), np.stack(Xt)
print("Label distribution:", Counter(labels))

le = LabelEncoder()
y_int = le.fit_transform(labels)

# Recreate the SAME split as training (random_state=42, stratify, 0.2)
idx = np.arange(len(y_int))
_, idx_test = train_test_split(idx, test_size=0.2, random_state=42, stratify=y_int)

Xa_te, Xv_te, Xt_te, y_te = Xa[idx_test], Xv[idx_test], Xt[idx_test], y_int[idx_test]

with open(f"{MODELS}/scaler_audio.pkl", "rb") as f: sa = pickle.load(f)
with open(f"{MODELS}/scaler_video.pkl", "rb") as f: sv = pickle.load(f)
with open(f"{MODELS}/scaler_text.pkl", "rb") as f: st = pickle.load(f)
with open(f"{MODELS}/label_encoder.pkl", "rb") as f: le_saved = pickle.load(f)

Xa_s = sa.transform(Xa_te)
Xv_s = sv.transform(Xv_te)
Xt_s = st.transform(Xt_te)

model = load_model(f"{MODELS}/final_multimodal_logits_model.h5")

def evaluate(name, Xa_in, Xv_in, Xt_in):
    preds = model.predict([Xa_in, Xv_in, Xt_in], verbose=0)
    pred_int = np.argmax(preds, axis=1)
    # map saved label-encoder order -> our order via class names
    acc = accuracy_score(y_te, pred_int)
    print(f"\n=== {name} ===")
    print(f"Accuracy: {acc:.4f}")
    print(classification_report(y_te, pred_int,
          target_names=list(le_saved.classes_), zero_division=0))

zeros_a = np.zeros_like(Xa_s)
zeros_v = np.zeros_like(Xv_s)
zeros_t = np.zeros_like(Xt_s)

evaluate("FULL multimodal (audio+video+text)", Xa_s, Xv_s, Xt_s)
evaluate("TEXT-only (audio/video zeroed) — app text path", zeros_a, zeros_v, Xt_s)
evaluate("AUDIO+VIDEO (text zeroed) — app file path no speech", Xa_s, Xv_s, zeros_t)
