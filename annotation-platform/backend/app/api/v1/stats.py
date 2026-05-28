"""Statistics and dashboard endpoints — SQLite compatible."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.image import Image
from app.models.project import Project, ProjectMember
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
    conds = [Image.project_id == project_id, Image.deleted_at.is_(None)]
    total = (await db.execute(select(func.count(Image.id)).where(and_(*conds)))).scalar() or 0
    annotated = (await db.execute(select(func.count(Image.id)).where(
        and_(*conds, Image.annotation_status == "annotated")))).scalar() or 0
    approved = (await db.execute(select(func.count(Image.id)).where(
        and_(*conds, Image.review_status == "approved")))).scalar() or 0
    rejected = (await db.execute(select(func.count(Image.id)).where(
        and_(*conds, Image.review_status == "rejected")))).scalar() or 0
    pending = (await db.execute(select(func.count(Image.id)).where(
        and_(*conds, Image.review_status == "pending")))).scalar() or 0

    # Python-side annotation counting
    img_ids = [r[0] for r in (await db.execute(select(Image.id).where(and_(*conds)))).all()]
    total_annos = 0
    auto_annos = 0
    if img_ids:
        annos = (await db.execute(select(Annotation).where(
            Annotation.image_id.in_(img_ids), Annotation.is_latest == True
        ))).scalars().all()
        total_annos = len(annos)
        auto_annos = sum(1 for a in annos if a.is_auto)

    return {
        "images": {"total": total, "annotated": annotated, "unannotated": total - annotated},
        "reviews": {"approved": approved, "rejected": rejected, "pending": pending,
                     "pass_rate": round(approved / max(approved + rejected, 1) * 100, 1)},
        "annotations": {"total": total_annos, "auto": auto_annos, "manual": total_annos - auto_annos,
                         "avg_per_image": round(total_annos / max(total, 1), 1)},
    }


@router.get("/members")
async def member_stats(
    project_id: uuid.UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Show project members, their uploaded images, annotations, and review stats."""
    img_ids = [r[0] for r in (await db.execute(
        select(Image.id).where(Image.project_id == project_id, Image.deleted_at.is_(None))
    )).all()]

    # Get all annotations for this project
    annotations = []
    if img_ids:
        annotations = (await db.execute(
            select(Annotation).where(Annotation.image_id.in_(img_ids), Annotation.is_latest == True)
        )).scalars().all()

    # Get all images grouped by uploader
    images = []
    if img_ids:
        images = (await db.execute(
            select(Image).where(Image.id.in_(img_ids))
        )).scalars().all()

    # Build per-user stats
    users_data = {}

    # From annotations
    for a in annotations:
        uid = a.annotator_id
        if uid not in users_data:
            users_data[uid] = {"annotations": 0, "auto_count": 0, "approved": 0, "rejected": 0, "uploads": 0, "reviewed": 0}
        users_data[uid]["annotations"] += 1
        if a.is_auto: users_data[uid]["auto_count"] += 1
        if a.review_status == "approved": users_data[uid]["approved"] += 1
        elif a.review_status == "rejected": users_data[uid]["rejected"] += 1

    # From images (upload count)
    for img in images:
        if img.uploaded_by:
            uid = img.uploaded_by
            if uid not in users_data:
                users_data[uid] = {"annotations": 0, "auto_count": 0, "approved": 0, "rejected": 0, "uploads": 0, "reviewed": 0}
            users_data[uid]["uploads"] += 1

    # From review records
    from app.models.review import ReviewRecord
    if img_ids:
        reviews = (await db.execute(
            select(ReviewRecord).where(ReviewRecord.annotation_id.in_(
                select(Annotation.id).where(Annotation.image_id.in_(img_ids))
            ))
        )).scalars().all()
        for r in reviews:
            uid = r.reviewer_id
            if uid not in users_data:
                users_data[uid] = {"annotations": 0, "auto_count": 0, "approved": 0, "rejected": 0, "uploads": 0, "reviewed": 0}
            users_data[uid]["reviewed"] += 1

    # Get user names
    user_ids = list(users_data.keys())
    user_map = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        user_map = {u.id: u for u in users}

    items = []
    for uid, d in users_data.items():
        u = user_map.get(uid)
        reviewed = d["approved"] + d["rejected"]
        items.append({
            "user_id": str(uid),
            "username": u.username if u else "unknown",
            "display_name": u.display_name if u else "unknown",
            "uploads": d["uploads"],
            "annotations": d["annotations"],
            "auto_count": d["auto_count"],
            "manual_count": d["annotations"] - d["auto_count"],
            "approved": d["approved"],
            "rejected": d["rejected"],
            "reviewed_count": d["reviewed"],
            "accuracy": round(d["approved"] / max(reviewed, 1) * 100, 1) if reviewed > 0 else None,
        })

    items.sort(key=lambda x: x["annotations"] + x["uploads"], reverse=True)
    return {"items": items, "total_members": len(items)}


