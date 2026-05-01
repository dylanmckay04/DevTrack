import asyncio
import uuid
import logging
from fastapi import WebSocket
from typing import Any

from app.services.redis_pubsub import RedisPubSub

logger = logging.getLogger(__name__)


def _user_channel(user_id: int) -> str:
    return f"ws:user:{user_id}"


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[tuple[WebSocket, int]] = []
        self._pubsub = RedisPubSub()
        self._channel_handlers: dict[int, int] = {}
        self._instance_id = str(uuid.uuid4())

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.append((websocket, user_id))
        logger.info("WebSocket connected for user_id=%d, total connections=%d", user_id, len(self.active_connections))

        if user_id not in self._channel_handlers:
            channel = _user_channel(user_id)
            await self._pubsub.subscribe(channel, self._make_handler(user_id))
            self._channel_handlers[user_id] = 1
            logger.info("Subscribed to Redis channel %s for user_id=%d", channel, user_id)
        else:
            self._channel_handlers[user_id] = self._channel_handlers.get(user_id, 0) + 1

    def disconnect(self, websocket: WebSocket, user_id: int | None = None):
        self.active_connections = [
            (connection, connection_user_id)
            for connection, connection_user_id in self.active_connections
            if connection is not websocket
        ]
        logger.info("WebSocket disconnected for user_id=%s, remaining connections=%d", user_id, len(self.active_connections))

        if user_id is not None:
            current_count = self._channel_handlers.get(user_id, 0)
            new_count = current_count - 1
            if new_count <= 0:
                self._channel_handlers.pop(user_id, None)
                channel = _user_channel(user_id)
                logger.info("Unsubscribing from Redis channel %s", channel)
                asyncio.create_task(self._safe_unsubscribe(channel))
            else:
                self._channel_handlers[user_id] = new_count

    async def broadcast_to_user(self, user_id: int, message: dict[str, Any]):
        print(f"DEBUG: Broadcasting to user_id={user_id}: type={message.get('type')}", flush=True)
        try:
            await self._send_to_local(user_id, message)
        except Exception as e:
            logger.error("Error in _send_to_local for user_id=%d: %s", user_id, e)
        redis_message = {**message, "_instance_id": self._instance_id}
        try:
            result = await self._pubsub.publish(_user_channel(user_id), redis_message)
            if not result:
                logger.warning("Failed to publish to Redis channel for user_id=%d", user_id)
        except Exception as e:
            logger.error("Error publishing to Redis for user_id=%d: %s", user_id, e)

    async def handle_redis_message(self, user_id: int, message: dict[str, Any]):
        if message.get("_instance_id") == self._instance_id:
            logger.debug("Ignoring own message for user_id=%d", user_id)
            return
        logger.info("Received Redis message for user_id=%d: type=%s", user_id, message.get("type"))
        await self._send_to_local(user_id, message)

    async def _send_to_local(self, user_id: int, message: dict[str, Any]):
        sent_count = 0
        for connection, connection_user_id in self.active_connections:
            if connection_user_id != user_id:
                continue
            try:
                print(f"DEBUG: Sending message to user_id={user_id}, type={message.get('type')}", flush=True)
                await connection.send_json(message)
                print(f"DEBUG: Message sent successfully to user_id={user_id}", flush=True)
                sent_count += 1
            except Exception as e:
                print(f"DEBUG: Failed to send message to user_id={user_id}: {e}", flush=True)
                logger.warning("Failed to send message to user_id=%d: %s", user_id, e)
                try:
                    await connection.close(code=1011)
                except Exception:
                    pass  # Connection already closed

        if sent_count > 0:
            logger.info("Sent message type=%s to %d local connections for user_id=%d", message.get("type"), sent_count, user_id)
        else:
            logger.warning("No local WebSocket connections found for user_id=%d", user_id)

    def _make_handler(self, user_id: int):
        async def handler(channel: str, message: dict[str, Any]) -> None:
            await self.handle_redis_message(user_id, message)
        return handler

    async def _safe_unsubscribe(self, channel: str) -> None:
        try:
            await self._pubsub.unsubscribe(channel)
        except Exception as e:
            logger.warning("Failed to unsubscribe from channel %s: %s", channel, e)

    async def close(self) -> None:
        await self._pubsub.close()
        self._channel_handlers.clear()


manager = ConnectionManager()


async def broadcast_application_event(event_type: str, application: Any):
    await manager.broadcast_to_user(
        application.owner_id,
        {
            "type": event_type,
            "application": {
                "id": application.id,
                "owner_id": application.owner_id,
                "company": application.company,
                "role": application.role,
                "status": application.status.value if hasattr(application.status, "value") else application.status,
                "job_url": application.job_url,
                "notes": application.notes,
                "applied_at": application.applied_at.isoformat() if application.applied_at else None,
                "created_at": application.created_at.isoformat() if application.created_at else None,
                "updated_at": application.updated_at.isoformat() if application.updated_at else None,
            },
        }
    )


async def broadcast_delete_event(owner_id: int, application_id: int):
    await manager.broadcast_to_user(
        owner_id,
        {
            "type": "application.deleted",
            "application": {"id": application_id, "owner_id": owner_id},
        },
    )