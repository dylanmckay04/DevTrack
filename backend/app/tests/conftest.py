import os
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5433/devtrack_test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base
from app.core.dependencies import get_db

engine = create_engine("postgresql://postgres:postgres@localhost:5433/devtrack_test")
TestingSessionLocal = sessionmaker(bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db):
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    
@pytest.fixture
def auth_client(client):
    client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "testPass123"
    })
    response = client.post("/auth/login", data={
        "username": "test@example.com",
        "password": "testPass123"
    })
    token = response.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client

