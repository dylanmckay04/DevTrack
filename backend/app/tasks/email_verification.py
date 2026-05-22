from app.celery_app import celery_app
from app.config import settings
from app.services.email import send_email


@celery_app.task
def send_verification_email(user_id: int, user_email: str, token: str):
    """Celery task to send a verification email to the user."""
    verify_url = f"{settings.BACKEND_URL}/auth/verify?token={token}"
    send_email(
        to=user_email,
        subject="Verify Your DevTrack Account",
        body=(
            f"Welcome to DevTrack!\n\n"
            f"Please verify your email address by clicking the link below:\n\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours. If you didn't create an account, you can ignore this email."
        ),
    )