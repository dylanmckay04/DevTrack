def test_upload_document(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    response = auth_client.post(f"/applications/{app_id}/documents", files={"file": ("test.pdf", open("test.pdf", "rb"))})
    assert response.status_code == 201
    assert response.json()["filename"] == "test.pdf"
    assert response.json()["r2_key"] is not None
    assert response.json()["uploaded_at"] is not None
    assert response.json()["owner_id"] == auth_client.user.id
    assert response.json()["application_id"] == app_id

def test_get_documents(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    response = auth_client.post(f"/applications/{app_id}/documents", files={"file": ("test.pdf", open("test.pdf", "rb"))})
    response = auth_client.get(f"/applications/{app_id}/documents")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["filename"] == "test.pdf"
    assert response.json()[0]["r2_key"] is not None
    assert response.json()[0]["uploaded_at"] is not None
    assert response.json()[0]["owner_id"] == auth_client.user.id
    assert response.json()[0]["application_id"] == app_id

def test_delete_document(auth_client):
    create = auth_client.post("/applications", json={
        "company": "Test Inc.",
        "role": "Backend Engineer"
    })
    app_id = create.json()["id"]
    response = auth_client.post(f"/applications/{app_id}/documents", files={"file": ("test.pdf", open("test.pdf", "rb"))})
    doc_id = response.json()["id"]
    response = auth_client.delete(f"/applications/{app_id}/documents/{doc_id}")
    assert response.status_code == 204
    response = auth_client.get(f"/applications/{app_id}/documents")
    assert response.status_code == 200
    assert len(response.json()) == 0