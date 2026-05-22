from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    status: str
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    annotated_count: int = 0
    approved_count: int = 0

    model_config = {"from_attributes": True}
