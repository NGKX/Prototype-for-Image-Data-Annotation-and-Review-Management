from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import get_db
from app.core.security import get_current_user, require_roles
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryRead

router = APIRouter()


def build_tree(categories: list[Category], parent_id: UUID | None = None) -> list[dict]:
    result = []
    for cat in categories:
        if cat.parent_id == parent_id:
            node = CategoryRead.model_validate(cat).model_dump(mode="json")
            node["children"] = build_tree(categories, cat.id)
            result.append(node)
    return result


@router.get("/tree")
async def get_category_tree(
    project_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.project_id == project_id, Category.is_active == True)
        .order_by(Category.sort_order, Category.name)
    )
    categories = result.scalars().all()
    return {"items": build_tree(categories)}


@router.get("")
async def list_categories(
    project_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.project_id == project_id)
        .order_by(Category.sort_order, Category.name)
    )
    cats = result.scalars().all()
    return {"items": [CategoryRead.model_validate(c).model_dump(mode="json") for c in cats]}


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    project_id: UUID = Query(...),
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    cat = Category(project_id=project_id, **body.model_dump(exclude_none=True))
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryRead.model_validate(cat)


@router.put("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: UUID,
    body: CategoryUpdate,
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(cat, key, val)
    await db.commit()
    await db.refresh(cat)
    return CategoryRead.model_validate(cat)


@router.get("/export")
async def export_categories(
    project_id: UUID = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).where(Category.project_id == project_id))
    cats = result.scalars().all()
    return {"items": [{"name": c.name, "color": c.color, "parent_name": None, "shortcut_key": c.shortcut_key} for c in cats]}


@router.post("/import")
async def import_categories(
    project_id: UUID = Query(...),
    items: list[dict] = [],
    current_user: dict = Depends(require_roles("admin", "data_manager")),
    db: AsyncSession = Depends(get_db),
):
    created = 0
    name_to_id = {}
    for item in items:
        parent_id = name_to_id.get(item.get("parent_name")) if item.get("parent_name") else None
        cat = Category(
            project_id=project_id,
            name=item["name"],
            color=item.get("color", "#3388FF"),
            parent_id=parent_id,
            shortcut_key=item.get("shortcut_key"),
        )
        db.add(cat)
        await db.flush()
        name_to_id[cat.name] = cat.id
        created += 1
    await db.commit()
    return {"imported": created}
