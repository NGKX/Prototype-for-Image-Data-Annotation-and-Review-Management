from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("")
async def list_exports():
    return {"message": "Not implemented — Phase 7"}
