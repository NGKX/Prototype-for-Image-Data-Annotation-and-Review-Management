"""Export annotations in YOLO, COCO, and VOC formats."""
import json
import os
import uuid
import zipfile
import tempfile
from io import BytesIO
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.image import Image
from app.models.annotation import Annotation
from app.models.category import Category
from app.models.export_record import ExportRecord
from app.utils import local_storage
from lxml import etree


def _build_category_map(categories: list[Category]) -> dict[uuid.UUID, int]:
    """Assign sequential integer IDs to categories for YOLO/COCO."""
    return {c.id: i for i, c in enumerate(sorted(categories, key=lambda c: c.name))}


# ── YOLO Format ──

def _generate_yolo_annotations(
    image: Image,
    annotations: list[Annotation],
    category_map: dict[uuid.UUID, int],
    image_dir: str,
    label_dir: str,
) -> None:
    """Write one YOLO label .txt per image. Bbox normalized to [0,1]."""
    if not image.width or not image.height:
        return

    img_w, img_h = image.width, image.height
    labels_path = os.path.join(label_dir, f"{os.path.splitext(image.original_name)[0]}.txt")

    lines = []
    for a in annotations:
        if a.type != "bbox" or a.category_id not in category_map:
            continue
        g = a.geometry
        x, y, w, h = g.get("x", 0), g.get("y", 0), g.get("width", 0), g.get("height", 0)
        cx = (x + w / 2) / img_w
        cy = (y + h / 2) / img_h
        nw = w / img_w
        nh = h / img_h
        cls_id = category_map[a.category_id]
        lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

    os.makedirs(label_dir, exist_ok=True)
    with open(labels_path, "w") as f:
        f.write("\n".join(lines))


# ── COCO Format ──

def _collect_coco_data(
    images: list[Image],
    annotations_by_image: dict[uuid.UUID, list[Annotation]],
    category_map: dict[uuid.UUID, int],
    categories: list[Category],
) -> dict:
    """Build COCO JSON structure."""
    coco_images = []
    coco_annotations = []
    anno_id = 1

    for img in images:
        coco_images.append({
            "id": img.id.int,
            "file_name": img.original_name,
            "width": img.width or 0,
            "height": img.height or 0,
        })
        for a in annotations_by_image.get(img.id, []):
            if a.category_id not in category_map:
                continue
            g = a.geometry
            if a.type == "bbox":
                bbox = [g.get("x", 0), g.get("y", 0), g.get("width", 0), g.get("height", 0)]
                area = bbox[2] * bbox[3]
            elif a.type == "polygon" and g.get("points"):
                pts = g["points"]
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                bbox = [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)]
                area = abs(sum(
                    pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                    for i in range(len(pts))
                )) / 2
            else:
                continue

            segmentation = []
            if a.type == "polygon" and g.get("points"):
                seg = []
                for p in g["points"]:
                    seg.extend([p[0], p[1]])
                segmentation = [seg]

            coco_annotations.append({
                "id": anno_id,
                "image_id": img.id.int,
                "category_id": category_map[a.category_id],
                "bbox": bbox,
                "area": area,
                "segmentation": segmentation,
                "iscrowd": 0,
            })
            anno_id += 1

    coco_categories = [
        {"id": cat_id, "name": c.name, "supercategory": c.name}
        for c in sorted(categories, key=lambda c: c.name)
        if (cat_id := category_map.get(c.id)) is not None
    ]

    return {"images": coco_images, "annotations": coco_annotations, "categories": coco_categories}


# ── VOC Format ──

