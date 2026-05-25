"""Celery task for dataset export."""
import sys
import os
import uuid
import asyncio
from celery import shared_task

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.core.config import settings


@shared_task(bind=True, max_retries=2, default_retry_delay=30, soft_time_limit=540, time_limit=600)
def export_dataset(self, export_record_id: str):
    """Export annotations in YOLO / COCO / VOC format as a ZIP archive."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(_run_export(export_record_id))


async def _run_export(export_record_id: str):
    from app.core.database import async_session
    from app.services.export_service import run_export

    async with async_session() as db:
        await run_export(db, uuid.UUID(export_record_id), settings.MAX_EXPORT_SIZE_GB)
