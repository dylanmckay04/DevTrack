from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from app.models.application import ApplicationStatus


class ApplicationCreate(BaseModel):
    company: str
    role: str
    status: ApplicationStatus = ApplicationStatus.applied
    job_url: Optional[str] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None


class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ApplicationOut(BaseModel):
    id: int
    owner_id: int
    company: str
    role: str
    status: ApplicationStatus
    job_url: Optional[str]
    notes: Optional[str]
    applied_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class PaginatedApplications(BaseModel):
    items: List[ApplicationOut]
    total: int
    has_more: bool
    next_cursor: Optional[str] = None
