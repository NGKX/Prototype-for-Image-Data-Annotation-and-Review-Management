"""ML Service API — YOLOv8 inference."""
from fastapi import FastAPI, UploadFile, File, Form
from yolo_inference import predict as yolo_predict

app = FastAPI(title="ML Inference Service", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "yolo": "active", "sam": "stub"}


@app.post("/predict")
async def predict_yolo(
    file: UploadFile = File(...),
    model_name: str = Form("yolov8n"),
    conf_threshold: float = Form(0.25),
):
    data = await file.read()
    detections = yolo_predict(data, model_name=model_name, conf_threshold=conf_threshold)
    return {"status": "ok", "detections": detections, "count": len(detections)}


@app.post("/predict/sam")
async def predict_sam():
    return {"status": "not_implemented", "message": "SAM inference not available in this version"}
