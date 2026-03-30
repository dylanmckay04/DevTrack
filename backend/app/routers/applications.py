from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.application import Application
from app.schemas.application import ApplicationCreate, ApplicationUpdate, ApplicationStatusUpdate, ApplicationOut
from app.services.board_events import broadcast_application_event, broadcast_delete_event

router = APIRouter()


@router.get("", response_model=List[ApplicationOut])
def get_applications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Application).filter(Application.owner_id == current_user.id).all()


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(app_in: ApplicationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    application = Application(**app_in.model_dump(), owner_id=current_user.id)
    db.add(application)
    db.commit()
    db.refresh(application)
    await broadcast_application_event("application.created", application)
    return application


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == app_id, Application.owner_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update_application(app_id: int, app_in: ApplicationUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == app_id, Application.owner_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    for key, value in app_in.model_dump(exclude_unset=True).items():
        setattr(app, key, value)
    db.commit()
    db.refresh(app)
    await broadcast_application_event("application.updated", app)
    return app


@router.patch("/{app_id}/status", response_model=ApplicationOut)
async def update_status(app_id: int, status_in: ApplicationStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == app_id, Application.owner_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = status_in.status
    db.commit()
    db.refresh(app)
    await broadcast_application_event("application.status_changed", app)
    return app


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == app_id, Application.owner_id == current_user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    owner_id = app.owner_id
    application_id = app.id
    db.delete(app)
    db.commit()
    await broadcast_delete_event(owner_id, application_id)
