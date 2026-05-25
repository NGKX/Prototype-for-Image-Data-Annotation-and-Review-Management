"""YOLOv8 inference module."""
import numpy as np
from PIL import Image
from io import BytesIO

_model_cache = {}


def load_model(model_name: str = "yolov8n"):
    if model_name not in _model_cache:
        from ultralytics import YOLO
        _model_cache[model_name] = YOLO(f"{model_name}.pt")
    return _model_cache[model_name]


def predict(image_data: bytes, model_name: str = "yolov8n", conf_threshold: float = 0.25):
    model = load_model(model_name)
    img = Image.open(BytesIO(image_data))
    results = model(img, conf=conf_threshold, verbose=False)
    detections = []
    for r in results:
        boxes = r.boxes
        if boxes is not None:
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                cls_name = model.names.get(cls_id, str(cls_id))
                conf = float(boxes.conf[i].item())
                xyxy = boxes.xyxy[i].tolist()  # [x1, y1, x2, y2]
                detections.append({
                    "class_id": cls_id,
                    "class_name": cls_name,
                    "confidence": round(conf, 4),
                    "bbox": [round(v, 2) for v in xyxy],
                })
    return detections
