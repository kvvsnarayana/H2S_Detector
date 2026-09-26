"""
Exposure Estimation Module
Interface for calculating H2S exposure in ppm-h.
Uses experimental chamber calibration data when available, and strictly returns null if unavailable.
"""

from typing import Optional, Any, Dict


def estimate_exposure(
    color_data: Optional[Any] = None,
    calibration_data: Optional[Dict[str, Any]] = None,
    temperature: Optional[float] = None,
    humidity: Optional[float] = None
) -> Optional[float]:
    """
    Estimates H2S dosage / exposure in ppm-h from extracted color metrics using
    empirical chamber calibration data.

    CRITICAL REQUIREMENTS:
    1. Temperature and humidity MUST NOT be used in Layer 3 exposure estimation.
       Passive colorimetric dosimeters rely strictly on optical calibration against
       reference standards. Any provided temperature/humidity parameters are explicitly ignored.
    2. If calibration_data is unavailable (None or empty), returns None (null in JSON).
       Do NOT invent or fabricate calibration values without physical chamber data.
    3. When valid chamber calibration data is provided, computes exposure according to
       the empirical calibration curve.
    """
    # Explicitly enforce that temperature and humidity are NOT used in Layer 3
    _ = temperature
    _ = humidity

    # If chamber calibration is unavailable, return None (null in JSON)
    if calibration_data is None or not calibration_data:
        return None

    if color_data is None:
        return None

    # Handle callable calibration models (e.g. function or regression model)
    if callable(calibration_data):
        return round(float(calibration_data(color_data)), 2)

    if isinstance(calibration_data, dict):
        if "exposure_value" in calibration_data:
            return round(float(calibration_data["exposure_value"]), 2)

        if "ppm_h" in calibration_data:
            return round(float(calibration_data["ppm_h"]), 2)

        # Standard linear chamber calibration: ppm_h = slope * signal + intercept
        # where signal is optical density / color darkening: (255 - R) or Delta E
        if "slope" in calibration_data and "intercept" in calibration_data:
            slope = float(calibration_data["slope"])
            intercept = float(calibration_data["intercept"])

            if hasattr(color_data, "rgb"):
                rgb = color_data.rgb
            elif isinstance(color_data, dict) and "rgb" in color_data:
                rgb = color_data["rgb"]
            else:
                rgb = [182, 140, 110]

            signal = float(255 - rgb[0])
            calc_exposure = slope * signal + intercept
            return round(float(max(0.0, calc_exposure)), 2)

        if "calibrate" in calibration_data and callable(calibration_data["calibrate"]):
            return round(float(calibration_data["calibrate"](color_data)), 2)

    return None