def _generate_voc_xml(image: Image, annotations: list[Annotation], anno_dir: str) -> None:
    """Write one PASCAL VOC XML annotation file per image."""
    ann = etree.Element("annotation")

    etree.SubElement(ann, "folder").text = "JPEGImages"
    etree.SubElement(ann, "filename").text = image.original_name

    source = etree.SubElement(ann, "source")
    etree.SubElement(source, "database").text = "Annotation Platform"
    etree.SubElement(source, "annotation").text = "manual"

    size = etree.SubElement(ann, "size")
    etree.SubElement(size, "width").text = str(image.width or 0)
    etree.SubElement(size, "height").text = str(image.height or 0)
    etree.SubElement(size, "depth").text = "3"

    for a in annotations:
        g = a.geometry
        obj = etree.SubElement(ann, "object")
        etree.SubElement(obj, "name").text = str(a.category_id or "")
        etree.SubElement(obj, "pose").text = "Unspecified"
        etree.SubElement(obj, "truncated").text = "0"
        etree.SubElement(obj, "difficult").text = "0"
        bndbox = etree.SubElement(obj, "bndbox")
        if a.type == "bbox":
            xmin = str(int(g.get("x", 0)))
            ymin = str(int(g.get("y", 0)))
            xmax = str(int(g.get("x", 0) + g.get("width", 0)))
            ymax = str(int(g.get("y", 0) + g.get("height", 0)))
        elif a.type == "polygon" and g.get("points"):
            pts = g["points"]
            xmin = str(int(min(p[0] for p in pts)))
            ymin = str(int(min(p[1] for p in pts)))
            xmax = str(int(max(p[0] for p in pts)))
            ymax = str(int(max(p[1] for p in pts)))
        else:
            continue
        etree.SubElement(bndbox, "xmin").text = xmin
        etree.SubElement(bndbox, "ymin").text = ymin
        etree.SubElement(bndbox, "xmax").text = xmax
        etree.SubElement(bndbox, "ymax").text = ymax

    name = os.path.splitext(image.original_name)[0]
    path = os.path.join(anno_dir, f"{name}.xml")
    os.makedirs(anno_dir, exist_ok=True)
    with open(path, "wb") as f:
        f.write(etree.tostring(ann, pretty_print=True, xml_declaration=True, encoding="utf-8"))


# ── ZIP Packaging ──

def _create_zip_archive(tmpdir: str, export_id: uuid.UUID, max_size_bytes: int) -> list[str]:
    """Create a ZIP archive (possibly split into volumes) and return file paths."""
    files = []
    for root, _, filenames in os.walk(tmpdir):
        for fn in filenames:
            files.append((os.path.join(root, fn), os.path.relpath(os.path.join(root, fn), tmpdir)))

    if not files:
        return []

    volumes = []
    vol_idx = 0
    current_size = 0
    current_zip: zipfile.ZipFile | None = None
    vol_paths: list[str] = []

    def flush_zip():
        nonlocal vol_idx, current_size, current_zip
        if current_zip:
            current_zip.close()
            vol_paths.append(current_zip.filename)
        vol_idx += 1
        current_size = 0
        vol_path = os.path.join(tmpdir, f"export_{export_id.hex}" + (f"_part{vol_idx}" if vol_idx > 0 else "") + ".zip")
        current_zip = zipfile.ZipFile(vol_path, "w", zipfile.ZIP_DEFLATED)
        return vol_path

    flush_zip()
    for src_path, arcname in files:
        size = os.path.getsize(src_path)
        if max_size_bytes > 0 and current_size + size > max_size_bytes and current_size > 0:
            flush_zip()
        current_zip.write(src_path, arcname)
        current_size += size

    flush_zip()
    return vol_paths


# ── Main Export Orchestrator ──

