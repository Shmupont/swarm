"""Auth and rate-limit tests."""
from tests.conftest import register_agent


def test_no_auth_header(client):
    r = client.get("/agents/balance")
    assert r.status_code in (401, 403)


def test_invalid_key_format(client):
    r = client.get(
        "/agents/balance",
        headers={"Authorization": "Bearer bad-key"},
    )
    assert r.status_code == 401


def test_invalid_key_value(client):
    r = client.get(
        "/agents/balance",
        headers={"Authorization": "Bearer aml_fakeprefix_fakesecret"},
    )
    assert r.status_code == 401


def test_valid_key_works(client):
    agent = register_agent(client, "AuthTest")
    r = client.get("/agents/balance", headers=agent["headers"])
    assert r.status_code == 200


def test_key_rotation_invalidates_old(client):
    agent = register_agent(client, "RotateTest")
    old_headers = agent["headers"]

    # Rotate
    r = client.post("/agents/rotate_key", headers=old_headers)
    assert r.status_code == 200
    new_key = r.json()["api_key"]

    # Old key should fail
    r = client.get("/agents/balance", headers=old_headers)
    assert r.status_code == 401

    # New key works
    r = client.get(
        "/agents/balance",
        headers={"Authorization": f"Bearer {new_key}"},
    )
    assert r.status_code == 200


def test_cannot_bid_own_task(client):
    agent = register_agent(client, "SelfBid")
    r = client.post(
        "/agents/balance/topup",
        json={"amount_cents": 10000},
        headers=agent["headers"],
    )

    r = client.post(
        "/tasks",
        json={
            "title": "My task",
            "description": "test",
            "budget_cents": 1000,
            "deadline": "2099-12-31T23:59:59",
        },
        headers=agent["headers"],
    )
    task_id = r.json()["id"]

    r = client.post(
        f"/tasks/{task_id}/bids",
        json={"price_cents": 500, "eta_seconds": 60},
        headers=agent["headers"],
    )
    assert r.status_code == 400
    assert "own task" in r.json()["detail"]


def test_seller_cannot_accept_bid(client):
    buyer = register_agent(client, "Buyer")
    seller = register_agent(client, "Seller")

    r = client.post(
        "/agents/balance/topup",
        json={"amount_cents": 10000},
        headers=buyer["headers"],
    )

    r = client.post(
        "/tasks",
        json={
            "title": "Auth test",
            "description": "test",
            "budget_cents": 5000,
            "deadline": "2099-12-31T23:59:59",
        },
        headers=buyer["headers"],
    )
    task_id = r.json()["id"]

    r = client.post(
        f"/tasks/{task_id}/bids",
        json={"price_cents": 2000, "eta_seconds": 60},
        headers=seller["headers"],
    )
    bid_id = r.json()["id"]

    # Seller tries to accept their own bid → 403
    r = client.post(f"/bids/{bid_id}/accept", headers=seller["headers"])
    assert r.status_code == 403
