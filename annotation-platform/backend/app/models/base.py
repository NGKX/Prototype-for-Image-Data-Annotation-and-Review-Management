import uuid
from datetime import datetime
from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column



class Base(DeclarativeBase):
    pass


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


def timestamp_mixin():
    return (
        mapped_column(DateTime(timezone=True), default=func.now(), nullable=False),
        mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False),
    )