@router.get("/trends")
async def trend_stats(
    project_id: uuid.UUID = Query(...),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    img_ids = [r[0] for r in (await db.execute(
        select(Image.id).where(Image.project_id == project_id, Image.deleted_at.is_(None))
    )).all()]
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Python-side date aggregation
    anno_by_day = {}
    if img_ids:
        rows = (await db.execute(select(
            Annotation.created_at, Annotation.is_auto
        ).where(Annotation.image_id.in_(img_ids), Annotation.created_at >= since))).all()
        for dt, is_auto in rows:
            ds = str(dt.date())
            a = anno_by_day.setdefault(ds, {"total": 0, "auto": 0})
            a["total"] += 1
            if is_auto: a["auto"] += 1

    review_by_day = {}
    rev_rows = (await db.execute(select(
        ReviewRecord.created_at, ReviewRecord.action
    ).where(ReviewRecord.created_at >= since))).all()
    for dt, act in rev_rows:
        ds = str(dt.date())
        r = review_by_day.setdefault(ds, {"total": 0, "approved": 0, "rejected": 0})
        r["total"] += 1
        if act == "approved": r["approved"] += 1
        elif act == "rejected": r["rejected"] += 1

    data = []
    for i in range(days):
        d = since + timedelta(days=i)
        ds = str(d.date())
        data.append({
            "date": ds,
            "annotations": anno_by_day.get(ds, {"total": 0, "auto": 0})["total"],
            "auto_annotations": anno_by_day.get(ds, {"total": 0, "auto": 0})["auto"],
            "reviews": review_by_day.get(ds, {"total": 0, "approved": 0, "rejected": 0})["total"],
            "approved": review_by_day.get(ds, {"total": 0, "approved": 0, "rejected": 0})["approved"],
            "rejected": review_by_day.get(ds, {"total": 0, "approved": 0, "rejected": 0})["rejected"],
        })
    return {"items": data, "days": days}


@router.get("/categories")
async def category_stats(
    project_id: uuid.UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    img_ids = [r[0] for r in (await db.execute(
        select(Image.id).where(Image.project_id == project_id, Image.deleted_at.is_(None))
    )).all()]
    if not img_ids:
        return {"items": []}

    rows = (await db.execute(select(
        Annotation.category_id, func.count(Annotation.id).label("count")
    ).where(Annotation.image_id.in_(img_ids), Annotation.is_latest == True,
            Annotation.category_id.isnot(None))
    .group_by(Annotation.category_id).order_by(func.count(Annotation.id).desc()))).all()

    cat_ids = [r.category_id for r in rows]
    cat_map = {}
    if cat_ids:
        cats = (await db.execute(select(Category).where(Category.id.in_(cat_ids)))).scalars().all()
        cat_map = {c.id: c for c in cats}

    items = []
    for r in rows:
        c = cat_map.get(r.category_id)
        items.append({"category_id": str(r.category_id), "name": c.name if c else "unknown",
                       "color": c.color if c else "#999", "count": r.count})
    return {"items": items}


@router.get("/overview")
async def overview(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(current_user["user_id"])
    role = current_user["role"]
    projects = (await db.execute(select(Project).where(Project.status == "active"))).scalars().all()
    project_ids = [p.id for p in projects]

    total_images = 0; annotated_images = 0; approved = 0; rejected = 0; total_annos = 0
    if project_ids:
        conds = [Image.project_id.in_(project_ids), Image.deleted_at.is_(None)]
        total_images = (await db.execute(select(func.count(Image.id)).where(and_(*conds)))).scalar() or 0
        annotated_images = (await db.execute(select(func.count(Image.id)).where(
            and_(*conds, Image.annotation_status == "annotated")))).scalar() or 0
        approved = (await db.execute(select(func.count(Image.id)).where(
            and_(*conds, Image.review_status == "approved")))).scalar() or 0
        rejected = (await db.execute(select(func.count(Image.id)).where(
            and_(*conds, Image.review_status == "rejected")))).scalar() or 0
        all_ids = [r[0] for r in (await db.execute(select(Image.id).where(and_(*conds)))).all()]
        if all_ids:
            total_annos = len((await db.execute(select(Annotation).where(
                Annotation.image_id.in_(all_ids), Annotation.is_latest == True
            ))).scalars().all())

    my_todos = 0; todo_label = ""
    if project_ids:
        if role == "annotator":
            my_todos = (await db.execute(select(func.count(Image.id)).where(and_(
                Image.project_id.in_(project_ids), Image.annotation_status != "annotated",
                Image.deleted_at.is_(None), Image.uploaded_by == user_id
            )))).scalar() or 0
            todo_label = "待标注图片"
        else:
            my_todos = (await db.execute(select(func.count(Image.id)).where(and_(
                Image.project_id.in_(project_ids), Image.review_status == "pending",
                Image.deleted_at.is_(None)
            )))).scalar() or 0
            todo_label = "待审核图片"

    recent = []
    revs = (await db.execute(select(ReviewRecord).order_by(ReviewRecord.created_at.desc()).limit(5))).scalars().all()
    if revs:
        uid_set = {r.reviewer_id for r in revs}
        umap = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(uid_set)))).scalars().all()}
        for r in revs:
            u = umap.get(r.reviewer_id)
            recent.append({"reviewer": u.display_name if u else "", "action": r.action,
                           "reason": r.reason, "created_at": r.created_at.isoformat() if r.created_at else None})

    return {
        "projects": {"total": len(projects)},
        "images": {"total": total_images, "annotated": annotated_images, "approved": approved, "rejected": rejected},
        "annotations": {"total": total_annos},
        "progress": round(annotated_images / max(total_images, 1) * 100, 1),
        "my_todos": my_todos, "todo_label": todo_label,
        "recent_reviews": recent,
    }
