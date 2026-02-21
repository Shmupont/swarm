#!/usr/bin/env python3
"""
Seed script — demonstrates the full lifecycle including user-managed agents.

Usage:
    python scripts/seed.py            # defaults to http://localhost:8000
    python scripts/seed.py http://api:8000
"""
import json
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def main():
    c = httpx.Client(base_url=BASE, timeout=15)

    # ── Phase 1: User registration + agent creation ─────────────────

    print("=== 1. Register user Matt ===")
    r = c.post("/auth/register", json={"email": "matt@example.com", "password": "password123"})
    r.raise_for_status()
    matt_token = r.json()["access_token"]
    matt_h = {"Authorization": f"Bearer {matt_token}"}
    print(f"  JWT token obtained")

    print("=== 2. Matt creates a Tax Agent ===")
    r = c.post(
        "/users/agents",
        json={
            "name": "TaxBot-Pro",
            "display_name": "TaxBot Pro — Automated Tax Filing",
            "category": "tax",
            "capabilities_json": {
                "services": ["tax_filing", "tax_advisory", "audit_prep"],
                "jurisdictions": ["US", "CA"],
            },
            "allow_subcontracting": False,
            "require_owner_approval": True,
        },
        headers=matt_h,
    )
    r.raise_for_status()
    tax_agent = r.json()
    tax_agent_id = tax_agent["id"]
    tax_agent_key = tax_agent["api_key"]
    print(f"  agent_id={tax_agent_id}")

    print("=== 3. Matt creates a listing for TaxBot Pro ===")
    r = c.post(
        "/users/listings",
        json={
            "agent_id": tax_agent_id,
            "category": "tax",
            "headline": "Expert AI Tax Filing — Fast & Accurate",
            "description": "TaxBot Pro handles personal and business tax returns with 99.5% accuracy. Supports W-2, 1099, Schedule C, and more.",
            "pricing_json": {
                "base_price_cents": 5000,
                "currency": "USD",
                "per_return": True,
            },
        },
        headers=matt_h,
    )
    r.raise_for_status()
    listing = r.json()
    listing_id = listing["id"]
    print(f"  listing_id={listing_id}")

    # ── Phase 2: Second user browses and hires ──────────────────────

    print("=== 4. Register user Sarah ===")
    r = c.post("/auth/register", json={"email": "sarah@example.com", "password": "password456"})
    r.raise_for_status()
    sarah_token = r.json()["access_token"]
    sarah_h = {"Authorization": f"Bearer {sarah_token}"}
    print(f"  JWT token obtained")

    print("=== 5. Sarah tops up her wallet ($200) ===")
    r = c.post("/users/wallet/topup", json={"amount_cents": 20000}, headers=sarah_h)
    r.raise_for_status()
    print(f"  balance={r.json()['balance_cents']} cents")

    print("=== 6. Sarah browses marketplace listings ===")
    r = c.get("/marketplace/listings", params={"category": "tax"})
    r.raise_for_status()
    listings = r.json()
    print(f"  found {len(listings)} tax listing(s)")

    print("=== 7. Sarah hires TaxBot Pro ===")
    r = c.post(
        f"/marketplace/listings/{listing_id}/hire",
        json={
            "title": "File 2025 Personal Tax Return",
            "description": "Need my 2025 personal tax return filed. W-2 income, some 1099 freelance work.",
            "budget_cents": 5000,
            "deadline": "2026-04-15T23:59:59",
            "acceptance_json": {"type": "manual"},
        },
        headers=sarah_h,
    )
    r.raise_for_status()
    contract = r.json()
    contract_id = contract["id"]
    print(f"  contract_id={contract_id}")

    # ── Phase 3: Agent does work (using API key) ────────────────────

    tax_h = {"Authorization": f"Bearer {tax_agent_key}"}

    print("=== 8. TaxBot Pro submits artifact ===")
    artifact_content = json.dumps({
        "form": "1040",
        "status": "completed",
        "refund_amount_cents": 234500,
        "summary": "Tax return filed successfully. Federal refund of $2,345.00 expected.",
    })
    r = c.post(
        f"/contracts/{contract_id}/artifacts",
        json={"kind": "json", "content_or_url": artifact_content},
        headers=tax_h,
    )
    r.raise_for_status()
    print(f"  artifact submitted, checksum={r.json()['checksum'][:16]}…")

    print("=== 9. TaxBot Pro marks as submitted ===")
    r = c.post(f"/contracts/{contract_id}/submit", headers=tax_h)
    r.raise_for_status()
    print(f"  status={r.json()['status']}")

    # ── Phase 4: Original agent-only lifecycle (backward compat) ────

    print("\n=== 10. Register buyer agent (Alice) ===")
    r = c.post("/agents/register", json={"name": "Alice (Buyer)"})
    r.raise_for_status()
    alice = r.json()
    alice_key = alice["api_key"]
    alice_id = alice["agent_id"]
    ah = {"Authorization": f"Bearer {alice_key}"}
    print(f"  agent_id={alice_id}")

    print("=== 11. Register seller agent (Bob) ===")
    r = c.post("/agents/register", json={"name": "Bob (Seller)"})
    r.raise_for_status()
    bob = r.json()
    bob_key = bob["api_key"]
    bob_id = bob["agent_id"]
    bh = {"Authorization": f"Bearer {bob_key}"}
    print(f"  agent_id={bob_id}")

    print("=== 12. Top up Alice ($100) ===")
    r = c.post("/agents/balance/topup", json={"amount_cents": 10000}, headers=ah)
    r.raise_for_status()
    print(f"  balance={r.json()['balance_cents']} cents")

    print("=== 13. Alice posts a task ===")
    r = c.post(
        "/tasks",
        json={
            "title": "Generate a JSON report",
            "description": "Create a summary report in JSON format.",
            "inputs_json": {"data": "sample input"},
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
            "deadline": "2026-12-31T23:59:59",
        },
        headers=ah,
    )
    r.raise_for_status()
    task = r.json()
    task_id = task["id"]
    print(f"  task_id={task_id}")

    print("=== 14. Bob bids ===")
    r = c.post(
        f"/tasks/{task_id}/bids",
        json={"price_cents": 4000, "eta_seconds": 120},
        headers=bh,
    )
    r.raise_for_status()
    bid_id = r.json()["id"]
    print(f"  bid_id={bid_id}")

    print("=== 15. Alice accepts bid ===")
    r = c.post(f"/bids/{bid_id}/accept", headers={**ah, "Idempotency-Key": f"accept-{bid_id}"})
    r.raise_for_status()
    a2a_contract_id = r.json()["id"]
    print(f"  contract_id={a2a_contract_id}")

    print("=== 16. Bob delivers ===")
    artifact_content = json.dumps({"summary": "All systems nominal", "score": 97.5})
    r = c.post(
        f"/contracts/{a2a_contract_id}/artifacts",
        json={"kind": "json", "content_or_url": artifact_content},
        headers=bh,
    )
    r.raise_for_status()
    r = c.post(f"/contracts/{a2a_contract_id}/submit", headers=bh)
    r.raise_for_status()
    print(f"  submitted")

    print("=== 17. Alice evaluates + accepts ===")
    r = c.post(f"/contracts/{a2a_contract_id}/evaluate", headers=ah)
    r.raise_for_status()
    print(f"  eval result={r.json()['result']}")
    r = c.post(
        f"/contracts/{a2a_contract_id}/accept",
        headers={**ah, "Idempotency-Key": f"settle-{a2a_contract_id}"},
    )
    r.raise_for_status()
    print(f"  settled")

    print("\n✓ Full lifecycle complete (user-managed + agent-to-agent).")


if __name__ == "__main__":
    main()
