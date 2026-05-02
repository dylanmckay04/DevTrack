from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import datetime
from base64 import b64decode, b64encode
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.application import Application, ApplicationStatus
from app.schemas.application import ApplicationCreate, ApplicationUpdate, ApplicationStatusUpdate, ApplicationOut, PaginatedApplications
from app.services.board_events import broadcast_application_event, broadcast_delete_event

router = APIRouter()


@router.get("/paginated", response_model=PaginatedApplications)
def get_applications_paginated(
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    status_filter: Optional[ApplicationStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Application).filter(Application.owner_id == current_user.id)

    if status_filter:
        query = query.filter(Application.status == status_filter)

    count_query = query.with_entities(func.count(Application.id))
    total = count_query.scalar()

    if cursor:
        decoded = b64decode(cursor).decode()
        created_at_str, id_str = decoded.split("|", 1)
        created_at = datetime.fromisoformat(created_at_str)
        cursor_id = int(id_str)
        query = query.filter(
            or_(
                Application.created_at < created_at,
                and_(Application.created_at == created_at, Application.id < cursor_id),
            )
        )

    applications = query.order_by(Application.created_at.desc(), Application.id.desc()).limit(limit + 1).all()

    has_more = len(applications) > limit
    if has_more:
        applications = applications[:-1]

    next_cursor = None
    if has_more and applications:
        last = applications[-1]
        cursor_value = f"{last.created_at.isoformat()}|{last.id}"
        next_cursor = b64encode(cursor_value.encode()).decode()

    return PaginatedApplications(items=applications, total=total, has_more=has_more, next_cursor=next_cursor)


@router.get("", response_model=List[ApplicationOut])
def get_applications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Application).filter(Application.owner_id == current_user.id).all()


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(app_in: ApplicationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    application = Application(**app_in.model_dump(), owner_id=current_user.id)
    db.add(application)
    db.commit()
    db.refresh(application)
    print(f"DEBUG: Application created, broadcasting event for app_id={application.id}, owner_id={application.owner_id}", flush=True)
    try:
        await broadcast_application_event("application.created", application)
        print(f"DEBUG: Broadcast completed for app_id={application.id}", flush=True)
    except Exception as e:
        print(f"DEBUG: Error broadcasting application event: {e}", flush=True)
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
