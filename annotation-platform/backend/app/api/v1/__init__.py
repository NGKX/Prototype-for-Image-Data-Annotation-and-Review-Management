from fastapi import APIRouter
from app.api.v1 import auth, projects, images, categories, annotations, reviews, exports, stats

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(images.router, prefix="/images", tags=["images"])
router.include_router(categories.router, prefix="/categories", tags=["categories"])
router.include_router(annotations.router, prefix="/annotations", tags=["annotations"])
router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
router.include_router(exports.router, prefix="/exports", tags=["exports"])
router.include_router(stats.router, prefix="/stats", tags=["stats"])
