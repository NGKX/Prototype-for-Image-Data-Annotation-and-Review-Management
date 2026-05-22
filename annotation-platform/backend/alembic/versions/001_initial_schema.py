"""initial schema — all 10 tables with indexes

Revision ID: 001
Revises:
Create Date: 2026-05-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table("users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="annotator"),
        sa.Column("display_name", sa.String(128)),
        sa.Column("email", sa.String(256)),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_users_role", "users", ["role"])

    # 2. projects
    op.create_table("projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 3. project_members
    op.create_table("project_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_role", sa.String(32), nullable=False, server_default="annotator"),
        sa.UniqueConstraint("project_id", "user_id"),
    )

    # 4. images
    op.create_table("images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("original_name", sa.String(512), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("thumbnail_key", sa.String(512)),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("file_size", sa.BigInteger()),
        sa.Column("mime_type", sa.String(64), server_default="image/jpeg"),
        sa.Column("annotation_status", sa.String(32), server_default="unannotated"),
        sa.Column("review_status", sa.String(32), server_default="pending"),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_images_project", "images", ["project_id"])
    op.create_index("idx_images_review_status", "images", ["project_id", "review_status"])
    op.create_index("idx_images_annotation_status", "images", ["project_id", "annotation_status"])
    op.create_index("idx_images_project_status", "images", ["project_id", "deleted_at", "annotation_status", "review_status"])

    # 5. categories
    op.create_table("categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("color", sa.String(7), server_default="#3388FF"),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id")),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("shortcut_key", sa.String(16)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("project_id", "name"),
    )
    op.create_index("idx_categories_project", "categories", ["project_id"])
    op.create_index("idx_categories_parent", "categories", ["parent_id"])

    # 6. annotations
    op.create_table("annotations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("image_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("images.id"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id")),
        sa.Column("annotator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("geometry", postgresql.JSONB(), nullable=False),
        sa.Column("is_auto", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("confidence", sa.Float()),
        sa.Column("is_latest", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("superseded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("annotations.id")),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("review_status", sa.String(32), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_annotations_image", "annotations", ["image_id"])
    op.create_index("idx_annotations_category", "annotations", ["category_id"])
    op.create_index("idx_annotations_annotator", "annotations", ["annotator_id", "created_at"])
    op.create_index("idx_annotations_review", "annotations", ["review_status"])
    op.create_index("idx_annotations_type", "annotations", ["type"])
    op.create_index("idx_annotations_image_review", "annotations", ["image_id", "review_status"])
    op.create_index("idx_annotations_image_latest", "annotations", ["image_id", "is_latest"], postgresql_where=sa.text("is_latest = TRUE"))
    op.create_index("idx_annotations_geometry_gin", "annotations", ["geometry"], postgresql_using="gin", postgresql_ops={"geometry": "jsonb_path_ops"})

    # 7. annotation_versions
    op.create_table("annotation_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("annotation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("annotations.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("geometry", postgresql.JSONB(), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id")),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("change_summary", sa.String(512)),
        sa.Column("source", sa.String(32), server_default="manual"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("annotation_id", "version"),
    )

    # 8. review_records
    op.create_table("review_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("annotation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("annotations.id"), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("preset_reason", sa.String(64)),
        sa.Column("triggered_by", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_review_annotation", "review_records", ["annotation_id", "created_at"])
    op.create_index("idx_review_reviewer", "review_records", ["reviewer_id"])
    op.create_index("idx_review_created", "review_records", ["created_at"])

    # 9. task_assignments
    op.create_table("task_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("image_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("images.id"), nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("task_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), server_default="assigned"),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("image_id", "assignee_id", "task_type"),
    )
    op.create_index("idx_task_assignments_assignee", "task_assignments", ["assignee_id", "status", "locked_until"])
    op.create_index("idx_task_assignments_image", "task_assignments", ["image_id", "task_type"])

    # 10. export_records
    op.create_table("export_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("export_format", sa.String(32), nullable=False),
        sa.Column("filter_criteria", postgresql.JSONB()),
        sa.Column("file_url", sa.String(1024)),
        sa.Column("file_size", sa.BigInteger()),
        sa.Column("volumes", postgresql.JSONB()),
        sa.Column("status", sa.String(32), server_default="processing"),
        sa.Column("error_msg", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_export_project", "export_records", ["project_id", "created_at"])

    # 11. audit_logs
    op.create_table("audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_type", sa.String(64)),
        sa.Column("target_id", postgresql.UUID(as_uuid=True)),
        sa.Column("detail", postgresql.JSONB()),
        sa.Column("ip_address", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_audit_user_time", "audit_logs", ["user_id", "created_at"])
    op.create_index("idx_audit_created", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("export_records")
    op.drop_table("task_assignments")
    op.drop_table("review_records")
    op.drop_table("annotation_versions")
    op.drop_table("annotations")
    op.drop_table("categories")
    op.drop_table("images")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("users")
