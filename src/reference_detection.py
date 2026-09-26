"""
Reference Colour-Scale Detection Module
Detects fiducial landmarks / calibration color swatches and performs perspective rectification.
"""

from typing import Optional, Tuple, List
import numpy as np
import cv2
from pydantic import BaseModel, ConfigDict


class ReferenceDetectionResult(BaseModel):
    """Container for reference scale detection and rectification results."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    found: bool
    corners: Optional[List[List[float]]] = None
    rectified: Optional[np.ndarray] = None
    bbox: Optional[Tuple[int, int, int, int]] = None
    reason: Optional[str] = None


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 coordinate points in clockwise order:
    [top-left, top-right, bottom-right, bottom-left].
    """
    pts = pts.reshape(4, 2).astype("float32")
    rect = np.zeros((4, 2), dtype="float32")

    # Top-left has smallest sum, bottom-right has largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # Top-right has smallest difference, bottom-left has largest difference
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def rectify_perspective(
    image: np.ndarray,
    corners: np.ndarray,
    target_size: Optional[Tuple[int, int]] = None
) -> np.ndarray:
    """
    Warps perspective of four corners into an aligned top-down rectangular view.
    """
    rect = order_points(corners)
    (tl, tr, br, bl) = rect

    if target_size is None:
        width_a = np.linalg.norm(br - bl)
        width_b = np.linalg.norm(tr - tl)
        max_width = max(int(width_a), int(width_b))

        height_a = np.linalg.norm(tr - br)
        height_b = np.linalg.norm(tl - bl)
        max_height = max(int(height_a), int(height_b))

        max_width = max(max_width, 20)
        max_height = max(max_height, 20)
    else:
        max_width, max_height = target_size

    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")

    transform_matrix = cv2.getPerspectiveTransform(rect, dst)
    rectified = cv2.warpPerspective(image, transform_matrix, (max_width, max_height))
    return rectified


def detect_reference_scale(
    image: np.ndarray,
    min_area: float = 1200.0,
    max_area_ratio: float = 0.35,
    min_std_dev: float = 15.0
) -> ReferenceDetectionResult:
    """
    Detects calibration reference color scale on badge, extracts 4 corner landmarks,
    and returns perspective-rectified reference image.
    """
    if image is None or image.size == 0 or len(image.shape) < 2:
        return ReferenceDetectionResult(
            found=False,
            reason="Reference scale not detected"
        )

    img_h, img_w = image.shape[:2]
    total_area = float(img_h * img_w)

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Multi-threshold detection strategy for robustness
    candidate_polygons = []

    # Strategy 1: Canny edge detection
    edges = cv2.Canny(blurred, 40, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated_edges = cv2.dilate(edges, kernel, iterations=1)
    contours_edges, _ = cv2.findContours(dilated_edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    # Strategy 2: Adaptive & Otsu thresholding
    _, thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours_otsu, _ = cv2.findContours(thresh_otsu, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    all_contours = list(contours_edges) + list(contours_otsu)

    for cnt in all_contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > (total_area * max_area_ratio):
            continue

        perimeter = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.03 * perimeter, True)

        if len(approx) == 4 and cv2.isContourConvex(approx):
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = max(w, h) / max(min(w, h), 1)

            # Reference cards are compact rectangles (aspect ratio typically 0.8 to 2.2),
            # unlike sensor strips which are narrow elongated strips (aspect ratio >= 2.5).
            if 0.7 <= aspect_ratio <= 2.2:
                # Check internal color/intensity variance to ensure swatches/contrast exist
                patch = gray[y:y+h, x:x+w]
                if patch.size > 0:
                    std_dev = float(np.std(patch))
                    if std_dev >= min_std_dev:
                        candidate_polygons.append({
                            "contour": approx,
                            "area": area,
                            "aspect_ratio": aspect_ratio,
                            "std_dev": std_dev,
                            "bbox": (x, y, w, h)
                        })

    if not candidate_polygons:
        return ReferenceDetectionResult(
            found=False,
            reason="Reference scale not detected"
        )

    # Pick the most prominent reference chart candidate with high swatch contrast
    candidate_polygons.sort(key=lambda c: (c["std_dev"] > 20.0, c["area"]), reverse=True)
    best_candidate = candidate_polygons[0]

    raw_corners = best_candidate["contour"].reshape(4, 2)
    ordered_corners = order_points(raw_corners)
    rectified_img = rectify_perspective(image, ordered_corners)

    return ReferenceDetectionResult(
        found=True,
        corners=ordered_corners.tolist(),
        rectified=rectified_img,
        bbox=best_candidate["bbox"],
        reason=None
    )
