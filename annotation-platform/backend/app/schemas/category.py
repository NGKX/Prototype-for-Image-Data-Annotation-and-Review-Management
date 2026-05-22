from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class CategoryCreate(BaseModel):
    name: str
    color: str = "#3388FF"
    parent_id: Optional[UUID] = None
    sort_order: int = 0
    shortcut_key: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None
    shortcut_key: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    color: str = "#3388FF"
    parent_id: Optional[UUID] = None
    sort_order: int = 0
    shortcut_key: Optional[str] = None
    is_active: bool = True
    children: list["CategoryRead"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryTree(CategoryRead):
    pass
