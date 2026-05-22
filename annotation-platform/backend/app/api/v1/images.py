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


@router.get("/{image_id}")
async def get_image(
    image_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await image_service.get_image_detail(image_id=image_id, db=db)


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
