from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class GeometryBBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class GeometryPolygon(BaseModel):
    points: list[list[float]]
    closed: bool = True


class AnnotationCreate(BaseModel):
    type: str  # bbox, polygon, point, line, circle, segmentation
    geometry: dict
    category_id: Optional[UUID] = None


class AnnotationUpdate(BaseModel):
    geometry: Optional[dict] = None
    category_id: Optional[UUID] = None


class AnnotationRead(BaseModel):
    id: UUID
    image_id: UUID
    category_id: Optional[UUID] = None
    annotator_id: UUID
    type: str
    geometry: dict
    is_auto: bool = False
    confidence: Optional[float] = None
    is_latest: bool = True
    version: int = 1
    review_status: str = "pending"
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnnotationVersionRead(BaseModel):
    id: UUID
    annotation_id: UUID
    version: int
    geometry: dict
    type: str
    change_summary: Optional[str] = None
    source: str = "manual"
    created_at: datetime

    model_config = {"from_attributes": True}
