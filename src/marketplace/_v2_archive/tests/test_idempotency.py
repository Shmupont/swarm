"""Idempotency key tests — duplicate requests must return the same result."""
import json

from tests.conftest import register_agent, topup


def test_accept_bid_idempotent(client):
    buyer = register_agent(client, "Buyer")
    seller = register_agent(client, "Seller")
    topup(client, buyer["headers"], 10000)

    # Create task
    r = client.post(
        "/tasks",
        json={
            "title": "Idem test",
            "description": "test",
            "budget_cents": 5000,
            "deadline": "2099-12-31T23:59:59",
        },
        headers=buyer["headers"],
    )
    task_id = r.json()["id"]

    # Bid
    r = client.post(
        f"/tasks/{task_id}/bids",
        json={"price_cents": 3000, "eta_seconds": 60},
        headers=seller["headers"],
    )
    bid_id = r.json()["id"]

    idem_key = "unique-accept-key-123"

    # First accept
    r1 = client.post(
        f"/bids/{bid_id}/accept",
        headers={**buyer["headers"], "Idempotency-Key": idem_key},
    )
    assert r1.status_code == 200
    contract_id_1 = r1.json()["id"]

    # Second accept with SAME key → must return same result
    r2 = client.post(
        f"/bids/{bid_id}/accept",
        headers={**buyer["headers"], "Idempotency-Key": idem_key},
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == contract_id_1  # exact same response


def test_settle_idempotent(client):
    buyer = register_agent(client, "Buyer")
    seller = register_agent(client, "Seller")
    topup(client, buyer["headers"], 10000)

    r = client.post(
        "/tasks",
        json={
            "title": "Settle idem",
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

    r = client.post(f"/bids/{bid_id}/accept", headers=buyer["headers"])
    contract_id = r.json()["id"]

    # Artifact + submit
    r = client.post(
        f"/contracts/{contract_id}/artifacts",
        json={"kind": "text", "content_or_url": "done"},
        headers=seller["headers"],
    )
    r = client.post(f"/contracts/{contract_id}/submit", headers=seller["headers"])

    idem_key = "settle-once"

    r1 = client.post(
        f"/contracts/{contract_id}/accept",
        headers={**buyer["headers"], "Idempotency-Key": idem_key},
    )
    assert r1.status_code == 200

    r2 = client.post(
        f"/contracts/{contract_id}/accept",
        headers={**buyer["headers"], "Idempotency-Key": idem_key},
    )
    assert r2.status_code == 200
    assert r2.json() == r1.json()

    # Seller should only have been paid once
    r = client.get("/agents/balance", headers=seller["headers"])
    assert r.json()["balance_cents"] == 2000
