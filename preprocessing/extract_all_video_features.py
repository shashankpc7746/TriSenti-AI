import logging
import os
import pickle
import threading

import cv2
import numpy as np
import torch
from tqdm import tqdm

logger = logging.getLogger(__name__)

# Paths (dataset batch mode)
VIDEO_FOLDER = 'data/mini_dataset/segmented_video'
OUTPUT_PATH = 'data/mini_dataset/mini_video_features.pkl'

# Cap on how many frames go through ResNet per video. Frames are sampled
# evenly across the clip; averaging 32 frames approximates the all-frames
# mean while keeping CPU inference time bounded for long uploads.
MAX_FRAMES = int(os.environ.get("VIDEO_MAX_FRAMES", "32"))

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

_resnet = None
_transform = None
_model_lock = threading.Lock()


def _get_model():
    """Lazy-load ResNet18 + transform once (thread-safe) so importing this
    module stays cheap for the API process."""
    global _resnet, _transform
    if _resnet is not None:
        return _resnet, _transform
    with _model_lock:
        if _resnet is not None:
            return _resnet, _transform
        from torchvision import models, transforms
        logger.info("Loading ResNet18 for video feature extraction...")
        resnet = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        resnet = torch.nn.Sequential(*list(resnet.children())[:-1])  # drop classifier
        resnet.to(device)
        resnet.eval()
        _transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225])
        ])
        _resnet = resnet
        logger.info("ResNet18 loaded.")
    return _resnet, _transform


def extract_all_video_features(video_path):
    """Return the mean ResNet18 embedding over sampled frames, or None."""
    resnet, transform = _get_model()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("Could not open video: %s", video_path)
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total_frames > MAX_FRAMES:
        target_indices = set(
            int(i) for i in np.linspace(0, total_frames - 1, MAX_FRAMES)
        )
    else:
        target_indices = None  # short clip / unknown length: use every frame

    frame_features = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if target_indices is not None and frame_idx not in target_indices:
            frame_idx += 1
            continue
        frame_idx += 1

        try:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            input_tensor = transform(frame).unsqueeze(0).to(device)
            with torch.no_grad():
                feature = resnet(input_tensor).squeeze().cpu().numpy()
                frame_features.append(feature)
        except Exception as e:
            logger.warning("Error processing frame %d: %s", frame_idx, e)
            continue

    cap.release()

    if frame_features:
        return np.mean(frame_features, axis=0)  # average across sampled frames
    return None


def main():
    feature_dict = {}

    print("Extracting CNN features from all segmented video clips...\n")

    for filename in tqdm(os.listdir(VIDEO_FOLDER)):
        if filename.endswith('.mp4'):
            clip_id = filename.replace('.mp4', '')
            video_path = os.path.join(VIDEO_FOLDER, filename)
            features = extract_all_video_features(video_path)
            if features is not None:
                feature_dict[clip_id] = features

    # Save all extracted features
    with open(OUTPUT_PATH, 'wb') as f:
        pickle.dump(feature_dict, f)

    print(f"\n✅ Extracted CNN features for {len(feature_dict)} video clips.")
    print(f"🔸 Saved to: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
