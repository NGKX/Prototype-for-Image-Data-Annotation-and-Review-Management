"""Statistics and dashboard endpoints."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, case, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.image import Image
from app.models.project import Project
from app.models.task_assignment import TaskAssignment
from app.models.annotation import Annotation
from app.models.review import ReviewRecord
from app.models.category import Category
from app.models.user import User

router = APIRouter()


@router.get("/dashboard")
async def dashboard(
    project_id: uuid.UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Project overview: image counts, annotation progress, review pass rate."""
    conditions = [Image.project_id == project_id, Image.deleted_at.is_(None)]

    total = (await db.execute(select(func.count(Image.id)).where(and_(*conditions)))).scalar() or 0
    annotated = (await db.execute(
        select(func.count(Image.id)).where(and_(*conditions, Image.annotation_status == "annotated"))
    )).scalar() or 0
    approved = (await db.execute(
        select(func.count(Image.id)).where(and_(*conditions, Image.review_status == "approved"))
    )).scalar() or 0
    rejected = (await db.execute(
        select(func.count(Image.id)).where(and_(*conditions, Image.review_status == "rejected"))
    )).scalar() or 0
    pending = (await db.execute(
        select(func.count(Image.id)).where(and_(*conditions, Image.review_status == "pending"))
    )).scalar() or 0

    img_ids_subq = select(Image.id).where(and_(*conditions)).scalar_subquery()
    total_annos = (await db.execute(
        select(func.count(Annotation.id)).where(
            Annotation.image_id.in_(img_ids_subq), Annotation.is_latest == True
        )
    )).scalar() or 0
    auto_annos = (await db.execute(
        select(func.count(Annotation.id)).where(
            Annotation.image_id.in_(img_ids_subq), Annotation.is_latest == True, Annotation.is_auto == True
        )
    )).scalar() or 0

    return {
        "images": {"total": total, "annotated": annotated, "unannotated": total - annotated},
        "reviews": {"approved": approved, "rejected": rejected, "pending": pending,
                     "pass_rate": round(approved / max(approved + rejected, 1) * 100, 1)},
        "annotations": {"total": total_annos, "auto": auto_annos, "manual": total_annos - auto_annos,
                         "avg_per_image": round(total_annos / max(total, 1), 1)},
    }


