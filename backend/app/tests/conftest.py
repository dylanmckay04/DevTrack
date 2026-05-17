import os

os.environ["TESTING"] = "1"
# Disable Celery and Redis for tests to avoid connection errors
os.environ.pop("CELERY_BROKER_URL", None)
os.environ.pop("CELERY_RESULT_BACKEND", None)
os.environ["CELERY_BROKER_URL"] = ""
os.environ["CELERY_RESULT_BACKEND"] = ""

# Set test database URL - use localhost since tests run outside Docker
_TEST_DB_URL = "postgresql://postgres:postgres@localhost:5433/devtrack_test"
os.environ["DATABASE_URL"] = _TEST_DB_URL

import pytest
import types
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base
from app.core.dependencies import get_db
from app.config import settings
from app.models.user import User

# Verify that test database URL is being used
assert settings.DATABASE_URL == _TEST_DB_URL, f"Database URL mismatch: expected {_TEST_DB_URL}, got {settings.DATABASE_URL}"

engine = create_engine(_TEST_DB_URL)
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
def auth_client(client, db):
    register_response = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "testPass123"
    })

    # Bypass email verification for testing
    user = db.query(User).filter(User.email == "test@example.com").first()
    user.is_verified = True
    user.verification_token = None
    db.commit()

    response = client.post("/auth/login", data={
        "username": "test@example.com",
        "password": "testPass123"
    })
    token = response.json()["access_token"]
    client.token = token
    client.headers.update({"Authorization": f"Bearer {token}"})
    client.user = types.SimpleNamespace(id=user.id)  # Get ID from database query
    return client

