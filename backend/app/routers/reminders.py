from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.reminder import Reminder
from app.schemas.reminder import ReminderCreate, ReminderOut
from app.tasks.reminders import send_reminder_email

router = APIRouter()


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(reminder_in: ReminderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reminder = Reminder(**reminder_in.model_dump(), owner_id=current_user.id)
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    # Schedule Celery task
    send_reminder_email.apply_async(
        args=[reminder.id, current_user.email, reminder.message],
        eta=reminder.remind_at,
    )
    return reminder


@router.get("", response_model=List[ReminderOut])
def get_reminders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Reminder).filter(Reminder.owner_id == current_user.id).all()


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.owner_id == current_user.id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(reminder)
    db.commit()
