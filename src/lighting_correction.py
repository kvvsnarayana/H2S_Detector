"""
Lighting and Colour Correction Module
Applies white balancing / color constancy using detected reference scale neutrals/whites.
"""

from typing import Optional
import numpy as np
import cv2


def apply_gray_world(image: np.ndarray) -> np.ndarray:
    """
    Applies classical Gray-World assumption for color constancy.
    Scales each channel such that the mean of each channel matches the global gray average.
    """
    if image is None or image.size == 0 or len(image.shape) != 3:
        return image

    b, g, r = cv2.split(image.astype(np.float32))
    mean_b, mean_g, mean_r = np.mean(b), np.mean(g), np.mean(r)
    gray_mean = (mean_b + mean_g + mean_r) / 3.0

    if mean_b > 0:
        b = b * (gray_mean / mean_b)
    if mean_g > 0:
        g = g * (gray_mean / mean_g)
    if mean_r > 0:
        r = r * (gray_mean / mean_r)

    corrected = cv2.merge([b, g, r])
    return np.clip(corrected, 0, 255).astype(np.uint8)


def apply_white_balance(
    image: np.ndarray,
    reference_white_patch: Optional[np.ndarray] = None
) -> np.ndarray:
    """
    Applies white balancing using reference white/neutral patch if provided,
    otherwise falls back to Gray-World color constancy.
    """
    if image is None or image.size == 0 or len(image.shape) != 3:
        return image

    if reference_white_patch is not None and reference_white_patch.size > 0:
        # Compute gains based on reference white patch
        med_bgr = np.median(reference_white_patch, axis=(0, 1)).astype(np.float32)
        max_val = np.max(med_bgr)
        if min(med_bgr) > 10.0 and max_val > 0:
            scale_b = max_val / med_bgr[0]
            scale_g = max_val / med_bgr[1]
            scale_r = max_val / med_bgr[2]

            img_f = image.astype(np.float32)
            img_f[:, :, 0] *= scale_b
            img_f[:, :, 1] *= scale_g
            img_f[:, :, 2] *= scale_r
            return np.clip(img_f, 0, 255).astype(np.uint8)

    return apply_gray_world(image)
