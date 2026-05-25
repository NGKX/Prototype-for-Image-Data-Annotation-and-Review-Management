"""Test fixtures for the annotation platform."""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport

# Add backend to path
import sys
sys.path.insert(0, "annotation-platform/backend")

from app.main import app
from app.core.database import async_session, engine, Base


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def auth_headers(client):
    """Register and login, return headers with Bearer token."""
    r = await client.post("/api/v1/auth/register", json={
        "username": "testuser", "password": "testpass", "display_name": "Test User"
    })
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
