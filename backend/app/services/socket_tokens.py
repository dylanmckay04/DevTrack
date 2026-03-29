from threading import Lock
from time import time

import redis
from redis.exceptions import RedisError

from app.config import settings


class SocketTokenStore:
    def __init__(self):
        self._memory_tokens: dict[str, tuple[str, float]] = {}
        self._memory_lock = Lock()
        self._redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def remember(self, jti: str, user_id: int, expires_in: int) -> None:
        if not jti:
            return

        if self._remember_redis(jti, user_id, expires_in):
            return

        with self._memory_lock:
            self._purge_expired_locked()
            self._memory_tokens[jti] = (str(user_id), time() + expires_in)

    def consume(self, jti: str, user_id: int) -> bool:
        if not jti:
            return False

        redis_result = self._consume_redis(jti, user_id)
        if redis_result is not None:
            return redis_result

        with self._memory_lock:
            self._purge_expired_locked()
            entry = self._memory_tokens.pop(jti, None)

        if not entry:
            return False

        stored_user_id, _ = entry
        return stored_user_id == str(user_id)

    def _remember_redis(self, jti: str, user_id: int, expires_in: int) -> bool:
        try:
            return bool(
                self._redis_client.set(
                    self._key(jti),
                    str(user_id),
                    ex=expires_in,
                    nx=True,
                )
            )
        except RedisError:
            return False

    def _consume_redis(self, jti: str, user_id: int) -> bool | None:
        try:
            stored_user_id = self._redis_client.getdel(self._key(jti))
        except (AttributeError, RedisError):
            return None

        if stored_user_id is None:
            return False

        return stored_user_id == str(user_id)

    def _purge_expired_locked(self) -> None:
        now = time()
        expired = [jti for jti, (_, expires_at) in self._memory_tokens.items() if expires_at <= now]
        for jti in expired:
            self._memory_tokens.pop(jti, None)

    def _key(self, jti: str) -> str:
        return f"socket-token:{jti}"


socket_token_store = SocketTokenStore()