from fastapi import WebSocket
from typing import Any


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[tuple[WebSocket, int]] = []

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.append((websocket, user_id))

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            (connection, connection_user_id)
            for connection, connection_user_id in self.active_connections
            if connection is not websocket
        ]

    async def broadcast_to_user(self, user_id: int, message: dict[str, Any]):
        disconnected: list[WebSocket] = []
        for connection, connection_user_id in self.active_connections:
            if connection_user_id != user_id:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


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