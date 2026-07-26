"""
S3 Storage Service for Faraja Solution Loans.

In development (APP_ENV=development), photos are stored as base64 strings.
In production, files are uploaded to AWS S3 and URLs are returned.

Required environment variables for production:
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_REGION (default: af-south-1)
    S3_BUCKET_NAME
    S3_BASE_URL (optional, for CDN/CloudFront)
"""

import os
import uuid
import base64
from datetime import datetime
from typing import Optional


# ── Configuration ──────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "af-south-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "faraja-loans-docs")
S3_BASE_URL = os.getenv("S3_BASE_URL", "")
APP_ENV = os.getenv("APP_ENV", "development")

IS_DEVELOPMENT = APP_ENV == "development"


# ── Helpers ─────────────────────────────────────────────────────────────────────
def _get_s3_client():
    """Lazily import and create boto3 S3 client."""
    try:
        import boto3
        return boto3.client(
            "s3",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
    except ImportError:
        raise RuntimeError(
            "boto3 is required for S3 uploads. Install it with: pip install boto3"
        )


def _generate_s3_key(folder: str, filename_suffix: str, client_id: str) -> str:
    """Generate a unique S3 object key."""
    date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
    unique_id = uuid.uuid4().hex[:8]
    return f"clients/{client_id}/{folder}/{date_prefix}_{unique_id}_{filename_suffix}"


def _data_url_to_bytes(data_url: str) -> tuple[bytes, str]:
    """Convert a base64 data URL to raw bytes and content type."""
    # Format: data:image/jpeg;base64,<data>
    if "," in data_url:
        header, encoded = data_url.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "")
        raw_bytes = base64.b64decode(encoded)
    else:
        # Assume raw base64 JPEG
        content_type = "image/jpeg"
        raw_bytes = base64.b64decode(data_url)
    return raw_bytes, content_type


# ── Public API ──────────────────────────────────────────────────────────────────
def upload_photo(
    data_url: str,
    folder: str,
    filename_suffix: str,
    client_id: str = "unknown",
) -> str:
    """
    Upload a photo (provided as a base64 data URL) to S3 or keep as-is in dev.

    Args:
        data_url: Base64 data URL string (e.g. "data:image/jpeg;base64,...")
        folder: Sub-folder within the client's directory (e.g. "id_photo", "passport")
        filename_suffix: Descriptive filename part (e.g. "applicant_id.jpg")
        client_id: Client ID for path scoping

    Returns:
        In development: the original base64 data URL
        In production: the public S3 URL for the uploaded file
    """
    if not data_url:
        return ""

    if IS_DEVELOPMENT:
        # In dev mode — just return the base64 as-is for immediate preview
        return data_url

    # Production — upload to S3
    raw_bytes, content_type = _data_url_to_bytes(data_url)
    s3_key = _generate_s3_key(folder, filename_suffix, client_id)

    s3 = _get_s3_client()
    s3.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        Body=raw_bytes,
        ContentType=content_type,
        # Server-side encryption
        ServerSideEncryption="AES256",
    )

    if S3_BASE_URL:
        return f"{S3_BASE_URL.rstrip('/')}/{s3_key}"
    else:
        return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"


def generate_presigned_upload_url(
    folder: str,
    filename_suffix: str,
    client_id: str,
    content_type: str = "image/jpeg",
    expiry_seconds: int = 300,
) -> dict:
    """
    Generate a presigned S3 URL for direct browser uploads.
    Useful when you want to upload large files directly from the browser.

    Returns:
        dict with 'url' and 'fields' keys for form-based upload,
        or 'upload_url' for PUT-based upload.
    """
    if IS_DEVELOPMENT:
        return {"error": "Presigned URLs not available in development mode"}

    s3_key = _generate_s3_key(folder, filename_suffix, client_id)
    s3 = _get_s3_client()

    response = s3.generate_presigned_post(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, 10 * 1024 * 1024],  # max 10MB
        ],
        ExpiresIn=expiry_seconds,
    )
    response["s3_key"] = s3_key
    return response


def delete_photo(s3_url: str) -> bool:
    """Delete a photo from S3 by its URL."""
    if IS_DEVELOPMENT or not s3_url:
        return True
    try:
        # Extract S3 key from URL
        s3_key = s3_url.split(f"{S3_BUCKET_NAME}/")[-1]
        s3 = _get_s3_client()
        s3.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        return True
    except Exception:
        return False
