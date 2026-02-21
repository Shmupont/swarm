import time
import uuid as uuid_mod

import redis as redis_lib

from .config import get_settings

_redis_client = None

TIER_LIMITS = {"free": 60, "pro": 300, "enterprise": 1000}


def get_redis():
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis_lib.Redis.from_url(
            settings.redis_url, decode_responses=True
        )
    return _redis_client


def set_redis(client):
    """Override Redis client (for testing)."""
    global _redis_client
    _redis_client = client


def check_rate_limit(agent_id: str, tier: str = "free") -> bool:
    """Return True if the request is allowed under the sliding-window limit."""
    try:
        r = get_redis()
        key = f"rate:{agent_id}"
        window = 60
        max_req = TIER_LIMITS.get(tier, 60)

        now = time.time()
        member = f"{now}:{uuid_mod.uuid4().hex[:8]}"

        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, now - window)
        pipe.zadd(key, {member: now})
        pipe.zcard(key)
        pipe.expire(key, window + 1)
        results = pipe.execute()

        count = results[2]
        return count <= max_req
    except Exception:
        return True  # allow request if Redis is unavailable
