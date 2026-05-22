from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles
from app.models.project import Project, ProjectMember
from app.models.image import Image
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectRead
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ProjectRead])
async def list_projects(
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Project)
    if current_user["role"] == "admin":
        query = query.where(Project.status.in_(["active", "archived"]))
    else:
        query = query.where(Project.status == "active")

    total_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Project.created_at.desc()).offset(offset).limit(page_size))
    projects = result.scalars().all()

    items = []
    for p in projects:
        img_count = (await db.execute(select(func.count(Image.id)).where(Image.project_id == p.id, Image.deleted_at.is_(None)))).scalar() or 0
        annotated_count = (await db.execute(select(func.count(Image.id)).where(Image.project_id == p.id, Image.deleted_at.is_(None), Image.annotation_status == "annotated"))).scalar() or 0
        approved_count = (await db.execute(select(func.count(Image.id)).where(Image.project_id == p.id, Image.deleted_at.is_(None), Image.review_status == "approved"))).scalar() or 0
        items.append(ProjectRead(
            id=p.id, name=p.name, description=p.description, status=p.status,
            created_by=p.created_by, created_at=p.created_at, updated_at=p.updated_at,
            image_count=img_count, annotated_count=annotated_count, approved_count=approved_count,
        ))

    total_pages = (total + page_size - 1) // page_size
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    project = Project(name=body.name, description=body.description, created_by=UUID(current_user["user_id"]))
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectRead(
        id=project.id, name=project.name, description=project.description,
        status=project.status, created_by=project.created_by,
        created_at=project.created_at, updated_at=project.updated_at,
        image_count=0, annotated_count=0, approved_count=0,
    )


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: UUID, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    img_count = (await db.execute(select(func.count(Image.id)).where(Image.project_id == project.id, Image.deleted_at.is_(None)))).scalar() or 0
    return ProjectRead(
        id=project.id, name=project.name, description=project.description,
        status=project.status, created_by=project.created_by,
        created_at=project.created_at, updated_at=project.updated_at,
        image_count=img_count, annotated_count=0, approved_count=0,
    )
