from celery import Celery
from app.config import settings
from app.database import SessionLocal
from app.services.email import send_email

if settings.CELERY_BROKER_URL and settings.CELERY_RESULT_BACKEND:
    celery_app = Celery("devtrack", broker=settings.CELERY_BROKER_URL, backend=settings.CELERY_RESULT_BACKEND)
else:
    celery_app = None

@celery_app.task
def send_reminder_email(reminder_id: int, user_email: str, message: str):
    """Celery task: send a reminder email at the scheduled time."""
    send_email(
        to=user_email,
        subject="DevTrack Reminder",
        body=f"Reminder: {message}",
    )

    db = SessionLocal()
    try:
        from app.models.reminder import Reminder
        db.query(Reminder).filter(Reminder.id == reminder_id).update({"sent": True})
        db.commit()
    finally:
        db.close()
