"""
Image Quality Module
Performs blur detection, illumination checks (overexposure/glare, underexposure/shadows),
and returns usable/retake quality assessments.
"""

from typing import Optional, Literal
import numpy as np
import cv2
from pydantic import BaseModel


class QualityAssessment(BaseModel):
    """Container for image quality assessment metrics and retake decisions."""
    is_acceptable: bool
    quality: Literal["GOOD", "FAIR", "POOR"]
    blur_score: float
    is_blurred: bool
    brightness: float
    is_underexposed: bool
    glare_ratio: float
    is_overexposed: bool
    reason: Optional[str] = None


def calculate_blur_score(image: np.ndarray) -> float:
    """
    Computes sharpness using the variance of the Laplacian.
    Higher values denote sharper images; values below threshold denote blur.
    """
    if image is None or image.size == 0:
        return 0.0
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    return float(laplacian.var())


def calculate_brightness(image: np.ndarray) -> float:
    """
    Computes mean image luminance/brightness (0.0 to 255.0).
    """
    if image is None or image.size == 0:
        return 0.0
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    return float(np.mean(gray))


def calculate_glare_ratio(image: np.ndarray, threshold: int = 250) -> float:
    """
    Computes fraction of pixels exhibiting extreme specular highlight / saturation.
    """
    if image is None or image.size == 0:
        return 1.0
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    glare_pixels = np.count_nonzero(gray >= threshold)
    return float(glare_pixels / gray.size)


def check_image_quality(
    image: np.ndarray,
    blur_threshold: float = 100.0,
    min_brightness: float = 40.0,
    max_brightness: float = 230.0,
    max_glare_ratio: float = 0.05
) -> QualityAssessment:
    """
    Validates image against sharpness, underexposure, and glare criteria.
    Returns QualityAssessment with retake recommendation if unacceptable.
    """
    if image is None or image.size == 0:
        return QualityAssessment(
            is_acceptable=False,
            quality="POOR",
            blur_score=0.0,
            is_blurred=True,
            brightness=0.0,
            is_underexposed=True,
            glare_ratio=0.0,
            is_overexposed=False,
            reason="Invalid or empty image"
        )

    blur_score = calculate_blur_score(image)
    brightness = calculate_brightness(image)
    glare_ratio = calculate_glare_ratio(image)

    is_blurred = blur_score < blur_threshold
    is_underexposed = brightness < min_brightness
    is_overexposed = (glare_ratio > max_glare_ratio) or (brightness > max_brightness)

    # Determine usability and reason
    # If the image is underexposed / dark, gradients are suppressed so check lighting first
    if is_underexposed:
        return QualityAssessment(
            is_acceptable=False,
            quality="POOR",
            blur_score=blur_score,
            is_blurred=is_blurred,
            brightness=brightness,
            is_underexposed=True,
            glare_ratio=glare_ratio,
            is_overexposed=is_overexposed,
            reason="Image is underexposed. Please move to a better-lit area or use lighting."
        )

    if is_overexposed:
        return QualityAssessment(
            is_acceptable=False,
            quality="POOR",
            blur_score=blur_score,
            is_blurred=is_blurred,
            brightness=brightness,
            is_underexposed=False,
            glare_ratio=glare_ratio,
            is_overexposed=True,
            reason="Excessive glare or overexposure detected. Please avoid direct specular reflection."
        )

    if is_blurred:
        return QualityAssessment(
            is_acceptable=False,
            quality="POOR",
            blur_score=blur_score,
            is_blurred=True,
            brightness=brightness,
            is_underexposed=False,
            glare_ratio=glare_ratio,
            is_overexposed=False,
            reason="Image is too blurry. Please hold camera steady and tap to focus."
        )

    # Image is acceptable. Determine GOOD vs FAIR quality
    quality_label: Literal["GOOD", "FAIR"] = "GOOD"
    if blur_score < (blur_threshold * 1.5) or brightness < 60.0 or brightness > 200.0 or glare_ratio > 0.02:
        quality_label = "FAIR"

    return QualityAssessment(
        is_acceptable=True,
        quality=quality_label,
        blur_score=blur_score,
        is_blurred=False,
        brightness=brightness,
        is_underexposed=False,
        glare_ratio=glare_ratio,
        is_overexposed=False,
        reason=None
    )
