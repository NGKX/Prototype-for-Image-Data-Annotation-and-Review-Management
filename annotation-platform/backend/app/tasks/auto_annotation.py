from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded


@shared_task(bind=True, max_retries=3, default_retry_delay=5, soft_time_limit=25, time_limit=30)
def auto_annotate_task(self, image_id: str, model_name: str = "yolov8n"):
    """Run YOLOv8 auto-annotation. Stub for Phase 1 (implemented in Phase 5)."""
    try:
        pass
    except SoftTimeLimitExceeded:
        self.retry(countdown=15)
    except Exception as exc:
        self.retry(exc=exc, countdown=self.default_retry_delay * (2 ** self.request.retries))
