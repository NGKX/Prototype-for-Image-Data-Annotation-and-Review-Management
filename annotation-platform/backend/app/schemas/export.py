from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ExportCreate(BaseModel):
    export_format: str  # "yolo", "coco", "voc"
    filter_criteria: Optional[dict] = None  # annotation_status, review_status, category_ids


class ExportRead(BaseModel):
    id: UUID
    project_id: UUID
    created_by: UUID
    export_format: str
    filter_criteria: Optional[dict] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    volumes: Optional[dict] = None
    status: str
    error_msg: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
