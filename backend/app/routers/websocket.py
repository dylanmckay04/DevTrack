from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.security import decode_socket_token
from app.services.board_events import manager
from app.services.socket_tokens import socket_token_store

router = APIRouter()


@router.websocket("/ws/board")
async def board_websocket(websocket: WebSocket):
    token = websocket.query_params.get("token")
    payload = decode_socket_token(token) if token else None
    user_id = payload.get("sub") if payload else None
    jti = payload.get("jti") if payload else None

    if user_id is None or jti is None:
        await websocket.close(code=1008)
        return

    if not socket_token_store.consume(jti, int(user_id)):
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, int(user_id))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

