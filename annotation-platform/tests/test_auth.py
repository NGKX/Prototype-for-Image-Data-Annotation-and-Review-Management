"""Core smoke tests for auth and API endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_register_login(client: AsyncClient):
    # Register
    r = await client.post("/api/v1/auth/register", json={
        "username": "smokeuser", "password": "smokepass", "display_name": "Smoke Test"
    })
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert data["user"]["username"] == "smokeuser"

    # Login
    r = await client.post("/api/v1/auth/login", json={
        "username": "smokeuser", "password": "smokepass"
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.anyio
async def test_auth_required(client: AsyncClient):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401  # or 403


@pytest.mark.anyio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.anyio
async def test_projects_crud(client: AsyncClient, auth_headers):
    # Create
    r = await client.post("/api/v1/projects", json={"name": "Test Project"}, headers=auth_headers)
    assert r.status_code == 201
    pid = r.json()["id"]

    # List
    r = await client.get("/api/v1/projects", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] >= 1

    # Get
    r = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Test Project"


@pytest.mark.anyio
async def test_stats_endpoint(client: AsyncClient, auth_headers):
    # Create project first
    r = await client.post("/api/v1/projects", json={"name": "Stats Project"}, headers=auth_headers)
    pid = r.json()["id"]

    r = await client.get(f"/api/v1/stats/dashboard?project_id={pid}", headers=auth_headers)
    assert r.status_code == 200
    assert "images" in r.json()
