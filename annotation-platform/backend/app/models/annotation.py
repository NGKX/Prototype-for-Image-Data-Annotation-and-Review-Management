import uuid
from datetime import datetime
from sqlalchemy import String, Uuid, Integer, Boolean, Float, DateTime, ForeignKey, UniqueConstraint, func, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, uuid_pk


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[uuid.UUID] = uuid_pk()
    image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("images.id"), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"))
    annotator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    type: Mapped[str] = mapped_column(String(32), nullable=False)
    geometry: Mapped[dict] = mapped_column(JSON, nullable=False)

    is_auto: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float | None] = mapped_column(Float)
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True)
    superseded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("annotations.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)

    review_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    image = relationship("Image", back_populates="annotations")
    category = relationship("Category")
    annotator = relationship("User", foreign_keys=[annotator_id])
    versions = relationship("AnnotationVersion", back_populates="annotation", lazy="selectin",
                            order_by="AnnotationVersion.version")
    reviews = relationship("ReviewRecord", back_populates="annotation", lazy="selectin")


class AnnotationVersion(Base):
    __tablename__ = "annotation_versions"
    __table_args__ = (UniqueConstraint("annotation_id", "version"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    annotation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("annotations.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    geometry: Mapped[dict] = mapped_column(JSON, nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"))
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    change_summary: Mapped[str | None] = mapped_column(String(512))
    source: Mapped[str] = mapped_column(String(32), default="manual")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    annotation = relationship("Annotation", back_populates="versions")
