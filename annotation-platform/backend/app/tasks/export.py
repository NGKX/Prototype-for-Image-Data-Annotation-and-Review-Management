from celery import shared_task


@shared_task(bind=True, max_retries=2, default_retry_delay=30, time_limit=600)
def export_dataset(self, export_record_id: str):
    """Export annotations in the requested format. Stub for Phase 1 (implemented in Phase 7)."""
    pass
