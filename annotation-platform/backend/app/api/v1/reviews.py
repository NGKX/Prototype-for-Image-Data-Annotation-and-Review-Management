from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/queue")
async def review_queue():
    return {"message": "Not implemented — Phase 6"}
