"""Review queue, task claiming, approve/reject endpoints."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles
from app.models.image import Image as ImageModel
from app.models.annotation import Annotation as AnnoModel
from app.models.review import ReviewRecord
from app.models.task_assignment import TaskAssignment

router = APIRouter()

LOCK_DURATION_MINUTES = 30


@router.get("/queue")
async def review_queue(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """List images pending review, with their annotation counts."""
    conditions = [
        ImageModel.project_id == project_id,
        ImageModel.review_status == "pending",
        ImageModel.deleted_at.is_(None),
    ]

    total_q = select(func.count(ImageModel.id)).where(and_(*conditions))
    total = (await db.execute(total_q)).scalar() or 0

    offset = (page - 1) * page_size
    rows = (await db.execute(
        select(ImageModel)
        .where(and_(*conditions))
        .order_by(ImageModel.created_at.asc())
        .offset(offset).limit(page_size)
    )).scalars().all()

    items = []
    for img in rows:
        anno_count = (await db.execute(
            select(func.count(AnnoModel.id)).where(
                AnnoModel.image_id == img.id, AnnoModel.is_latest == True
            )
        )).scalar() or 0

        # Check if currently locked by someone else
        lock = (await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.image_id == img.id,
                TaskAssignment.task_type == "review",
                TaskAssignment.locked_until > func.now(),
            )
        )).scalar_one_or_none()
        locked_by = str(lock.assignee_id) if lock else None

        items.append({
            "id": str(img.id),
            "project_id": str(img.project_id),
            "original_name": img.original_name,
            "width": img.width,
            "height": img.height,
            "file_size": img.file_size,
            "mime_type": img.mime_type,
            "annotation_status": img.annotation_status,
            "review_status": img.review_status,
            "annotation_count": anno_count,
            "locked_by": locked_by,
            "thumbnail_url": f"/api/v1/images/files/thumbnails/{img.thumbnail_key}" if img.thumbnail_key else None,
            "created_at": img.created_at.isoformat() if img.created_at else None,
        })

    tp = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": tp}


@router.post("/{image_id}/claim")
async def claim_review(
    image_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Claim a review task with a lock to prevent concurrent review."""
    user_id = uuid.UUID(current_user["user_id"])

    # Verify image exists and is pending review
    img = (await db.execute(
        select(ImageModel).where(
            ImageModel.id == image_id,
            ImageModel.review_status == "pending",
            ImageModel.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found or not pending review")

    # Check existing lock
    existing = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.image_id == image_id,
            TaskAssignment.task_type == "review",
        )
    )).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if existing:
        if existing.locked_until and existing.locked_until > now and existing.assignee_id != user_id:
            raise HTTPException(status_code=409, detail="Task already claimed by another reviewer")
        # Re-claim or extend lock
        existing.assignee_id = user_id
        existing.locked_until = now + timedelta(minutes=LOCK_DURATION_MINUTES)
        existing.status = "in_progress"
    else:
        task = TaskAssignment(
            image_id=image_id,
            assignee_id=user_id,
            task_type="review",
            status="in_progress",
            assigned_by=user_id,
            locked_until=now + timedelta(minutes=LOCK_DURATION_MINUTES),
        )
        db.add(task)

    await db.commit()
    return {"status": "claimed", "image_id": str(image_id), "locked_until": (now + timedelta(minutes=LOCK_DURATION_MINUTES)).isoformat()}


@router.post("/{image_id}/release")
async def release_review(
    image_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Release a claimed review task."""
    user_id = uuid.UUID(current_user["user_id"])
    task = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.image_id == image_id,
            TaskAssignment.task_type == "review",
            TaskAssignment.assignee_id == user_id,
        )
    )).scalar_one_or_none()
    if task:
        task.locked_until = None
        task.status = "assigned"
        await db.commit()
    return {"status": "released"}


class ReviewBody(BaseModel):
    reason: Optional[str] = None
    preset_reason: Optional[str] = None


@router.post("/{image_id}/approve")
async def approve_review(
    image_id: uuid.UUID,
    payload: ReviewBody = ReviewBody(),
    current_user: dict = Depends(require_roles("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Approve all annotations on an image."""
    return await _resolve_review(image_id, "approved", current_user, db, payload)


@router.post("/{image_id}/reject")
async def reject_review(
    image_id: uuid.UUID,
    payload: ReviewBody = ReviewBody(),
    current_user: dict = Depends(require_roles("admin", "reviewer")),
    db: AsyncSession = Depends(get_db),
):
    """Reject review and return image to annotator for rework."""
    return await _resolve_review(image_id, "rejected", current_user, db, payload)


async def _resolve_review(
    image_id: uuid.UUID,
    action: str,
    current_user: dict,
    db: AsyncSession,
    payload: ReviewBody | None = None,
):
    user_id = uuid.UUID(current_user["user_id"])

    # Verify image
    img = (await db.execute(
        select(ImageModel).where(ImageModel.id == image_id, ImageModel.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    # Verify the user holds the lock or is admin
    task = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.image_id == image_id,
            TaskAssignment.task_type == "review",
        )
    )).scalar_one_or_none()

    if task and task.assignee_id != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Review task is claimed by another reviewer")

    reason = payload.reason if payload else None
    preset = payload.preset_reason if payload else None

    # Update image status
    if action == "approved":
        img.review_status = "approved"
        new_anno_status = "approved"
    else:
        img.review_status = "rejected"
        img.annotation_status = "unannotated"
        new_anno_status = "rejected"

    # Update all latest annotations
    annotations = (await db.execute(
        select(AnnoModel).where(AnnoModel.image_id == image_id, AnnoModel.is_latest == True)
    )).scalars().all()

    for a in annotations:
        a.review_status = new_anno_status
        record = ReviewRecord(
            annotation_id=a.id,
            reviewer_id=user_id,
            action=action,
            reason=reason,
            preset_reason=preset,
        )
        db.add(record)

    # Release the lock
    if task:
        task.locked_until = None
        task.status = "completed"

    await db.commit()
    return {"status": "ok", "action": action, "reviewed_count": len(annotations)}
