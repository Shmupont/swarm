#!/usr/bin/env python3
"""
SWARM Background Job Worker
Runs as a separate Railway service.
Start command: python src/worker.py
"""
import os
import time
import logging
from datetime import datetime, timezone, timedelta

import psycopg2
import psycopg2.extras
import openai
import anthropic
import resend

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:xVdaBmfhuUcdFYMQWAbSPjTvlALNaFKK@switchback.proxy.rlwy.net:54371/railway",
)
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
POLL_INTERVAL_SECONDS = 60


def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def run_agent(agent: dict, job: dict) -> str:
    """Execute the agent's LLM call with the user's config as context."""
    system_prompt = agent.get("system_prompt", "You are a helpful AI agent.")
    config = job.get("config", {})

    config_lines = "\n".join(f"- {k}: {v}" for k, v in config.items())
    user_message = f"""Run your automation task with these parameters:
{config_lines}

Provide a clear, concise summary of what you found. Be specific with numbers, names, and URLs where relevant."""

    provider = agent.get("llm_provider", "openai")
    model = agent.get("llm_model", "gpt-4o-mini")
    api_key = agent.get("decrypted_api_key") or os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")

    if provider == "anthropic":
        client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text
    else:
        client = openai.OpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1024,
        )
        return response.choices[0].message.content


def send_email_notification(to_email: str, agent_name: str, result: str, job_id: str):
    """Send result notification email via Resend."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set, skipping email notification")
        return

    resend.api_key = RESEND_API_KEY

    preview = result[:500] + ("..." if len(result) > 500 else "")

    try:
        resend.Emails.send({
            "from": "SWARM <notifications@openswarm.world>",
            "to": to_email,
            "subject": f"🤖 {agent_name} has results for you",
            "html": f"""
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #04080f; color: #e2e8f0; padding: 32px; border-radius: 16px;">
  <h2 style="color: #3b82f6; margin-bottom: 8px;">🤖 {agent_name}</h2>
  <p style="color: #94a3b8; margin-bottom: 24px;">Your agent has completed a run and has results for you.</p>

  <div style="background: #0d1117; border: 1px solid #1e2d45; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
    <h3 style="color: #e2e8f0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Results</h3>
    <p style="color: #cbd5e1; line-height: 1.6;">{preview}</p>
  </div>

  <a href="https://openswarm.world/dashboard/active-jobs"
     style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
    View Full Results →
  </a>

  <p style="color: #475569; font-size: 12px; margin-top: 24px;">
    You're receiving this because you have an active agent monitoring on SWARM.<br>
    <a href="https://openswarm.world/dashboard/active-jobs" style="color: #3b82f6;">Manage your agents</a>
  </p>
