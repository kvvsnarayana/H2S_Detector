/**
 * H2S Sensing Strip Color Calibration & Exposure Calculation Engine
 * 
 * PHYSICAL BADGE REGION GEOMETRY:
 * - Left Zone   = H2S Sensing Strip
 * - Center Zone = Printed H2S Reference Colour Scale (used for illumination correction)
 * - Right Zone  = Expiry Indicator (RIGHT-SIDE indicator)
 * 
 * MANDATORY H2S CALIBRATION PALETTE:
 * 0%   = 0 ppm       #96CDE1
 * 10%  = ~0–1 ppm    #92C9CA (0.5 ppm)
 * 20%  = ~1–2 ppm    #8EB5B2 (1.5 ppm)
 * 30%  = ~2–4 ppm    #86A89A (3.0 ppm)
 * 40%  = ~4–6 ppm    #819A8A (5.0 ppm)
 * 50%  = ~6–8 ppm    #788C7D (7.0 ppm)
 * 60%  = ~8–10 ppm   #6C7B76 (9.0 ppm)
 * 70%  = ~10–12 ppm  #5F696E (11.0 ppm)
 * 80%  = ~12–15 ppm  #50585C (13.5 ppm)
 * 90%  = ~15–20 ppm  #41464A (17.5 ppm)
 * 100% = >=20 ppm    #323437 (20.0 ppm)
 */

const H2S_CALIBRATION_POINTS = [
  { levelPct: 0,   ppm: 0.0,  hex: '#96CDE1', rgb: { r: 150, g: 205, b: 225 }, label: '0% (0.0 ppm - Baseline)' },
  { levelPct: 10,  ppm: 0.5,  hex: '#92C9CA', rgb: { r: 146, g: 201, b: 202 }, label: '10% (~0-1 ppm - Very Slight Trace)' },
  { levelPct: 20,  ppm: 1.5,  hex: '#8EB5B2', rgb: { r: 142, g: 181, b: 178 }, label: '20% (~1-2 ppm - Slight Trace)' },
  { levelPct: 30,  ppm: 3.0,  hex: '#86A89A', rgb: { r: 134, g: 168, b: 154 }, label: '30% (~2-4 ppm - Low Trace)' },
  { levelPct: 40,  ppm: 5.0,  hex: '#819A8A', rgb: { r: 129, g: 154, b: 138 }, label: '40% (~4-6 ppm - Mild Exposure)' },
  { levelPct: 50,  ppm: 7.0,  hex: '#788C7D', rgb: { r: 120, g: 140, b: 125 }, label: '50% (~6-8 ppm - Moderate Exposure)' },
  { levelPct: 60,  ppm: 9.0,  hex: '#6C7B76', rgb: { r: 108, g: 123, b: 118 }, label: '60% (~8-10 ppm - Medium Exposure)' },
  { levelPct: 70,  ppm: 11.0, hex: '#5F696E', rgb: { r: 95,  g: 105, b: 110 }, label: '70% (~10-12 ppm - Elevated Exposure)' },
  { levelPct: 80,  ppm: 13.5, hex: '#50585C', rgb: { r: 80,  g: 88,  b: 92  }, label: '80% (~12-15 ppm - High Exposure)' },
  { levelPct: 90,  ppm: 17.5, hex: '#41464A', rgb: { r: 65,  g: 70,  b: 74  }, label: '90% (~15-20 ppm - Very High Exposure)' },
  { levelPct: 100, ppm: 20.0, hex: '#323437', rgb: { r: 50,  g: 52,  b: 55  }, label: '100% (>=20.0 ppm - Maximum Exposure)' }
];

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Color Correction using Photographed CENTER Reference Scale Patches
 * Adjusts raw sensing strip RGB against detected vs ideal reference scale color.
 */
