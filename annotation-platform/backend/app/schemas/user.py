from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "annotator"
    display_name: Optional[str] = None
    email: Optional[str] = None


class UserRead(BaseModel):
    id: UUID
    username: str
    role: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class LoginRequest(BaseModel):
    username: str
    password: str
