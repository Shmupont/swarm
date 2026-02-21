"""User registration, agent management, listings, and marketplace tests."""
from tests.conftest import register_user


def test_register_and_login(client):
    user = register_user(client, "alice@test.com", "securepass1")
    assert user["token"]

    # Login with same creds
    r = client.post("/auth/login", json={"email": "alice@test.com", "password": "securepass1"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_register_duplicate_email(client):
    register_user(client, "dup@test.com")
    r = client.post("/auth/register", json={"email": "dup@test.com", "password": "password123"})
    assert r.status_code == 409


def test_login_wrong_password(client):
    register_user(client, "wrong@test.com")
    r = client.post("/auth/login", json={"email": "wrong@test.com", "password": "badpassword"})
    assert r.status_code == 401


def test_get_me(client):
    user = register_user(client, "me@test.com")
    r = client.get("/auth/me", headers=user["headers"])
    assert r.status_code == 200
    assert r.json()["email"] == "me@test.com"


def test_create_agent_for_user(client):
    user = register_user(client, "owner@test.com")
    r = client.post(
        "/users/agents",
        json={
            "name": "MyBot",
            "display_name": "My Test Bot",
            "category": "development",
            "capabilities_json": {"lang": "python"},
        },
        headers=user["headers"],
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "MyBot"
    assert data["api_key"].startswith("aml_")
    assert data["category"] == "development"


def test_list_my_agents(client):
    user = register_user(client, "lister@test.com")
    client.post(
        "/users/agents",
        json={"name": "Bot1", "display_name": "Bot 1", "category": "tax"},
        headers=user["headers"],
    )
    client.post(
        "/users/agents",
        json={"name": "Bot2", "display_name": "Bot 2", "category": "legal"},
        headers=user["headers"],
    )
    r = client.get("/users/agents", headers=user["headers"])
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_create_listing(client):
    user = register_user(client, "seller@test.com")
    r = client.post(
        "/users/agents",
        json={"name": "TaxBot", "display_name": "Tax Bot", "category": "tax"},
        headers=user["headers"],
    )
    agent_id = r.json()["id"]

    r = client.post(
        "/users/listings",
        json={
            "agent_id": agent_id,
            "category": "tax",
            "headline": "Best Tax Service",
            "description": "We do taxes right.",
            "pricing_json": {"price_cents": 5000},
        },
        headers=user["headers"],
    )
    assert r.status_code == 201
    data = r.json()
    assert data["headline"] == "Best Tax Service"
    assert data["agent_name"] == "TaxBot"


def test_browse_marketplace(client):
    user = register_user(client, "browse@test.com")
    r = client.post(
        "/users/agents",
        json={"name": "BrowseBot", "display_name": "Browse Bot", "category": "finance"},
        headers=user["headers"],
    )
    agent_id = r.json()["id"]

    client.post(
        "/users/listings",
        json={
            "agent_id": agent_id,
            "category": "finance",
            "headline": "Finance Agent",
            "description": "Financial analysis.",
        },
        headers=user["headers"],
    )

    # Browse all
    r = client.get("/marketplace/listings")
    assert r.status_code == 200
    assert len(r.json()) >= 1

    # Browse by category
    r = client.get("/marketplace/listings", params={"category": "finance"})
    assert r.status_code == 200
    assert len(r.json()) >= 1

    # Browse wrong category
    r = client.get("/marketplace/listings", params={"category": "nonexistent"})
    assert r.status_code == 200
    assert len(r.json()) == 0


def test_hire_flow(client):
    # Seller creates listing
    seller = register_user(client, "hire_seller@test.com")
    r = client.post(
        "/users/agents",
        json={"name": "HireBot", "display_name": "Hire Bot", "category": "tax"},
        headers=seller["headers"],
    )
    agent_id = r.json()["id"]

    r = client.post(
        "/users/listings",
        json={
            "agent_id": agent_id,
            "category": "tax",
            "headline": "Hire Me",
            "description": "I do tax work.",
            "pricing_json": {"price_cents": 3000},
        },
        headers=seller["headers"],
    )
    listing_id = r.json()["id"]

    # Buyer registers and tops up
    buyer = register_user(client, "hire_buyer@test.com")
    client.post(
        "/users/wallet/topup",
        json={"amount_cents": 10000},
        headers=buyer["headers"],
    )

    # Buyer hires from listing
    r = client.post(
        f"/marketplace/listings/{listing_id}/hire",
        json={
            "title": "Do my taxes",
            "description": "File my 2025 taxes",
            "budget_cents": 3000,
            "deadline": "2099-12-31T23:59:59",
        },
        headers=buyer["headers"],
    )
    assert r.status_code == 201
    contract = r.json()
    assert contract["hiring_user_id"] is not None
    assert contract["price_cents"] == 3000

    # Verify buyer wallet deducted
    r = client.get("/users/wallet", headers=buyer["headers"])
    assert r.json()["balance_cents"] == 7000


def test_user_wallet(client):
    user = register_user(client, "wallet@test.com")

    r = client.get("/users/wallet", headers=user["headers"])
    assert r.status_code == 200
    assert r.json()["balance_cents"] == 0

    r = client.post(
        "/users/wallet/topup",
        json={"amount_cents": 5000},
        headers=user["headers"],
    )
    assert r.status_code == 200
    assert r.json()["balance_cents"] == 5000


def test_update_listing(client):
    user = register_user(client, "update@test.com")
    r = client.post(
        "/users/agents",
        json={"name": "UpdBot", "display_name": "Update Bot", "category": "legal"},
        headers=user["headers"],
    )
    agent_id = r.json()["id"]

    r = client.post(
        "/users/listings",
        json={
            "agent_id": agent_id,
            "category": "legal",
            "headline": "Original Headline",
            "description": "Original desc.",
        },
        headers=user["headers"],
    )
    listing_id = r.json()["id"]

    r = client.patch(
        f"/users/listings/{listing_id}",
        json={"headline": "Updated Headline"},
        headers=user["headers"],
    )
    assert r.status_code == 200
    assert r.json()["headline"] == "Updated Headline"
