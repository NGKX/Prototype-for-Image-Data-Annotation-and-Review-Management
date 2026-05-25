import uuid
from datetime import datetime
from sqlalchemy import String, Uuid, Integer, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, uuid_pk


class Image(Base):
    __tablename__ = "images"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    original_name: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    thumbnail_key: Mapped[str | None] = mapped_column(String(512))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")

    annotation_status: Mapped[str] = mapped_column(String(32), default="unannotated", nullable=False)
    review_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    is_sensitive: Mapped[bool] = mapped_column(default=False, nullable=False)
    sensitive_note: Mapped[str | None] = mapped_column(String(512))

    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="images")
    annotations = relationship("Annotation", back_populates="image", lazy="selectin")
    uploader = relationship("User", foreign_keys=[uploaded_by])
