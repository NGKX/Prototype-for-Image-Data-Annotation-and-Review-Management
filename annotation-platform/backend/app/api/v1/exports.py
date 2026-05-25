"""Export dataset API endpoints."""
import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles
from app.models.export_record import ExportRecord
from app.schemas.export import ExportCreate, ExportRead
from app.utils import local_storage

router = APIRouter()


@router.get("")
async def list_exports(
    project_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [ExportRecord.project_id == project_id]
    total = (await db.execute(select(func.count(ExportRecord.id)).where(*conditions))).scalar() or 0
    offset = (page - 1) * page_size
    rows = (await db.execute(
        select(ExportRecord).where(*conditions).order_by(ExportRecord.created_at.desc()).offset(offset).limit(page_size)
    )).scalars().all()

    items = [ExportRead.model_validate(r) for r in rows]
    tp = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": tp}


@router.post("", status_code=201)
async def create_export(
    body: ExportCreate,
    project_id: uuid.UUID = Query(...),
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    record = ExportRecord(
        project_id=project_id,
        created_by=uuid.UUID(current_user["user_id"]),
        export_format=body.export_format,
        filter_criteria=body.filter_criteria,
        status="processing",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Run export in-process for local dev (without Redis/Celery)
    # In production with Celery: export_dataset.delay(str(record.id))
    import asyncio
    asyncio.create_task(_run_export_local(str(record.id)))

    return ExportRead.model_validate(record)


async def _run_export_local(export_id: str):
    from app.core.database import async_session
    from app.services.export_service import run_export
    from app.core.config import settings
    async with async_session() as db:
        await run_export(db, uuid.UUID(export_id), settings.MAX_EXPORT_SIZE_GB)


@router.get("/{export_id}/download")
async def download_export(
    export_id: uuid.UUID,
    token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # Authenticate via token query param for browser downloads
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    from app.core.security import decode_access_token
    try:
        decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    record = (await db.execute(select(ExportRecord).where(ExportRecord.id == export_id))).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Export not found")
    if record.status != "completed":
        raise HTTPException(status_code=400, detail="Export not yet completed")
    if not record.file_url:
        raise HTTPException(status_code=404, detail="No file available")

    path = local_storage.get_file_path("exports", record.file_url)
    if not local_storage.file_exists("exports", record.file_url):
        raise HTTPException(status_code=404, detail="File not found on storage")

    filename = f"export_{record.export_format}_{record.id.hex[:8]}.zip"
    return FileResponse(path, media_type="application/zip", filename=filename)


@router.get("/{export_id}")
async def get_export(
    export_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = (await db.execute(select(ExportRecord).where(ExportRecord.id == export_id))).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Export not found")
    return ExportRead.model_validate(record)


@router.delete("/{export_id}")
async def delete_export(
    export_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    record = (await db.execute(select(ExportRecord).where(ExportRecord.id == export_id))).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Export not found")

    if record.file_url:
        try:
            local_storage.delete_file("exports", record.file_url)
        except Exception:
            pass
    if record.volumes and record.volumes.get("keys"):
        for key in record.volumes["keys"]:
            try:
                local_storage.delete_file("exports", key)
            except Exception:
                pass

    await db.delete(record)
    await db.commit()
    return {"status": "deleted"}
