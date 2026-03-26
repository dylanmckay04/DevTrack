from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.application import Application
from app.models.document import Document
from app.schemas.document import DocumentOut
from app.services.r2 import upload_file, delete_file

router = APIRouter()


@router.post("/{app_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    app_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.delete("/{app_id}/documents/{doc_id}", status_code=204)
def delete_document(app_id: int, doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    delete_file(doc.r2_key)
    db.delete(doc)
    db.commit()