function correctSensingStripColor(rawRgb, detectedRefRgb = null, idealRefRgb = null) {
  if (!detectedRefRgb || !idealRefRgb) {
    return { ...rawRgb };
  }

  // Calculate RGB illumination gain multipliers
  const gainR = detectedRefRgb.r > 0 ? idealRefRgb.r / detectedRefRgb.r : 1.0;
  const gainG = detectedRefRgb.g > 0 ? idealRefRgb.g / detectedRefRgb.g : 1.0;
  const gainB = detectedRefRgb.b > 0 ? idealRefRgb.b / detectedRefRgb.b : 1.0;

  // Apply gain correction with clamping [0, 255]
  return {
    r: Math.max(0, Math.min(255, Math.round(rawRgb.r * gainR))),
    g: Math.max(0, Math.min(255, Math.round(rawRgb.g * gainG))),
    b: Math.max(0, Math.min(255, Math.round(rawRgb.b * gainB)))
  };
}

/**
 * Analyze H2S Sensing Strip Color against 11 Calibration Points.
 * Performs 3D polyline linear projection & illumination correction.
 * 
 * STRICT RULES:
 * - Never default to 0 ppm.
 * - Never return 0 ppm for out of calibration range colors -> return 'OUT OF CALIBRATION RANGE' or 'RETAKE REQUIRED'.
 */
