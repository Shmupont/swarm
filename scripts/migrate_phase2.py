import os
#!/usr/bin/env python3
"""
Phase 2 database migration — background jobs, job runs, notifications,
and automation columns on agent_profiles.
"""
import os
import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    os.environ.get("DATABASE_URL", ""),
)


def run():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print("Running Phase 2 migrations...")

    # ── New tables ──────────────────────────────────────────────────────

    cur.execute("""
        CREATE TABLE IF NOT EXISTS background_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
            license_id UUID REFERENCES agent_licenses(id) ON DELETE SET NULL,

            config JSONB NOT NULL DEFAULT '{}',

            billing_model VARCHAR(20) NOT NULL DEFAULT 'per_run',
            schedule VARCHAR(20) NOT NULL DEFAULT 'daily',

            status VARCHAR(20) NOT NULL DEFAULT 'active',
            last_run_at TIMESTAMPTZ,
            next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            run_count INTEGER NOT NULL DEFAULT 0,

            credits_spent_total INTEGER NOT NULL DEFAULT 0,
            billing_period_start TIMESTAMPTZ DEFAULT NOW(),
            billing_period_end TIMESTAMPTZ,

            output_methods TEXT[] NOT NULL DEFAULT '{in_app}',
            notification_email VARCHAR(255),

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    print("  ✓ background_jobs table")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS job_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES background_jobs(id) ON DELETE CASCADE,

            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,

            status VARCHAR(20) NOT NULL DEFAULT 'running',
            result TEXT,
            error TEXT,
            credits_charged INTEGER NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    print("  ✓ job_runs table")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            job_id UUID REFERENCES background_jobs(id) ON DELETE SET NULL,
            job_run_id UUID REFERENCES job_runs(id) ON DELETE SET NULL,

            type VARCHAR(50) NOT NULL DEFAULT 'job_result',
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            read BOOLEAN NOT NULL DEFAULT FALSE,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    print("  ✓ notifications table")

    # ── Indexes ─────────────────────────────────────────────────────────

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_background_jobs_user
        ON background_jobs(user_id)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_background_jobs_next_run
        ON background_jobs(next_run_at) WHERE status = 'active'
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_job_runs_job
        ON job_runs(job_id)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user
        ON notifications(user_id, read)
    """)
    print("  ✓ indexes")

    # ── Columns on agent_profiles ────────────────────────────────────────

    new_cols = {
        "agent_mode": "VARCHAR(20) DEFAULT 'chat'",
        "billing_model": "VARCHAR(20) DEFAULT 'per_answer'",
        "schedule_options": "TEXT[] DEFAULT '{daily}'",
        "required_inputs_schema": "JSONB DEFAULT '[]'",
        "price_per_run_credits": "INTEGER DEFAULT 50",
        "price_weekly_credits": "INTEGER DEFAULT 500",
    }

    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_profiles'")
    existing = {row[0] for row in cur.fetchall()}

    for col, definition in new_cols.items():
        if col not in existing:
            cur.execute(f"ALTER TABLE agent_profiles ADD COLUMN {col} {definition}")
            print(f"  ✓ agent_profiles.{col}")
        else:
            print(f"  – agent_profiles.{col} already exists, skipping")

    conn.commit()
    cur.close()
    conn.close()
    print("Phase 2 migration complete.")


if __name__ == "__main__":
    run()
