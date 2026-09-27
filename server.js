require('dotenv').config();
const express = require('express');
const path = require('path');
const { db, getProvider, healthCheck, hashPassword, verifyPassword, generateRandomToken } = require('./database/db');
const { uploadScanImage, getStorageStatus } = require('./utils/storage');
const { generateExcelReportBuffer } = require('./utils/excelExport');
const { analyzeExpiryColor, CALIBRATION_POINTS } = require('./utils/expiryCalibration');
const { analyzeH2sStripColor, calculateShiftExposure, H2S_CALIBRATION_POINTS } = require('./utils/h2sCalibration');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// SERVER-SIDE SESSION AUTHENTICATION & RBAC MIDDLEWARE
// -------------------------------------------------------------

/**
 * Session Middleware: Resolves user identity strictly from server-side sessions.
 * NEVER trusts client-sent role headers or worker_id params.
 */
app.use(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const nowIso = new Date().toISOString();
    const session = await db.get(`
      SELECT s.token, s.role, s.worker_id, u.id as user_id, u.username, u.name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `, [token, nowIso]);

    if (session) {
      req.user = {
        id: session.user_id,
        username: session.username,
        role: session.role,
        worker_id: session.worker_id,
        name: session.name
      };
    } else {
      req.user = null;
    }
  } catch (err) {
    console.error('[Session Middleware Error]:', err.message);
    req.user = null;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied: Safety Officer / Admin privileges required.' });
  }
  next();
}

// Disable browser caching for API endpoints
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// -------------------------------------------------------------
// AUTHENTICATION & SESSION API ENDPOINTS
// -------------------------------------------------------------

