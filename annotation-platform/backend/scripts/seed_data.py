"""Seed script: creates 4 test users and a sample project.

Usage:
    PYTHONPATH=. python scripts/seed_data.py
"""
import asyncio
import sys
sys.path.insert(0, ".")

from sqlalchemy import select
from app.core.database import async_session
from app.core.security import hash_password
from app.models.user import User
from app.models.project import Project, ProjectMember


USERS = [
    {"username": "admin", "password": "admin123", "role": "admin", "display_name": "System Admin"},
    {"username": "manager", "password": "manager123", "role": "data_manager", "display_name": "Data Manager"},
    {"username": "reviewer", "password": "reviewer123", "role": "reviewer", "display_name": "Reviewer"},
    {"username": "annotator", "password": "annotator123", "role": "annotator", "display_name": "Annotator"},
]


async def seed():
    async with async_session() as db:
        # Create users
        user_map = {}
        for u in USERS:
            result = await db.execute(select(User).where(User.username == u["username"]))
            existing = result.scalar_one_or_none()
            if existing:
                user_map[u["username"]] = existing
                print(f"User {u['username']} already exists, skipping.")
            else:
                user = User(
                    username=u["username"],
                    password_hash=hash_password(u["password"]),
                    role=u["role"],
                    display_name=u["display_name"],
                )
                db.add(user)
                await db.flush()
                user_map[u["username"]] = user
                print(f"Created user: {u['username']} ({u['role']})")

        # Create sample project
        result = await db.execute(select(Project).where(Project.name == "路面病害检测"))
        project = result.scalar_one_or_none()
        if project:
            print("Sample project already exists, skipping.")
        else:
            project = Project(
                name="路面病害检测",
                description="路面裂缝、坑洞等病害图片标注项目",
                created_by=user_map["admin"].id,
            )
            db.add(project)
            await db.flush()

            # Add all users as project members
            for key, role in [("manager", "manager"), ("reviewer", "reviewer"), ("annotator", "annotator")]:
                db.add(ProjectMember(project_id=project.id, user_id=user_map[key].id, project_role=role))
            print(f"Created project: {project.name}")

        await db.commit()

    print("\nSeed complete!")
    print("Default credentials:")
    for u in USERS:
        print(f"  {u['role']:15s} | {u['username']}/{u['password']}")


if __name__ == "__main__":
    asyncio.run(seed())
