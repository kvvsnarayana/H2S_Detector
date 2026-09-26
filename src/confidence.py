"""
Confidence Calculation Module
Computes overall image and measurement confidence score (0.0 to 1.0) based on blur, lighting, alignment, and color uniformity.
"""

from typing import Optional, Any
import numpy as np


def calculate_confidence(
    is_valid: bool,
    quality_result: Optional[Any] = None,
    reference_found: bool = False,
    strip_found: bool = False,
    strip_roi: Optional[np.ndarray] = None
) -> float:
    """
    Calculates overall measurement confidence score in [0.0, 1.0].
    Returns 0.0 if image is unusable or components are missing.
    """
    if not is_valid or not reference_found or not strip_found:
        return 0.0

    if quality_result is not None and not getattr(quality_result, "is_acceptable", True):
        return 0.0

    # Base confidence for valid detection
    base_score = 0.70

    # Sharpness factor (0.0 to 0.15)
    blur_score = getattr(quality_result, "blur_score", 150.0) if quality_result else 150.0
    sharpness_factor = min(blur_score / 300.0, 1.0) * 0.15

    # Illumination factor (0.0 to 0.10)
    brightness = getattr(quality_result, "brightness", 128.0) if quality_result else 128.0
    illumination_factor = (1.0 - abs(brightness - 128.0) / 128.0) * 0.10

    # Uniformity factor of sensor strip (0.0 to 0.05)
    uniformity_factor = 0.05
    if strip_roi is not None and strip_roi.size > 0:
        std_val = float(np.std(strip_roi))
        uniformity_factor = max(0.0, (1.0 - min(std_val / 40.0, 1.0)) * 0.05)

    total_confidence = base_score + sharpness_factor + illumination_factor + uniformity_factor
    return round(float(np.clip(total_confidence, 0.0, 1.0)), 2)
