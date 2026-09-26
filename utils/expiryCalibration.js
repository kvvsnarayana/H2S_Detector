/**
 * Badge Expiry Indicator Calibration & Interpolation Engine
 * 
 * INTERNAL EXPIRY CALIBRATION PALETTE (11 POINTS - MANDATORY):
 * - 0%   #C59A45  (Dry – amber/yellow-brown)
 * - 10%  #C5A052  (Amber-yellow)
 * - 20%  #B5A45A  (Yellow with slight green)
 * - 30%  #A5A866  (Yellow-green)
 * - 40%  #91A96F  (Pale yellow-green)
 * - 50%  #7FA87A  (Light green)
 * - 60%  #6DA58B  (Green / blue-green)
 * - 70%  #5E9F91  (Pale blue-green)
 * - 80%  #57969A  (Aqua / blue-green)
 * - 90%  #6095A5  (Light blue)
 * - 100% #6A9EAE  (Clearly hydrated blue/aqua)
 */

const CALIBRATION_POINTS = [
  { validity: 0,   hex: '#C59A45', rgb: { r: 197, g: 154, b: 69 },  label: '0% Dry (Amber/Yellow-brown)' },
  { validity: 10,  hex: '#C5A052', rgb: { r: 197, g: 160, b: 82 },  label: '10% Amber-yellow' },
  { validity: 20,  hex: '#B5A45A', rgb: { r: 181, g: 164, b: 90 },  label: '20% Yellow with slight green' },
  { validity: 30,  hex: '#A5A866', rgb: { r: 165, g: 168, b: 102 }, label: '30% Yellow-green' },
  { validity: 40,  hex: '#91A96F', rgb: { r: 145, g: 169, b: 111 }, label: '40% Pale yellow-green' },
  { validity: 50,  hex: '#7FA87A', rgb: { r: 127, g: 168, b: 122 }, label: '50% Light green' },
  { validity: 60,  hex: '#6DA58B', rgb: { r: 109, g: 165, b: 139 }, label: '60% Green / blue-green' },
  { validity: 70,  hex: '#5E9F91', rgb: { r: 94,  g: 159, b: 145 }, label: '70% Pale blue-green' },
  { validity: 80,  hex: '#57969A', rgb: { r: 87,  g: 150, b: 154 }, label: '80% Aqua / blue-green' },
  { validity: 90,  hex: '#6095A5', rgb: { r: 96,  g: 149, b: 165 }, label: '90% Light blue' },
  { validity: 100, hex: '#6A9EAE', rgb: { r: 106, g: 158, b: 174 }, label: '100% Hydrated Blue/Aqua' }
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
 * Normalized Chromaticity / Illumination Compensation helper.
 * Normalizes RGB values to (r', g', b') proportions to minimize overall brightness/lighting variations.
 */
function normalizeRgb(rgb) {
  const sum = rgb.r + rgb.g + rgb.b || 1;
  return {
    r: rgb.r / sum,
    g: rgb.g / sum,
    b: rgb.b / sum,
    intensity: sum / 3
  };
}

/**
 * Analyze physical expiry indicator color against internal 11-point calibration palette.
 * Performs multi-segment 3D polyline projection & linear interpolation.
 */
function analyzeExpiryColor(detectedHex, isUnreadable = false) {
  if (isUnreadable || !detectedHex || detectedHex === 'UNREADABLE' || detectedHex === 'RETAKE') {
    return {
      detected_hex: 'N/A',
      reference_color: 'N/A',
      closest_reference_label: 'N/A',
      validity_percentage: null,
      expiry_level: null,
      status: 'RETAKE',
      can_proceed: false,
      message: 'EXPIRY INDICATOR NOT CLEAR — RETAKE'
    };
  }

  const cleanHex = detectedHex.toUpperCase().startsWith('#') ? detectedHex.toUpperCase() : `#${detectedHex.toUpperCase()}`;
  const cRgb = hexToRgb(cleanHex);
  const cNorm = normalizeRgb(cRgb);

  // 1. Find closest calibration anchor point
  let closestAnchor = CALIBRATION_POINTS[0];
  let minAnchorDist = Infinity;

  CALIBRATION_POINTS.forEach(pt => {
    const d = Math.hypot(cRgb.r - pt.rgb.r, cRgb.g - pt.rgb.g, cRgb.b - pt.rgb.b);
    if (d < minAnchorDist) {
      minAnchorDist = d;
      closestAnchor = pt;
    }
  });

  // 2. Project onto polyline segments (10 segments between 11 calibration points)
  let bestDist = Infinity;
  let bestValidity = closestAnchor.validity;

  for (let i = 0; i < CALIBRATION_POINTS.length - 1; i++) {
    const pA = CALIBRATION_POINTS[i];
    const pB = CALIBRATION_POINTS[i + 1];

    const vecAB = { r: pB.rgb.r - pA.rgb.r, g: pB.rgb.g - pA.rgb.g, b: pB.rgb.b - pA.rgb.b };
    const lenSqAB = vecAB.r * vecAB.r + vecAB.g * vecAB.g + vecAB.b * vecAB.b;

    if (lenSqAB === 0) continue;

    const vecAC = { r: cRgb.r - pA.rgb.r, g: cRgb.g - pA.rgb.g, b: cRgb.b - pA.rgb.b };
    const t = (vecAC.r * vecAB.r + vecAC.g * vecAB.g + vecAC.b * vecAB.b) / lenSqAB;
    const tClamped = Math.max(0, Math.min(1, t));

    const projPoint = {
      r: pA.rgb.r + tClamped * vecAB.r,
      g: pA.rgb.g + tClamped * vecAB.g,
      b: pA.rgb.b + tClamped * vecAB.b
    };

    const distToSeg = Math.hypot(cRgb.r - projPoint.r, cRgb.g - projPoint.g, cRgb.b - projPoint.b);

    const normA = normalizeRgb(pA.rgb);
    const normB = normalizeRgb(pB.rgb);
    const projNorm = {
      r: normA.r + tClamped * (normB.r - normA.r),
      g: normA.g + tClamped * (normB.g - normA.g),
      b: normA.b + tClamped * (normB.b - normA.b)
    };
    const normDist = Math.hypot(cNorm.r - projNorm.r, cNorm.g - projNorm.g, cNorm.b - projNorm.b) * 255;

    const effectiveDist = Math.min(distToSeg, normDist * 0.85);

    if (effectiveDist < bestDist) {
      bestDist = effectiveDist;
      bestValidity = pA.validity + tClamped * (pB.validity - pA.validity);
    }
  }

  // 3. Out-of-bounds check (if distance to all calibration segments is too large > 115)
  if (bestDist > 115) {
    return {
      detected_hex: cleanHex,
      reference_color: closestAnchor.hex,
      closest_reference_label: `${closestAnchor.hex} (${closestAnchor.validity}% reference - ${closestAnchor.label})`,
      validity_percentage: null,
      expiry_level: null,
      status: 'RETAKE',
      can_proceed: false,
      message: 'EXPIRY INDICATOR NOT CLEAR — RETAKE'
    };
  }

  const validityPercentage = Math.round(Math.max(0, Math.min(100, bestValidity)));

  // 4. Status Determination
  let status = 'VALID';
  if (validityPercentage >= 50) {
    status = 'VALID';
  } else if (validityPercentage >= 15) {
    status = 'WARNING';
  } else {
    status = 'EXPIRED';
  }

  const canProceed = status === 'VALID' || status === 'WARNING';
  let message = '';
  if (status === 'VALID') {
    message = `Physical Expiry Indicator: VALID (${validityPercentage}% level). Shift entry allowed.`;
  } else if (status === 'WARNING') {
    message = `Physical Expiry Indicator: WARNING (${validityPercentage}% level). Shift allowed with caution.`;
  } else {
    message = `BADGE EXPIRED — SHIFT CANNOT START`;
  }

  return {
    detected_hex: cleanHex,
    reference_color: closestAnchor.hex,
    closest_reference_label: `${closestAnchor.hex} (${closestAnchor.validity}% - ${closestAnchor.label})`,
    validity_percentage: validityPercentage,
    expiry_level: validityPercentage,
    status: status, // VALID | WARNING | EXPIRED | RETAKE
    can_proceed: canProceed,
    message: message
  };
}

module.exports = {
  CALIBRATION_POINTS,
  hexToRgb,
  rgbToHex,
  normalizeRgb,
  analyzeExpiryColor
};
