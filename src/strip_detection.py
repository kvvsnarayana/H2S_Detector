"""
H2S Sensor-Strip Detection Module
Segments and extracts the active chemical dosimeter sensing region-of-interest (ROI).
"""

from typing import Optional, Tuple, List
import numpy as np
import cv2
from pydantic import BaseModel, ConfigDict


class StripDetectionResult(BaseModel):
    """Container for sensor strip detection and extracted ROI results."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    found: bool
    roi: Optional[np.ndarray] = None
    bbox: Optional[Tuple[int, int, int, int]] = None
    aspect_ratio: Optional[float] = None
    reason: Optional[str] = None


def detect_sensor_strip(
    image: np.ndarray,
    reference_bbox: Optional[Tuple[int, int, int, int]] = None,
    min_area: float = 400.0,
    min_aspect_ratio: float = 1.8,
    max_aspect_ratio: float = 10.0
) -> StripDetectionResult:
    """
    Locates the elongated chemical sensor strip, performs segmentation,
    and extracts the cropped ROI.
    """
    if image is None or image.size == 0 or len(image.shape) < 2:
        return StripDetectionResult(
            found=False,
            reason="Sensor strip not detected"
        )

    img_h, img_w = image.shape[:2]
    total_area = float(img_h * img_w)

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Multi-strategy contour extraction
    candidates = []

    # Canny edges
    edges = cv2.Canny(blurred, 30, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=1)
    contours_edges, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    # Thresholding
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours_thresh, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    all_contours = list(contours_edges) + list(contours_thresh)

    for cnt in all_contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > (total_area * 0.35):
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        bbox_area = float(w * h)
        if bbox_area <= 0:
            continue

        # Strip should be largely rectangular
        solidity = area / bbox_area
        if solidity < 0.65:
            continue

        aspect_ratio = max(w, h) / max(min(w, h), 1)
        if not (min_aspect_ratio <= aspect_ratio <= max_aspect_ratio):
            continue

        # Check overlap with reference bounding box (if provided)
        if reference_bbox is not None:
            rx, ry, rw, rh = reference_bbox
            # Compute intersection
            ix1 = max(x, rx)
            iy1 = max(y, ry)
            ix2 = min(x + w, rx + rw)
            iy2 = min(y + h, ry + rh)
            if ix2 > ix1 and iy2 > iy1:
                inter_area = (ix2 - ix1) * (iy2 - iy1)
                if inter_area / area > 0.2:
                    # Overlaps significantly with reference scale
                    continue

        # Sensor strip has uniform color / lower variance than multi-swatch reference card
        patch = image[y:y+h, x:x+w]
        if patch.size > 0:
            std_dev = float(np.std(patch))
            candidates.append({
                "bbox": (x, y, w, h),
                "area": area,
                "solidity": solidity,
                "aspect_ratio": aspect_ratio,
                "std_dev": std_dev
            })

    if not candidates:
        return StripDetectionResult(
            found=False,
            reason="Sensor strip not detected"
        )

    # Rank candidates: strip typically has lower internal variance and good aspect ratio
    candidates.sort(key=lambda c: (c["aspect_ratio"] >= 2.0, -c["std_dev"], c["area"]), reverse=True)
    best = candidates[0]

    bx, by, bw, bh = best["bbox"]
    roi = image[by:by+bh, bx:bx+bw].copy()

    return StripDetectionResult(
        found=True,
        roi=roi,
        bbox=best["bbox"],
        aspect_ratio=best["aspect_ratio"],
        reason=None
    )


class ExpiryIndicatorResult(BaseModel):
    """Container for badge shelf-life / expiry indicator check."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    is_expired: bool
    detected: bool
    color_rgb: Optional[List[int]] = None
    reason: Optional[str] = None


def detect_expiry_indicator(image: np.ndarray) -> ExpiryIndicatorResult:
    """
    Locates and evaluates the chemical expiry indicator dot/patch on the dosimeter badge.
    Fresh badge: indicator is green or neutral.
    Expired badge: indicator turns red / high-saturation magenta.
    """
    if image is None or image.size == 0 or len(image.shape) != 3:
        return ExpiryIndicatorResult(
            is_expired=False,
            detected=False,
            reason="Invalid image for expiry detection"
        )

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # 1. Search for red indicator patch (expired indicator)
    mask_red1 = cv2.inRange(hsv, (0, 70, 70), (10, 255, 255))
    mask_red2 = cv2.inRange(hsv, (170, 70, 70), (180, 255, 255))
    mask_red = mask_red1 | mask_red2

    cnts_red, _ = cv2.findContours(mask_red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in cnts_red:
        area = cv2.contourArea(cnt)
        if 50.0 <= area <= 4000.0:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect = max(w, h) / max(min(w, h), 1)
            if aspect <= 2.0:  # Squarish or circular dot
                patch = image[y:y+h, x:x+w]
                med_bgr = np.median(patch, axis=(0, 1))
                return ExpiryIndicatorResult(
                    is_expired=True,
                    detected=True,
                    color_rgb=[int(med_bgr[2]), int(med_bgr[1]), int(med_bgr[0])],
                    reason="Badge expiry indicator is RED (expired)"
                )

    # 2. Search for green indicator patch (fresh / unexpired indicator)
    mask_green = cv2.inRange(hsv, (35, 70, 70), (85, 255, 255))
    cnts_green, _ = cv2.findContours(mask_green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in cnts_green:
        area = cv2.contourArea(cnt)
        if 50.0 <= area <= 4000.0:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect = max(w, h) / max(min(w, h), 1)
            if aspect <= 2.0:
                patch = image[y:y+h, x:x+w]
                med_bgr = np.median(patch, axis=(0, 1))
                return ExpiryIndicatorResult(
                    is_expired=False,
                    detected=True,
                    color_rgb=[int(med_bgr[2]), int(med_bgr[1]), int(med_bgr[0])],
                    reason="Badge expiry indicator is GREEN (fresh / unexpired)"
                )

    return ExpiryIndicatorResult(
        is_expired=False,
        detected=False,
        reason="No distinct expiry indicator patch detected"
    )
