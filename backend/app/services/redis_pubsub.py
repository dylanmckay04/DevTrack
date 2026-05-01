import asyncio
import json
import logging
from typing import Any, Callable, Awaitable

import redis.asyncio as redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)

ChannelHandler = Callable[[str, dict[str, Any]], Awaitable[None]]


class RedisPubSub:
    def __init__(self):
        self._redis_client: redis.Redis | None = None
        self._pubsub_client: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._subscriber_task: asyncio.Task | None = None
        self._handlers: dict[str, ChannelHandler] = {}
        self._subscribed_channels: set[str] = set()
        self._connection_healthy: bool = False

        if settings.CELERY_BROKER_URL:
            try:
                self._redis_client = redis.from_url(
                    settings.CELERY_BROKER_URL,
                    decode_responses=True,
                )
                self._pubsub_client = redis.from_url(
                    settings.CELERY_BROKER_URL,
                    decode_responses=True,
                )
                logger.info("Redis clients created for pub/sub: %s", settings.CELERY_BROKER_URL)
            except (RedisError, AttributeError) as e:
                logger.error("Failed to create Redis client for pub/sub: %s", e)
                self._redis_client = None
                self._pubsub_client = None
        else:
            logger.warning("CELERY_BROKER_URL not set, Redis pub/sub disabled")

    async def _check_connection(self) -> bool:
        if not self._redis_client:
            return False
        try:
            await self._redis_client.ping()
            self._connection_healthy = True
            return True
        except (RedisError, ConnectionError, OSError) as e:
            logger.warning("Redis connection check failed: %s", e)
            self._connection_healthy = False
            return False

    async def publish(self, channel: str, message: dict[str, Any]) -> bool:
        if not self._redis_client:
            return False

        try:
            if not self._connection_healthy:
                if not await self._check_connection():
                    return False
            await self._redis_client.publish(
                channel,
                json.dumps(message),
            )
            return True
        except (RedisError, TypeError, ConnectionError, OSError) as e:
            logger.warning("Failed to publish to channel %s: %s", channel, e)
            self._connection_healthy = False
            return False

    async def subscribe(self, channel: str, handler: ChannelHandler) -> bool:
        if not self._pubsub_client:
            return False

        self._handlers[channel] = handler

        if channel in self._subscribed_channels:
            return True

        try:
            if self._pubsub is None:
                self._pubsub = self._pubsub_client.pubsub(ignore_subscribe_messages=True)

            await self._pubsub.subscribe(channel)
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
            await self._pubsub.unsubscribe(channel)
            self._subscribed_channels.discard(channel)
            self._handlers.pop(channel, None)
            return True
        except RedisError as e:
            logger.warning("Failed to unsubscribe from channel %s: %s", channel, e)
            return False

    async def _listen(self) -> None:
        if not self._pubsub:
            return

        backoff = 1.0
        logger.info("Redis pub/sub listener started")

        while True:
            try:
                async for message in self._pubsub.listen():
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

                self._connection_healthy = True
                backoff = 1.0

            except asyncio.CancelledError:
                logger.info("Redis pub/sub listener cancelled")
                raise
            except Exception as e:
                logger.error("Redis pub/sub listener error (restarting in %.1fs): %s", backoff, e)
                self._connection_healthy = False
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)
                if not self._pubsub:
                    return
                try:
                    if self._pubsub_client:
                        self._pubsub = self._pubsub_client.pubsub(ignore_subscribe_messages=True)
                        for channel in self._subscribed_channels:
                            await self._pubsub.subscribe(channel)
                        logger.info("Reconnected to Redis pub/sub, re-subscribed to %d channels", len(self._subscribed_channels))
                except Exception as reconnect_error:
                    logger.error("Failed to reconnect pub/sub: %s", reconnect_error)

    async def close(self) -> None:
        if self._subscriber_task and not self._subscriber_task.done():
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            try:
                await self._pubsub.unsubscribe()
                await self._pubsub.aclose()
            except RedisError as e:
                logger.warning("Error closing pubsub: %s", e)
            self._pubsub = None

        if self._redis_client:
            try:
                await self._redis_client.aclose()
            except RedisError as e:
                logger.warning("Error closing Redis client: %s", e)
            self._redis_client = None

        if self._pubsub_client:
            try:
                await self._pubsub_client.aclose()
            except RedisError as e:
                logger.warning("Error closing pub/sub client: %s", e)
            self._pubsub_client = None

        self._subscribed_channels.clear()
        self._handlers.clear()
