from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("")
async def list_categories():
    return {"message": "Not implemented — Phase 3"}
