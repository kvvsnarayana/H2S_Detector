# Sulfide Sentinels - Person 2 (Image Processing & AI/ML)

Welcome to the **Person 2** component of the **Sulfide Sentinels H2S Exposure-Dosimeter Application**.

---

## 1. Scope & Responsibilities

This subproject (`person2-ai/`) is exclusively responsible for the backend computer vision and AI/ML algorithms:
1. **Image Quality Checking:** Blur detection, glare/overexposure, shadow/underexposure, and perspective readiness.
2. **Reference Colour-Scale Detection:** Localization and perspective rectification of the on-badge calibration swatches.
3. **H2S Sensor-Strip Detection:** Region-of-interest (ROI) segmentation of the reactive chemical strip.
4. **Color Extraction:** Robust central-tendency extraction in RGB, HSV, and CIE-Lab color spaces.
5. **Lighting & Color Correction:** Color constancy and white-balance calibration using reference landmarks.
6. **Calibration Mapping:** Mapping corrected color parameters to exposure (placeholder until lab data is available).
7. **Exposure Estimation:** Interface returning H2S exposure in `ppm-h`.
8. **Confidence Calculation:** Multi-metric confidence score ($0.0 \to 1.0$) reflecting image clarity and sensor stability.
9. **Machine Learning / Regression:** Future milestone for non-linear multi-spectral estimation.
10. **JSON / API Interface:** Standardized output contract consumed by Person 1's frontend.

---

## 2. Team Boundary & Rules

* **Frontend Independence:** Person 1 builds all UI, camera preview, authentication, worker management, and history components.
* **Isolation:** All Person 2 code, data, models, and tests reside strictly inside `person2-ai/`.
* **Zero Modification Rule:** Files outside `person2-ai/` are never modified, deleted, or restructured.

---

## 3. Directory Structure

```text
person2-ai/
├── data/
│   ├── raw/                  # Unprocessed dosimeter test images (.gitignored)
│   ├── processed/            # Rectified badge and extracted strip ROIs (.gitignored)
│   └── calibration/          # Experimental calibration charts and reference data
├── src/
│   ├── __init__.py
│   ├── quality.py            # Sharpness, glare, blur, and lighting validation
│   ├── reference_detection.py # Detection & perspective rectification of reference color scale
│   ├── strip_detection.py    # Segmentation & ROI extraction of H2S reactive sensor strip
│   ├── lighting_correction.py # White balance / color constancy using reference scale
│   ├── color_extraction.py   # Robust median RGB, HSV, and CIE-Lab color extraction
│   ├── exposure_estimation.py # Exposure interface (placeholder: returns null until data is ready)
│   ├── confidence.py         # Multi-metric confidence calculation (0.0 to 1.0)
│   └── pipeline.py           # Master classical CV orchestrator returning the JSON schema
├── tests/
│   ├── __init__.py
│   ├── test_quality.py
│   ├── test_reference_detection.py
│   ├── test_strip_detection.py
│   ├── test_color_extraction.py
│   └── test_pipeline.py
├── outputs/                  # Diagnostic outputs, annotated test images & JSON logs
├── .gitignore                # Environment, cache, and raw image exclusion rules
├── requirements.txt          # Python dependencies
└── README.md                 # Architecture, usage instructions, and Person 1 API contract
```

---

## 4. Milestone 1: Classical Computer-Vision Pipeline

The initial pipeline executes strictly without heuristic ML or fabricated calibration curves:

$$\text{Test Image} \longrightarrow \text{Quality Check} \longrightarrow \text{Reference Scale Detection} \longrightarrow \text{Sensor Strip Detection} \longrightarrow \text{Usable / Retake Decision}$$

---

## 5. Standardized JSON Output Contract

The pipeline outputs standard JSON conforming to the following contracts:

### Usable / Valid Image
```json
{
  "status": "VALID",
  "exposure": null,
  "unit": "ppm-h",
  "confidence": 0.88,
  "quality": "GOOD",
  "detectedColor": {
    "rgb": [182, 140, 110],
    "hsv": [25, 101, 182],
    "lab": [60.5, 12.3, 24.1]
  },
  "reason": null
}
```

### Unusable Image (Retake Required)
```json
{
  "status": "RETAKE",
  "exposure": null,
  "unit": "ppm-h",
  "confidence": 0.0,
  "quality": "POOR",
  "detectedColor": null,
  "reason": "Reference scale not detected"
}
```

---

## 6. Dependencies & Requirements

* `python >= 3.10`
* `numpy >= 1.24.0`
* `opencv-python >= 4.8.0`
* `scipy >= 1.10.0`
* `pydantic >= 2.0.0`
* `pytest >= 7.4.0`
