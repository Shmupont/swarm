"""Full task lifecycle: create → bid → accept → artifact → submit → evaluate → settle."""
import json

from tests.conftest import register_agent, topup


def test_full_lifecycle(client):
    buyer = register_agent(client, "Buyer")
    seller = register_agent(client, "Seller")

    topup(client, buyer["headers"], 10000)

    # Post task
    r = client.post(
        "/tasks",
        json={
            "title": "Generate JSON",
            "description": "Make a report",
            "acceptance_json": {
                "type": "json_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "score": {"type": "number"},
                    },
                    "required": ["summary", "score"],
                },
            },
            "budget_cents": 5000,
            "deadline": "2099-12-31T23:59:59",
        },
        headers=buyer["headers"],
    )
    assert r.status_code == 201
    task_id = r.json()["id"]

    # Bid
    r = client.post(
        f"/tasks/{task_id}/bids",
        json={"price_cents": 4000, "eta_seconds": 60},
        headers=seller["headers"],
    )
    assert r.status_code == 201
    bid_id = r.json()["id"]

    # Accept bid → contract + escrow
    r = client.post(f"/bids/{bid_id}/accept", headers=buyer["headers"])
    assert r.status_code == 200
    contract_id = r.json()["id"]

    # Verify buyer balance decreased
    r = client.get("/agents/balance", headers=buyer["headers"])
    assert r.json()["balance_cents"] == 6000  # 10000 - 4000

    # Submit artifact
    artifact_body = json.dumps({"summary": "all good", "score": 95})
    r = client.post(
        f"/contracts/{contract_id}/artifacts",
        json={"kind": "json", "content_or_url": artifact_body},
        headers=seller["headers"],
    )
    assert r.status_code == 201

    # Submit contract
    r = client.post(f"/contracts/{contract_id}/submit", headers=seller["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "submitted"

    # Evaluate
    r = client.post(f"/contracts/{contract_id}/evaluate", headers=buyer["headers"])
    assert r.status_code == 200
    assert r.json()["result"] == "pass"

    # Accept → settle
    r = client.post(f"/contracts/{contract_id}/accept", headers=buyer["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "settled"

    # Seller got paid
    r = client.get("/agents/balance", headers=seller["headers"])
    assert r.json()["balance_cents"] == 4000

    # Reputation updated
    r = client.get(f"/agents/{seller['agent_id']}/reputation")
    assert r.json()["total_completed"] == 1
    assert r.json()["reputation_score"] == 1.0

    # Task marked completed
    r = client.get(f"/tasks/{task_id}")
    assert r.json()["status"] == "completed"
