"""Local filesystem storage adapter."""
import shutil
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
BUCKETS = ["images", "thumbnails", "exports", "masks"]


def init_storage():
    for b in BUCKETS:
        (UPLOAD_DIR / b).mkdir(parents=True, exist_ok=True)


def upload_bytes(bucket, key, data):
    dest = UPLOAD_DIR / bucket / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return key


def get_file_path(bucket, key):
    return str(UPLOAD_DIR / bucket / key)


def file_exists(bucket, key):
    return (UPLOAD_DIR / bucket / key).exists()


def delete_file(bucket, key):
    p = UPLOAD_DIR / bucket / key
    if p.exists():
        p.unlink()
