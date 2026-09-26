"""
Colour Extraction Module
Extracts robust central tendency colors across RGB, HSV, and CIE-Lab color spaces from sensor strip ROI.
"""

from typing import List, Dict, Any, Optional
import numpy as np
import cv2
from pydantic import BaseModel, Field


class ColorMetrics(BaseModel):
    """Container for multi-space color values extracted from an ROI."""
    rgb: List[int] = Field(description="RGB central tendency [R, G, B]")
    hsv: List[int] = Field(description="OpenCV HSV [H, S, V] where H in [0, 179]")
    lab: List[float] = Field(description="CIE-Lab [L*, a*, b*] with L* in [0, 100]")

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


def extract_color_metrics(
    roi: np.ndarray,
    margin_ratio: float = 0.05
) -> ColorMetrics:
    """
    Extracts robust central-tendency color metrics across RGB, HSV, and CIE-Lab spaces.
    Excludes border margin pixels to avoid edge/shadow artifacts.
    """
    if roi is None or roi.size == 0:
        raise ValueError("Cannot extract color from empty or None ROI")

    if len(roi.shape) != 3 or roi.shape[2] != 3:
        raise ValueError("ROI must be a 3-channel BGR image")

    h, w = roi.shape[:2]
    # Apply margin crop if ROI is sufficiently large
    dh = int(h * margin_ratio)
    dw = int(w * margin_ratio)

    if (h - 2 * dh) >= 3 and (w - 2 * dw) >= 3:
        roi_sampled = roi[dh:h - dh, dw:w - dw]
    else:
        roi_sampled = roi

    # Robust central tendency using median to reject specular noise / shadows
    med_bgr = np.median(roi_sampled, axis=(0, 1))

    # RGB extraction: note OpenCV uses BGR ordering
    rgb = [
        int(round(float(med_bgr[2]))),
        int(round(float(med_bgr[1]))),
        int(round(float(med_bgr[0])))
    ]

    # HSV extraction using OpenCV COLOR_BGR2HSV
    roi_hsv = cv2.cvtColor(roi_sampled, cv2.COLOR_BGR2HSV)
    med_hsv = np.median(roi_hsv, axis=(0, 1))
    hsv = [
        int(round(float(med_hsv[0]))),
        int(round(float(med_hsv[1]))),
        int(round(float(med_hsv[2])))
    ]

    # CIE-Lab extraction on normalized float32 image
    roi_f32 = roi_sampled.astype(np.float32) / 255.0
    roi_lab = cv2.cvtColor(roi_f32, cv2.COLOR_BGR2Lab)
    med_lab = np.median(roi_lab, axis=(0, 1))
    lab = [
        round(float(med_lab[0]), 1),
        round(float(med_lab[1]), 1),
        round(float(med_lab[2]), 1)
    ]

    return ColorMetrics(rgb=rgb, hsv=hsv, lab=lab)
