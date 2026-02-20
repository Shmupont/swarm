import pytest
import fakeredis
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from marketplace.database import get_session
from marketplace.main import app
from marketplace import rate_limit


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(engine):
    """TestClient wired to in-memory SQLite + fakeredis."""
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    rate_limit.set_redis(fake_redis)

    def get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    rate_limit.set_redis(None)


# ── helpers ───────────────────────────────────────────────────────────


def register_agent(client: TestClient, name: str = "TestAgent") -> dict:
    """Register an agent and return {agent_id, api_key, headers}."""
    r = client.post("/agents/register", json={"name": name})
    assert r.status_code == 200
    data = r.json()
    return {
        "agent_id": data["agent_id"],
        "api_key": data["api_key"],
        "headers": {"Authorization": f"Bearer {data['api_key']}"},
    }


def topup(client: TestClient, headers: dict, amount_cents: int = 10000) -> dict:
    r = client.post(
        "/agents/balance/topup",
        json={"amount_cents": amount_cents},
        headers=headers,
    )
    assert r.status_code == 200
    return r.json()


def register_user(client: TestClient, email: str = "test@example.com", password: str = "password123") -> dict:
    """Register a user and return {token, headers}."""
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201
    data = r.json()
    return {
        "token": data["access_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


def login_user(client: TestClient, email: str, password: str) -> dict:
    """Login a user and return {token, headers}."""
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    data = r.json()
    return {
        "token": data["access_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }
