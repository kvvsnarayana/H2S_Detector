"""
Unit tests for src.strip_detection module
Tests detection and ROI segmentation of synthetic H2S sensor strip and failure when absent.
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

from src.strip_detection import (
    detect_sensor_strip,
    StripDetectionResult
)


@pytest.fixture
def synthetic_badge_with_strip() -> np.ndarray:
    """Fixture providing a synthetic dosimeter badge with an elongated sensor strip."""
    img = np.full((600, 600, 3), 50, dtype=np.uint8)
    # White badge substrate
    cv2.rectangle(img, (80, 120), (520, 480), (242, 242, 244), -1)

    # Reference scale on left
    cv2.rectangle(img, (120, 180), (260, 360), (20, 20, 20), -1)

    # Elongated sensor strip on right: x=360, y=180, w=50, h=180 (aspect ratio = 3.6)
    cv2.rectangle(img, (360, 180), (410, 360), (110, 140, 182), -1)
    # Strip border
    cv2.rectangle(img, (360, 180), (410, 360), (80, 110, 150), 1)

    return img


@pytest.fixture
def synthetic_badge_without_strip() -> np.ndarray:
    """Fixture providing a synthetic badge with a reference scale but no sensor strip."""
    img = np.full((600, 600, 3), 50, dtype=np.uint8)
    # White badge substrate
    cv2.rectangle(img, (80, 120), (520, 480), (242, 242, 244), -1)
    # Reference scale on left
    cv2.rectangle(img, (120, 180), (260, 360), (20, 20, 20), -1)
    return img


class TestStripDetection:
    """Test suite for sensor strip detection and ROI segmentation."""

    def test_detect_valid_sensor_strip(self, synthetic_badge_with_strip):
        """Validates detection and ROI extraction of an elongated sensor strip."""
        ref_bbox = (120, 180, 140, 180)
        result = detect_sensor_strip(synthetic_badge_with_strip, reference_bbox=ref_bbox)

        assert isinstance(result, StripDetectionResult)
        assert result.found is True
        assert result.roi is not None
        assert isinstance(result.roi, np.ndarray)
        assert result.roi.size > 0
        assert result.bbox is not None

        x, y, w, h = result.bbox
        assert 340 <= x <= 380
        assert 160 <= y <= 200
        assert 40 <= w <= 65
        assert 160 <= h <= 200

        # Verify elongated aspect ratio characteristic of dosimeter sensor strips
        assert result.aspect_ratio is not None
        assert result.aspect_ratio >= 2.0
        assert result.reason is None

    def test_sensor_strip_absent_fails(self, synthetic_badge_without_strip):
        """Validates that strip detection fails when the strip is absent."""
        ref_bbox = (120, 180, 140, 180)
        result = detect_sensor_strip(synthetic_badge_without_strip, reference_bbox=ref_bbox)

        assert result.found is False
        assert result.roi is None
        assert result.bbox is None
        assert result.reason == "Sensor strip not detected"

    def test_strip_absent_on_blank_image(self):
        """Validates failure on completely blank image."""
        blank = np.full((400, 400, 3), 200, dtype=np.uint8)
        result = detect_sensor_strip(blank)
        assert result.found is False
        assert result.reason == "Sensor strip not detected"

    def test_squarish_object_not_detected_as_strip(self):
        """Validates that a squarish object (aspect ratio ~1.0) is rejected as a strip."""
        img = np.full((500, 500, 3), 50, dtype=np.uint8)
        # Add a square patch (aspect ratio = 1.0)
        cv2.rectangle(img, (150, 150), (250, 250), (110, 140, 182), -1)

        result = detect_sensor_strip(img)
        assert result.found is False

    def test_reference_bbox_overlap_exclusion(self):
        """Validates that the reference scale area itself is not falsely detected as the sensor strip."""
        img = np.full((500, 500, 3), 50, dtype=np.uint8)
        # Only an elongated reference scale
        ref_bbox = (100, 100, 60, 200)
        cv2.rectangle(img, (100, 100), (160, 300), (20, 20, 20), -1)

        result = detect_sensor_strip(img, reference_bbox=ref_bbox)
        assert result.found is False

    def test_empty_or_none_image_handling(self):
        """Validates that empty or None input is safely handled."""
        result_none = detect_sensor_strip(None)
        assert result_none.found is False

        result_empty = detect_sensor_strip(np.array([], dtype=np.uint8))
        assert result_empty.found is False
