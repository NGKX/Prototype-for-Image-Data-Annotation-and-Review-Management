from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, case, delete
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles
from app.models.project import Project, ProjectMember
from app.models.image import Image
from app.models.annotation import Annotation, AnnotationVersion
from app.models.category import Category
from app.models.review import ReviewRecord
from app.models.task_assignment import TaskAssignment
from app.models.export_record import ExportRecord
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectRead
from app.schemas.common import PaginatedResponse

router = APIRouter()


async def _get_counts(db: AsyncSession, project_ids: list[UUID]) -> dict:
    """Batch-load image counts for multiple projects in a single query."""
    if not project_ids:
        return {}
    stmt = (
        select(
            Image.project_id,
            func.count(Image.id).label("total"),
            func.count(case((Image.annotation_status == "annotated", 1))).label("annotated"),
            func.count(case((Image.review_status == "approved", 1))).label("approved"),
        )
        .where(Image.project_id.in_(project_ids), Image.deleted_at.is_(None))
        .group_by(Image.project_id)
    )
    rows = (await db.execute(stmt)).all()
    return {row.project_id: (row.total, row.annotated, row.approved) for row in rows}


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

    # Single batch query for all counts
    counts = await _get_counts(db, [p.id for p in projects])

    items = []
    for p in projects:
        tc, ac, apc = counts.get(p.id, (0, 0, 0))
        items.append(ProjectRead(
            id=p.id, name=p.name, description=p.description, status=p.status,
            created_by=p.created_by, created_at=p.created_at, updated_at=p.updated_at,
            image_count=tc, annotated_count=ac or 0, approved_count=apc or 0,
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
async def get_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    counts = await _get_counts(db, [project.id])
    tc, ac, apc = counts.get(project.id, (0, 0, 0))
    return ProjectRead(
        id=project.id, name=project.name, description=project.description,
        status=project.status, created_by=project.created_by,
        created_at=project.created_at, updated_at=project.updated_at,
        image_count=tc, annotated_count=ac or 0, approved_count=apc or 0,
    )


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(project, key, val)
    await db.commit()
    await db.refresh(project)
    counts = await _get_counts(db, [project.id])
    tc, ac, apc = counts.get(project.id, (0, 0, 0))
    return ProjectRead(
        id=project.id, name=project.name, description=project.description,
        status=project.status, created_by=project.created_by,
        created_at=project.created_at, updated_at=project.updated_at,
        image_count=tc, annotated_count=ac or 0, approved_count=apc or 0,
    )


@router.patch("/{project_id}/archive", response_model=ProjectRead)
async def archive_project(
    project_id: UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project.status = "archived"
    await db.commit()
    await db.refresh(project)
    return ProjectRead(
        id=project.id, name=project.name, description=project.description,
        status=project.status, created_by=project.created_by,
        created_at=project.created_at, updated_at=project.updated_at,
        image_count=0, annotated_count=0, approved_count=0,
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Delete related data in order
    img_ids = (await db.execute(select(Image.id).where(Image.project_id == project_id))).scalars().all()
    if img_ids:
        anno_ids = (await db.execute(select(Annotation.id).where(Annotation.image_id.in_(img_ids)))).scalars().all()
        if anno_ids:
            await db.execute(delete(AnnotationVersion).where(AnnotationVersion.annotation_id.in_(anno_ids)))
            await db.execute(delete(ReviewRecord).where(ReviewRecord.annotation_id.in_(anno_ids)))
        await db.execute(delete(Annotation).where(Annotation.image_id.in_(img_ids)))
        await db.execute(delete(TaskAssignment).where(TaskAssignment.image_id.in_(img_ids)))

    await db.execute(delete(ExportRecord).where(ExportRecord.project_id == project_id))
    await db.execute(delete(Image).where(Image.project_id == project_id))
    await db.execute(delete(Category).where(Category.project_id == project_id))
    await db.execute(delete(ProjectMember).where(ProjectMember.project_id == project_id))
    await db.execute(delete(Project).where(Project.id == project_id))

    await db.commit()
    return {"status": "deleted", "project_id": str(project_id)}


# ── Project membership ──

@router.post("/{project_id}/join")
async def join_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(current_user["user_id"])
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")
    existing = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_joined"}
    member = ProjectMember(project_id=project_id, user_id=user_id, project_role="annotator")
    db.add(member)
    await db.commit()
    return {"status": "joined"}


@router.post("/{project_id}/leave")
async def leave_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(current_user["user_id"])
    result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        return {"status": "not_a_member"}
    await db.delete(member)
    await db.commit()
    return {"status": "left"}


@router.get("/{project_id}/is-member")
async def check_membership(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(current_user["user_id"])
    result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    return {"is_member": result.scalar_one_or_none() is not None}
