#!/usr/bin/env python3
"""Migration: add openai_assistant_id to agent_profiles, openai_thread_id to agent_sessions."""

import os
import sys

import psycopg2

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:xVdaBmfhuUcdFYMQWAbSPjTvlALNaFKK@switchback.proxy.rlwy.net:54371/railway",
)


def run():
    print(f"Connecting to DB...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Adding openai_assistant_id to agent_profiles...")
    cur.execute(
        "ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS openai_assistant_id TEXT;"
    )

    print("Adding openai_thread_id to agent_sessions...")
    cur.execute(
        "ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS openai_thread_id TEXT;"
    )

    cur.close()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    run()
