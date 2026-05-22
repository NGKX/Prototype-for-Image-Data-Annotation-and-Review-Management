from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("")
async def list_annotations():
    return {"message": "Not implemented — Phase 3"}
