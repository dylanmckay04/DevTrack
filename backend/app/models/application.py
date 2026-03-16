from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    interviewing = "interviewing"
    offer = "offer"
    rejected = "rejected"


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.applied, nullable=False)
    job_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="applications")
    documents = relationship("Document", back_populates="application", cascade="all, delete")
    reminders = relationship("Reminder", back_populates="application", cascade="all, delete")
