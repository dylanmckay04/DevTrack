from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.application import Application
from app.models.document import Document
from app.schemas.document import DocumentOut
from app.services.r2 import upload_file, delete_file, get_presigned_url
import os

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

CONTENT_TYPE_MAP = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

router = APIRouter()


@router.post("/{app_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    app_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and Word documents are allowed")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    await file.seek(0)

    application = db.query(Application).filter(Application.id == app_id, Application.owner_id == current_user.id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    r2_key = await upload_file(file, current_user.id)
    document = Document(
        owner_id=current_user.id,
        application_id=app_id,
        filename=file.filename,
        r2_key=r2_key,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/{app_id}/documents", response_model=List[DocumentOut])
def get_documents(app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Document).filter(Document.application_id == app_id, Document.owner_id == current_user.id).all()


@router.get("/{app_id}/documents/{doc_id}/preview")
def get_document_preview(
    app_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ext = os.path.splitext(doc.r2_key)[1].lower()
    content_type = CONTENT_TYPE_MAP.get(ext, "application/octet-stream")
    url = get_presigned_url(doc.r2_key)
    return {"url": url, "content_type": content_type}


@router.delete("/{app_id}/documents/{doc_id}", status_code=204)
def delete_document(app_id: int, doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    delete_file(doc.r2_key)
    db.delete(doc)
    db.commit()
