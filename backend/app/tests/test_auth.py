import pytest
from starlette.websockets import WebSocketDisconnect
from app.models.user import User
from app.core.security import create_verification_token
from app.services.socket_tokens import socket_token_store


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ── Registration ──────────────────────────────────────────────────────────────

def test_register_returns_verification_message(client):
    response = client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    assert response.status_code == 201
    data = response.json()
    assert "message" in data
    assert "verify" in data["message"].lower()

def test_register_duplicate_email(client):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    response = client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    assert response.status_code == 400

def test_register_creates_unverified_user(client, db):
    client.post("/auth/register", json={
        "email": "unverified@example.com",
        "password": "strongPass123"
    })
    user = db.query(User).filter(User.email == "unverified@example.com").first()
    assert user is not None
    assert user.is_verified is False
    assert user.verification_token is not None


# ── Login ──────────────────────────────────────────────────────────────

def test_login_unverified_user_returns_403(client):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    response = client.post("/auth/login", data={
        "username": "dylan@example.com",
        "password": "strongPass123"
    })
    assert response.status_code == 403
    assert "verified" in response.json()["detail"].lower()

def test_login_verified_user_succeeds(client, db):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    user = db.query(User).filter(User.email == "dylan@example.com").first()
    user.is_verified = True
    db.commit()

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


# ── Email verification ──────────────────────────────────────────────────────────────

def test_verify_email_success(client, db):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    user = db.query(User).filter(User.email == "dylan@example.com").first()
    token = user.verification_token

    response = client.get(f"/auth/verify?token={token}", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert "verified=true" in response.headers["location"]

    db.refresh(user)
    assert user.is_verified is True
    assert user.verification_token is None

def test_verify_email_invalid_token(client):
    response = client.get("/auth/verify?token=totallyinvalidtoken", follow_redirects=False)
    assert response.status_code == 400

def test_verify_email_already_verified(client, db):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    user = db.query(User).filter(User.email == "dylan@example.com").first()
    token = user.verification_token
    user.is_verified = True
    db.commit()

    response = client.get(f"/auth/verify?token={token}", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert "verified=already" in response.headers["location"]


# ── Resend verification ──────────────────────────────────────────────────────────────

def test_resend_verification_success(client):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    response = client.post("/auth/resend-verification", json={
        "email": "dylan@example.com"
    })
    assert response.status_code == 200
    assert "message" in response.json()

def test_resend_verification_nonexistent_email_returns_200(client):
    client.post("/auth/register", json={
        "email": "ghost@example.com",
        "password": "ghostPass123"
    })
    response = client.post("/auth/resend-verification", json={
        "email": "ghost@example.com"
    })
    assert response.status_code == 200

def test_resend_verification_already_verified_returns_200(client, db):
    client.post("/auth/register", json={
        "email": "dylan@example.com",
        "password": "strongPass123"
    })
    user = db.query(User).filter(User.email == "dylan@example.com").first()
    user.is_verified = True
    db.commit()

    response = client.post("/auth/resend-verification", json={
        "email": "dylan@example.com"
    })
    assert response.status_code == 200


# ── Protected routes ──────────────────────────────────────────────────────────────

def test_protected_route_without_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


# ── Socket tokens ──────────────────────────────────────────────────────────────

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
    async def fake_remember_redis(jti, user_id, expires_in):
        return False

    async def fake_consume_redis(jti, user_id):
        return None

    monkeypatch.setattr(socket_token_store, "_remember_redis", fake_remember_redis)
    monkeypatch.setattr(socket_token_store, "_consume_redis", fake_consume_redis)

    socket_token = auth_client.post("/auth/socket-token").json()["socket_token"]

    with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
        websocket.send_text("ping")

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
            websocket.send_text("ping")
            websocket.receive_text()

    assert exc_info.value.code == 1008

