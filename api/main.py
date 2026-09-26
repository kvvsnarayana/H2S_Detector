"""
Person 2 API Layer: FastAPI Adapter for Sulfide Sentinels Dosimeter Analysis Pipeline.

ARCHITECTURAL BOUNDARIES & RESPONSIBILITIES:
- This module serves STRICTLY as a thin HTTP API adapter around `src.pipeline.run_pipeline`.
- NO computer vision, image processing, or color science algorithms are implemented here;
  all image processing is delegated directly to the classical CV pipeline in `src.pipeline`.
- Temperature and humidity inputs are strictly UNEXPOSED to prevent uncalibrated bias.
- Internal test flags (e.g. `is_expired`) are strictly UNEXPOSED in the public API contract.
- Authentication, user management, Supabase/database persistence, frontend UI, and Vercel
  deployment belong to Person 1 and are not implemented here.
"""

import sys
from pathlib import Path
from enum import Enum
from typing import Optional, Dict

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

# Ensure the person2-ai root directory is in sys.path for direct imports
_person2_root = Path(__file__).resolve().parent.parent
if str(_person2_root) not in sys.path:
    sys.path.insert(0, str(_person2_root))

from src.pipeline import run_pipeline, PipelineResult


# Allowed image file extensions for upload validation
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}


class ShiftContext(str, Enum):
    """
    Allowed shift context values strictly adhering to the dosimeter workflow contract.
    - START_OF_SHIFT: Validates sensor strip freshness (expiry check enforced).
    - END_OF_SHIFT: Normal shift completion analysis (expiry check omitted).
    """
    START_OF_SHIFT = "START_OF_SHIFT"
    END_OF_SHIFT = "END_OF_SHIFT"


# Initialize FastAPI application
app = FastAPI(
    title="Sulfide Sentinels - Person 2 CV Pipeline API",
    description=(
        "Thin HTTP API adapter wrapping the classical computer vision pipeline "
        "for hydrogen sulfide (H2S) dosimeter badge analysis."
    ),
    version="1.0.0",
)

# Optional CORS configuration to facilitate local development integration with Person 1 frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/health",
    summary="Service Health Check",
    response_model=Dict[str, str],
    tags=["System"],
)
def health() -> Dict[str, str]:
    """
    Returns the operational status of the Person 2 AI API service.
    Expected response: {"status": "ok"}
    """
    return {"status": "ok"}


@app.post(
    "/analyze",
    response_model=PipelineResult,
    summary="Analyze Dosimeter Badge Image",
    tags=["Analysis"],
)
async def analyze(
    file: Optional[UploadFile] = File(
        default=None,
        description="Uploaded dosimeter badge image file (standard field name: 'file').",
    ),
    image: Optional[UploadFile] = File(
        default=None,
        include_in_schema=False,
        description="Uploaded dosimeter badge image file (alternative field name: 'image').",
    ),
    shift_context: Optional[ShiftContext] = Form(
        default=None,
        description="Shift context: 'START_OF_SHIFT' or 'END_OF_SHIFT' (defaults to 'END_OF_SHIFT').",
    ),
    shift_context_query: Optional[ShiftContext] = Query(
        default=None,
        alias="shift_context",
        include_in_schema=False,
        description="Shift context query parameter fallback.",
    ),
) -> PipelineResult:
    """
    Accepts an uploaded dosimeter image and a shift context, validates the input,
    and delegates execution directly to the existing classical CV pipeline.

    - Validates that the uploaded file is a readable image.
    - Decodes image bytes into memory via OpenCV (no CV logic implemented in API layer).
    - Calls `src.pipeline.run_pipeline` with strictly `image` and `shift_context`.
    - Returns standardized `PipelineResult` adhering to the project JSON schema.
    """
    # 1. Determine uploaded file (support both 'file' and 'image' form field names)
    upload_file = file or image
    if upload_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided. Please upload an image file using form field 'file' or 'image'.",
        )

    # 2. Validate MIME content-type if provided by client
    if upload_file.content_type:
        content_type = upload_file.content_type.lower()
        if not (content_type.startswith("image/") or content_type == "application/octet-stream"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file content type '{upload_file.content_type}'. Expected an image.",
            )

    # 3. Validate file extension if filename is present
    if upload_file.filename:
        extension = Path(upload_file.filename).suffix.lower()
        if extension and extension not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Unsupported image file extension '{extension}'. "
                    f"Allowed extensions: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}."
                ),
            )

    # 4. Read the uploaded file bytes into memory
    try:
        contents = await upload_file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(exc)}",
        )

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image file is empty (0 bytes).",
        )

    # 5. Decode image bytes using OpenCV (strictly memory-based)
    nparr = np.frombuffer(contents, dtype=np.uint8)
    cv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 6. Reject invalid or unreadable images
    if cv_image is None or cv_image.size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file could not be decoded as a valid image.",
        )

    # 7. Resolve shift_context (Form takes precedence, followed by Query, defaulting to END_OF_SHIFT)
    resolved_shift = shift_context or shift_context_query or ShiftContext.END_OF_SHIFT

    # 8. Delegate strictly to the existing pipeline
    # NOTE: Only 'image' and 'shift_context' are passed.
    # Temperature, humidity, and is_expired are intentionally excluded.
    result: PipelineResult = run_pipeline(
        image=cv_image,
        shift_context=resolved_shift.value,
    )

    # 9. Return existing PipelineResult preserving the exact JSON schema
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
