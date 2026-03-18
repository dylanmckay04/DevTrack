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
    
