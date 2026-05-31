"""
Improved training for the TriSenti multimodal fusion model.

Why this exists
---------------
The original model (models/multimodal_model.py) trained ONLY on samples where
all three modalities are present. But at inference the app frequently feeds
zero-vectors for missing modalities (text-only analysis zeros audio+video;
file uploads with no speech zero the text). The model never saw that during
training, so single-modality accuracy collapsed (text-only fell to ~55%).

Fixes applied here
------------------
1. MODALITY DROPOUT: during training we randomly zero whole modalities so the
   network learns to cope with every combination it meets at inference. We also
   explicitly add the pure single-modality and audio+video views to the data.
2. Per-modality encoders with BatchNorm + L2 + dropout for better generalisation
   on a tiny (400-clip) dataset.
3. Class weights (Neutral has only 18 samples) + label smoothing.
4. Outputs are LOGITS (no softmax) and files keep the SAME names, so api/main.py
   works unchanged.

Run from project root:
  .\multimodal_env\Scripts\python.exe training\train_model.py
"""

import os
import pickle
import numpy as np
import pandas as pd
from collections import Counter

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, accuracy_score
from sklearn.utils.class_weight import compute_class_weight

import tensorflow as tf
from tensorflow.keras.models import Model  # type: ignore
from tensorflow.keras.layers import (  # type: ignore
    Input, Dense, Concatenate, Dropout, BatchNormalization,
)
from tensorflow.keras.regularizers import l2  # type: ignore
from tensorflow.keras.optimizers import Adam  # type: ignore
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau  # type: ignore
from tensorflow.keras.utils import to_categorical  # type: ignore

SEED = 42
np.random.seed(SEED)
tf.random.set_seed(SEED)

DATA = "data/mini_dataset"
MODELS = "models"

# ───────────────────────── Load features ──────────────────────────────────────
print("--- Loading features ---")
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
        Xa.append(np.asarray(audio[key], dtype=np.float32))
        Xv.append(np.asarray(video[key], dtype=np.float32))
        Xt.append(np.asarray(text[key], dtype=np.float32))
        labels.append(row["annotation"])

Xa, Xv, Xt = np.stack(Xa), np.stack(Xv), np.stack(Xt)
print(f"Matched clips: {len(labels)} | shapes a={Xa.shape} v={Xv.shape} t={Xt.shape}")
print("Label distribution:", Counter(labels))

le = LabelEncoder()
y_int = le.fit_transform(labels)
num_classes = len(le.classes_)

# ───────────────────────── Split (stratified) ─────────────────────────────────
(Xa_tr, Xa_te, Xv_tr, Xv_te, Xt_tr, Xt_te,
 y_tr, y_te) = train_test_split(
    Xa, Xv, Xt, y_int, test_size=0.2, random_state=SEED, stratify=y_int
)

# ───────────────────────── Scale (fit on train only) ──────────────────────────
sa, sv, st = StandardScaler(), StandardScaler(), StandardScaler()
Xa_tr = sa.fit_transform(Xa_tr); Xa_te = sa.transform(Xa_te)
Xv_tr = sv.fit_transform(Xv_tr); Xv_te = sv.transform(Xv_te)
Xt_tr = st.fit_transform(Xt_tr); Xt_te = st.transform(Xt_te)

with open(f"{MODELS}/scaler_audio.pkl", "wb") as f: pickle.dump(sa, f)
with open(f"{MODELS}/scaler_video.pkl", "wb") as f: pickle.dump(sv, f)
with open(f"{MODELS}/scaler_text.pkl", "wb") as f: pickle.dump(st, f)
print("Saved scalers.")

# ───────────────────────── Modality-dropout augmentation ──────────────────────
# Build an augmented training set that includes the views the app uses at
# inference. Each "view" masks some modalities to zero (post-scaling), exactly
# like main.py does with np.zeros(...).
def make_views(Xa_, Xv_, Xt_, y_):
    za, zv, zt = (np.zeros_like(Xa_), np.zeros_like(Xv_), np.zeros_like(Xt_))
    views = [
        (Xa_, Xv_, Xt_),   # full multimodal
        (za,  zv,  Xt_),   # text-only  (app text path)
        (Xa_, zv,  zt),    # audio-only
        (za,  Xv_, zt),    # video-only
        (Xa_, Xv_, zt),    # audio+video (file w/o speech)
    ]
    Aa = np.concatenate([v[0] for v in views], axis=0)
    Vv = np.concatenate([v[1] for v in views], axis=0)
    Tt = np.concatenate([v[2] for v in views], axis=0)
    Yy = np.concatenate([y_ for _ in views], axis=0)
    return Aa, Vv, Tt, Yy

