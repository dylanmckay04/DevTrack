from fastapi.testclient import TestClient


def test_create_application(auth_client):
    response = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer",
        "job_url": "https://testinc.com/joburl"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["company"] == "Test Inc."
    assert data["status"] == "applied"

def test_get_applications(auth_client):
    auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    response = auth_client.get("/applications")
    assert response.status_code == 200
    assert len(response.json()) == 1

def test_update_status(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    response = auth_client.patch(f"/applications/{app_id}/status", json={
        "status": "interviewing"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "interviewing"

def test_cannot_access_other_users_application(auth_client, client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    
    client.post("/auth/register", json={
        "email": "test2@example.com",
        "password": "testPass123"
    })
    login = client.post("/auth/login", data={
        "username": "test2@example.com",
        "password": "testPass123"
    })
    token = login.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    response = client.get(f"/applications/{app_id}")
    assert response.status_code == 404 # hide resource from other users
    
def test_get_single_application(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    response = auth_client.get(f"/applications/{app_id}")
    assert response.status_code == 200
    assert response.json()["id"] == app_id
    assert response.json()["company"] == "Test Inc."

def test_delete_application(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    
    response = auth_client.delete(f"/applications/{app_id}")
    assert response.status_code == 204
    
    follow_up = auth_client.get(f"/applications/{app_id}")
    assert follow_up.status_code == 404

def test_create_application_broadcasts_websocket_event(auth_client):
    socket_token = auth_client.post("/auth/socket-token").json()["socket_token"]

    with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
        response = auth_client.post("/applications", json={
            "company": "Realtime Inc.",
            "role": "Platform Engineer"
        })

        assert response.status_code == 201
        message = websocket.receive_json()

    assert message["type"] == "application.created"
    assert message["application"]["id"] == response.json()["id"]
    assert message["application"]["status"] == "applied"

def test_update_status_broadcasts_websocket_event(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Realtime Inc.",
        "role": "Platform Engineer"
    })
    app_id = create.json()["id"]
    socket_token = auth_client.post("/auth/socket-token").json()["socket_token"]

    with auth_client.websocket_connect(f"/ws/board?token={socket_token}") as websocket:
        response = auth_client.patch(f"/applications/{app_id}/status", json={
            "status": "offer"
        })

        assert response.status_code == 200
        message = websocket.receive_json()

    assert message["type"] == "application.status_changed"
    assert message["application"]["id"] == app_id
    assert message["application"]["status"] == "offer"


def test_websocket_events_are_isolated_by_user(auth_client):
    socket_token_user1 = auth_client.post("/auth/socket-token").json()["socket_token"]

    with TestClient(auth_client.app) as second_client:
        second_client.post("/auth/register", json={
            "email": "isolation@example.com",
            "password": "testPass123",
        })
        second_login = second_client.post("/auth/login", data={
            "username": "isolation@example.com",
            "password": "testPass123",
        })
        second_client.headers.update({"Authorization": f"Bearer {second_login.json()['access_token']}"})
        socket_token_user2 = second_client.post("/auth/socket-token").json()["socket_token"]

        with auth_client.websocket_connect(f"/ws/board?token={socket_token_user1}") as ws_user1:
            with second_client.websocket_connect(f"/ws/board?token={socket_token_user2}") as ws_user2:
                user1_create = auth_client.post("/applications", json={
                    "company": "Owner One Inc.",
                    "role": "Backend Engineer",
                })
                assert user1_create.status_code == 201

                user2_create = second_client.post("/applications", json={
                    "company": "Owner Two Inc.",
                    "role": "Frontend Engineer",
                })
                assert user2_create.status_code == 201

                user1_event = ws_user1.receive_json()
                user2_event = ws_user2.receive_json()

    assert user1_event["application"]["owner_id"] == auth_client.user.id
    assert user1_event["application"]["id"] == user1_create.json()["id"]
    assert user2_event["application"]["owner_id"] != auth_client.user.id
    assert user2_event["application"]["id"] == user2_create.json()["id"]