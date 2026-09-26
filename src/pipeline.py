"""
Pipeline Module
Master classical computer-vision orchestrator executing quality checking, detection,
correction, color extraction, and exposure estimation, returning the standardized JSON result.
"""

from typing import Optional, List, Dict, Any, Literal
import numpy as np
from pydantic import BaseModel, Field, ConfigDict

from src.quality import check_image_quality, QualityAssessment
from src.reference_detection import detect_reference_scale, ReferenceDetectionResult
from src.strip_detection import (
    detect_sensor_strip,
    StripDetectionResult,
    detect_expiry_indicator,
    ExpiryIndicatorResult
)
from src.lighting_correction import apply_white_balance
from src.color_extraction import extract_color_metrics, ColorMetrics
from src.exposure_estimation import estimate_exposure
from src.confidence import calculate_confidence


class DetectedColor(BaseModel):
    """Extracted color metrics conforming to the standardized contract."""
    rgb: List[int] = Field(description="RGB central tendency [R, G, B]")
    hsv: List[int] = Field(description="OpenCV HSV [H, S, V] where H in [0, 179]")
    lab: List[float] = Field(description="CIE-Lab [L*, a*, b*] with L* in [0, 100]")


class PipelineResult(BaseModel):
    """
    Standardized Person 1 / Person 2 JSON interface contract.
    Directly serializable via model_dump() and model_dump_json().
    """
    status: Literal["VALID", "RETAKE"]
    exposure: Optional[float] = None
    unit: str = "ppm-h"
    confidence: float
    quality: Literal["GOOD", "FAIR", "POOR"]
    detectedColor: Optional[DetectedColor] = None
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Converts model to serializable Python dictionary."""
        return self.model_dump()

    def to_json(self) -> str:
        """Converts model to standardized JSON string."""
        return self.model_dump_json(indent=2)


def process_image(
    image: np.ndarray,
    shift_context: Literal["START_OF_SHIFT", "END_OF_SHIFT"] = "END_OF_SHIFT",
    calibration_data: Optional[Dict[str, Any]] = None,
    temperature: Optional[float] = None,
    humidity: Optional[float] = None,
    is_expired: Optional[bool] = None
) -> PipelineResult:
    """
    Executes the classical CV dosimeter analysis pipeline:
    1. Input validation & Image quality validation (blur, lighting, glare)
    2. LAYER 1 — SENSOR STRIP DETECTION:
       - If the sensor strip is absent -> RETAKE.
       - If detected -> continue.
    3. SHIFT CONTEXT CHECK:
       - At START_OF_SHIFT: expiry indicator is checked. If expired -> RETAKE.
       - At END_OF_SHIFT: expiry indicator MUST NOT be considered; workflow continues normally.
    4. LAYER 2 — REFERENCE SCALE DETECTION:
       - Occurs only after strip presence is confirmed.
       - If reference scale is absent -> RETAKE.
       - If detected -> continue.
    5. LAYER 3 — COLOR EXTRACTION + EXPOSURE ESTIMATION:
       - Extract strip color only after Layers 1 and 2 succeed.
       - Temperature and humidity are strictly NOT used in Layer 3.
       - Chamber calibration data is used if provided.
       - If calibration is unavailable, exposure remains null (do not invent exposure values).
    6. Multi-metric confidence score computation.

    Returns standardized PipelineResult adhering to the project schema contract.
    """
    # Step 0: Input validation
    if image is None or image.size == 0 or len(image.shape) < 2:
        return PipelineResult(
            status="RETAKE",
            exposure=None,
            unit="ppm-h",
            confidence=0.0,
            quality="POOR",
            detectedColor=None,
            reason="Invalid or empty image"
        )

    # Step 1: Quality checking gate
    quality_result: QualityAssessment = check_image_quality(image)
    if not quality_result.is_acceptable:
        return PipelineResult(
            status="RETAKE",
            exposure=None,
            unit="ppm-h",
            confidence=0.0,
            quality=quality_result.quality,
            detectedColor=None,
            reason=quality_result.reason
        )

    # Step 2: LAYER 1 — SENSOR STRIP DETECTION
    # Must confirm strip presence before any reference scale or concentration analysis
    strip_result: StripDetectionResult = detect_sensor_strip(image)
    if not strip_result.found or strip_result.roi is None:
        return PipelineResult(
            status="RETAKE",
            exposure=None,
            unit="ppm-h",
            confidence=0.0,
            quality="POOR",
            detectedColor=None,
            reason="Sensor strip not detected"
        )

    # Step 3: SHIFT CONTEXT — EXPIRY INDICATOR
    # At START_OF_SHIFT, the expiry indicator may be checked.
    # At END_OF_SHIFT, the expiry indicator MUST NOT be considered.
    if shift_context == "START_OF_SHIFT":
        if is_expired is not None:
            badge_expired = is_expired
        else:
            expiry_res = detect_expiry_indicator(image)
            badge_expired = expiry_res.is_expired

        if badge_expired:
            return PipelineResult(
                status="RETAKE",
                exposure=None,
                unit="ppm-h",
                confidence=0.0,
                quality="POOR",
                detectedColor=None,
                reason="Dosimeter badge has expired. Do not use for shift."
            )

    # Step 4: LAYER 2 — REFERENCE SCALE DETECTION
    # Reference scale detection occurs only after strip presence is confirmed
    ref_result: ReferenceDetectionResult = detect_reference_scale(image)
    if not ref_result.found:
        return PipelineResult(
            status="RETAKE",
            exposure=None,
            unit="ppm-h",
            confidence=0.0,
            quality="POOR",
            detectedColor=None,
            reason="Reference scale not detected"
        )

    # Step 5: LAYER 3 — COLOR EXTRACTION + EXPOSURE ESTIMATION
    # Extract strip color only after Layers 1 and 2 succeed
    try:
        color_metrics: ColorMetrics = extract_color_metrics(strip_result.roi)
    except Exception as exc:
        return PipelineResult(
            status="RETAKE",
            exposure=None,
            unit="ppm-h",
            confidence=0.0,
            quality="POOR",
            detectedColor=None,
            reason=f"Color extraction error: {str(exc)}"
        )

    # Exposure estimation:
    # Uses chamber calibration if available; remains null if unavailable.
    # Temperature and humidity are strictly ignored in Layer 3.
    exposure_value = estimate_exposure(
        color_data=color_metrics,
        calibration_data=calibration_data,
        temperature=temperature,
        humidity=humidity
    )

    # Confidence calculation
    confidence_score = calculate_confidence(
        is_valid=True,
        quality_result=quality_result,
        reference_found=ref_result.found,
        strip_found=strip_result.found,
        strip_roi=strip_result.roi
    )

    detected_color = DetectedColor(
        rgb=color_metrics.rgb,
        hsv=color_metrics.hsv,
        lab=color_metrics.lab
    )

    return PipelineResult(
        status="VALID",
        exposure=exposure_value,
        unit="ppm-h",
        confidence=confidence_score,
        quality=quality_result.quality,
        detectedColor=detected_color,
        reason=None
    )


def run_pipeline(
    image: np.ndarray,
    shift_context: Literal["START_OF_SHIFT", "END_OF_SHIFT"] = "END_OF_SHIFT",
    calibration_data: Optional[Dict[str, Any]] = None,
    temperature: Optional[float] = None,
    humidity: Optional[float] = None,
    is_expired: Optional[bool] = None
) -> PipelineResult:
    """Entry point alias executing the classical CV dosimeter analysis pipeline."""
    return process_image(
        image=image,
        shift_context=shift_context,
        calibration_data=calibration_data,
        temperature=temperature,
        humidity=humidity,
        is_expired=is_expired
    )
