"""Image upload, validation, and management service."""
import uuid
from io import BytesIO
from fastapi import UploadFile, HTTPException
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image as PILImage

from app.models.image import Image
from app.models.project import Project
from app.models.task_assignment import TaskAssignment
from app.utils import local_storage

ALLOWED = {"image/jpeg", "image/png"}


def _validate_image_header(data: bytes) -> str:
    if len(data) < 4:
        raise ValueError("File too small")
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"\x89PNG":
        return "image/png"
    raise ValueError("Not a valid JPG or PNG file")


async def upload_images(project_id, files, user_id, db):
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Project not found")

    succeeded, failed = [], []
    for file in files:
        try:
            raw = await file.read()
            mime = _validate_image_header(raw)
            if mime not in ALLOWED:
                raise ValueError(f"Unsupported format")

            img = PILImage.open(BytesIO(raw))
            w, h = img.size
            ext = "jpg" if mime == "image/jpeg" else "png"
            storage_key = f"{project_id}/{uuid.uuid4().hex}.{ext}"
            local_storage.upload_bytes("images", storage_key, raw)

            thumbnail_key = None
            try:
                img.thumbnail((300, 300))
                buf = BytesIO()
                img.save(buf, format="JPEG" if mime == "image/jpeg" else "PNG")
                thumb_key = f"{project_id}/thumb_{uuid.uuid4().hex}.{ext}"
                local_storage.upload_bytes("thumbnails", thumb_key, buf.getvalue())
                thumbnail_key = thumb_key
            except Exception:
                pass

            image = Image(
                project_id=project_id, original_name=file.filename or "unknown",
                storage_key=storage_key, thumbnail_key=thumbnail_key,
                width=w, height=h, file_size=len(raw), mime_type=mime, uploaded_by=user_id,
            )
            db.add(image)
            await db.flush()
            succeeded.append({"id": str(image.id), "filename": file.filename, "width": w, "height": h})
        except ValueError as e:
            failed.append({"filename": file.filename, "reason": str(e)})
        except Exception as e:
            failed.append({"filename": file.filename, "reason": str(e)})

    await db.commit()
    return {"succeeded": succeeded, "failed": failed}


async def list_images(project_id, db, user, page=1, page_size=20, annotation_status=None, review_status=None, search=None):
    conditions = [Image.project_id == project_id, Image.deleted_at.is_(None)]

    if user["role"] == "annotator":
        user_uuid = uuid.UUID(user["user_id"])
        q = select(TaskAssignment.image_id).where(TaskAssignment.assignee_id == user_uuid, TaskAssignment.task_type == "annotation")
        r = await db.execute(q)
        assigned_ids = [row[0] for row in r.fetchall()]
        visible = [Image.uploaded_by == user_uuid]
        if assigned_ids:
            visible.append(Image.id.in_(assigned_ids))
        visible.append(Image.review_status == "approved")
        conditions.append(or_(*visible))

    if annotation_status:
        conditions.append(Image.annotation_status == annotation_status)
    if review_status:
        conditions.append(Image.review_status == review_status)
    if search:
        conditions.append(Image.original_name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count(Image.id)).where(and_(*conditions)))).scalar() or 0
    offset = (page - 1) * page_size
    rows = (await db.execute(select(Image).where(and_(*conditions)).order_by(Image.created_at.desc()).offset(offset).limit(page_size))).scalars().all()

    items = []
    for img in rows:
        items.append({
            "id": str(img.id), "project_id": str(img.project_id),
            "original_name": img.original_name, "width": img.width, "height": img.height,
            "file_size": img.file_size, "mime_type": img.mime_type,
            "annotation_status": img.annotation_status, "review_status": img.review_status,
            "is_sensitive": img.is_sensitive, "sensitive_note": img.sensitive_note,
            "thumbnail_url": f"/api/v1/images/files/thumbnails/{img.thumbnail_key}" if img.thumbnail_key else None,
            "uploaded_by": str(img.uploaded_by) if img.uploaded_by else None,
            "created_at": img.created_at.isoformat() if img.created_at else None,
        })
    tp = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": tp}


async def get_image_detail(image_id, db):
    result = await db.execute(select(Image).where(Image.id == image_id, Image.deleted_at.is_(None)))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(404, "Image not found")
    return {
        "id": str(img.id), "project_id": str(img.project_id),
        "original_name": img.original_name, "storage_key": img.storage_key,
        "thumbnail_key": img.thumbnail_key, "width": img.width, "height": img.height,
        "file_size": img.file_size, "mime_type": img.mime_type,
        "annotation_status": img.annotation_status, "review_status": img.review_status,
        "is_sensitive": img.is_sensitive, "sensitive_note": img.sensitive_note,
        "presigned_url": f"/api/v1/images/files/images/{img.storage_key}",
        "uploaded_by": str(img.uploaded_by) if img.uploaded_by else None,
        "created_at": img.created_at.isoformat() if img.created_at else None,
    }
