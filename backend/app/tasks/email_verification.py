import os
from celery import Celery
from app.config import settings
from app.database import SessionLocal
from app.services.email import send_email

# In testing mode or if Celery URLs aren't configured, use a mock
if os.getenv("TESTING") or not (settings.CELERY_BROKER_URL and settings.CELERY_RESULT_BACKEND):
    from unittest.mock import MagicMock
    celery_app = MagicMock()
    # Create a decorator that wraps functions to handle .delay() calls
    def mock_task_decorator(func):
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        # Add .delay() method that silently ignores calls
        wrapper.delay = lambda *args, **kwargs: MagicMock()
        return wrapper
    celery_app.task = mock_task_decorator
else:
    celery_app = Celery("devtrack", broker=settings.CELERY_BROKER_URL, backend=settings.CELERY_RESULT_BACKEND)


@celery_app.task
def send_verification_email(user_id: int, user_email: str, token: str):
    """Celery task to send a verification email to the user."""
    verify_url = f"{settings.FRONTEND_URL}/auth/verify?token={token}"
    send_email(
        to_email=user_email,
        subject="Verify Your DevTrack Account",
        body=(
            f"Welcome to DevTrack!\n\n"
            f"Please verify your email address by clicking the link below:\n\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours. If you didn't create an account, you can ignore this email."
        ),
    )