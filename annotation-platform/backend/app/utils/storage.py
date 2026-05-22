from minio import Minio
from app.core.config import settings

_minio_client: Minio | None = None


def get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _minio_client


async def init_minio_buckets():
    client = get_minio_client()
    buckets = ["images", "thumbnails", "exports", "masks"]
    for bucket in buckets:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)


def upload_file(object_name: str, file_path: str, content_type: str = "application/octet-stream") -> str:
    client = get_minio_client()
    client.fput_object(settings.MINIO_BUCKET, object_name, file_path, content_type=content_type)
    return object_name


def upload_bytes(object_name: str, data: bytes, length: int, content_type: str = "application/octet-stream") -> str:
    from io import BytesIO
    client = get_minio_client()
    client.put_object(settings.MINIO_BUCKET, object_name, BytesIO(data), length, content_type=content_type)
    return object_name


def get_presigned_url(object_name: str, expires: int = 3600) -> str:
    client = get_minio_client()
    return client.presigned_get_object(settings.MINIO_BUCKET, object_name, expires=expires)


def delete_file(object_name: str):
    client = get_minio_client()
    client.remove_object(settings.MINIO_BUCKET, object_name)


def file_exists(object_name: str) -> bool:
    try:
        client = get_minio_client()
        client.stat_object(settings.MINIO_BUCKET, object_name)
        return True
    except Exception:
        return False
