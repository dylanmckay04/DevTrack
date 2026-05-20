from app.celery_app import celery_app
from app.database import SessionLocal
from app.services.email import send_email

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
