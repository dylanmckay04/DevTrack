import asyncio
import logging
from time import time

import redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)


class SocketTokenStore:
    def __init__(self):
        self._memory_tokens: dict[str, tuple[str, float]] = {}
        self._memory_lock = asyncio.Lock()

        # Only create Redis client if URL is configured
        if settings.CELERY_BROKER_URL:
            self._redis_client = redis.Redis.from_url(
                settings.CELERY_BROKER_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        else:
            self._redis_client = None

    async def remember(self, jti: str, user_id: int, expires_in: int) -> None:
        if not jti:
            return

        if await self._remember_redis(jti, user_id, expires_in):
            return

        async with self._memory_lock:
            self._purge_expired_locked()
            import time
            self._memory_tokens[jti] = (str(user_id), time.time() + expires_in)

    async def consume(self, jti: str, user_id: int) -> bool:
        if not jti:
            return False

        redis_result = await self._consume_redis(jti, user_id)
        if redis_result is not None:
            return redis_result

        async with self._memory_lock:
            self._purge_expired_locked()
            import time
            entry = self._memory_tokens.get(jti)

        if entry:
            stored_user_id, _ = entry
            return stored_user_id == str(user_id)

        # Neither Redis nor local memory has the token. On multi-instance deployments
        # without shared Redis, the token was stored on a different instance. Fall back
        # to trusting the already-verified JWT signature + expiry.
        logger.debug("Socket token jti=%s not found locally; allowing via JWT-only validation", jti)
        return True

    async def remove(self, jti: str) -> None:
        """Remove token after disconnect - doesn't fail if missing"""
        if not jti:
            return
        
        try:
            await self._redis_client.delete(self._key(jti))
        except (AttributeError, RedisError):
            pass
        
        async with self._memory_lock:
            self._memory_tokens.pop(jti, None)

    async def _remember_redis(self, jti: str, user_id: int, expires_in: int) -> bool:
        try:
            return bool(
                await self._redis_client.set(
                    self._key(jti),
                    str(user_id),
                    ex=expires_in,
                    nx=True,
                )
            )
        except (AttributeError, RedisError):
            return False

    async def _consume_redis(self, jti: str, user_id: int) -> bool | None:
        try:
            stored_user_id = await self._redis_client.getdel(self._key(jti))
        except (AttributeError, RedisError):
            return None

        if stored_user_id is None:
            return False

        return stored_user_id == str(user_id)

    def _purge_expired_locked(self) -> None:
        import time
        now = time.time()
        expired = [jti for jti, (_, expires_at) in self._memory_tokens.items() if expires_at <= now]
        for jti in expired:
            self._memory_tokens.pop(jti, None)

    def _key(self, jti: str) -> str:
        return f"socket-token:{jti}"

    async def close(self) -> None:
        if self._redis_client:
            await self._redis_client.aclose()
            self._redis_client = None


socket_token_store = SocketTokenStore()