async def run_export(db: AsyncSession, export_id: uuid.UUID, max_size_gb: int):
    """Execute the full export pipeline."""
    max_size_bytes = int(max_size_gb * 1024 * 1024 * 1024)

    # Load export record
    rec = (await db.execute(select(ExportRecord).where(ExportRecord.id == export_id))).scalar_one_or_none()
    if not rec:
        return

    rec.status = "processing"
    await db.commit()

    try:
        # Load project images (un-deleted)
        filters = rec.filter_criteria or {}
        conditions = [Image.project_id == rec.project_id, Image.deleted_at.is_(None)]

        if filters.get("annotation_status"):
            conditions.append(Image.annotation_status == filters["annotation_status"])
        if filters.get("review_status"):
            conditions.append(Image.review_status == filters["review_status"])

        images = (await db.execute(
            select(Image).where(*conditions).order_by(Image.original_name)
        )).scalars().all()

        if not images:
            rec.status = "failed"
            rec.error_msg = "No images found matching the criteria"
            await db.commit()
            return

        # Load categories (for COCO/YOLO class mapping)
        cats = (await db.execute(
            select(Category).where(Category.project_id == rec.project_id)
        )).scalars().all()
        cat_map = _build_category_map(cats)
        # Filter by category_ids if specified
        if filters.get("category_ids"):
            allowed = set(uuid.UUID(cid) for cid in filters["category_ids"])
            cat_map = {k: v for k, v in cat_map.items() if k in allowed}

        # Load annotations for all images in one query
        img_ids = [i.id for i in images]
        all_annos = (await db.execute(
            select(Annotation).where(
                Annotation.image_id.in_(img_ids),
                Annotation.is_latest == True,
            )
        )).scalars().all()

        annotations_by_image: dict[uuid.UUID, list[Annotation]] = {i.id: [] for i in images}
        for a in all_annos:
            annotations_by_image[a.image_id].append(a)

        # Generate output
        fmt = rec.export_format
        tmpdir = tempfile.mkdtemp()

        if fmt == "yolo":
            img_dir = os.path.join(tmpdir, "images")
            lbl_dir = os.path.join(tmpdir, "labels")
            os.makedirs(img_dir, exist_ok=True)
            for img in images:
                src = local_storage.get_file_path("images", img.storage_key)
                if os.path.exists(src):
                    import shutil
                    shutil.copy2(src, os.path.join(img_dir, img.original_name))
                _generate_yolo_annotations(img, annotations_by_image.get(img.id, []), cat_map, img_dir, lbl_dir)
            # Write classes.txt
            id_to_name = {v: c.name for c in cats if c.id in cat_map for v in [cat_map[c.id]]}
            with open(os.path.join(tmpdir, "classes.txt"), "w") as f:
                for i in sorted(id_to_name):
                    f.write(f"{id_to_name[i]}\n")

        elif fmt == "coco":
            coco_data = _collect_coco_data(images, annotations_by_image, cat_map, cats)
            with open(os.path.join(tmpdir, "annotations.json"), "w") as f:
                json.dump(coco_data, f, indent=2, default=str)

        elif fmt == "voc":
            img_dir = os.path.join(tmpdir, "JPEGImages")
            anno_dir = os.path.join(tmpdir, "Annotations")
            os.makedirs(img_dir, exist_ok=True)
            for img in images:
                src = local_storage.get_file_path("images", img.storage_key)
                if os.path.exists(src):
                    import shutil
                    shutil.copy2(src, os.path.join(img_dir, img.original_name))
                _generate_voc_xml(img, annotations_by_image.get(img.id, []), anno_dir)

        # Create ZIP archive
        vol_paths = _create_zip_archive(tmpdir, export_id, max_size_bytes)

        # Upload to storage
        storage_keys = []
        total_size = 0
        for vp in vol_paths:
            key = f"{rec.project_id}/{export_id.hex}/{os.path.basename(vp)}"
            with open(vp, "rb") as f:
                data = f.read()
            local_storage.upload_bytes("exports", key, data)
            storage_keys.append(key)
            total_size += len(data)

        # Update record
        rec.status = "completed"
        rec.file_url = storage_keys[0] if storage_keys else None
        rec.file_size = total_size
        rec.volumes = {"count": len(vol_paths), "keys": storage_keys, "image_count": len(images),
                        "annotation_count": sum(len(v) for v in annotations_by_image.values())}
        rec.completed_at = datetime.now(timezone.utc)
        await db.commit()

        # Cleanup temp dir
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    except Exception as e:
        rec.status = "failed"
        rec.error_msg = str(e)
        await db.commit()
