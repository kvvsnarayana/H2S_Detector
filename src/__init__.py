"""
Sulfide Sentinels - Person 2 AI/CV Core Package
"""

from src.quality import check_image_quality, QualityAssessment
from src.reference_detection import detect_reference_scale, ReferenceDetectionResult
from src.strip_detection import (
    detect_sensor_strip,
    StripDetectionResult,
    detect_expiry_indicator,
    ExpiryIndicatorResult
)
from src.lighting_correction import apply_white_balance, apply_gray_world
from src.color_extraction import extract_color_metrics, ColorMetrics
from src.exposure_estimation import estimate_exposure
from src.confidence import calculate_confidence
from src.pipeline import process_image, run_pipeline, PipelineResult, DetectedColor

__all__ = [
    "check_image_quality",
    "QualityAssessment",
    "detect_reference_scale",
    "ReferenceDetectionResult",
    "detect_sensor_strip",
    "StripDetectionResult",
    "detect_expiry_indicator",
    "ExpiryIndicatorResult",
    "apply_white_balance",
    "apply_gray_world",
    "extract_color_metrics",
    "ColorMetrics",
    "estimate_exposure",
    "calculate_confidence",
    "process_image",
    "run_pipeline",
    "PipelineResult",
    "DetectedColor",
]