@router.get("/annotators")
async def annotator_stats(
    project_id: uuid.UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-annotator performance."""
    img_ids_subq = select(Image.id).where(
        Image.project_id == project_id, Image.deleted_at.is_(None)
    ).scalar_subquery()

    rows = (await db.execute(
        select(
            Annotation.annotator_id,
            func.count(Annotation.id).label("total"),
            func.count(case((Annotation.is_auto == True, 1))).label("auto_count"),
            func.count(case((Annotation.review_status == "approved", 1))).label("approved_count"),
            func.count(case((Annotation.review_status == "rejected", 1))).label("rejected_count"),
        )
        .where(Annotation.image_id.in_(img_ids_subq), Annotation.is_latest == True)
        .group_by(Annotation.annotator_id)
    )).all()

    user_ids = [row.annotator_id for row in rows]
    user_map = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        user_map = {u.id: u for u in users}

    items = []
    for row in rows:
        u = user_map.get(row.annotator_id)
        total = row.total
        approved = row.approved_count
        rejected = row.rejected_count
        reviewed = approved + rejected
        items.append({
            "user_id": str(row.annotator_id),
            "username": u.username if u else "unknown",
            "display_name": u.display_name if u else "unknown",
            "total_annotations": total,
            "auto_count": row.auto_count,
            "manual_count": total - row.auto_count,
            "approved": approved,
            "rejected": rejected,
            "accuracy": round(approved / max(reviewed, 1) * 100, 1) if reviewed > 0 else 0,
        })

    items.sort(key=lambda x: x["total_annotations"], reverse=True)
    return {"items": items}


@router.get("/trends")
async def trend_stats(
    project_id: uuid.UUID = Query(...),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily annotation and review counts."""
    img_ids_subq = select(Image.id).where(
        Image.project_id == project_id, Image.deleted_at.is_(None)
    ).scalar_subquery()

    since = datetime.now(timezone.utc) - timedelta(days=days)

    anno_rows = (await db.execute(
        select(
            cast(Annotation.created_at, Date).label("day"),
            func.count(Annotation.id).label("count"),
            func.count(case((Annotation.is_auto == True, 1))).label("auto_count"),
        )
        .where(Annotation.image_id.in_(img_ids_subq), Annotation.created_at >= since)
        .group_by(cast(Annotation.created_at, Date))
        .order_by(cast(Annotation.created_at, Date))
    )).all()

    review_rows = (await db.execute(
        select(
            cast(ReviewRecord.created_at, Date).label("day"),
            func.count(ReviewRecord.id).label("count"),
            func.count(case((ReviewRecord.action == "approved", 1))).label("approved_count"),
            func.count(case((ReviewRecord.action == "rejected", 1))).label("rejected_count"),
        )
        .where(ReviewRecord.created_at >= since)
        .group_by(cast(ReviewRecord.created_at, Date))
        .order_by(cast(ReviewRecord.created_at, Date))
    )).all()

    anno_map = {str(r.day): {"total": r.count, "auto": r.auto_count} for r in anno_rows}
    review_map = {str(r.day): {"total": r.count, "approved": r.approved_count, "rejected": r.rejected_count}
                  for r in review_rows}

    data = []
    for i in range(days):
        d = since + timedelta(days=i)
        ds = str(d.date())
        data.append({
            "date": ds,
            "annotations": anno_map.get(ds, {"total": 0, "auto": 0})["total"],
            "auto_annotations": anno_map.get(ds, {"total": 0, "auto": 0})["auto"],
            "reviews": review_map.get(ds, {"total": 0, "approved": 0, "rejected": 0})["total"],
            "approved": review_map.get(ds, {"total": 0, "approved": 0, "rejected": 0})["approved"],
            "rejected": review_map.get(ds, {"total": 0, "approved": 0, "rejected": 0})["rejected"],
        })

    return {"items": data, "days": days}


@router.get("/categories")
async def category_stats(
    project_id: uuid.UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Annotation distribution by category."""
    img_ids_subq = select(Image.id).where(
        Image.project_id == project_id, Image.deleted_at.is_(None)
    ).scalar_subquery()

    rows = (await db.execute(
        select(
            Annotation.category_id,
            func.count(Annotation.id).label("count"),
        )
        .where(Annotation.image_id.in_(img_ids_subq), Annotation.is_latest == True,
               Annotation.category_id.isnot(None))
        .group_by(Annotation.category_id)
        .order_by(func.count(Annotation.id).desc())
    )).all()

    cat_ids = [r.category_id for r in rows]
    cat_map = {}
    if cat_ids:
        cats = (await db.execute(select(Category).where(Category.id.in_(cat_ids)))).scalars().all()
        cat_map = {c.id: c for c in cats}

    items = []
    for r in rows:
        c = cat_map.get(r.category_id)
        items.append({
            "category_id": str(r.category_id),
            "name": c.name if c else "unknown",
            "color": c.color if c else "#999",
            "count": r.count,
        })

    return {"items": items}


@router.get("/overview")
async def overview(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard overview: summary across visible projects, user todos, recent activity."""
    user_id = uuid.UUID(current_user["user_id"])
    role = current_user["role"]

    proj_query = select(Project).where(Project.status == "active")
    projects = (await db.execute(proj_query)).scalars().all()
    total_projects = len(projects)
    project_ids = [p.id for p in projects]

    total_images = 0
    annotated_images = 0
    images_approved = 0
    images_rejected = 0
    total_annotations = 0

    if project_ids:
        img_conds = [Image.project_id.in_(project_ids), Image.deleted_at.is_(None)]
        total_images = (await db.execute(select(func.count(Image.id)).where(and_(*img_conds)))).scalar() or 0
        annotated_images = (await db.execute(
            select(func.count(Image.id)).where(and_(*img_conds, Image.annotation_status == "annotated"))
        )).scalar() or 0
        images_approved = (await db.execute(
            select(func.count(Image.id)).where(and_(*img_conds, Image.review_status == "approved"))
        )).scalar() or 0
        images_rejected = (await db.execute(
            select(func.count(Image.id)).where(and_(*img_conds, Image.review_status == "rejected"))
        )).scalar() or 0

        annos_q = select(func.count(Annotation.id)).where(
            Annotation.image_id.in_(select(Image.id).where(and_(*img_conds)).scalar_subquery()),
            Annotation.is_latest == True,
        )
        total_annotations = (await db.execute(annos_q)).scalar() or 0

    # User-specific todos
    my_todos = 0
    todo_label = ""

    if role == "annotator":
        my_img_conds = [Image.deleted_at.is_(None), Image.annotation_status != "annotated"]
        if project_ids:
            my_img_conds.append(Image.project_id.in_(project_ids))
        uploaded_q = select(func.count(Image.id)).where(and_(*my_img_conds, Image.uploaded_by == user_id))
        my_uploaded = (await db.execute(uploaded_q)).scalar() or 0
        assigned_ids_subq = select(TaskAssignment.image_id).where(
            TaskAssignment.assignee_id == user_id, TaskAssignment.task_type == "annotation"
        ).scalar_subquery()
        assigned_q = select(func.count(Image.id)).where(and_(*my_img_conds, Image.id.in_(assigned_ids_subq)))
        my_assigned = (await db.execute(assigned_q)).scalar() or 0
        rejected_q = select(func.count(Image.id)).where(
            and_(Image.uploaded_by == user_id, Image.review_status == "rejected", Image.deleted_at.is_(None))
        )
        my_rejected = (await db.execute(rejected_q)).scalar() or 0
        my_todos = my_uploaded + my_assigned + my_rejected
        todo_label = "待标注图片"

    elif role == "reviewer":
        if project_ids:
            pending_q = select(func.count(Image.id)).where(
                Image.project_id.in_(project_ids),
                Image.review_status == "pending",
                Image.deleted_at.is_(None),
            )
            my_todos = (await db.execute(pending_q)).scalar() or 0
        todo_label = "待审核图片"

    elif role in ("admin", "data_manager"):
        if project_ids:
            pending_q = select(func.count(Image.id)).where(
                Image.project_id.in_(project_ids),
                Image.review_status == "pending",
                Image.deleted_at.is_(None),
            )
            my_todos = (await db.execute(pending_q)).scalar() or 0
        todo_label = "待审核图片"

    # Recent review activity (last 5)
    recent_reviews = []
    review_rows = (await db.execute(
        select(ReviewRecord).order_by(ReviewRecord.created_at.desc()).limit(5)
    )).scalars().all()

    user_ids_in_reviews = [r.reviewer_id for r in review_rows]
    user_map = {}
    if user_ids_in_reviews:
        users = (await db.execute(select(User).where(User.id.in_(user_ids_in_reviews)))).scalars().all()
        user_map = {u.id: u for u in users}

    for r in review_rows:
        u = user_map.get(r.reviewer_id)
        recent_reviews.append({
            "reviewer": u.display_name if u else "unknown",
            "action": r.action,
            "reason": r.reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "projects": {"total": total_projects},
        "images": {
            "total": total_images,
            "annotated": annotated_images,
            "unannotated": total_images - annotated_images,
            "approved": images_approved,
            "rejected": images_rejected,
        },
        "annotations": {"total": total_annotations},
        "progress": round(annotated_images / max(total_images, 1) * 100, 1),
        "my_todos": my_todos,
        "todo_label": todo_label,
        "recent_reviews": recent_reviews,
    }
