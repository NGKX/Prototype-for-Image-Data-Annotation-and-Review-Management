"""Celery task for YOLOv8 auto-annotation."""
import sys, os, uuid, asyncio
from io import BytesIO
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


@shared_task(bind=True, max_retries=3, default_retry_delay=5, soft_time_limit=25, time_limit=30)
def auto_annotate_task(self, image_id: str, model_name: str = "yolov8n"):
    """Run YOLOv8 inference on an image and create auto-annotations."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(_run_auto_annotate(image_id, model_name))


async def _run_auto_annotate(image_id: str, model_name: str):
    from app.core.database import async_session
    from app.models.image import Image
    from app.models.annotation import Annotation, AnnotationVersion
    from app.utils import local_storage
    from sqlalchemy import select

    async with async_session() as db:
        # Load image
        result = await db.execute(select(Image).where(Image.id == image_id))
        img = result.scalar_one_or_none()
        if not img:
            return {"status": "error", "detail": "Image not found"}

        # Read image bytes from local storage
        path = local_storage.get_file_path("images", img.storage_key)
        with open(path, "rb") as f:
            image_data = f.read()

        # Try YOLO inference
        try:
            from ml_service.yolo_inference import predict
            detections = predict(image_data, model_name=model_name)
        except ImportError:
            # Fallback: try calling ML service via HTTP
            import httpx
            resp = httpx.post(
                f"http://ml-service:8001/predict",
                files={"file": (img.original_name, image_data, img.mime_type)},
                data={"model_name": model_name},
                timeout=20,
            )
            if resp.status_code != 200:
                return {"status": "error", "detail": f"ML service returned {resp.status_code}"}
            detections = resp.json().get("detections", [])

        # Remove previous auto-annotations for this image
        prev = (await db.execute(
            select(Annotation).where(
                Annotation.image_id == image_id,
                Annotation.is_auto == True,
                Annotation.is_latest == True,
            )
        )).scalars().all()
        for p in prev:
            p.is_latest = False

        # Create new auto-annotations
        created = 0
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            w, h = x2 - x1, y2 - y1
            if w < 5 or h < 5:
                continue
            a = Annotation(
                image_id=image_id,
                annotator_id=img.uploaded_by or img.project.created_by,
                type="bbox",
                geometry={"x": round(x1, 2), "y": round(y1, 2), "width": round(w, 2), "height": round(h, 2)},
                is_auto=True,
                confidence=det.get("confidence"),
                is_latest=True,
                version=1,
                review_status="pending",
            )
            db.add(a)
            await db.flush()
            v = AnnotationVersion(
                annotation_id=a.id, version=1, geometry=a.geometry,
                type="bbox", source="auto", created_by=a.annotator_id,
            )
            db.add(v)
            created += 1

        img.annotation_status = "annotated" if created > 0 else img.annotation_status
        await db.commit()
        return {"status": "ok", "detections": len(detections), "created": created}
