import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.security import decode_socket_token
from app.services.board_events import manager
from app.services.socket_tokens import socket_token_store

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/board")
async def board_websocket(websocket: WebSocket):
    token = websocket.query_params.get("token")
    payload = decode_socket_token(token) if token else None
    user_id = int(payload.get("sub")) if payload and payload.get("sub") else None
    jti = payload.get("jti") if payload else None

    if user_id is None or jti is None:
        logger.warning("WebSocket connection rejected: invalid token")
        await websocket.close(code=1008)
        return

    if not await socket_token_store.consume(jti, user_id):
        logger.warning("WebSocket connection rejected: invalid or already used socket token for user_id=%d", user_id)
        await websocket.close(code=1008)
        return

    print(f"DEBUG: WebSocket connection accepted for user_id={user_id}", flush=True)
    await manager.connect(websocket, user_id)
    print(f"DEBUG: WebSocket fully connected for user_id={user_id}", flush=True)
    
    try:
        # Just wait for disconnect, don't need to receive messages from client
        await websocket.receive_text()
    except WebSocketDisconnect:
        print(f"DEBUG: WebSocket disconnected normally for user_id={user_id}", flush=True)
        logger.info("WebSocket disconnected for user_id=%d", user_id)
    except Exception as e:
        print(f"DEBUG: WebSocket error for user_id={user_id}: {e}", flush=True)
        logger.error("WebSocket error for user_id=%d: %s", user_id, e)
    finally:
        manager.disconnect(websocket, user_id)
        await socket_token_store.remove(jti)
        print(f"DEBUG: WebSocket cleanup done for user_id={user_id}", flush=True)
