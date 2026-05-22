from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.annotation import Annotation, AnnotationVersion
from app.models.category import Category
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationRead, AnnotationVersionRead

router = APIRouter()


@router.get("")
async def list_annotations(
    image_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Annotation).where(
            Annotation.image_id == image_id,
            Annotation.is_latest == True,
        )
    )
    annotations = result.scalars().all()

    # Batch-load categories to avoid N+1
    cat_ids = [a.category_id for a in annotations if a.category_id]
    cat_map: dict = {}
    if cat_ids:
        cats = (await db.execute(select(Category).where(Category.id.in_(cat_ids)))).scalars().all()
        cat_map = {c.id: c for c in cats}

    items = []
    for a in annotations:
        cat = cat_map.get(a.category_id) if a.category_id else None
        items.append(AnnotationRead(
            id=a.id, image_id=a.image_id, category_id=a.category_id,
            annotator_id=a.annotator_id, type=a.type, geometry=a.geometry,
            is_auto=a.is_auto, confidence=a.confidence, is_latest=a.is_latest,
            version=a.version, review_status=a.review_status,
            category_name=cat.name if cat else None,
            category_color=cat.color if cat else None,
            created_at=a.created_at, updated_at=a.updated_at,
        ))

    return {"items": items}


@router.post("", response_model=AnnotationRead, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    body: AnnotationCreate,
    image_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    annotation = Annotation(
        image_id=image_id,
        annotator_id=UUID(current_user["user_id"]),
        type=body.type,
        geometry=body.geometry,
        category_id=body.category_id,
    )
    db.add(annotation)
    await db.flush()

    # Create version snapshot
    version = AnnotationVersion(
        annotation_id=annotation.id,
        version=annotation.version,
        geometry=annotation.geometry,
        type=annotation.type,
        category_id=annotation.category_id,
        source="manual",
        created_by=UUID(current_user["user_id"]),
    )
    db.add(version)
    await db.commit()
    await db.refresh(annotation)

    return AnnotationRead(
        id=annotation.id, image_id=annotation.image_id, category_id=annotation.category_id,
        annotator_id=annotation.annotator_id, type=annotation.type, geometry=annotation.geometry,
        is_auto=annotation.is_auto, confidence=annotation.confidence, is_latest=annotation.is_latest,
        version=annotation.version, review_status=annotation.review_status,
        created_at=annotation.created_at, updated_at=annotation.updated_at,
    )


@router.put("/{annotation_id}", response_model=AnnotationRead)
async def update_annotation(
    annotation_id: UUID,
    body: AnnotationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Annotation).where(Annotation.id == annotation_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Annotation not found")

    if body.geometry is not None:
        a.geometry = body.geometry
    if body.category_id is not None:
        a.category_id = body.category_id

    a.version += 1
    a.review_status = "pending"

    # Create version snapshot
    version = AnnotationVersion(
        annotation_id=a.id,
        version=a.version,
        geometry=a.geometry,
        type=a.type,
        category_id=a.category_id,
        source="manual",
        change_summary="Updated",
        created_by=UUID(current_user["user_id"]),
    )
    db.add(version)
    await db.commit()
    await db.refresh(a)

    return AnnotationRead(
        id=a.id, image_id=a.image_id, category_id=a.category_id,
        annotator_id=a.annotator_id, type=a.type, geometry=a.geometry,
        is_auto=a.is_auto, confidence=a.confidence, is_latest=a.is_latest,
        version=a.version, review_status=a.review_status,
        created_at=a.created_at, updated_at=a.updated_at,
    )


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Annotation).where(Annotation.id == annotation_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Annotation not found")
    a.is_latest = False
    await db.commit()


@router.get("/{annotation_id}/versions")
async def get_versions(
    annotation_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnnotationVersion).where(AnnotationVersion.annotation_id == annotation_id)
        .order_by(AnnotationVersion.version.desc())
    )
    versions = result.scalars().all()
    return {"items": [AnnotationVersionRead.model_validate(v) for v in versions]}


@router.post("/batch")
async def save_batch(
    annotations: list[AnnotationCreate],
    image_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save all annotations for an image in one request."""
    user_id = UUID(current_user["user_id"])

    # Mark all existing as not latest
    existing = (await db.execute(
        select(Annotation).where(Annotation.image_id == image_id, Annotation.is_latest == True)
    )).scalars().all()
    for e in existing:
        e.is_latest = False

    created = []
    for item in annotations:
        a = Annotation(
            image_id=image_id, annotator_id=user_id,
            type=item.type, geometry=item.geometry, category_id=item.category_id,
        )
        db.add(a)
        await db.flush()
        # Version snapshot
        v = AnnotationVersion(
            annotation_id=a.id, version=a.version, geometry=a.geometry,
            type=a.type, category_id=a.category_id, source="manual",
            created_by=user_id,
        )
        db.add(v)
        created.append(str(a.id))

    await db.commit()
    return {"created": len(created), "ids": created}