Xa_aug, Xv_aug, Xt_aug, y_aug = make_views(Xa_tr, Xv_tr, Xt_tr, y_tr)
# Shuffle the augmented set
perm = np.random.permutation(len(y_aug))
Xa_aug, Xv_aug, Xt_aug, y_aug = Xa_aug[perm], Xv_aug[perm], Xt_aug[perm], y_aug[perm]
print(f"Augmented train size: {len(y_aug)} (from {len(y_tr)} base clips x 5 views)")

y_aug_cat = to_categorical(y_aug, num_classes)

# Class weights from the ORIGINAL label distribution (views don't change ratios)
cw = compute_class_weight("balanced", classes=np.unique(y_tr), y=y_tr)
class_weight = dict(enumerate(cw))
print("Class weights:", class_weight)

# ───────────────────────── Model ──────────────────────────────────────────────
def encoder(dim, prefix, width):
    inp = Input(shape=(dim,), name=f"{prefix}_in")
    x = Dense(width, activation="relu", kernel_regularizer=l2(1e-4), name=f"{prefix}_d1")(inp)
    x = BatchNormalization(name=f"{prefix}_bn1")(x)
    x = Dropout(0.4, name=f"{prefix}_do1")(x)
    x = Dense(width // 2, activation="relu", kernel_regularizer=l2(1e-4), name=f"{prefix}_d2")(x)
    x = Dropout(0.3, name=f"{prefix}_do2")(x)
    return inp, x

ia, ea = encoder(Xa_tr.shape[1], "audio", 64)
iv, ev = encoder(Xv_tr.shape[1], "video", 128)
it, et = encoder(Xt_tr.shape[1], "text", 256)

merged = Concatenate(name="fusion_concat")([ea, ev, et])
x = Dense(128, activation="relu", kernel_regularizer=l2(1e-4), name="fusion_d1")(merged)
x = BatchNormalization(name="fusion_bn")(x)
x = Dropout(0.4, name="fusion_do")(x)
x = Dense(64, activation="relu", name="fusion_d2")(x)
x = Dropout(0.3, name="fusion_do2")(x)
logits = Dense(num_classes, activation=None, name="output_logits")(x)

model = Model(inputs=[ia, iv, it], outputs=logits)
model.compile(
    optimizer=Adam(7e-4),
    loss=tf.keras.losses.CategoricalCrossentropy(from_logits=True, label_smoothing=0.05),
    metrics=["accuracy"],
)
model.summary()

# ───────────────────────── Train ───────────────────────────────────────────────
callbacks = [
    EarlyStopping(monitor="val_loss", patience=15, restore_best_weights=True),
    ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=6, min_lr=1e-5),
]
model.fit(
    [Xa_aug, Xv_aug, Xt_aug], y_aug_cat,
    validation_split=0.15, epochs=200, batch_size=32,
    class_weight=class_weight, callbacks=callbacks, verbose=2,
)

# ───────────────────────── Evaluate (all inference views) ──────────────────────
def report(name, a, v, t):
    preds = model.predict([a, v, t], verbose=0)
    pred = np.argmax(preds, axis=1)
    acc = accuracy_score(y_te, pred)
    print(f"\n=== {name} ===  accuracy={acc:.4f}")
    print(classification_report(y_te, pred, target_names=list(le.classes_), zero_division=0))
    return acc

za, zv, zt = np.zeros_like(Xa_te), np.zeros_like(Xv_te), np.zeros_like(Xt_te)
print("\n################  TEST-SET RESULTS  ################")
report("FULL multimodal",            Xa_te, Xv_te, Xt_te)
report("TEXT-only (app text path)",  za,    zv,    Xt_te)
report("AUDIO+VIDEO (no speech)",    Xa_te, Xv_te, zt)
report("AUDIO-only",                 Xa_te, zv,    zt)
report("VIDEO-only",                 za,    Xv_te, zt)

# ───────────────────────── Save ─────────────────────────────────────────────────
model.save(f"{MODELS}/final_multimodal_logits_model.h5")
with open(f"{MODELS}/label_encoder.pkl", "wb") as f: pickle.dump(le, f)
print("\nSaved model + label encoder (same filenames; api/main.py unchanged).")
