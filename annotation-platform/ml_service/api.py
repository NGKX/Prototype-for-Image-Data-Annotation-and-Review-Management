"""ML Service API — YOLOv8 / SAM inference.

Phase 1: stub implementation.
Phase 5: real YOLOv8 inference.
Phase 9: SAM segmentation (optional).
"""
from fastapi import FastAPI

app = FastAPI(title="ML Inference Service", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "yolo": "stub", "sam": "stub"}


@app.post("/predict")
async def predict():
    """YOLOv8 object detection. Stub for Phase 1."""
    return {
        "status": "ok",
        "message": "ML Service stub — real inference available in Phase 5",
        "detections": [],
    }


@app.post("/predict/sam")
async def predict_sam():
    """SAM segmentation. Stub — may be implemented in Phase 9."""
    return {
        "status": "not_implemented",
        "message": "SAM inference is not available in this version",
    }
