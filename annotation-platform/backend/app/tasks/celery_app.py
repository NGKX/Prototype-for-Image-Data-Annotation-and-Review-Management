from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "annotation_platform",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND or settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_queues={
        "default": {"exchange": "default", "routing_key": "default"},
        "ml": {"exchange": "ml", "routing_key": "ml"},
        "export": {"exchange": "export", "routing_key": "export"},
    },
    task_default_queue="default",
    task_default_routing_key="default",
    task_routes={
        "app.tasks.auto_annotation.*": {"queue": "ml"},
        "app.tasks.thumbnails.*": {"queue": "default"},
        "app.tasks.export.*": {"queue": "export"},
    },
    broker_connection_retry_on_startup=True,
)

celery_app.autodiscover_tasks(["app.tasks.thumbnails", "app.tasks.auto_annotation", "app.tasks.export"])
