import asyncio
import json
import logging
from typing import Any, Callable, Awaitable

import redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)

ChannelHandler = Callable[[str, dict[str, Any]], Awaitable[None]]


class RedisPubSub:
    def __init__(self):
        self._redis_client: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._subscriber_task: asyncio.Task | None = None
        self._handlers: dict[str, ChannelHandler] = {}
        self._subscribed_channels: set[str] = set()

        if settings.CELERY_BROKER_URL:
            try:
                self._redis_client = redis.Redis.from_url(
                    settings.CELERY_BROKER_URL,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
            except (RedisError, AttributeError) as e:
                logger.warning("Failed to create Redis client for pub/sub: %s", e)
                self._redis_client = None

    async def publish(self, channel: str, message: dict[str, Any]) -> bool:
        if not self._redis_client:
            return False

        try:
            await asyncio.to_thread(
                self._redis_client.publish,
                channel,
                json.dumps(message),
            )
            return True
        except (RedisError, TypeError) as e:
            logger.warning("Failed to publish to channel %s: %s", channel, e)
            return False

    async def subscribe(self, channel: str, handler: ChannelHandler) -> bool:
        if not self._redis_client:
            return False

        self._handlers[channel] = handler

        if channel in self._subscribed_channels:
            return True

        try:
            if self._pubsub is None:
                self._pubsub = self._redis_client.pubsub()

            await asyncio.to_thread(self._pubsub.subscribe, channel)
            self._subscribed_channels.add(channel)

            if self._subscriber_task is None or self._subscriber_task.done():
                self._subscriber_task = asyncio.create_task(self._listen())

            return True
        except (RedisError, AttributeError) as e:
            logger.warning("Failed to subscribe to channel %s: %s", channel, e)
            return False

    async def unsubscribe(self, channel: str) -> bool:
        if not self._pubsub:
            return False

        try:
            await asyncio.to_thread(self._pubsub.unsubscribe, channel)
            self._subscribed_channels.discard(channel)
            self._handlers.pop(channel, None)
            return True
        except RedisError as e:
            logger.warning("Failed to unsubscribe from channel %s: %s", channel, e)
            return False

    async def _listen(self) -> None:
        if not self._pubsub:
            return

        loop = asyncio.get_event_loop()
        backoff = 1.0

        while True:
            try:
                while True:
                    message = await loop.run_in_executor(None, self._pubsub.get_message, True, 1.0)

                    if message and message.get("type") == "message":
                        channel = message.get("channel")
                        data = message.get("data")

                        if channel and data:
                            handler = self._handlers.get(channel)
                            if handler:
                                try:
                                    parsed = json.loads(data)
                                    await handler(channel, parsed)
                                except Exception as e:
                                    logger.warning("Error handling message on %s: %s", channel, e)

                    await asyncio.sleep(0.01)

            except asyncio.CancelledError:
                logger.info("Redis pub/sub listener cancelled")
                raise
            except Exception as e:
                logger.error("Redis pub/sub listener error (restarting in %.1fs): %s", backoff, e)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)
                if not self._pubsub:
                    return

    async def close(self) -> None:
        if self._subscriber_task and not self._subscriber_task.done():
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            try:
                await asyncio.to_thread(self._pubsub.unsubscribe)
                await asyncio.to_thread(self._pubsub.close)
            except RedisError as e:
                logger.warning("Error closing pubsub: %s", e)
            self._pubsub = None

        if self._redis_client:
            try:
                await asyncio.to_thread(self._redis_client.close)
            except RedisError as e:
                logger.warning("Error closing Redis client: %s", e)
            self._redis_client = None

        self._subscribed_channels.clear()
        self._handlers.clear()