function analyzeH2sStripColor(detectedHex, detectedRefHex = null, isUnreadable = false) {
  if (isUnreadable || !detectedHex || detectedHex === 'UNREADABLE' || detectedHex === 'RETAKE') {
    return {
      detected_hex: 'N/A',
      corrected_hex: 'N/A',
      reference_color: 'N/A',
      closest_reference_label: 'N/A',
      interpolated_percentage: null,
      estimated_ppm: null,
      confidence: 0,
      quality: 'Low',
      status: 'RETAKE REQUIRED',
      can_proceed: false,
      message: 'RETAKE REQUIRED — Reference scale or sensing strip cannot be detected clearly.'
    };
  }

  const cleanDetectedHex = detectedHex.toUpperCase().startsWith('#') ? detectedHex.toUpperCase() : `#${detectedHex.toUpperCase()}`;
  const rawRgb = hexToRgb(cleanDetectedHex);

  // Apply illumination correction if reference scale detected
  let correctedRgb = rawRgb;
  if (detectedRefHex && detectedRefHex !== 'N/A') {
    const cleanRefHex = detectedRefHex.toUpperCase().startsWith('#') ? detectedRefHex.toUpperCase() : `#${detectedRefHex.toUpperCase()}`;
    const detectedRefRgb = hexToRgb(cleanRefHex);
    // Ideal reference baseline is 0% #96CDE1
    const idealRefRgb = H2S_CALIBRATION_POINTS[0].rgb;
    correctedRgb = correctSensingStripColor(rawRgb, detectedRefRgb, idealRefRgb);
  }

  const correctedHex = rgbToHex(correctedRgb.r, correctedRgb.g, correctedRgb.b);

  // 1. Find closest calibration anchor point
  let closestAnchor = H2S_CALIBRATION_POINTS[0];
  let minAnchorDist = Infinity;

  H2S_CALIBRATION_POINTS.forEach(pt => {
    const d = Math.hypot(correctedRgb.r - pt.rgb.r, correctedRgb.g - pt.rgb.g, correctedRgb.b - pt.rgb.b);
    if (d < minAnchorDist) {
      minAnchorDist = d;
      closestAnchor = pt;
    }
  });

  // 2. Project onto polyline segments across 11 calibration points
  let bestDist = Infinity;
  let bestPpm = closestAnchor.ppm;
  let bestPct = closestAnchor.levelPct;

  for (let i = 0; i < H2S_CALIBRATION_POINTS.length - 1; i++) {
    const pA = H2S_CALIBRATION_POINTS[i];
    const pB = H2S_CALIBRATION_POINTS[i + 1];

    const vecAB = { r: pB.rgb.r - pA.rgb.r, g: pB.rgb.g - pA.rgb.g, b: pB.rgb.b - pA.rgb.b };
    const lenSqAB = vecAB.r * vecAB.r + vecAB.g * vecAB.g + vecAB.b * vecAB.b;

    if (lenSqAB === 0) continue;

    const vecAC = { r: correctedRgb.r - pA.rgb.r, g: correctedRgb.g - pA.rgb.g, b: correctedRgb.b - pA.rgb.b };
    const t = (vecAC.r * vecAB.r + vecAC.g * vecAB.g + vecAC.b * vecAB.b) / lenSqAB;
    const tClamped = Math.max(0, Math.min(1, t));

    const projPoint = {
      r: pA.rgb.r + tClamped * vecAB.r,
      g: pA.rgb.g + tClamped * vecAB.g,
      b: pA.rgb.b + tClamped * vecAB.b
    };

    const distToSeg = Math.hypot(correctedRgb.r - projPoint.r, correctedRgb.g - projPoint.g, correctedRgb.b - projPoint.b);

    if (distToSeg < bestDist) {
      bestDist = distToSeg;
      bestPpm = pA.ppm + tClamped * (pB.ppm - pA.ppm);
      bestPct = pA.levelPct + tClamped * (pB.levelPct - pA.levelPct);
    }
  }

  // 3. Out-of-bounds check: Do NOT silently return 0 ppm!
  if (bestDist > 115) {
    return {
      detected_hex: cleanDetectedHex,
      corrected_hex: correctedHex,
      reference_color: closestAnchor.hex,
      closest_reference_label: `${closestAnchor.hex} (${closestAnchor.label})`,
      interpolated_percentage: null,
      estimated_ppm: null,
      confidence: 0.30,
      quality: 'Low',
      status: 'OUT OF CALIBRATION RANGE',
      can_proceed: false,
      message: 'OUT OF CALIBRATION RANGE — Detected H2S color is outside calibrated scale. Retake image capture.'
    };
  }

  const estimatedPpm = Math.round(Math.max(0, bestPpm) * 10) / 10;
  const interpolatedPct = Math.round(Math.max(0, Math.min(100, bestPct)));
  const confidence = Math.round(Math.max(0.70, 1.0 - (bestDist / 250)) * 100) / 100;
  const quality = confidence >= 0.90 ? 'High' : (confidence >= 0.75 ? 'Medium' : 'Low');

  return {
    detected_hex: cleanDetectedHex,
    corrected_hex: correctedHex,
    reference_color: closestAnchor.hex,
    closest_reference_label: `${closestAnchor.hex} (${closestAnchor.label})`,
    interpolated_percentage: interpolatedPct,
    estimated_ppm: estimatedPpm,
    confidence: confidence,
    quality: quality,
    status: 'ANALYZED',
    can_proceed: true,
    message: `H2S Sensing Strip Analyzed: ${estimatedPpm} ppm (${interpolatedPct}% scale, Confidence: ${Math.round(confidence * 100)}%).`
  };
}

/**
 * Calculate Cumulative Shift Exposure in ppm-h
 * Delta ppm = Post-Shift ppm - Pre-Shift ppm
 * Final Exposure = Delta ppm * Shift Duration (hours)
 */
function calculateShiftExposure(preShiftPpm, postShiftPpm, durationMinutes) {
  const pre = Math.max(0, parseFloat(preShiftPpm) || 0);
  const post = Math.max(0, parseFloat(postShiftPpm) || 0);
  const deltaPpm = Math.max(0, post - pre);

  const durationMins = Math.max(0, parseInt(durationMinutes, 10) || 0);
  const durationHours = Math.round((durationMins / 60) * 100) / 100;
  const finalExposurePpmH = Math.round(deltaPpm * durationHours * 100) / 100;

  return {
    pre_shift_ppm: pre,
    post_shift_ppm: post,
    delta_ppm: Math.round(deltaPpm * 100) / 100,
    duration_minutes: durationMins,
    duration_hours: durationHours,
    final_exposure_ppm_h: finalExposurePpmH
  };
}

module.exports = {
  H2S_CALIBRATION_POINTS,
  hexToRgb,
  rgbToHex,
  correctSensingStripColor,
  analyzeH2sStripColor,
  calculateShiftExposure
};
