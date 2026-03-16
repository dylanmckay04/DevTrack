import boto3
import uuid
from fastapi import UploadFile
from app.config import settings

r2_client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto",
)


async def upload_file(file: UploadFile, user_id: int) -> str:
    """Upload a file to R2 and return the R2 key."""
    extension = file.filename.split(".")[-1]
    r2_key = f"users/{user_id}/documents/{uuid.uuid4()}.{extension}"
    contents = await file.read()
    r2_client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=r2_key,
        Body=contents,
        ContentType=file.content_type,
    )
    return r2_key


def delete_file(r2_key: str) -> None:
    """Delete a file from R2."""
    r2_client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)


def get_presigned_url(r2_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for temporary file access."""
    return r2_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": r2_key},
        ExpiresIn=expires_in,
    )
