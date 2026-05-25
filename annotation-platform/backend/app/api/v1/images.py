"""Image management API endpoints."""
import uuid
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles, decode_access_token
from app.services import image_service
from app.utils import local_storage

router = APIRouter()


@router.get("")
async def list_project_images(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    annotation_status: str | None = None,
    review_status: str | None = None,
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await image_service.list_images(
        project_id=project_id, db=db, user=current_user,
        page=page, page_size=page_size,
        annotation_status=annotation_status, review_status=review_status,
        search=search,
    )


@router.post("/upload")
async def upload_images(
    project_id: uuid.UUID = Query(...),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await image_service.upload_images(
        project_id=project_id, files=files,
        user_id=uuid.UUID(current_user["user_id"]), db=db,
    )


@router.post("/{image_id}/auto-annotate")
async def auto_annotate(
    image_id: uuid.UUID,
    model_name: str = Query("yolov8n"),
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, update as sql_update
    from app.models.image import Image as ImageModel
    from app.tasks.auto_annotation import auto_annotate_task

    result = await db.execute(select(ImageModel).where(ImageModel.id == image_id, ImageModel.deleted_at.is_(None)))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    # Set status to annotating
    img.annotation_status = "annotating"
    await db.commit()

    # Run directly in-process (for local dev without Celery workers)
    # In production, use: task = auto_annotate_task.delay(str(image_id), model_name)
    try:
        result_data = auto_annotate_task(str(image_id), model_name)
        return {"status": "completed", **result_data}
    except Exception as e:
        img.annotation_status = "unannotated"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Auto-annotation failed: {str(e)}")


@router.post("/{image_id}/submit-review")
async def submit_review(
    image_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, update
    from app.models.image import Image as ImageModel
    from app.models.annotation import Annotation as AnnoModel
    result = await db.execute(select(ImageModel).where(ImageModel.id == image_id, ImageModel.deleted_at.is_(None)))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    img.annotation_status = "annotated"
    img.review_status = "pending"
    await db.execute(
        update(AnnoModel).where(AnnoModel.image_id == image_id, AnnoModel.is_latest == True)
        .values(review_status="pending")
    )
    await db.commit()
    return {"status": "ok", "review_status": "pending"}


@router.patch("/{image_id}/sensitive")
async def toggle_sensitive(
    image_id: uuid.UUID,
    is_sensitive: bool | None = Query(None),
    sensitive_note: str | None = Query(None),
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.image import Image as ImageModel

    result = await db.execute(select(ImageModel).where(ImageModel.id == image_id, ImageModel.deleted_at.is_(None)))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    if is_sensitive is not None:
        img.is_sensitive = is_sensitive
    if sensitive_note is not None:
        img.sensitive_note = sensitive_note
    await db.commit()
    return {"status": "ok", "is_sensitive": img.is_sensitive, "sensitive_note": img.sensitive_note}


@router.get("/{image_id}")
async def get_image(
    image_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await image_service.get_image_detail(image_id=image_id, db=db)


# ── Soft-delete / restore / permanent-delete ──

@router.delete("/{image_id}")
async def soft_delete_image(
    image_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.image import Image as ImageModel
    from datetime import datetime, timezone

    result = await db.execute(
        select(ImageModel).where(ImageModel.id == image_id, ImageModel.deleted_at.is_(None))
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    img.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "deleted", "image_id": str(image_id)}


@router.post("/{image_id}/restore")
async def restore_image(
    image_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.image import Image as ImageModel

    result = await db.execute(
        select(ImageModel).where(ImageModel.id == image_id, ImageModel.deleted_at.isnot(None))
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found in trash")
    img.deleted_at = None
    await db.commit()
    return {"status": "restored", "image_id": str(image_id)}


@router.delete("/{image_id}/permanent")
async def permanent_delete_image(
    image_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, delete
    from app.models.image import Image as ImageModel
    from app.models.annotation import Annotation as AnnoModel
    from app.models.annotation import AnnotationVersion as AnnoVerModel
    from app.models.review import ReviewRecord as RevModel
    from app.models.task_assignment import TaskAssignment as TaskModel

    result = await db.execute(
        select(ImageModel).where(ImageModel.id == image_id)
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete related annotations
    anno_ids = (await db.execute(
        select(AnnoModel.id).where(AnnoModel.image_id == image_id)
    )).scalars().all()
    if anno_ids:
        await db.execute(delete(AnnoVerModel).where(AnnoVerModel.annotation_id.in_(anno_ids)))
        await db.execute(delete(RevModel).where(RevModel.annotation_id.in_(anno_ids)))
    await db.execute(delete(AnnoModel).where(AnnoModel.image_id == image_id))
    await db.execute(delete(TaskModel).where(TaskModel.image_id == image_id))

    # Remove files from storage
    try:
        if img.storage_key:
            local_storage.delete_file("images", img.storage_key)
        if img.thumbnail_key:
            local_storage.delete_file("thumbnails", img.thumbnail_key)
    except Exception:
        pass

    await db.delete(img)
    await db.commit()
    return {"status": "permanently_deleted", "image_id": str(image_id)}


@router.get("/trash/list")
async def list_trash(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, func, and_
    from app.models.image import Image as ImageModel

    conditions = [ImageModel.project_id == project_id, ImageModel.deleted_at.isnot(None)]
    total = (await db.execute(select(func.count(ImageModel.id)).where(and_(*conditions)))).scalar() or 0
    offset = (page - 1) * page_size
    rows = (await db.execute(
        select(ImageModel).where(and_(*conditions)).order_by(ImageModel.deleted_at.desc()).offset(offset).limit(page_size)
    )).scalars().all()

    items = []
    for img in rows:
        items.append({
            "id": str(img.id),
            "project_id": str(img.project_id),
            "original_name": img.original_name,
            "width": img.width,
            "height": img.height,
            "file_size": img.file_size,
            "mime_type": img.mime_type,
            "thumbnail_url": f"/api/v1/images/files/thumbnails/{img.thumbnail_key}" if img.thumbnail_key else None,
            "deleted_at": img.deleted_at.isoformat() if img.deleted_at else None,
            "created_at": img.created_at.isoformat() if img.created_at else None,
        })

    tp = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": tp}


@router.get("/files/{bucket:path}/{key:path}")
async def serve_file(
    bucket: str,
    key: str,
    token: str | None = Query(None),
):
    # Validate token if provided (required for <img> tag access)
    if token:
        try:
            decode_access_token(token)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    # Sanitize path to prevent directory traversal
    if ".." in key or ".." in bucket:
        raise HTTPException(status_code=400, detail="Invalid path")
    path = local_storage.get_file_path(bucket, key)
    if not local_storage.file_exists(bucket, key):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
