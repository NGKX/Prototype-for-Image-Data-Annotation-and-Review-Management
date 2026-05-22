from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded


@shared_task(bind=True, max_retries=3, default_retry_delay=5, soft_time_limit=25, time_limit=30)
def generate_thumbnail(self, image_id: str):
    """Generate thumbnail for an uploaded image. Stub for Phase 1."""
    try:
        pass
    except SoftTimeLimitExceeded:
        self.retry(countdown=15)
    except Exception as exc:
        self.retry(exc=exc, countdown=self.default_retry_delay * (2 ** self.request.retries))