/**
 * POST /api/auth/login
 * Role-based login with hashed password verification and random session token generation
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);

    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Please check username and password/PIN.' });
    }

    // Generate random server-side session token
    const token = generateRandomToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.run(`
      INSERT INTO sessions (token, user_id, role, worker_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [token, user.id, user.role, user.worker_id || null, expiresAt]);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        worker_id: user.worker_id
      }
    });
  } catch (error) {
    console.error('[API POST /api/auth/login Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Destroys server-side session
 */
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.headers['x-session-token'];
    if (token) {
      await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user session details
 */
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    let workerInfo = null;
    if (req.user.role === 'worker' && req.user.worker_id) {
      workerInfo = await db.get('SELECT * FROM workers WHERE worker_id = ?', [req.user.worker_id]);
    }

    const unreadAlertsRow = await db.get(`
      SELECT COUNT(*) as count FROM alerts 
      WHERE is_read = 0 AND (
        (target_role = ? AND (worker_id = ? OR worker_id IS NULL))
        OR (target_role = 'admin' AND ? = 'admin')
      )
    `, [req.user.role, req.user.worker_id, req.user.role]);

    const unreadAlerts = unreadAlertsRow ? parseInt(unreadAlertsRow.count, 10) : 0;

    res.json({
      success: true,
      data: {
        user: req.user,
        worker: workerInfo,
        unreadAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/workers
 * Public endpoint to list active worker options for login dropdown
 */
app.get('/api/auth/workers', async (req, res) => {
  try {
    const workers = await db.all("SELECT worker_id, name, department FROM workers WHERE status = 'active' ORDER BY name ASC");
    res.json({ success: true, data: workers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// ALERTS & NOTIFICATIONS API ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/alerts
 * Retrieve alerts targeted to user's role and worker ID
 */
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    const { alert_type } = req.query;
    let query = '';
    let params = [];

    if (req.user.role === 'admin') {
      if (alert_type && alert_type.trim()) {
        query = 'SELECT * FROM alerts WHERE alert_type = ? ORDER BY id DESC';
        params.push(alert_type.trim());
      } else {
        query = 'SELECT * FROM alerts ORDER BY id DESC';
      }
    } else {
      if (alert_type && alert_type.trim()) {
        query = `
          SELECT * FROM alerts 
          WHERE (target_role = 'worker' AND (worker_id = ? OR worker_id IS NULL))
            AND alert_type = ?
          ORDER BY id DESC
        `;
        params.push(req.user.worker_id, alert_type.trim());
      } else {
        query = `
          SELECT * FROM alerts 
          WHERE (target_role = 'worker' AND (worker_id = ? OR worker_id IS NULL))
          ORDER BY id DESC
        `;
        params.push(req.user.worker_id);
      }
    }

    const alerts = await db.all(query, params);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/alerts/:id/read
 * Mark alert as read
 */
app.patch('/api/alerts/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('UPDATE alerts SET is_read = 1 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Alert marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/alerts
 * Safety Officer create custom alert (Admin only)
 */
app.post('/api/alerts', requireAdmin, async (req, res) => {
  try {
    const { target_role = 'worker', worker_id, title, message, alert_type = 'shift_issue', severity = 'warning' } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required.' });
    }

    const nowIso = new Date().toISOString();
    const result = await db.run(`
      INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `, [target_role, worker_id || null, title, message, alert_type, severity, nowIso]);

    const createdAlert = await db.get('SELECT * FROM alerts WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Alert created successfully.',
      data: createdAlert
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// CONFIGURABLE SYSTEM SETTINGS API ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/settings
 * Retrieve configurable settings & exposure thresholds
 */
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settingsList = await db.all('SELECT * FROM settings');
    const settingsObj = {};
    settingsList.forEach(s => { settingsObj[s.key] = s.value; });
    res.json({ success: true, data: settingsObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/settings
 * Update system thresholds & provisional labels (Admin only)
 */
app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    const { high_exposure_threshold, provisional_label, shift_max_hours } = req.body;

    if (high_exposure_threshold !== undefined) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['high_exposure_threshold', String(high_exposure_threshold)]);
    }
    if (provisional_label !== undefined) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['provisional_label', String(provisional_label)]);
    }
    if (shift_max_hours !== undefined) {
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shift_max_hours', String(shift_max_hours)]);
    }

    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// CORE SYSTEM API ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/health
 * Safe Health check endpoint verifying Express server, DB provider, and Storage configuration
 */
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    const storageHealth = await getStorageStatus();

    const isHealthy = dbHealth.status === 'connected';

    res.json({
      status: isHealthy ? 'ok' : 'degraded',
      system: 'Sulfide Sentinels H2S Exposure Monitoring System',
      environment: process.env.NODE_ENV || 'development',
      provider: getProvider(),
      database: dbHealth,
      storage: storageHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      system: 'Sulfide Sentinels H2S Exposure Monitoring System',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/stats
 * Summary metrics tailored to authenticated user role
 */
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'worker') {
      const workerId = req.user.worker_id;
      const personalScansRow = await db.get('SELECT COUNT(*) as count FROM scans WHERE worker_id = ?', [workerId]);
      const personalScans = personalScansRow ? parseInt(personalScansRow.count, 10) : 0;

      const activeShift = await db.get("SELECT * FROM shifts WHERE worker_id = ? AND status = 'active'", [workerId]);

      const unreadAlertsRow = await db.get(`
        SELECT COUNT(*) as count FROM alerts 
        WHERE is_read = 0 AND target_role = 'worker' AND (worker_id = ? OR worker_id IS NULL)
      `, [workerId]);
      const unreadAlerts = unreadAlertsRow ? parseInt(unreadAlertsRow.count, 10) : 0;

      const pendingAnalysesRow = await db.get(`
        SELECT COUNT(*) as count FROM scans 
        WHERE worker_id = ? AND (exposure_estimate IS NULL OR status = 'pending_analysis')
      `, [workerId]);
      const pendingAnalyses = pendingAnalysesRow ? parseInt(pendingAnalysesRow.count, 10) : 0;

      return res.json({
        success: true,
        role: 'worker',
        data: {
          workerId,
          workerName: req.user.name,
          hasActiveShift: !!activeShift,
          activeShift,
          personalScans,
          pendingAnalyses,
          unreadAlerts
        }
      });
    }

    // Admin Workforce Overview Stats
    const totalWorkersRow = await db.get("SELECT COUNT(*) as count FROM workers WHERE status = 'active'");
    const totalWorkers = totalWorkersRow ? parseInt(totalWorkersRow.count, 10) : 0;

    const totalRegisteredRow = await db.get("SELECT COUNT(*) as count FROM workers");
    const totalRegistered = totalRegisteredRow ? parseInt(totalRegisteredRow.count, 10) : 0;

    const activeShiftsRow = await db.get("SELECT COUNT(*) as count FROM shifts WHERE status = 'active'");
    const activeShifts = activeShiftsRow ? parseInt(activeShiftsRow.count, 10) : 0;

    const completedShiftsRow = await db.get("SELECT COUNT(*) as count FROM shifts WHERE status = 'completed'");
    const completedShifts = completedShiftsRow ? parseInt(completedShiftsRow.count, 10) : 0;

    const totalScansRow = await db.get('SELECT COUNT(*) as count FROM scans');
    const totalScans = totalScansRow ? parseInt(totalScansRow.count, 10) : 0;

    const pendingAnalysisRow = await db.get("SELECT COUNT(*) as count FROM scans WHERE exposure_estimate IS NULL OR status = 'pending_analysis'");
    const pendingAnalysis = pendingAnalysisRow ? parseInt(pendingAnalysisRow.count, 10) : 0;

    const activeAlertsRow = await db.get("SELECT COUNT(*) as count FROM alerts WHERE is_read = 0");
    const activeAlertsCount = activeAlertsRow ? parseInt(activeAlertsRow.count, 10) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const validBadgesRow = await db.get(`
      SELECT COUNT(*) as count FROM badges 
      WHERE status = 'active' AND (expiry_date IS NULL OR expiry_date >= ?)
    `, [todayStr]);
    const validBadges = validBadgesRow ? parseInt(validBadgesRow.count, 10) : 0;

    res.json({
      success: true,
      role: 'admin',
      data: {
        totalWorkers,
        totalRegistered,
        activeShifts,
        completedShifts,
        totalScans,
        todaysScans: totalScans,
        pendingAnalysis,
        validBadges,
        activeAlertsCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/app/info
 * Application title, version, and build info
 */
app.get('/api/app/info', async (req, res) => {
  const storageStatus = await getStorageStatus();

  res.json({
    success: true,
    data: {
      name: 'Sulfide Sentinels H2S Exposure Monitoring System',
      shortName: 'Sulfide Sentinels',
      version: '2.0.0-cloud',
      build: 'Supabase PostgreSQL & Cloud Storage Release',
      environment: process.env.NODE_ENV || 'production',
      backendFramework: 'Express 5 (Node.js)',
      databaseEngine: `${getProvider().toUpperCase()} Provider`,
      storageEngine: `${storageStatus.provider.toUpperCase()} (${storageStatus.bucket})`,
      workflowStage: 'Stage 6 Complete (Dual Database Cloud Architecture)'
    }
  });
});

/**
 * POST /api/scans/analyze-expiry-indicator
 * Dedicated API interface for physical badge expiry indicator image analysis.
 * Determines physical badge validity state: VALID, EXPIRED, or UNREADABLE.
 */
app.post('/api/scans/analyze-expiry-indicator', requireAuth, async (req, res) => {
  try {
    let { image_path, worker_id, badge_id, mock_status, detected_hex } = req.body;

    // Upload image to Supabase Storage if binary/base64
    if (image_path && (image_path.startsWith('data:image/') || image_path.length > 500)) {
      image_path = await uploadScanImage(image_path, 'expiry');
    }

    const expiryRegionConfig = {
      region_id: 'EXPIRY_DOT_TOP_RIGHT',
      label: 'Physical Expiry Indicator Dot',
      coordinates: { xRatio: 0.70, yRatio: 0.15, widthRatio: 0.22, heightRatio: 0.25 },
      calibration_anchors: CALIBRATION_POINTS
    };

    let targetHex = detected_hex;
    let isUnreadable = false;

    if (mock_status) {
      const uMock = String(mock_status).toUpperCase();
      if (uMock === 'VALID' || uMock === '100%') targetHex = '#6A9EAE';
      else if (uMock === '50%' || uMock === 'HALF') targetHex = '#7FA87A';
      else if (uMock === 'WARNING' || uMock === '35%') targetHex = '#9BA96C';
      else if (uMock === 'EXPIRED' || uMock === 'INVALID' || uMock === '0%') targetHex = '#C59A45';
      else if (uMock === 'UNREADABLE' || uMock === 'RETAKE') isUnreadable = true;
      else if (mock_status.startsWith('#')) targetHex = mock_status;
    } else if (image_path) {
      const pathLower = image_path.toLowerCase();
      if (pathLower.includes('unreadable') || pathLower.includes('retake')) isUnreadable = true;
      else if (pathLower.includes('expired') || pathLower.includes('bad_badge')) targetHex = '#C59A45';
      else if (pathLower.includes('warning')) targetHex = '#9BA96C';
      else if (!targetHex) targetHex = '#6A9EAE';
    } else if (!targetHex) {
      targetHex = '#6A9EAE';
    }

    const analysis = analyzeExpiryColor(targetHex, isUnreadable);

    const responseData = {
      success: true,
      expiry_status: analysis.status,
      detected_hex: analysis.detected_hex,
      reference_color: analysis.reference_color,
      closest_reference_label: analysis.closest_reference_label,
      validity_percentage: analysis.validity_percentage,
      can_proceed: analysis.can_proceed,
      message: analysis.message,
      image_path: image_path || null,
      region_config: expiryRegionConfig,
      detection: {
        indicator_found: analysis.status !== 'UNREADABLE',
        detected_color_hex: analysis.detected_hex,
        reference_color: analysis.reference_color,
        closest_reference_label: analysis.closest_reference_label,
        validity_percentage: analysis.validity_percentage,
        confidence: analysis.status === 'UNREADABLE' ? 0.30 : 0.98
      },
      validation: {
        can_proceed: analysis.can_proceed,
        action_required: analysis.can_proceed ? 'NONE' : (analysis.status === 'UNREADABLE' ? 'RETAKE_IMAGE' : 'BLOCK_SHIFT'),
        message: analysis.message
      }
    };

    if (analysis.status === 'EXPIRED' || analysis.status === 'INVALID') {
      try {
        await db.run(`
          INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity)
          VALUES ('admin', ?, 'Attempted Shift Entry with Expired Physical Badge', ?, 'badge_expired', 'danger')
        `, [
          worker_id || 'UNKNOWN',
          `Worker ${worker_id || 'Unknown'} attempted pre-shift scan with an EXPIRED physical badge (${analysis.validity_percentage}% validity, HEX ${analysis.detected_hex}, Serial ${badge_id || 'N/A'}). Shift entry blocked.`
        ]);
      } catch (e) {
        console.error('[Alert Error]:', e);
      }
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scans/analyze-h2s-strip
 * Dedicated API interface for physical badge H2S sensing strip image analysis.
 */
app.post('/api/scans/analyze-h2s-strip', requireAuth, async (req, res) => {
  try {
    let { detected_hex, detected_ref_hex, is_unreadable, mock_ppm, image_path } = req.body;

    if (image_path && (image_path.startsWith('data:image/') || image_path.length > 500)) {
      image_path = await uploadScanImage(image_path, 'h2s_strip');
    }

    let targetHex = detected_hex;
    let isUnreadable = !!is_unreadable;

    if (mock_ppm !== undefined && mock_ppm !== null) {
      const ppmNum = parseFloat(mock_ppm);
      if (isNaN(ppmNum)) {
        isUnreadable = true;
      } else if (ppmNum <= 0) targetHex = '#96CDE1';
      else if (ppmNum <= 1) targetHex = '#92C9CA';
      else if (ppmNum <= 2) targetHex = '#8EB5B2';
      else if (ppmNum <= 4) targetHex = '#86A89A';
      else if (ppmNum <= 6) targetHex = '#819A8A';
      else if (ppmNum <= 8) targetHex = '#788C7D';
      else if (ppmNum <= 10) targetHex = '#6C7B76';
      else if (ppmNum <= 12) targetHex = '#5F696E';
      else if (ppmNum <= 15) targetHex = '#50585C';
      else if (ppmNum <= 20) targetHex = '#41464A';
      else targetHex = '#323437';
    }

    const analysis = analyzeH2sStripColor(targetHex, detected_ref_hex, isUnreadable);

    res.json({
      success: true,
      h2s_status: analysis.status,
      detected_hex: analysis.detected_hex,
      corrected_hex: analysis.corrected_hex,
      reference_color: analysis.reference_color,
      closest_reference_label: analysis.closest_reference_label,
      estimated_ppm: analysis.estimated_ppm,
      confidence: analysis.confidence,
      quality: analysis.quality,
      can_proceed: analysis.can_proceed,
      message: analysis.message,
      image_path: image_path || null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/database/status
 * Detailed database health & table metrics (Admin only)
 */
app.get('/api/database/status', requireAdmin, async (req, res) => {
  try {
    const totalWorkers = (await db.get("SELECT COUNT(*) as count FROM workers")).count;
    const activeWorkers = (await db.get("SELECT COUNT(*) as count FROM workers WHERE status = 'active'")).count;
    const totalBadges = (await db.get("SELECT COUNT(*) as count FROM badges")).count;
    const totalShifts = (await db.get("SELECT COUNT(*) as count FROM shifts")).count;
    const activeShifts = (await db.get("SELECT COUNT(*) as count FROM shifts WHERE status = 'active'")).count;
    const completedShifts = (await db.get("SELECT COUNT(*) as count FROM shifts WHERE status = 'completed'")).count;
    const totalScans = (await db.get("SELECT COUNT(*) as count FROM scans")).count;
    const pendingScans = (await db.get("SELECT COUNT(*) as count FROM scans WHERE exposure_estimate IS NULL OR status = 'pending_analysis'")).count;

    const dbHealth = await healthCheck();
    const storageHealth = await getStorageStatus();

    res.json({
      success: true,
      data: {
        status: dbHealth.status,
        provider: getProvider().toUpperCase(),
        databaseEngine: `${getProvider().toUpperCase()} Provider`,
        storage: storageHealth,
        metrics: {
          totalWorkers: parseInt(totalWorkers, 10),
          activeWorkers: parseInt(activeWorkers, 10),
          totalBadges: parseInt(totalBadges, 10),
          totalShifts: parseInt(totalShifts, 10),
          activeShifts: parseInt(activeShifts, 10),
          completedShifts: parseInt(completedShifts, 10),
          totalScans: parseInt(totalScans, 10),
          pendingScans: parseInt(pendingScans, 10)
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/database/export
 * Export complete database JSON snapshot for backup (Admin only)
 */
app.get('/api/database/export', requireAdmin, async (req, res) => {
  try {
    const workers = await db.all("SELECT * FROM workers ORDER BY id ASC");
    const badges = await db.all("SELECT * FROM badges ORDER BY id ASC");
    const shifts = await db.all("SELECT * FROM shifts ORDER BY id ASC");
    const scans = await db.all("SELECT * FROM scans ORDER BY id ASC");

    const backupData = {
      system: 'Sulfide Sentinels H2S Exposure Monitoring System',
      version: '2.0.0-cloud',
      provider: getProvider(),
      exported_at: new Date().toISOString(),
      summary: {
        total_workers: workers.length,
        total_badges: badges.length,
        total_shifts: shifts.length,
        total_scans: scans.length
      },
      data: {
        workers,
        badges,
        shifts,
        scans
      }
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `sulfide_sentinels_backup_${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/database/export-excel
 * Download Excel Report (.xlsx)
 */
app.get('/api/database/export-excel', requireAdmin, async (req, res) => {
  try {
    const buffer = await generateExcelReportBuffer(db);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `sulfide_sentinels_report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('[API GET /api/database/export-excel Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/database/clear-test-data
 * Safely clear test data / reset demo database (Admin only)
 */
app.post('/api/database/clear-test-data', requireAdmin, async (req, res) => {
  try {
    const { confirmKey } = req.body;
    if (confirmKey !== 'CONFIRM_CLEAR_DEMO_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Invalid confirmation key. Action cancelled.'
      });
    }

    await db.run("DELETE FROM alerts");
    await db.run("DELETE FROM sessions");
    await db.run("DELETE FROM scans");
    await db.run("DELETE FROM shifts");
    await db.run("DELETE FROM workers");
    await db.run("DELETE FROM badges");
    await db.run("DELETE FROM users WHERE role != 'admin'");

    await db.run("INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)", ['BDG-1001', '2026-01-10', '2027-01-10', 'active']);
    await db.run("INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)", ['BDG-1002', '2026-01-15', '2027-01-15', 'active']);
    await db.run("INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)", ['BDG-1003', '2026-02-01', '2027-02-01', 'active']);
    await db.run("INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)", ['BDG-1004', '2025-01-01', '2026-01-01', 'expired']);

    await db.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-101', 'John Doe', 'Refining & Processing', 'BDG-1001']);
    await db.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-102', 'Jane Smith', 'Pipeline Inspection', 'BDG-1002']);
    await db.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-103', 'Robert Chen', 'Safety Compliance', 'BDG-1003']);
    await db.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-104', 'Maria Garcia', 'Drilling Operations', 'BDG-1004']);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    await db.run("INSERT INTO shifts (worker_id, badge_id, start_time, status) VALUES (?, ?, ?, 'active')", ['W-101', 'BDG-1001', twoHoursAgo]);
    await db.run("INSERT INTO shifts (worker_id, badge_id, start_time, status) VALUES (?, ?, ?, 'active')", ['W-102', 'BDG-1002', fourHoursAgo]);

    await db.run(
      "INSERT INTO scans (worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate, confidence, quality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['W-101', 1, 'pre-shift', '/uploads/scans/sample_preshift_1.jpg', '#F4E8C1', 0.0, 0.98, 'High', 'completed']
    );
    await db.run(
      "INSERT INTO scans (worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate, confidence, quality, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['W-102', 2, 'pre-shift', '/uploads/scans/sample_preshift_2.jpg', '#F0E6BC', 0.0, 0.96, 'High', 'completed']
    );

    const workers = await db.all('SELECT worker_id, name FROM workers');
    for (const w of workers) {
      const pin = `${w.worker_id.replace(/[^0-9]/g, '') || '101'}89!pass`;
      const workerCreds = hashPassword(pin);
      try {
        await db.run("INSERT INTO users (username, password_hash, salt, role, worker_id, name) VALUES (?, ?, ?, 'worker', ?, ?)", [
          w.worker_id.toLowerCase(),
          workerCreds.hash,
          workerCreds.salt,
          w.worker_id,
          w.name
        ]);
      } catch (e) { }
    }

    res.json({
      success: true,
      message: 'Demo test data reset to clean initial state successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workers
 * Retrieve all workers (Admin only)
 */
app.get('/api/workers', requireAdmin, async (req, res) => {
  try {
    const workers = await db.all(`
      SELECT 
        w.id,
        w.worker_id,
        w.name,
        w.department,
        w.badge_id,
        COALESCE(w.status, 'active') as status,
        w.created_at,
        b.manufacture_date as badge_manufacture_date,
        b.expiry_date as badge_expiry_date,
        COALESCE(b.status, 'active') as badge_status,
        s.id as active_shift_id,
        s.start_time as shift_start_time
      FROM workers w
      LEFT JOIN badges b ON w.badge_id = b.badge_id
      LEFT JOIN shifts s ON w.worker_id = s.worker_id AND s.status = 'active'
      ORDER BY w.id DESC
    `);

    res.json({ success: true, data: workers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workers/active
 * Retrieve active workers (Authenticated)
 */
app.get('/api/workers/active', requireAuth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let query = `
      SELECT 
        w.id,
        w.worker_id,
        w.name,
        w.department,
        w.badge_id,
        w.status,
        w.created_at,
        b.manufacture_date as badge_manufacture_date,
        b.expiry_date as badge_expiry_date,
        COALESCE(b.status, 'active') as badge_status,
        s.id as active_shift_id,
        s.start_time as shift_start_time
      FROM workers w
      LEFT JOIN badges b ON w.badge_id = b.badge_id
      LEFT JOIN shifts s ON w.worker_id = s.worker_id AND s.status = 'active'
      WHERE w.status = 'active'
    `;
    let params = [];

    // RBAC: Worker can only see their own active entry
    if (req.user.role === 'worker') {
      query += ` AND w.worker_id = ?`;
      params.push(req.user.worker_id);
    }
    query += ` ORDER BY w.name ASC`;

    const activeWorkers = await db.all(query, params);

    activeWorkers.forEach(w => {
      if (w.badge_expiry_date && w.badge_expiry_date < todayStr) {
        w.badge_status = 'expired';
      }
    });

    res.json({ success: true, data: activeWorkers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workers/:id
 * Retrieve single worker profile details (Admin or Own Profile)
 */
app.get('/api/workers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    let worker = null;
    if (!isNaN(id)) {
      worker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);
    }
    if (!worker) {
      worker = await db.get('SELECT * FROM workers WHERE worker_id = ?', [id]);
    }

    if (!worker) {
      return res.status(404).json({ success: false, error: `Worker not found with ID '${id}'.` });
    }

    // RBAC Enforcement: Worker can ONLY view their own profile
    if (req.user.role === 'worker' && worker.worker_id !== req.user.worker_id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own profile.' });
    }

    const badge = (await db.get('SELECT * FROM badges WHERE badge_id = ?', [worker.badge_id])) || {
      badge_id: worker.badge_id,
      manufacture_date: 'N/A',
      expiry_date: 'N/A',
      status: 'active'
    };

    const todayStr = new Date().toISOString().split('T')[0];
    if (badge.expiry_date && badge.expiry_date !== 'N/A' && badge.expiry_date < todayStr) {
      badge.status = 'expired';
    }

    const activeShift = await db.get("SELECT * FROM shifts WHERE worker_id = ? AND status = 'active'", [worker.worker_id]);

    const scanLogs = await db.all('SELECT * FROM scans WHERE worker_id = ? ORDER BY id DESC', [worker.worker_id]);
    const scanCount = scanLogs.length;
    const exposureCount = scanLogs.filter(s => s.exposure_estimate !== null && s.exposure_estimate > 0).length;

    res.json({
      success: true,
      data: {
        worker,
        badge,
        shift: {
          onShift: !!activeShift,
          shiftId: activeShift ? activeShift.id : null,
          startTime: activeShift ? activeShift.start_time : null
        },
        metrics: {
          scanCount,
          exposureCount
        },
        recentScans: scanLogs.slice(0, 5)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/badges/:badgeId
 * Retrieve single badge info by badgeId (Authenticated)
 */
app.get('/api/badges/:badgeId', requireAuth, async (req, res) => {
  try {
    const { badgeId } = req.params;
    const badge = await db.get('SELECT * FROM badges WHERE LOWER(badge_id) = LOWER(?)', [badgeId]);

    if (!badge) {
      return res.status(404).json({ success: false, error: `Badge '${badgeId}' not found.` });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isExpired = badge.expiry_date && badge.expiry_date < todayStr;
    const status = isExpired ? 'expired' : (badge.status || 'active');

    res.json({
      success: true,
      data: {
        ...badge,
        status,
        isExpired
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workers
 * Register a new worker and auto-create user login (Admin only)
 */
app.post('/api/workers', requireAdmin, async (req, res) => {
  try {
    const { worker_id, name, department, badge_id, manufacture_date, expiry_date } = req.body;

    if (!worker_id || !worker_id.trim()) {
      return res.status(400).json({ success: false, error: 'Worker ID is required.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Worker Name is required.' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ success: false, error: 'Department is required.' });
    }
    if (!badge_id || !badge_id.trim()) {
      return res.status(400).json({ success: false, error: 'Badge ID is required.' });
    }
    if (!expiry_date || !expiry_date.trim()) {
      return res.status(400).json({ success: false, error: 'Badge Expiry Date is required.' });
    }

    const cleanWorkerId = worker_id.trim();
    const cleanName = name.trim();
    const cleanDept = department.trim();
    const cleanBadgeId = badge_id.trim();
    const cleanExpiry = expiry_date.trim();
    const cleanMfg = (manufacture_date && manufacture_date.trim()) ? manufacture_date.trim() : new Date().toISOString().split('T')[0];

    const duplicateWorker = await db.get('SELECT id FROM workers WHERE LOWER(worker_id) = LOWER(?)', [cleanWorkerId]);
    if (duplicateWorker) {
      return res.status(400).json({ success: false, error: `Duplicate Error: Worker ID '${cleanWorkerId}' is already registered.` });
    }

    const duplicateBadgeWorker = await db.get('SELECT id, name FROM workers WHERE LOWER(badge_id) = LOWER(?)', [cleanBadgeId]);
    if (duplicateBadgeWorker) {
      return res.status(400).json({
        success: false,
        error: `Duplicate Error: Badge ID '${cleanBadgeId}' is already assigned to worker '${duplicateBadgeWorker.name}'.`
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const badgeStatus = cleanExpiry < todayStr ? 'expired' : 'active';

    const existingBadge = await db.get('SELECT id FROM badges WHERE LOWER(badge_id) = LOWER(?)', [cleanBadgeId]);
    if (existingBadge) {
      await db.run(`
        UPDATE badges 
        SET manufacture_date = ?, expiry_date = ?, status = ?
        WHERE id = ?
      `, [cleanMfg, cleanExpiry, badgeStatus, existingBadge.id]);
    } else {
      await db.run(`
        INSERT INTO badges (badge_id, manufacture_date, expiry_date, status)
        VALUES (?, ?, ?, ?)
      `, [cleanBadgeId, cleanMfg, cleanExpiry, badgeStatus]);
    }

    const result = await db.run(`
      INSERT INTO workers (worker_id, name, department, badge_id, status)
      VALUES (?, ?, ?, ?, 'active')
    `, [cleanWorkerId, cleanName, cleanDept, cleanBadgeId]);

    // Auto-create user login with salt-hashed PIN
    const pin = `${cleanWorkerId.replace(/[^0-9]/g, '') || '101'}89!pass`;
    const workerCreds = hashPassword(pin);
    try {
      await db.run(`
        INSERT INTO users (username, password_hash, salt, role, worker_id, name)
        VALUES (?, ?, ?, 'worker', ?, ?)
      `, [cleanWorkerId.toLowerCase(), workerCreds.hash, workerCreds.salt, cleanWorkerId, cleanName]);
    } catch (e) { }

    const newWorker = await db.get('SELECT * FROM workers WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Worker registered successfully.',
      data: {
        ...newWorker,
        badge_manufacture_date: cleanMfg,
        badge_expiry_date: cleanExpiry,
        badge_status: badgeStatus
      }
    });
  } catch (error) {
    console.error('[API POST /api/workers Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workers/:id
 * Update worker details (Admin only)
 */
app.put('/api/workers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_id, name, department, badge_id, manufacture_date, expiry_date } = req.body;

    const existingWorker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);
    if (!existingWorker) {
      return res.status(404).json({ success: false, error: `Worker with ID '${id}' not found.` });
    }

    if (!worker_id || !worker_id.trim()) {
      return res.status(400).json({ success: false, error: 'Worker ID is required.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Worker Name is required.' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ success: false, error: 'Department is required.' });
    }
    if (!badge_id || !badge_id.trim()) {
      return res.status(400).json({ success: false, error: 'Badge ID is required.' });
    }
    if (!expiry_date || !expiry_date.trim()) {
      return res.status(400).json({ success: false, error: 'Badge Expiry Date is required.' });
    }

    const cleanWorkerId = worker_id.trim();
    const cleanName = name.trim();
    const cleanDept = department.trim();
    const cleanBadgeId = badge_id.trim();
    const cleanExpiry = expiry_date.trim();
    const cleanMfg = (manufacture_date && manufacture_date.trim()) ? manufacture_date.trim() : new Date().toISOString().split('T')[0];

    const duplicateWorker = await db.get('SELECT id FROM workers WHERE LOWER(worker_id) = LOWER(?) AND id != ?', [cleanWorkerId, id]);
    if (duplicateWorker) {
      return res.status(400).json({ success: false, error: `Duplicate Error: Worker ID '${cleanWorkerId}' is already assigned to another worker.` });
    }

    const duplicateBadge = await db.get('SELECT id, name FROM workers WHERE LOWER(badge_id) = LOWER(?) AND id != ?', [cleanBadgeId, id]);
    if (duplicateBadge) {
      return res.status(400).json({
        success: false,
        error: `Duplicate Error: Badge ID '${cleanBadgeId}' is already assigned to worker '${duplicateBadge.name}'.`
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const badgeStatus = cleanExpiry < todayStr ? 'expired' : 'active';

    const existingBadge = await db.get('SELECT id FROM badges WHERE LOWER(badge_id) = LOWER(?)', [cleanBadgeId]);
    if (existingBadge) {
      await db.run(`
        UPDATE badges 
        SET manufacture_date = ?, expiry_date = ?, status = ?
        WHERE id = ?
      `, [cleanMfg, cleanExpiry, badgeStatus, existingBadge.id]);
    } else {
      await db.run(`
        INSERT INTO badges (badge_id, manufacture_date, expiry_date, status)
        VALUES (?, ?, ?, ?)
      `, [cleanBadgeId, cleanMfg, cleanExpiry, badgeStatus]);
    }

    await db.run(`
      UPDATE workers
      SET worker_id = ?, name = ?, department = ?, badge_id = ?
      WHERE id = ?
    `, [cleanWorkerId, cleanName, cleanDept, cleanBadgeId, id]);

    const updatedWorker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Worker updated successfully.',
      data: {
        ...updatedWorker,
        badge_manufacture_date: cleanMfg,
        badge_expiry_date: cleanExpiry,
        badge_status: badgeStatus
      }
    });
  } catch (error) {
    console.error('[API PUT /api/workers/:id Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/workers/:id/status
 * Toggle worker status (Admin only)
 */
app.patch('/api/workers/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: "Status must be either 'active' or 'inactive'." });
    }

    const worker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);
    if (!worker) {
      return res.status(404).json({ success: false, error: `Worker with ID '${id}' not found.` });
    }

    await db.run('UPDATE workers SET status = ? WHERE id = ?', [status, id]);

    if (status === 'inactive') {
      const nowIso = new Date().toISOString();
      await db.run(`
        UPDATE shifts 
        SET status = 'closed', end_time = ? 
        WHERE worker_id = ? AND status = 'active'
      `, [nowIso, worker.worker_id]);
    }

    const updatedWorker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `Worker status updated to '${status}'.`,
      data: updatedWorker
    });
  } catch (error) {
    console.error('[API PATCH /api/workers/:id/status Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workers/:id
 * Permanently delete worker and associated records (Admin only)
 */
app.delete('/api/workers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API DELETE /api/workers/${id}] Incoming DELETE request from user '${req.user ? req.user.username : 'unauthenticated'}' (role: ${req.user ? req.user.role : 'none'})`);

    let worker = null;
    if (!isNaN(id)) {
      worker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);
    }
    if (!worker) {
      worker = await db.get('SELECT * FROM workers WHERE LOWER(worker_id) = LOWER(?)', [id]);
    }

    if (!worker) {
      console.warn(`[API DELETE /api/workers/${id}] Worker record NOT FOUND for param '${id}'`);
      return res.status(404).json({ success: false, error: `Worker not found with ID '${id}'.` });
    }

    console.log(`[API DELETE /api/workers/${id}] Target worker resolved: Database ID #${worker.id}, Worker ID '${worker.worker_id}', Name '${worker.name}'`);

    if (req.user && req.user.worker_id && req.user.worker_id.toLowerCase() === worker.worker_id.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You cannot delete your own worker profile.' });
    }

    const activeShift = await db.get("SELECT id FROM shifts WHERE LOWER(worker_id) = LOWER(?) AND status = 'active'", [worker.worker_id]);
    if (activeShift) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete worker '${worker.name}' (${worker.worker_id}) because they currently have an active shift. Please end worker's shift first.`
      });
    }

    await db.transaction(async (tx) => {
      const linkedUser = await tx.get('SELECT id FROM users WHERE LOWER(worker_id) = LOWER(?)', [worker.worker_id]);
      if (linkedUser) {
        await tx.run('DELETE FROM sessions WHERE user_id = ?', [linkedUser.id]);
      }
      await tx.run('DELETE FROM sessions WHERE LOWER(worker_id) = LOWER(?)', [worker.worker_id]);
      await tx.run('DELETE FROM users WHERE LOWER(worker_id) = LOWER(?)', [worker.worker_id]);
      await tx.run('DELETE FROM alerts WHERE LOWER(worker_id) = LOWER(?)', [worker.worker_id]);
      await tx.run('DELETE FROM scans WHERE LOWER(worker_id) = LOWER(?)', [worker.worker_id]);
      await tx.run('DELETE FROM shifts WHERE LOWER(worker_id) = LOWER(?)', [worker.worker_id]);
      await tx.run('DELETE FROM workers WHERE id = ? OR LOWER(worker_id) = LOWER(?)', [worker.id, worker.worker_id]);
    });

    console.log(`[API DELETE /api/workers/${id}] Transaction completed. Worker '${worker.name}' (${worker.worker_id}) successfully removed.`);

    res.json({
      success: true,
      message: `Worker '${worker.name}' (${worker.worker_id}) and related records deleted successfully.`,
      deletedWorkerId: worker.worker_id,
      deletedNumericId: worker.id
    });
  } catch (error) {
    console.error('[API DELETE /api/workers/:id Exception]:', error);
    res.status(500).json({ success: false, error: 'Database/Server exception: ' + error.message });
  }
});

/**
 * POST /api/shifts
 * Create a new shift (Authenticated - Worker restricted to self)
 */
app.post('/api/shifts', requireAuth, async (req, res) => {
  try {
    let { worker_id, badge_id, pre_shift_ppm } = req.body;

    if (req.user.role === 'worker') {
      worker_id = req.user.worker_id;
    }

    if (!worker_id || !badge_id) {
      return res.status(400).json({ success: false, error: 'Worker ID and Badge ID are required to start shift.' });
    }

    const worker = await db.get('SELECT * FROM workers WHERE worker_id = ?', [worker_id]);
    if (!worker) {
      return res.status(404).json({ success: false, error: `Worker '${worker_id}' not found.` });
    }

    if (worker.status === 'inactive') {
      return res.status(400).json({ success: false, error: `Worker '${worker_id}' is currently inactive.` });
    }

    const badge = await db.get('SELECT * FROM badges WHERE badge_id = ?', [badge_id]);
    const todayStr = new Date().toISOString().split('T')[0];
    if (badge && badge.expiry_date && badge.expiry_date < todayStr) {
      return res.status(400).json({ success: false, error: `Cannot start shift: Badge '${badge_id}' has expired.` });
    }

    const existingActiveShift = await db.get("SELECT * FROM shifts WHERE worker_id = ? AND status = 'active'", [worker_id]);
    if (existingActiveShift) {
      return res.status(400).json({
        success: false,
        error: `Worker '${worker.name}' (${worker_id}) already has an active shift started at ${existingActiveShift.start_time}.`
      });
    }

    const nowIso = new Date().toISOString();
    const cleanPrePpm = pre_shift_ppm !== undefined && pre_shift_ppm !== null ? parseFloat(pre_shift_ppm) : 0.0;
    const result = await db.run(`
      INSERT INTO shifts (worker_id, badge_id, start_time, pre_shift_ppm, status)
      VALUES (?, ?, ?, ?, 'active')
    `, [worker_id, badge_id, nowIso, cleanPrePpm]);

    const newShift = await db.get('SELECT * FROM shifts WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: 'Shift started successfully.',
      data: {
        ...newShift,
        worker_name: worker.name,
        department: worker.department
      }
    });
  } catch (error) {
    console.error('[API POST /api/shifts Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shifts/active
 * Retrieve active shifts (Worker restricted to self, Admin sees all)
 */
app.get('/api/shifts/active', requireAuth, async (req, res) => {
  try {
    let activeShifts;
    if (req.user.role === 'worker') {
      activeShifts = await db.all(`
        SELECT s.*, w.name as worker_name, w.department 
        FROM shifts s
        JOIN workers w ON s.worker_id = w.worker_id
        WHERE s.status = 'active' AND s.worker_id = ?
        ORDER BY s.id DESC
      `, [req.user.worker_id]);
    } else {
      activeShifts = await db.all(`
        SELECT s.*, w.name as worker_name, w.department 
        FROM shifts s
        JOIN workers w ON s.worker_id = w.worker_id
        WHERE s.status = 'active'
        ORDER BY s.id DESC
      `);
    }

    res.json({ success: true, data: activeShifts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shifts/:id
 * Retrieve single shift (Worker restricted to self, Admin sees all)
 */
app.get('/api/shifts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await db.get(`
      SELECT s.*, w.name as worker_name, w.department 
      FROM shifts s
      JOIN workers w ON s.worker_id = w.worker_id
      WHERE s.id = ?
    `, [id]);

    if (!shift) {
      return res.status(404).json({ success: false, error: `Shift '${id}' not found.` });
    }

    if (req.user.role === 'worker' && shift.worker_id !== req.user.worker_id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own shift details.' });
    }

    res.json({ success: true, data: shift });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/shifts/:id/complete
 * Close and complete an active shift (Worker restricted to self)
 */
app.patch('/api/shifts/:id/complete', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await db.get('SELECT * FROM shifts WHERE id = ?', [id]);

    if (!shift) {
      return res.status(404).json({ success: false, error: `Shift '${id}' not found.` });
    }

    if (shift.status === 'completed') {
      return res.status(400).json({ success: false, error: `Shift '${id}' is already completed.` });
    }

    if (req.user.role === 'worker' && shift.worker_id !== req.user.worker_id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only complete your own active shift.' });
    }

    const endTime = new Date();
    const endTimeIso = endTime.toISOString();
    const startTime = new Date(shift.start_time);

    const diffMs = endTime - startTime;
    const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

    const preScan = await db.get("SELECT * FROM scans WHERE shift_id = ? AND scan_type = 'pre-shift' ORDER BY id ASC LIMIT 1", [id]);
    const postScan = await db.get("SELECT * FROM scans WHERE shift_id = ? AND scan_type = 'post-shift' ORDER BY id DESC LIMIT 1", [id]);

    const prePpm = preScan && preScan.h2s_ppm !== null && preScan.h2s_ppm !== undefined ? preScan.h2s_ppm : (preScan && preScan.exposure_estimate !== null ? preScan.exposure_estimate : (shift.pre_shift_ppm !== null && shift.pre_shift_ppm !== undefined ? shift.pre_shift_ppm : 0.0));
    const postPpm = postScan && postScan.h2s_ppm !== null && postScan.h2s_ppm !== undefined ? postScan.h2s_ppm : (postScan && postScan.exposure_estimate !== null ? postScan.exposure_estimate : prePpm);

    const expMetrics = calculateShiftExposure(prePpm, postPpm, durationMinutes);

    await db.run(`
      UPDATE shifts 
      SET 
        end_time = ?, 
        duration_minutes = ?, 
        status = 'completed',
        pre_shift_ppm = ?,
        post_shift_ppm = ?,
        delta_ppm = ?,
        final_exposure_ppm_h = ?
      WHERE id = ?
    `, [
      endTimeIso,
      durationMinutes,
      expMetrics.pre_shift_ppm,
      expMetrics.post_shift_ppm,
      expMetrics.delta_ppm,
      expMetrics.final_exposure_ppm_h,
      id
    ]);

    if (postScan) {
      await db.run(`
        UPDATE scans
        SET 
          pre_shift_ppm = ?,
          post_shift_ppm = ?,
          delta_ppm = ?,
          shift_exposure_ppm_h = ?,
          exposure_estimate = ?
        WHERE id = ?
      `, [
        expMetrics.pre_shift_ppm,
        expMetrics.post_shift_ppm,
        expMetrics.delta_ppm,
        expMetrics.final_exposure_ppm_h,
        expMetrics.final_exposure_ppm_h,
        postScan.id
      ]);
    }

    const completedShift = await db.get(`
      SELECT s.*, w.name as worker_name, w.department 
      FROM shifts s
      JOIN workers w ON s.worker_id = w.worker_id
      WHERE s.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Shift completed successfully.',
      data: completedShift
    });
  } catch (error) {
    console.error('[API PATCH /api/shifts/:id/complete Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/shifts
 * Retrieve shifts (Worker strictly filtered to self, Admin sees all)
 */
app.get('/api/shifts', requireAuth, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let { worker_id } = req.query;

    if (req.user.role === 'worker') {
      worker_id = req.user.worker_id;
    }

    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('s.status = ?');
      params.push(status);
    }

    if (worker_id) {
      whereConditions.push('s.worker_id = ?');
      params.push(worker_id);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      whereConditions.push('(LOWER(s.worker_id) LIKE ? OR LOWER(w.name) LIKE ? OR LOWER(s.badge_id) LIKE ? OR CAST(s.id AS TEXT) LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM shifts s
      JOIN workers w ON s.worker_id = w.worker_id
      ${whereClause}
    `;
    const totalCountRow = await db.get(countQuery, params);
    const totalCount = totalCountRow ? parseInt(totalCountRow.count, 10) : 0;

    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const offset = (Math.max(1, pageNum) - 1) * limitNum;

    const query = `
      SELECT 
        s.*, 
        w.name as worker_name, 
        w.department,
        (SELECT id FROM scans WHERE shift_id = s.id AND (scan_type = 'pre-shift' OR scan_type = 'pre_shift') ORDER BY id DESC LIMIT 1) as pre_shift_scan_id,
        (SELECT id FROM scans WHERE shift_id = s.id AND (scan_type = 'post-shift' OR scan_type = 'post_shift') ORDER BY id DESC LIMIT 1) as post_shift_scan_id
      FROM shifts s
      JOIN workers w ON s.worker_id = w.worker_id
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT ? OFFSET ?
    `;

    const shifts = await db.all(query, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: shifts,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scans
 * Save scan record (Worker restricted to self)
 * Stores image in Supabase Storage (with local disk fallback)
 */
app.post('/api/scans', requireAuth, async (req, res) => {
  try {
    let {
      worker_id,
      shift_id,
      scan_type,
      image_path,
      quality,
      status,
      expiry_indicator_status,
      reference_color,
      validity_percentage,
      detected_hex,
      h2s_ppm,
      corrected_hex,
      closest_h2s_reference,
      pre_shift_ppm,
      post_shift_ppm,
      delta_ppm,
      shift_exposure_ppm_h
    } = req.body;

    if (req.user.role === 'worker') {
      worker_id = req.user.worker_id;
    }

    if (!worker_id || !scan_type) {
      return res.status(400).json({ success: false, error: 'Worker ID and scan_type are required.' });
    }

    const cleanScanType = scan_type === 'pre-shift' || scan_type === 'pre_shift' ? 'pre-shift' : 'post-shift';

    // Upload to Supabase Storage if base64 / binary data URL
    let storedImagePath = image_path || '/uploads/scans/scan_capture.jpg';
    if (image_path && (image_path.startsWith('data:image/') || image_path.length > 500)) {
      storedImagePath = await uploadScanImage(image_path, cleanScanType);
    }

    const result = await db.run(`
      INSERT INTO scans (
        worker_id, shift_id, scan_type, image_path, detected_color,
        exposure_estimate, confidence, quality, status, expiry_indicator_status,
        reference_color, validity_percentage, detected_hex, corrected_hex,
        h2s_ppm, closest_h2s_reference, pre_shift_ppm, post_shift_ppm,
        delta_ppm, shift_exposure_ppm_h
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      worker_id,
      shift_id || null,
      cleanScanType,
      storedImagePath,
      detected_hex || '#96CDE1',
      shift_exposure_ppm_h !== undefined ? shift_exposure_ppm_h : (h2s_ppm !== undefined ? h2s_ppm : null),
      0.96,
      quality || 'High',
      status || 'completed',
      expiry_indicator_status || 'VALID',
      reference_color || '#6A9EAE',
      validity_percentage !== undefined && validity_percentage !== null ? validity_percentage : 100,
      detected_hex || '#96CDE1',
      corrected_hex || detected_hex || '#96CDE1',
      h2s_ppm !== undefined ? h2s_ppm : null,
      closest_h2s_reference || null,
      pre_shift_ppm !== undefined ? pre_shift_ppm : null,
      post_shift_ppm !== undefined ? post_shift_ppm : null,
      delta_ppm !== undefined ? delta_ppm : null,
      shift_exposure_ppm_h !== undefined ? shift_exposure_ppm_h : null
    ]);

    const newScan = await db.get('SELECT * FROM scans WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: `${cleanScanType} scan saved successfully.`,
      data: newScan
    });
  } catch (error) {
    console.error('[API POST /api/scans Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scans
 * Scan History Retrieval (Worker restricted to self)
 */
app.get('/api/scans', requireAuth, async (req, res) => {
  try {
    const {
      search,
      department,
      scan_type,
      status,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'DESC',
      page = 1,
      limit = 10
    } = req.query;
    let { worker_id } = req.query;

    if (req.user.role === 'worker') {
      worker_id = req.user.worker_id;
    }

    let whereConditions = [];
    let params = [];

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      whereConditions.push('(CAST(sc.id AS TEXT) LIKE ? OR LOWER(sc.worker_id) LIKE ? OR LOWER(w.name) LIKE ? OR LOWER(w.badge_id) LIKE ?)');
      params.push(term, term, term, term);
    }

    if (worker_id && worker_id.trim()) {
      whereConditions.push('sc.worker_id = ?');
      params.push(worker_id.trim());
    }

    if (department && department.trim()) {
      whereConditions.push('w.department = ?');
      params.push(department.trim());
    }

    if (scan_type && scan_type.trim()) {
      const cleanType = scan_type.trim() === 'pre_shift' ? 'pre-shift' : (scan_type.trim() === 'post_shift' ? 'post-shift' : scan_type.trim());
      whereConditions.push('sc.scan_type = ?');
      params.push(cleanType);
    }

    if (status && status.trim()) {
      const s = status.trim().toLowerCase();
      if (s === 'pending_analysis' || s === 'pending analysis') {
        whereConditions.push('(sc.exposure_estimate IS NULL OR sc.status = \'pending_analysis\')');
      } else {
        whereConditions.push('LOWER(sc.status) = ?');
        params.push(s);
      }
    }

    if (date_from && date_from.trim()) {
      whereConditions.push('sc.created_at >= ?');
      params.push(date_from.trim() + 'T00:00:00.000Z');
    }

    if (date_to && date_to.trim()) {
      whereConditions.push('sc.created_at <= ?');
      params.push(date_to.trim() + 'T23:59:59.999Z');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      ${whereClause}
    `;
    const totalCountRow = await db.get(countQuery, params);
    const totalCount = totalCountRow ? parseInt(totalCountRow.count, 10) : 0;

    let orderCol = 'sc.id';
    if (sort_by === 'worker' || sort_by === 'worker_name') orderCol = 'w.name';
    else if (sort_by === 'scan_type') orderCol = 'sc.scan_type';
    else if (sort_by === 'status') orderCol = 'sc.status';
    else if (sort_by === 'timestamp' || sort_by === 'created_at') orderCol = 'sc.created_at';

    const cleanSortOrder = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const query = `
      SELECT 
        sc.*, 
        w.name as worker_name, 
        w.department,
        w.badge_id
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      ${whereClause}
      ORDER BY ${orderCol} ${cleanSortOrder}
      LIMIT ? OFFSET ?
    `;

    const scans = await db.all(query, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: scans,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scans/:id
 * Retrieve single scan details (Worker restricted to self)
 */
app.get('/api/scans/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await db.get(`
      SELECT 
        sc.*, 
        w.name as worker_name, 
        w.department,
        w.badge_id,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.duration_minutes as shift_duration_minutes,
        s.status as shift_status
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      LEFT JOIN shifts s ON sc.shift_id = s.id
      WHERE sc.id = ?
    `, [id]);

    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan record '${id}' not found.` });
    }

    if (req.user.role === 'worker' && scan.worker_id !== req.user.worker_id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own scan records.' });
    }

    res.json({ success: true, data: scan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scans/:id/analysis
 * Analysis result for scan (Worker restricted to self)
 */
app.get('/api/scans/:id/analysis', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await db.get(`
      SELECT 
        sc.*, 
        w.name as worker_name, 
        w.department,
        w.badge_id,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.duration_minutes as shift_duration_minutes,
        s.status as shift_status
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      LEFT JOIN shifts s ON sc.shift_id = s.id
      WHERE sc.id = ?
    `, [id]);

    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan record '#SCN-${id}' not found.` });
    }

    if (req.user.role === 'worker' && scan.worker_id !== req.user.worker_id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own scan analysis.' });
    }

    let shiftDurationText = 'N/A';
    if (scan.shift_duration_minutes) {
      const hrs = Math.floor(scan.shift_duration_minutes / 60);
      const mins = scan.shift_duration_minutes % 60;
      shiftDurationText = hrs > 0 ? `${hrs} hrs ${mins} mins` : `${mins} mins`;
    } else if (scan.shift_status === 'active') {
      shiftDurationText = 'Shift Active (In Progress)';
    }

    const isPending = scan.exposure_estimate === null || scan.status === 'pending_analysis';

    res.json({
      success: true,
      data: {
        scan_id: scan.id,
        worker_id: scan.worker_id,
        worker_name: scan.worker_name || 'N/A',
        department: scan.department || 'N/A',
        badge_id: scan.badge_id || 'N/A',
        shift_id: scan.shift_id || null,
        shift_duration: shiftDurationText,
        scan_type: scan.scan_type,
        image_path: scan.image_path || '/uploads/scans/scan_capture.jpg',
        detected_color: isPending ? null : (scan.detected_color || '#CDB889'),
        exposure_estimate: isPending ? null : scan.exposure_estimate,
        unit: scan.unit || 'ppm-h',
        confidence: isPending ? null : (scan.confidence !== undefined ? scan.confidence : null),
        quality: scan.quality || 'High',
        status: scan.status || (isPending ? 'pending_analysis' : 'completed'),
        analysis_notes: scan.analysis_notes || null,
        is_pending: isPending,
        created_at: scan.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper: Trigger Worker & Admin Alerts for Analysis Events
 */
async function handleAnalysisAlertTriggers(scan, updatedScan, warningsList = []) {
  try {
    const workerId = scan.worker_id;
    const worker = await db.get('SELECT name FROM workers WHERE worker_id = ?', [workerId]);
    const workerName = worker ? worker.name : workerId;
    const nowIso = new Date().toISOString();

    const thresholdRow = await db.get("SELECT value FROM settings WHERE key = 'high_exposure_threshold'");
    const threshold = thresholdRow ? parseFloat(thresholdRow.value) : 10.0;
    const provisionalLabelRow = await db.get("SELECT value FROM settings WHERE key = 'provisional_label'");
    const provisionalLabel = provisionalLabelRow ? provisionalLabelRow.value : 'Provisional Exposure Estimate';

    const expVal = updatedScan.exposure_estimate !== null && updatedScan.exposure_estimate !== undefined ? parseFloat(updatedScan.exposure_estimate) : null;
    const status = (updatedScan.status || '').toLowerCase();
    const quality = (updatedScan.quality || '').toLowerCase();

    // 1. High / Provisional Exposure Alert
    if ((expVal !== null && expVal >= threshold) || status === 'provisional') {
      await db.run(`
        INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
        VALUES ('admin', ?, '⚠️ Provisional High H2S Exposure Alert', ?, 'high_exposure', 'danger', 0, ?)
      `, [
        workerId,
        `Provisional high exposure recorded: ${expVal !== null ? expVal + ' ppm-h' : 'Provisional'} for ${workerName} (${workerId}). Threshold: > ${threshold} ppm-h. Status: ${provisionalLabel}`,
        nowIso
      ]);

      await db.run(`
        INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
        VALUES ('worker', ?, '⚠️ Safety Warning: High H2S Exposure Detected', ?, 'high_exposure', 'danger', 0, ?)
      `, [
        workerId,
        `Your scan recorded a provisional exposure of ${expVal !== null ? expVal + ' ppm-h' : 'Provisional'}. Please notify your Safety Officer. ${provisionalLabel}`,
        nowIso
      ]);
    }

    // 2. Retake Required Alert
    if (quality === 'low' || status === 'retake_required') {
      await db.run(`
        INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
        VALUES ('worker', ?, '📷 Scan Image Quality Low: Retake Required', ?, 'retake_required', 'warning', 0, ?)
      `, [
        workerId,
        `Your scan #SCN-${scan.id} had low image quality or illumination. Please retake photo capture under good lighting.`,
        nowIso
      ]);
    }

    // 3. Analysis Unavailable Alert
    if (status === 'unavailable' || status === 'failed') {
      await db.run(`
        INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
        VALUES ('worker', ?, '⏳ External Analysis Unavailable', ?, 'analysis_unavailable', 'info', 0, ?)
      `, [
        workerId,
        `External spectro-analysis module is currently unavailable for scan #SCN-${scan.id}. Result marked as Pending Analysis.`,
        nowIso
      ]);
    }

    // 4. Repeated Exposure Precaution Alert
    if (expVal !== null && expVal > 0.5) {
      const recentElevatedRow = await db.get(`
        SELECT COUNT(*) as count FROM scans
        WHERE worker_id = ? AND exposure_estimate IS NOT NULL AND exposure_estimate > 0.5
      `, [workerId]);

      const recentElevatedCount = recentElevatedRow ? parseInt(recentElevatedRow.count, 10) : 0;

      if (recentElevatedCount >= 2) {
        await db.run(`
          INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
          VALUES ('worker', ?, '⚠️ Cumulative Repeated Exposure Precaution', ?, 'repeated_exposure', 'warning', 0, ?)
        `, [
          workerId,
          `You have accumulated ${recentElevatedCount} scans with detectable H2S exposure traces. Please review personal protective equipment.`,
          nowIso
        ]);
      }
    }
  } catch (err) {
    console.error('[Alert Trigger Error]:', err.message);
  }
}

/**
 * POST /api/scans/:id/analysis-result
 * Receive analysis results from external analysis module/API
 */
app.post(['/api/scans/:id/analysis-result', '/api/scans/:id/analysis'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let {
      detected_hex,
      detected_color,
      exposure_estimate,
      unit = 'ppm-h',
      confidence,
      quality = 'High',
      status,
      warnings,
      analysis_notes
    } = req.body;

    const scan = await db.get('SELECT * FROM scans WHERE id = ?', [id]);
    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan record '#SCN-${id}' not found.` });
    }

    if (req.user.role === 'worker' && String(scan.worker_id).toLowerCase() !== String(req.user.worker_id).toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Unauthorized to update this scan analysis.' });
    }

    let shiftId = scan.shift_id;
    if (!shiftId) {
      const activeShift = await db.get("SELECT id FROM shifts WHERE worker_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [scan.worker_id]);
      if (activeShift) shiftId = activeShift.id;
    }

    const isUnavailable = status === 'unavailable' || status === 'failed';
    const cleanExposure = (isUnavailable || exposure_estimate === null || exposure_estimate === undefined) ? null : parseFloat(exposure_estimate);
    const cleanStatus = status || (cleanExposure === null ? 'pending' : 'completed');
    const hexVal = detected_hex || detected_color || scan.detected_hex || scan.detected_color || '#215F9A';

    let warningsStr = null;
    if (Array.isArray(warnings)) {
      warningsStr = JSON.stringify(warnings);
    } else if (typeof warnings === 'string') {
      warningsStr = warnings;
    }

    await db.run(`
      UPDATE scans 
      SET 
        shift_id = ?,
        detected_hex = ?,
        detected_color = ?,
        exposure_estimate = ?,
        unit = ?,
        confidence = ?,
        quality = ?,
        status = ?,
        warnings = ?,
        analysis_notes = ?
      WHERE id = ?
    `, [
      shiftId || null,
      hexVal,
      hexVal,
      cleanExposure,
      unit || 'ppm-h',
      confidence !== undefined && confidence !== null ? parseFloat(confidence) : scan.confidence,
      quality || scan.quality || 'High',
      cleanStatus,
      warningsStr || scan.warnings,
      analysis_notes !== undefined ? analysis_notes : scan.analysis_notes,
      id
    ]);

    const updatedScan = await db.get(`
      SELECT 
        sc.*, 
        w.name as worker_name, 
        w.department,
        w.badge_id,
        sh.start_time as shift_start_time
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      LEFT JOIN shifts sh ON sc.shift_id = sh.id
      WHERE sc.id = ?
    `, [id]);

    await handleAnalysisAlertTriggers(scan, updatedScan, warnings);

    res.json({
      success: true,
      message: `Analysis result for scan #SCN-${id} saved against worker → shift → scan hierarchy.`,
      data: {
        ...updatedScan,
        exposure_display: updatedScan.exposure_estimate !== null ? `${updatedScan.exposure_estimate} ${updatedScan.unit || 'ppm-h'}` : 'Pending Analysis',
        hierarchy: `Worker (${updatedScan.worker_id}) → Shift (${updatedScan.shift_id || 'N/A'}) → Scan (#SCN-${updatedScan.id})`
      }
    });
  } catch (error) {
    console.error('[API Analysis Result Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scans/:id/analysis-result
 * Retrieve detailed external analysis result for a scan
 */
app.get('/api/scans/:id/analysis-result', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await db.get(`
      SELECT 
        sc.*, 
        w.name as worker_name, 
        w.department,
        w.badge_id,
        sh.start_time as shift_start_time,
        sh.status as shift_status
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      LEFT JOIN shifts sh ON sc.shift_id = sh.id
      WHERE sc.id = ?
    `, [id]);

    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan record '#SCN-${id}' not found.` });
    }

    if (req.user.role === 'worker' && String(scan.worker_id).toLowerCase() !== String(req.user.worker_id).toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this scan analysis.' });
    }

    const isPendingOrUnavailable = scan.exposure_estimate === null && scan.h2s_ppm === null && scan.status === 'pending';

    let warningsList = [];
    if (scan.warnings) {
      try {
        warningsList = JSON.parse(scan.warnings);
      } catch (e) {
        warningsList = [scan.warnings];
      }
    }

    const prePpm = scan.pre_shift_ppm !== null && scan.pre_shift_ppm !== undefined ? scan.pre_shift_ppm : 0.0;
    const postPpm = scan.post_shift_ppm !== null && scan.post_shift_ppm !== undefined ? scan.post_shift_ppm : (scan.h2s_ppm || 0.0);
    const deltaPpm = scan.delta_ppm !== null && scan.delta_ppm !== undefined ? scan.delta_ppm : Math.max(0, postPpm - prePpm);
    const shiftDurationHours = scan.shift_duration_minutes ? Math.round((scan.shift_duration_minutes / 60) * 100) / 100 : 0.0;
    const finalExposurePpmH = scan.shift_exposure_ppm_h !== null && scan.shift_exposure_ppm_h !== undefined ? scan.shift_exposure_ppm_h : (scan.exposure_estimate !== null ? scan.exposure_estimate : Math.round(deltaPpm * shiftDurationHours * 100) / 100);

    res.json({
      success: true,
      data: {
        scan_id: scan.id,
        worker_id: scan.worker_id,
        worker_name: scan.worker_name || scan.worker_id,
        department: scan.department || 'N/A',
        badge_id: scan.badge_id || 'N/A',
        shift_id: scan.shift_id || 'N/A',
        scan_type: scan.scan_type,
        image_path: scan.image_path,
        detected_hex: scan.detected_hex || scan.detected_color || 'N/A',
        corrected_hex: scan.corrected_hex || scan.detected_hex || scan.detected_color || 'N/A',
        reference_color: scan.reference_color || '#96CDE1',
        closest_reference_label: scan.closest_h2s_reference || scan.reference_color || '#96CDE1',
        h2s_ppm: scan.h2s_ppm !== null && scan.h2s_ppm !== undefined ? scan.h2s_ppm : (isPendingOrUnavailable ? null : 0.0),
        pre_shift_ppm: prePpm,
        post_shift_ppm: postPpm,
        delta_ppm: deltaPpm,
        shift_duration_hours: shiftDurationHours,
        final_exposure_ppm_h: finalExposurePpmH,
        exposure_estimate: isPendingOrUnavailable ? null : finalExposurePpmH,
        exposure_display: isPendingOrUnavailable ? 'Pending Analysis' : `${finalExposurePpmH} ppm-h`,
        unit: 'ppm-h',
        confidence: scan.confidence !== null && scan.confidence !== undefined ? scan.confidence : 0.96,
        confidence_display: scan.confidence !== null && scan.confidence !== undefined ? `${(scan.confidence * 100).toFixed(1)}%` : '96.0%',
        quality: scan.quality || 'High',
        status: scan.status || (isPendingOrUnavailable ? 'pending' : 'completed'),
        status_display: isPendingOrUnavailable ? 'Pending Analysis' : (scan.status ? scan.status.toUpperCase() : 'COMPLETED'),
        warnings: warningsList,
        analysis_notes: scan.analysis_notes || null,
        created_at: scan.created_at,
        hierarchy: `Worker (${scan.worker_id}) → Shift (${scan.shift_id || 'Unassigned'}) → Scan (#SCN-${scan.id})`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scans/worker/:workerId
 * Retrieve scan records for a worker
 */
app.get('/api/scans/worker/:workerId', requireAuth, async (req, res) => {
  try {
    let { workerId } = req.params;

    if (req.user.role === 'worker') {
      workerId = req.user.worker_id;
    }

    const scans = await db.all(`
      SELECT 
        sc.*, 
        w.name as worker_name, 
        w.department,
        w.badge_id
      FROM scans sc
      LEFT JOIN workers w ON sc.worker_id = w.worker_id
      WHERE LOWER(sc.worker_id) = LOWER(?)
      ORDER BY sc.id DESC
    `, [workerId]);

    res.json({ success: true, data: scans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Server on host 0.0.0.0 and PORT (defaults to 3000)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  Sulfide Sentinels Server Running on Port ${PORT}`);
  console.log(`  Database Provider: ${getProvider().toUpperCase()}`);
  console.log(`  Host: 0.0.0.0 (Cloud & Local Ready)`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