</div>
""",
        })
        logger.info(f"Email sent to {to_email} for job {job_id}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")


def calculate_next_run(schedule: str):
    """Calculate the next run time based on schedule. Returns None for one-time jobs."""
    now = datetime.now(timezone.utc)
    if schedule == "hourly":
        return now + timedelta(hours=1)
    elif schedule == "daily":
        return now + timedelta(days=1)
    elif schedule == "weekly":
        return now + timedelta(weeks=1)
    else:  # 'once'
        return None


def process_job(job: dict, db):
    """Process a single background job."""
    job_id = job["id"]
    logger.info(f"Processing job {job_id}")

    cur = db.cursor()

    # Create a job_run record
    cur.execute(
        """
        INSERT INTO job_runs (job_id, status, started_at)
        VALUES (%s, 'running', NOW())
        RETURNING id
        """,
        (job_id,),
    )
    run_id = cur.fetchone()["id"]
    db.commit()

    try:
        # Fetch agent details
        cur.execute(
            """
            SELECT ap.*, u.email as owner_email
            FROM agent_profiles ap
            JOIN users u ON u.id = ap.owner_id
            WHERE ap.id = %s
            """,
            (job["agent_id"],),
        )
        agent = cur.fetchone()

        if not agent:
            raise Exception(f"Agent {job['agent_id']} not found")

        # Run the agent
        result = run_agent(dict(agent), dict(job))

        # Calculate credits to charge
        credits_to_charge = (
            agent.get("price_per_run_credits")
            or agent.get("price_per_message_credits")
            or 50
        )

        # Deduct credits from user wallet (atomic)
        cur.execute(
            """
            UPDATE wallets
            SET balance = balance - %s, updated_at = NOW()
            WHERE user_id = %s AND balance >= %s
            RETURNING balance
            """,
            (credits_to_charge, job["user_id"], credits_to_charge),
        )
        wallet_result = cur.fetchone()

        if not wallet_result:
            # Insufficient credits — pause the job
            cur.execute(
                """
                UPDATE background_jobs
                SET status = 'paused', updated_at = NOW()
                WHERE id = %s
                """,
                (job_id,),
            )
            cur.execute(
                """
                INSERT INTO notifications (user_id, job_id, type, title, body)
                VALUES (%s, %s, 'low_balance', 'Agent paused — low balance', %s)
                """,
                (
                    job["user_id"],
                    job_id,
                    f'Your agent "{agent["name"]}" was paused because your balance is too low. Add funds to resume.',
                ),
            )
            db.commit()
            logger.warning(f"Job {job_id} paused due to insufficient credits")
            return

        # Mark run as completed
        cur.execute(
            """
            UPDATE job_runs
            SET status = 'completed', result = %s, completed_at = NOW(), credits_charged = %s
            WHERE id = %s
            """,
            (result, credits_to_charge, run_id),
        )

        # Update job stats
        next_run = calculate_next_run(job["schedule"])
        if next_run and job["schedule"] != "once":
            cur.execute(
                """
                UPDATE background_jobs
                SET last_run_at = NOW(), next_run_at = %s, run_count = run_count + 1,
                    credits_spent_total = credits_spent_total + %s, updated_at = NOW()
                WHERE id = %s
                """,
                (next_run, credits_to_charge, job_id),
            )
        else:
            # One-time job — mark completed
            cur.execute(
                """
                UPDATE background_jobs
                SET last_run_at = NOW(), run_count = run_count + 1, status = 'completed',
                    credits_spent_total = credits_spent_total + %s, updated_at = NOW()
                WHERE id = %s
                """,
                (credits_to_charge, job_id),
            )

        # Create in-app notification
        result_preview = result[:200] + ("..." if len(result) > 200 else "")
        cur.execute(
            """
            INSERT INTO notifications (user_id, job_id, job_run_id, type, title, body)
            VALUES (%s, %s, %s, 'job_result', %s, %s)
            """,
            (
                job["user_id"],
                job_id,
                run_id,
                f'{agent["name"]} completed a run',
                result_preview,
            ),
        )

        db.commit()
        logger.info(f"Job {job_id} completed successfully, charged {credits_to_charge} credits")

        # Send email notification if opted in
        output_methods = job.get("output_methods") or ["in_app"]
        if "email" in output_methods and job.get("notification_email"):
            send_email_notification(
                job["notification_email"],
                agent["name"],
                result,
                str(job_id),
            )

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        cur.execute(
            """
            UPDATE job_runs
            SET status = 'failed', error = %s, completed_at = NOW()
            WHERE id = %s
            """,
            (str(e), run_id),
        )
        cur.execute(
            """
            UPDATE background_jobs
            SET updated_at = NOW()
            WHERE id = %s
            """,
            (job_id,),
        )
        db.commit()


def worker_loop():
    """Main worker loop — polls for due jobs every POLL_INTERVAL_SECONDS."""
    logger.info("SWARM Worker starting up...")

    while True:
        try:
            db = get_db()
            cur = db.cursor()

            # Find jobs due to run
            cur.execute(
                """
                SELECT bj.*, ap.name as agent_name
                FROM background_jobs bj
                JOIN agent_profiles ap ON ap.id = bj.agent_id
                WHERE bj.status = 'active'
                  AND bj.next_run_at <= NOW()
                ORDER BY bj.next_run_at ASC
                LIMIT 10
                """
            )
            jobs = cur.fetchall()

            if jobs:
                logger.info(f"Found {len(jobs)} job(s) to process")
                for job in jobs:
                    try:
                        process_job(dict(job), db)
                    except Exception as e:
                        logger.error(f"Error processing job {job['id']}: {e}")

            db.close()

        except Exception as e:
            logger.error(f"Worker loop error: {e}")

        logger.info(f"Worker sleeping {POLL_INTERVAL_SECONDS}s...")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    worker_loop()
