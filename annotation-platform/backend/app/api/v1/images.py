from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("")
async def list_images():
    return {"message": "Not implemented — Phase 2"}


@router.post("/upload")
async def upload_images():
    return {"message": "Not implemented — Phase 2"}
