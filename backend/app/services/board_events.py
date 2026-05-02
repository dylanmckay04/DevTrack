import asyncio
import uuid
from fastapi import WebSocket
from typing import Any

from app.services.redis_pubsub import RedisPubSub


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

        if user_id not in self._channel_handlers:
            channel = _user_channel(user_id)
            asyncio.create_task(self._pubsub.subscribe(channel, self._make_handler(user_id)))
            self._channel_handlers[user_id] = 1
        else:
            self._channel_handlers[user_id] = self._channel_handlers.get(user_id, 0) + 1

    def disconnect(self, websocket: WebSocket, user_id: int | None = None):
        self.active_connections = [
            (connection, connection_user_id)
            for connection, connection_user_id in self.active_connections
            if connection is not websocket
        ]

        if user_id is not None:
            self._channel_handlers[user_id] = self._channel_handlers.get(user_id, 1) - 1
            if self._channel_handlers.get(user_id, 0) <= 0:
                self._channel_handlers.pop(user_id, None)
                channel = _user_channel(user_id)
                asyncio.ensure_future(self._pubsub.unsubscribe(channel))

    async def broadcast_to_user(self, user_id: int, message: dict[str, Any]):
        await self._send_to_local(user_id, message)
        redis_message = {**message, "_instance_id": self._instance_id}
        asyncio.create_task(self._pubsub.publish(_user_channel(user_id), redis_message))

    async def handle_redis_message(self, user_id: int, message: dict[str, Any]):
        if message.get("_instance_id") == self._instance_id:
            return
        await self._send_to_local(user_id, message)

    async def _send_to_local(self, user_id: int, message: dict[str, Any]):
        disconnected: list[WebSocket] = []
        for connection, connection_user_id in self.active_connections:
            if connection_user_id != user_id:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection, user_id)

    def _make_handler(self, user_id: int):
        async def handler(channel: str, message: dict[str, Any]) -> None:
            await self.handle_redis_message(user_id, message)
        return handler

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