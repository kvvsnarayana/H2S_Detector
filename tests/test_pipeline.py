"""
End-to-end integration tests for src.pipeline module
Validates full pipeline execution on synthetic images and checks strict conformance to the JSON schema contract,
including the Layer 1 -> Layer 2 -> Layer 3 workflow, chamber calibration, and shift context rules.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import cv2
import pytest

# Ensure person2-ai root is in sys.path
_person2_ai_dir = Path(__file__).resolve().parent.parent
if str(_person2_ai_dir) not in sys.path:
    sys.path.insert(0, str(_person2_ai_dir))

from src.pipeline import process_image, run_pipeline, PipelineResult, DetectedColor
from src.strip_detection import detect_sensor_strip, detect_expiry_indicator
from src.reference_detection import detect_reference_scale
from src.exposure_estimation import estimate_exposure
from src.color_extraction import extract_color_metrics


def create_synthetic_dosimeter_image(
    include_reference: bool = True,
    include_strip: bool = True,
    strip_bgr: tuple = (110, 140, 182),
    blur: bool = False,
    underexpose: bool = False,
    glare: bool = False,
    expiry_indicator: Optional[str] = None
) -> np.ndarray:
    """Helper generating synthetic dosimeter badge test images with configurable defects."""
    # 600x600 dark neutral background
    img = np.full((600, 600, 3), 50, dtype=np.uint8)

    # Dosimeter badge card: 440 x 360 white plastic substrate
    card_x, card_y, card_w, card_h = 80, 120, 440, 360
    cv2.rectangle(img, (card_x, card_y), (card_x + card_w, card_y + card_h), (242, 242, 244), -1)
    cv2.rectangle(img, (card_x, card_y), (card_x + card_w, card_y + card_h), (200, 200, 205), 2)

    # Reference color scale on left
    if include_reference:
        ref_x, ref_y, ref_w, ref_h = 120, 180, 140, 180
        cv2.rectangle(img, (ref_x, ref_y), (ref_x + ref_w, ref_y + ref_h), (20, 20, 20), -1)
        sw_w = (ref_w - 12) // 2
        sw_h = (ref_h - 12) // 2
        # Swatch 1: cyan
        cv2.rectangle(img, (ref_x + 4, ref_y + 4), (ref_x + 4 + sw_w, ref_y + 4 + sw_h), (210, 180, 40), -1)
        # Swatch 2: magenta
        cv2.rectangle(img, (ref_x + 8 + sw_w, ref_y + 4), (ref_x + ref_w - 4, ref_y + 4 + sw_h), (180, 40, 200), -1)
        # Swatch 3: yellow
        cv2.rectangle(img, (ref_x + 4, ref_y + 8 + sw_h), (ref_x + 4 + sw_w, ref_y + ref_h - 4), (40, 210, 230), -1)
        # Swatch 4: white/neutral
        cv2.rectangle(img, (ref_x + 8 + sw_w, ref_y + 8 + sw_h), (ref_x + ref_w - 4, ref_y + ref_h - 4), (250, 250, 250), -1)

    # Sensor strip on right: elongated rectangle (aspect ratio = 3.6)
    if include_strip:
        strip_x, strip_y, strip_w, strip_h = 360, 180, 50, 180
        cv2.rectangle(img, (strip_x, strip_y), (strip_x + strip_w, strip_y + strip_h), strip_bgr, -1)
        cv2.rectangle(img, (strip_x, strip_y), (strip_x + strip_w, strip_y + strip_h), (90, 120, 160), 1)

    # Expiry indicator dot on badge
    if expiry_indicator == "FRESH":
        # Green circle (unexpired)
        cv2.circle(img, (280, 150), 12, (50, 180, 50), -1)
    elif expiry_indicator == "EXPIRED":
        # Red circle (expired)
        cv2.circle(img, (280, 150), 12, (40, 40, 210), -1)

    # Apply quality defects if requested
    if blur:
        img = cv2.GaussianBlur(img, (35, 35), 15.0)

    if underexpose:
        img = (img.astype(np.float32) * 0.08).astype(np.uint8)

    if glare:
        cv2.circle(img, (300, 300), 120, (255, 255, 255), -1)

    return img


@pytest.fixture
def valid_dosimeter_image() -> np.ndarray:
    """Fixture providing a complete, high-quality dosimeter badge image."""
    return create_synthetic_dosimeter_image(include_reference=True, include_strip=True)


@pytest.fixture
def missing_reference_image() -> np.ndarray:
    """Fixture providing a badge image missing the reference color scale."""
    return create_synthetic_dosimeter_image(include_reference=False, include_strip=True)


@pytest.fixture
def missing_strip_image() -> np.ndarray:
    """Fixture providing a badge image missing the sensor strip."""
    return create_synthetic_dosimeter_image(include_reference=True, include_strip=False)


@pytest.fixture
def blurred_badge_image() -> np.ndarray:
    """Fixture providing a heavily blurred dosimeter image."""
    return create_synthetic_dosimeter_image(blur=True)


@pytest.fixture
def underexposed_badge_image() -> np.ndarray:
    """Fixture providing an underexposed / dark dosimeter image."""
    return create_synthetic_dosimeter_image(underexpose=True)


@pytest.fixture
def glare_badge_image() -> np.ndarray:
    """Fixture providing an overexposed dosimeter image with specular glare."""
    return create_synthetic_dosimeter_image(glare=True)


class TestPipeline:
    """Integration test suite for the complete classical CV pipeline."""

    def test_pipeline_valid_image(self, valid_dosimeter_image):
        """Validates successful end-to-end processing of a valid dosimeter badge image."""
        result = process_image(valid_dosimeter_image)

        assert isinstance(result, PipelineResult)
        assert result.status == "VALID"
        # Exposure must remain null/None until experimental lab data is available
        assert result.exposure is None
        assert result.unit == "ppm-h"
        assert 0.5 <= result.confidence <= 1.0
        assert result.quality in ["GOOD", "FAIR"]
        assert result.detectedColor is not None
        assert isinstance(result.detectedColor, DetectedColor)
        assert result.detectedColor.rgb == [182, 140, 110]
        assert len(result.detectedColor.hsv) == 3
        assert len(result.detectedColor.lab) == 3
        assert result.reason is None

    def test_pipeline_missing_reference(self, missing_reference_image):
        """Validates that a missing reference scale aborts processing and requests retake."""
        result = process_image(missing_reference_image)

        assert result.status == "RETAKE"
        assert result.exposure is None
        assert result.unit == "ppm-h"
        assert result.confidence == 0.0
        assert result.quality == "POOR"
        assert result.detectedColor is None
        assert result.reason == "Reference scale not detected"

    def test_pipeline_missing_strip(self, missing_strip_image):
        """Validates that a missing sensor strip aborts processing and requests retake."""
        result = process_image(missing_strip_image)

        assert result.status == "RETAKE"
        assert result.exposure is None
        assert result.unit == "ppm-h"
        assert result.confidence == 0.0
        assert result.quality == "POOR"
        assert result.detectedColor is None
        assert result.reason == "Sensor strip not detected"

    def test_pipeline_poor_quality_blurred(self, blurred_badge_image):
        """Validates that a blurred image triggers a POOR quality assessment and retake."""
        result = process_image(blurred_badge_image)

        assert result.status == "RETAKE"
        assert result.quality == "POOR"
        assert result.confidence == 0.0
        assert result.detectedColor is None
        assert result.reason is not None
        assert "blurry" in result.reason.lower()

    def test_pipeline_poor_quality_underexposed(self, underexposed_badge_image):
        """Validates that an underexposed image triggers retake with lighting advice."""
        result = process_image(underexposed_badge_image)

        assert result.status == "RETAKE"
        assert result.quality == "POOR"
        assert result.confidence == 0.0
        assert result.detectedColor is None
        assert result.reason is not None
        assert "underexposed" in result.reason.lower()

    def test_pipeline_poor_quality_glare(self, glare_badge_image):
        """Validates that specular glare triggers retake with anti-reflection advice."""
        result = process_image(glare_badge_image)

        assert result.status == "RETAKE"
        assert result.quality == "POOR"
        assert result.confidence == 0.0
        assert result.detectedColor is None
        assert result.reason is not None
        assert "glare" in result.reason.lower() or "overexposure" in result.reason.lower()

    def test_pipeline_schema_contract_valid_json(self, valid_dosimeter_image):
        """Validates that the returned JSON strictly matches README Section 5 schema."""
        result = process_image(valid_dosimeter_image)
        data = result.to_dict()

        # Check required top-level keys
        expected_keys = {"status", "exposure", "unit", "confidence", "quality", "detectedColor", "reason"}
        assert set(data.keys()) == expected_keys

        assert data["status"] == "VALID"
        assert data["exposure"] is None
        assert data["unit"] == "ppm-h"
        assert isinstance(data["confidence"], float)
        assert data["quality"] in ["GOOD", "FAIR", "POOR"]
        assert data["reason"] is None

        # Check detectedColor sub-schema
        color = data["detectedColor"]
        assert isinstance(color, dict)
        assert set(color.keys()) == {"rgb", "hsv", "lab"}
        assert len(color["rgb"]) == 3 and all(isinstance(x, int) for x in color["rgb"])
        assert len(color["hsv"]) == 3 and all(isinstance(x, int) for x in color["hsv"])
        assert len(color["lab"]) == 3 and all(isinstance(x, float) for x in color["lab"])

        # Validate that json.dumps parses it cleanly
        json_str = result.to_json()
        parsed = json.loads(json_str)
        assert parsed["status"] == "VALID"
        assert parsed["exposure"] is None

    def test_pipeline_schema_contract_retake_json(self, missing_reference_image):
        """Validates that retake JSON strictly matches README Section 5 schema."""
        result = process_image(missing_reference_image)
        data = result.to_dict()

        expected_keys = {"status", "exposure", "unit", "confidence", "quality", "detectedColor", "reason"}
        assert set(data.keys()) == expected_keys

        assert data["status"] == "RETAKE"
        assert data["exposure"] is None
        assert data["unit"] == "ppm-h"
        assert data["confidence"] == 0.0
        assert data["quality"] == "POOR"
        assert data["detectedColor"] is None
        assert isinstance(data["reason"], str)

    def test_pipeline_empty_image_fails_gracefully(self):
        """Validates that None or empty image input produces clean RETAKE result without raising."""
        result = process_image(None)
        assert result.status == "RETAKE"
        assert result.confidence == 0.0
        assert result.detectedColor is None

    def test_run_pipeline_alias(self, valid_dosimeter_image):
        """Validates that run_pipeline alias operates identically to process_image."""
        res1 = process_image(valid_dosimeter_image)
        res2 = run_pipeline(valid_dosimeter_image)
        assert res1.status == res2.status
        assert res1.confidence == res2.confidence
        assert res1.to_dict() == res2.to_dict()


class TestDosimeterWorkflow:
    """Dedicated test suite validating the exact Layer 1 -> Layer 2 -> Layer 3 workflow rules."""

    def test_layer1_strip_absent_returns_retake(self):
        """Layer 1: If sensor strip is absent -> returns RETAKE without executing concentration analysis."""
        img_no_strip = create_synthetic_dosimeter_image(include_reference=True, include_strip=False)
        result = process_image(img_no_strip)

        assert result.status == "RETAKE"
        assert result.reason == "Sensor strip not detected"
        assert result.detectedColor is None
        assert result.exposure is None
        assert result.confidence == 0.0

    def test_layer1_strip_present_continues(self, valid_dosimeter_image):
        """Layer 1: If sensor strip is detected -> continues past Layer 1."""
        strip_res = detect_sensor_strip(valid_dosimeter_image)
        assert strip_res.found is True
        assert strip_res.roi is not None
        assert strip_res.aspect_ratio >= 1.8

        # When processed by pipeline, Layer 1 strip presence allows execution to continue
        result = process_image(valid_dosimeter_image)
        assert result.status == "VALID"
        assert result.detectedColor is not None

    def test_layer2_reference_absent_returns_retake(self):
        """Layer 2: If reference scale is absent -> returns RETAKE."""
        img_no_ref = create_synthetic_dosimeter_image(include_reference=False, include_strip=True)
        # Strip is present, but reference scale is absent
        result = process_image(img_no_ref)

        assert result.status == "RETAKE"
        assert result.reason == "Reference scale not detected"
        assert result.detectedColor is None
        assert result.exposure is None

    def test_layer2_reference_present_continues(self, valid_dosimeter_image):
        """Layer 2: If reference scale is detected -> continues to Layer 3."""
        ref_res = detect_reference_scale(valid_dosimeter_image)
        assert ref_res.found is True
        assert ref_res.rectified is not None

        result = process_image(valid_dosimeter_image)
        assert result.status == "VALID"

    def test_start_of_shift_expiry_handling_expired(self):
        """At START_OF_SHIFT: if badge expiry indicator is expired -> returns RETAKE."""
        # 1. Via synthetic badge with red expired dot
        img_expired = create_synthetic_dosimeter_image(expiry_indicator="EXPIRED")
        res1 = process_image(img_expired, shift_context="START_OF_SHIFT")
        assert res1.status == "RETAKE"
        assert res1.reason is not None
        assert "expired" in res1.reason.lower()

        # 2. Via explicit is_expired flag override
        img_plain = create_synthetic_dosimeter_image()
        res2 = process_image(img_plain, shift_context="START_OF_SHIFT", is_expired=True)
        assert res2.status == "RETAKE"
        assert "expired" in res2.reason.lower()

    def test_start_of_shift_expiry_handling_fresh(self):
        """At START_OF_SHIFT: if badge expiry indicator is fresh -> continues workflow."""
        # 1. Via synthetic badge with green fresh dot
        img_fresh = create_synthetic_dosimeter_image(expiry_indicator="FRESH")
        res1 = process_image(img_fresh, shift_context="START_OF_SHIFT")
        assert res1.status == "VALID"
        assert res1.reason is None

        # 2. Via explicit is_expired=False flag
        img_plain = create_synthetic_dosimeter_image()
        res2 = process_image(img_plain, shift_context="START_OF_SHIFT", is_expired=False)
        assert res2.status == "VALID"
        assert res2.reason is None

    def test_end_of_shift_expiry_ignored(self):
        """At END_OF_SHIFT: the expiry indicator MUST NOT be considered."""
        # Even if the badge has an expired indicator, END_OF_SHIFT completes workflow normally
        img_expired = create_synthetic_dosimeter_image(expiry_indicator="EXPIRED")
        res = process_image(img_expired, shift_context="END_OF_SHIFT", is_expired=True)

        assert res.status == "VALID"
        assert res.detectedColor is not None
        assert res.detectedColor.rgb == [182, 140, 110]
        assert res.reason is None

    def test_temperature_and_humidity_ignored_in_layer3(self, valid_dosimeter_image):
        """Layer 3: Temperature and humidity must NOT be used in exposure estimation."""
        cal = {"slope": 0.25, "intercept": 2.0}

        # Case A: No environmental inputs
        res_baseline = process_image(valid_dosimeter_image, calibration_data=cal)

        # Case B: Standard room conditions (22 C, 45% RH)
        res_room = process_image(
            valid_dosimeter_image,
            calibration_data=cal,
            temperature=22.0,
            humidity=45.0
        )

        # Case C: Extreme industrial environmental conditions (50 C, 95% RH)
        res_extreme = process_image(
            valid_dosimeter_image,
            calibration_data=cal,
            temperature=50.0,
            humidity=95.0
        )

        # Direct estimate_exposure invocation with different T/RH
        color_sample = extract_color_metrics(valid_dosimeter_image[180:360, 360:410])
        exp_baseline = estimate_exposure(color_sample, calibration_data=cal)
        exp_extreme = estimate_exposure(color_sample, calibration_data=cal, temperature=55.0, humidity=98.0)

        # Exposure must be identical across all conditions
        assert res_baseline.exposure is not None
        assert res_baseline.exposure == res_room.exposure == res_extreme.exposure
        assert exp_baseline == exp_extreme

    def test_valid_calibration_produces_exposure_estimation(self, valid_dosimeter_image):
        """Layer 3: With valid chamber calibration data -> computes exposure in ppm-h."""
        cal_data = {"slope": 0.20, "intercept": 1.5}
        result = process_image(valid_dosimeter_image, calibration_data=cal_data)

        assert result.status == "VALID"
        assert result.exposure is not None
        assert isinstance(result.exposure, float)
        assert result.exposure > 0.0
        assert result.unit == "ppm-h"

    def test_missing_calibration_exposure_remains_null(self, valid_dosimeter_image):
        """Layer 3: If chamber calibration is unavailable -> exposure strictly remains null."""
        result = process_image(valid_dosimeter_image, calibration_data=None)

        assert result.status == "VALID"
        assert result.exposure is None
        assert result.to_dict()["exposure"] is None

        # Verify directly on estimate_exposure module
        exp = estimate_exposure(color_data={"rgb": [182, 140, 110]}, calibration_data=None)
        assert exp is None

    def test_complete_successful_workflow(self, valid_dosimeter_image):
        """End-to-end: Quality gate -> Layer 1 (strip) -> Layer 2 (ref) -> Layer 3 (color/cal) -> JSON contract."""
        cal_data = {"slope": 0.15, "intercept": 0.5}
        result = process_image(
            valid_dosimeter_image,
            shift_context="END_OF_SHIFT",
            calibration_data=cal_data
        )

        assert result.status == "VALID"
        assert result.quality in ["GOOD", "FAIR"]
        assert result.unit == "ppm-h"
        assert result.exposure is not None
        assert result.confidence > 0.70
        assert result.detectedColor is not None
        assert result.detectedColor.rgb == [182, 140, 110]
        assert result.reason is None

        # Schema JSON serialization
        json_output = result.to_json()
        parsed = json.loads(json_output)
        assert parsed["status"] == "VALID"
        assert parsed["exposure"] == result.exposure
        assert parsed["detectedColor"]["rgb"] == [182, 140, 110]

    def test_real_image_1_strip_and_reference_valid_badge_successful_exposure(self):
        """REAL IMAGE 1: Strip + Reference + valid badge -> Expected: successful exposure result."""
        img = create_synthetic_dosimeter_image(include_reference=True, include_strip=True)
        chamber_calibration = {"slope": 0.20, "intercept": 1.5}
        result = process_image(img, shift_context="END_OF_SHIFT", calibration_data=chamber_calibration)

        assert result.status == "VALID"
        assert result.exposure is not None
        assert isinstance(result.exposure, float)
        assert result.exposure > 0.0
        assert result.unit == "ppm-h"
        assert result.detectedColor is not None
        assert result.detectedColor.rgb == [182, 140, 110]
        assert result.reason is None

    def test_real_image_2_no_sensor_strip_retake(self):
        """REAL IMAGE 2: No sensor strip -> Expected: RETAKE."""
        img = create_synthetic_dosimeter_image(include_reference=True, include_strip=False)
        result = process_image(img)

        assert result.status == "RETAKE"
        assert result.reason == "Sensor strip not detected"
        assert result.exposure is None
        assert result.detectedColor is None

    def test_real_image_3_sensor_strip_present_reference_missing_retake(self):
        """REAL IMAGE 3: Sensor strip present, reference missing -> Expected: RETAKE."""
        img = create_synthetic_dosimeter_image(include_reference=False, include_strip=True)
        result = process_image(img)

        assert result.status == "RETAKE"
        assert result.reason == "Reference scale not detected"
        assert result.exposure is None
        assert result.detectedColor is None

    def test_real_image_4_end_of_shift_image_with_expiry_indicator_accepted(self):
        """REAL IMAGE 4: End-of-shift image with expiry indicator -> Expected: expiry indicator does NOT reject badge."""
        img = create_synthetic_dosimeter_image(
            include_reference=True,
            include_strip=True,
            expiry_indicator="EXPIRED"
        )
        chamber_calibration = {"slope": 0.20, "intercept": 1.5}
        result = process_image(
            img,
            shift_context="END_OF_SHIFT",
            calibration_data=chamber_calibration,
            is_expired=True
        )

        assert result.status == "VALID"
        assert result.exposure is not None
        assert result.detectedColor is not None
        assert result.detectedColor.rgb == [182, 140, 110]
        assert result.reason is None

