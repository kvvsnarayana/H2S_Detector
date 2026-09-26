"""
Unit tests for src.quality module
Tests sharpness/blur, illumination/underexposure, glare/overexposure, and retake behavior.
"""

import sys
from pathlib import Path
import numpy as np
import cv2
import pytest

# Ensure person2-ai root is in sys.path
_person2_ai_dir = Path(__file__).resolve().parent.parent
if str(_person2_ai_dir) not in sys.path:
    sys.path.insert(0, str(_person2_ai_dir))

from src.quality import (
    calculate_blur_score,
    calculate_brightness,
    calculate_glare_ratio,
    check_image_quality,
    QualityAssessment
)


@pytest.fixture
def sharp_checkerboard_image() -> np.ndarray:
    """Fixture providing a crisp, high-contrast 400x400 checkerboard image."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    square_size = 40
    for r in range(0, 400, square_size):
        for c in range(0, 400, square_size):
            if (r // square_size + c // square_size) % 2 == 0:
                img[r:r + square_size, c:c + square_size] = (220, 220, 220)
            else:
                img[r:r + square_size, c:c + square_size] = (30, 30, 30)
    return img


@pytest.fixture
def well_lit_dosimeter_image() -> np.ndarray:
    """Fixture providing a well-lit, sharp synthetic dosimeter badge image."""
    img = np.full((500, 500, 3), 60, dtype=np.uint8)
    # White badge
    cv2.rectangle(img, (80, 80), (420, 420), (235, 235, 238), -1)
    # High-contrast elements
    cv2.rectangle(img, (120, 120), (220, 260), (20, 20, 20), -1)
    cv2.rectangle(img, (280, 120), (330, 300), (110, 140, 182), -1)
    return img


class TestQualityModule:
    """Test suite for image quality validation algorithms."""

    def test_sharp_image_passes_quality_check(self, sharp_checkerboard_image):
        """Validates that a crisp, in-focus image receives high blur score and is acceptable."""
        score = calculate_blur_score(sharp_checkerboard_image)
        assert score > 100.0, f"Expected high blur score for sharp image, got {score}"

        result = check_image_quality(sharp_checkerboard_image)
        assert isinstance(result, QualityAssessment)
        assert result.is_acceptable is True
        assert result.is_blurred is False
        assert result.quality in ["GOOD", "FAIR"]
        assert result.reason is None

    def test_blurred_image_fails_quality_check(self, sharp_checkerboard_image):
        """Validates that a heavily blurred image fails the blur threshold and requests retake."""
        blurred = cv2.GaussianBlur(sharp_checkerboard_image, (35, 35), 15.0)
        blur_score = calculate_blur_score(blurred)
        assert blur_score < 50.0, f"Expected low blur score for blurred image, got {blur_score}"

        result = check_image_quality(blurred, blur_threshold=100.0)
        assert result.is_acceptable is False
        assert result.is_blurred is True
        assert result.quality == "POOR"
        assert result.reason is not None
        assert "blurry" in result.reason.lower()

    def test_normal_brightness_passes(self, well_lit_dosimeter_image):
        """Validates that a properly illuminated image has brightness in expected range."""
        brightness = calculate_brightness(well_lit_dosimeter_image)
        assert 50.0 <= brightness <= 200.0

        result = check_image_quality(well_lit_dosimeter_image)
        assert result.is_acceptable is True
        assert result.is_underexposed is False
        assert result.is_overexposed is False

    def test_underexposed_image_fails_quality_check(self, well_lit_dosimeter_image):
        """Validates that a very dark / underexposed image fails and requests retake."""
        dark_image = (well_lit_dosimeter_image.astype(np.float32) * 0.08).astype(np.uint8)
        brightness = calculate_brightness(dark_image)
        assert brightness < 40.0, f"Expected dark brightness, got {brightness}"

        result = check_image_quality(dark_image, min_brightness=40.0)
        assert result.is_acceptable is False
        assert result.is_underexposed is True
        assert result.quality == "POOR"
        assert result.reason is not None
        assert "underexposed" in result.reason.lower()

    def test_overexposed_glare_image_fails_quality_check(self, well_lit_dosimeter_image):
        """Validates that specular glare / saturated highlights trigger retake."""
        glare_image = well_lit_dosimeter_image.copy()
        # Add large specular reflection spot covering > 10% of image
        cv2.circle(glare_image, (250, 250), 100, (255, 255, 255), -1)

        glare_ratio = calculate_glare_ratio(glare_image, threshold=250)
        assert glare_ratio > 0.05, f"Expected glare ratio > 0.05, got {glare_ratio}"

        result = check_image_quality(glare_image, max_glare_ratio=0.05)
        assert result.is_acceptable is False
        assert result.is_overexposed is True
        assert result.quality == "POOR"
        assert result.reason is not None
        assert "glare" in result.reason.lower() or "overexposure" in result.reason.lower()

    def test_empty_or_none_image_handling(self):
        """Validates robust handling of empty or None image input."""
        empty_img = np.array([], dtype=np.uint8)
        result_empty = check_image_quality(empty_img)
        assert result_empty.is_acceptable is False
        assert result_empty.quality == "POOR"

        result_none = check_image_quality(None)
        assert result_none.is_acceptable is False
        assert result_none.quality == "POOR"

    def test_grayscale_input_supported(self, sharp_checkerboard_image):
        """Validates that 2D grayscale images are correctly evaluated."""
        gray = cv2.cvtColor(sharp_checkerboard_image, cv2.COLOR_BGR2GRAY)
        assert len(gray.shape) == 2
        result = check_image_quality(gray)
        assert result.is_acceptable is True
        assert result.blur_score > 100.0
