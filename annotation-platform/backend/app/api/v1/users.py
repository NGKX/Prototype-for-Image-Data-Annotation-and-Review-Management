"""User management endpoints (admin only)."""
import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles, hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserRead

router = APIRouter()


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(User.id)))).scalar() or 0
    offset = (page - 1) * page_size
    rows = (await db.execute(
        select(User).order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )).scalars().all()

    items = [UserRead.model_validate(u) for u in rows]
    tp = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": tp}


@router.post("", status_code=201)
async def create_user(
    body: UserCreate,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="用户名已存在")
    if body.role not in ("admin", "data_manager", "reviewer", "annotator"):
        body.role = "annotator"

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        display_name=body.display_name or body.username,
        email=body.email,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if role and role in ("admin", "data_manager", "reviewer", "annotator"):
        user.role = role
    if is_active is not None:
        user.is_active = is_active

    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # Prevent self-deletion
    if str(user.id) == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="不能删除自己")

    # Soft-delete: deactivate instead of removing
    user.is_active = False
    await db.commit()
    return {"status": "deactivated", "user_id": str(user_id)}
