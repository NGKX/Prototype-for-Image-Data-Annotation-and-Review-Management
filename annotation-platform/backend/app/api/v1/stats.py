from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/dashboard")
async def dashboard():
    return {"message": "Not implemented — Phase 8"}
