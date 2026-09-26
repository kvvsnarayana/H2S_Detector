"""
Unit tests for src.reference_detection module
Tests detection of synthetic reference color scale, perspective/geometry handling, and absent scale handling.
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

from src.reference_detection import (
    detect_reference_scale,
    order_points,
    rectify_perspective,
    ReferenceDetectionResult
)


@pytest.fixture
def synthetic_badge_with_reference() -> np.ndarray:
    """Fixture providing a synthetic dosimeter badge containing a 4-swatch reference scale."""
    img = np.full((600, 600, 3), 50, dtype=np.uint8)
    # White badge substrate
    cv2.rectangle(img, (80, 120), (520, 480), (242, 242, 244), -1)

    # Reference color scale at (120, 180, 140, 180)
    rx, ry, rw, rh = 120, 180, 140, 180
    cv2.rectangle(img, (rx, ry), (rx + rw, ry + rh), (20, 20, 20), -1)
    # 4 distinct swatches
    half_w, half_h = (rw - 12) // 2, (rh - 12) // 2
    cv2.rectangle(img, (rx + 4, ry + 4), (rx + 4 + half_w, ry + 4 + half_h), (210, 180, 40), -1)
    cv2.rectangle(img, (rx + 8 + half_w, ry + 4), (rx + rw - 4, ry + 4 + half_h), (180, 40, 200), -1)
    cv2.rectangle(img, (rx + 4, ry + 8 + half_h), (rx + 4 + half_w, ry + rh - 4), (40, 210, 230), -1)
    cv2.rectangle(img, (rx + 8 + half_w, ry + 8 + half_h), (rx + rw - 4, ry + rh - 4), (250, 250, 250), -1)

    return img


@pytest.fixture
def synthetic_badge_without_reference() -> np.ndarray:
    """Fixture providing a badge without any reference scale."""
    img = np.full((600, 600, 3), 50, dtype=np.uint8)
    # White badge substrate
    cv2.rectangle(img, (80, 120), (520, 480), (242, 242, 244), -1)
    # Only a sensor strip on the right, no reference scale on the left
    cv2.rectangle(img, (360, 180), (410, 360), (110, 140, 182), -1)
    return img


class TestReferenceDetection:
    """Test suite for reference scale detection and perspective rectification."""

    def test_detect_valid_reference_scale(self, synthetic_badge_with_reference):
        """Validates detection of a standard reference scale card on a dosimeter badge."""
        result = detect_reference_scale(synthetic_badge_with_reference)

        assert isinstance(result, ReferenceDetectionResult)
        assert result.found is True
        assert result.corners is not None
        assert len(result.corners) == 4
        assert result.rectified is not None
        assert isinstance(result.rectified, np.ndarray)
        assert result.rectified.shape[0] > 20 and result.rectified.shape[1] > 20
        assert result.bbox is not None
        x, y, w, h = result.bbox
        assert 100 <= x <= 140
        assert 160 <= y <= 200
        assert result.reason is None

    def test_perspective_geometry_handling(self, synthetic_badge_with_reference):
        """Validates corner ordering and perspective rectification under geometric tilt."""
        # Apply 3D perspective warp to simulate camera viewed at an angle
        h, w = synthetic_badge_with_reference.shape[:2]
        src_quad = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        dst_quad = np.float32([[30, 20], [w - 40, 10], [w - 10, h - 30], [20, h - 20]])
        matrix = cv2.getPerspectiveTransform(src_quad, dst_quad)
        tilted_image = cv2.warpPerspective(synthetic_badge_with_reference, matrix, (w, h), borderValue=(50, 50, 50))

        result = detect_reference_scale(tilted_image)
        assert result.found is True
        assert result.corners is not None
        assert len(result.corners) == 4

        # Verify corner ordering: top-left, top-right, bottom-right, bottom-left
        corners = np.array(result.corners)
        ordered = order_points(corners)
        tl, tr, br, bl = ordered
        # Top points have smaller y than bottom points
        assert tl[1] < bl[1]
        assert tr[1] < br[1]
        # Left points have smaller x than right points
        assert tl[0] < tr[0]
        assert bl[0] < br[0]

        # Verify perspective rectification output
        rectified = rectify_perspective(tilted_image, ordered, target_size=(140, 180))
        assert rectified.shape == (180, 140, 3)
        assert np.mean(rectified) > 0

    def test_reference_absent_fails(self, synthetic_badge_without_reference):
        """Validates that detection fails when reference scale is absent on the badge."""
        result = detect_reference_scale(synthetic_badge_without_reference)

        assert result.found is False
        assert result.corners is None
        assert result.rectified is None
        assert result.reason == "Reference scale not detected"

    def test_reference_absent_on_plain_image(self):
        """Validates that detection fails on a uniform or blank image."""
        plain = np.full((500, 500, 3), 128, dtype=np.uint8)
        result = detect_reference_scale(plain)
        assert result.found is False
        assert result.reason == "Reference scale not detected"

    def test_empty_or_none_image_handling(self):
        """Validates that None or empty image does not crash and returns found=False."""
        result_none = detect_reference_scale(None)
        assert result_none.found is False

        result_empty = detect_reference_scale(np.array([], dtype=np.uint8))
        assert result_empty.found is False
