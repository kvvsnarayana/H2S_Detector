"""
Unit tests for src.color_extraction module
Tests RGB, HSV, and CIE-Lab extraction from known synthetic ROIs with appropriate OpenCV tolerances.
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

from src.color_extraction import (
    extract_color_metrics,
    ColorMetrics
)


class TestColorExtraction:
    """Test suite for robust multi-space color extraction."""

    def test_rgb_extraction_from_known_roi(self):
        """Validates exact RGB extraction from a known uniform BGR patch."""
        # Known BGR = (110, 140, 182) -> Expected RGB = [182, 140, 110]
        roi = np.full((50, 50, 3), (110, 140, 182), dtype=np.uint8)
        metrics = extract_color_metrics(roi)

        assert isinstance(metrics, ColorMetrics)
        assert len(metrics.rgb) == 3
        assert metrics.rgb == [182, 140, 110]

    def test_hsv_extraction_from_known_roi(self):
        """Validates HSV extraction against standard OpenCV cvtColor COLOR_BGR2HSV."""
        roi = np.full((60, 60, 3), (110, 140, 182), dtype=np.uint8)
        metrics = extract_color_metrics(roi)

        # OpenCV BGR to HSV conversion
        expected_hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)[0, 0]
        assert len(metrics.hsv) == 3
        # Tolerance of +/- 1 for integer rounding
        for actual, expected in zip(metrics.hsv, expected_hsv):
            assert abs(actual - int(expected)) <= 1

    def test_lab_extraction_from_known_roi(self):
        """Validates CIE-Lab extraction against OpenCV cvtColor COLOR_BGR2Lab on float32."""
        roi = np.full((60, 60, 3), (110, 140, 182), dtype=np.uint8)
        metrics = extract_color_metrics(roi)

        roi_f32 = roi.astype(np.float32) / 255.0
        expected_lab = cv2.cvtColor(roi_f32, cv2.COLOR_BGR2Lab)[0, 0]

        assert len(metrics.lab) == 3
        # Verify L* is in 0..100, and values match OpenCV within 0.5 float tolerance
        assert 0.0 <= metrics.lab[0] <= 100.0
        for actual, expected in zip(metrics.lab, expected_lab):
            assert abs(actual - float(expected)) <= 0.5

    def test_primary_colors_extraction(self):
        """Validates extraction across pure primary and neutral colors."""
        # Pure Red: BGR = (0, 0, 255) -> RGB = [255, 0, 0]
        roi_red = np.full((40, 40, 3), (0, 0, 255), dtype=np.uint8)
        red_metrics = extract_color_metrics(roi_red)
        assert red_metrics.rgb == [255, 0, 0]
        assert red_metrics.hsv[0] == 0
        assert red_metrics.hsv[1] == 255
        assert red_metrics.hsv[2] == 255

        # Pure Green: BGR = (0, 255, 0) -> RGB = [0, 255, 0]
        roi_green = np.full((40, 40, 3), (0, 255, 0), dtype=np.uint8)
        green_metrics = extract_color_metrics(roi_green)
        assert green_metrics.rgb == [0, 255, 0]
        assert green_metrics.hsv[1] == 255

        # Neutral Gray: BGR = (128, 128, 128) -> RGB = [128, 128, 128]
        roi_gray = np.full((40, 40, 3), (128, 128, 128), dtype=np.uint8)
        gray_metrics = extract_color_metrics(roi_gray)
        assert gray_metrics.rgb == [128, 128, 128]
        assert gray_metrics.hsv[1] == 0  # Saturation should be 0

    def test_robust_central_tendency_with_noise(self):
        """Validates that salt-and-pepper noise / specular outliers do not distort the median."""
        base_bgr = (110, 140, 182)
        roi = np.full((80, 80, 3), base_bgr, dtype=np.uint8)

        # Corrupt 10% of pixels with pure white specular glare and pure black shadows
        np.random.seed(42)
        noise_mask_white = np.random.rand(80, 80) < 0.05
        noise_mask_black = (np.random.rand(80, 80) < 0.05) & ~noise_mask_white
        roi[noise_mask_white] = [255, 255, 255]
        roi[noise_mask_black] = [0, 0, 0]

        # Extract color using robust central tendency
        metrics = extract_color_metrics(roi)

        # The median should reject the outliers and extract the true uncorrupted color
        assert abs(metrics.rgb[0] - 182) <= 1
        assert abs(metrics.rgb[1] - 140) <= 1
        assert abs(metrics.rgb[2] - 110) <= 1

    def test_margin_crop_excludes_border_artifacts(self):
        """Validates that margin_ratio excludes darker holder / border pixels."""
        base_bgr = (110, 140, 182)
        roi = np.full((60, 60, 3), base_bgr, dtype=np.uint8)
        # Add 2-pixel black border artifact
        cv2.rectangle(roi, (0, 0), (59, 59), (0, 0, 0), 2)

        # With margin_ratio=0.10, the border is cropped out
        metrics = extract_color_metrics(roi, margin_ratio=0.10)
        assert metrics.rgb == [182, 140, 110]

    def test_invalid_roi_raises_value_error(self):
        """Validates that invalid, empty, or 2D input raises ValueError."""
        with pytest.raises(ValueError):
            extract_color_metrics(None)

        with pytest.raises(ValueError):
            extract_color_metrics(np.array([], dtype=np.uint8))

        with pytest.raises(ValueError):
            # 2D grayscale array instead of 3-channel BGR
            extract_color_metrics(np.zeros((50, 50), dtype=np.uint8))
