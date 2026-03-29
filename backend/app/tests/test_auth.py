import pytest
from starlette.websockets import WebSocketDisconnect
from app.services.socket_tokens import socket_token_store


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_register(client):
    response = client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "dylan@example.com"
    assert "password" not in data

def test_login(client):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    response = client.post("/auth/login", data={
        "username": "dylan@example.com",
        "password": "strongPass123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
    
def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    response = client.post("/auth/login", data={
        "username": "dylan@example.com",
        "password": "wrongPass321"
    })
    assert response.status_code == 401

def test_protected_route_without_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401

def test_get_socket_token(auth_client):
    response = auth_client.post("/auth/socket-token")
    assert response.status_code == 200
    data = response.json()
    assert "socket_token" in data
    assert data["token_type"] == "socket"
    assert data["expires_in"] == 60

def test_socket_token_is_single_use(auth_client):
    socket_token = auth_client.post("/auth/socket-token").json()["socket_token"]

    with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
        websocket.send_text("ping")

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
            websocket.send_text("ping")
            websocket.receive_text()

    assert exc_info.value.code == 1008


def test_socket_token_single_use_when_redis_unavailable(auth_client, monkeypatch):
    monkeypatch.setattr(socket_token_store, "_remember_redis", lambda jti, user_id, expires_in: False)
    monkeypatch.setattr(socket_token_store, "_consume_redis", lambda jti, user_id: None)

    socket_token = auth_client.post("/auth/socket-token").json()["socket_token"]

    with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
        websocket.send_text("ping")

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
            websocket.send_text("ping")
            websocket.receive_text()

    assert exc_info.value.code == 1008

