import uuid
from datetime import datetime
from sqlalchemy import String, Uuid, BigInteger, Text, DateTime, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, uuid_pk


class ExportRecord(Base):
    __tablename__ = "export_records"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    export_format: Mapped[str] = mapped_column(String(32), nullable=False)
    filter_criteria: Mapped[dict | None] = mapped_column(JSON)
    file_url: Mapped[str | None] = mapped_column(String(1024))
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    volumes: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="processing")
    error_msg: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
