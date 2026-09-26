const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'sulfide_sentinels.db');

// Initialize SQLite database instance
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

// Enable Write-Ahead Logging (WAL) for performance & concurrency
db.pragma('journal_mode = WAL');

const crypto = require('crypto');

/**
 * Crypto Helper Functions for Password Hashing & Token Generation
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Initialize Tables Safely
 */
function initSchema() {
  // Workers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      badge_id TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration check: add status column to workers if it was created in previous stage without status
  try {
    db.exec(`ALTER TABLE workers ADD COLUMN status TEXT DEFAULT 'active';`);
  } catch (err) {
    // Column already exists
  }

  // Badges Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      badge_id TEXT UNIQUE NOT NULL,
      manufacture_date TEXT,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Shifts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      duration_minutes INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Scans Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT NOT NULL,
      shift_id INTEGER,
      scan_type TEXT NOT NULL,
      image_path TEXT,
      detected_color TEXT,
      exposure_estimate REAL,
      confidence REAL,
      quality TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration check: add unit and analysis_notes columns to scans if missing
  try {
    db.exec(`ALTER TABLE scans ADD COLUMN unit TEXT DEFAULT 'ppm-h';`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE scans ADD COLUMN analysis_notes TEXT;`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE scans ADD COLUMN expiry_indicator_status TEXT DEFAULT 'VALID';`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE scans ADD COLUMN reference_color TEXT;`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE scans ADD COLUMN validity_percentage REAL;`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE scans ADD COLUMN detected_hex TEXT;`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE scans ADD COLUMN warnings TEXT;`);
  } catch (err) {}

  try { db.exec(`ALTER TABLE scans ADD COLUMN corrected_hex TEXT;`); } catch (err) {}
  try { db.exec(`ALTER TABLE scans ADD COLUMN h2s_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE scans ADD COLUMN pre_shift_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE scans ADD COLUMN post_shift_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE scans ADD COLUMN delta_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE scans ADD COLUMN shift_exposure_ppm_h REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE scans ADD COLUMN closest_h2s_reference TEXT;`); } catch (err) {}

  try { db.exec(`ALTER TABLE shifts ADD COLUMN pre_shift_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE shifts ADD COLUMN post_shift_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE shifts ADD COLUMN delta_ppm REAL;`); } catch (err) {}
  try { db.exec(`ALTER TABLE shifts ADD COLUMN final_exposure_ppm_h REAL;`); } catch (err) {}

  // Users Table (Role-based authentication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'worker')),
      worker_id TEXT UNIQUE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Server-side Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      worker_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Alerts & Notifications Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_role TEXT DEFAULT 'worker',
      worker_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('danger', 'warning', 'info')),
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Configurable System Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedInitialData();
}

/**
 * Seed Initial Demo Data if Tables are Empty
 */
function seedInitialData() {
  const workerCount = db.prepare('SELECT COUNT(*) as count FROM workers').get().count;

  if (workerCount === 0) {
    console.log('[Database] Seeding initial demo data into SQLite...');

    // Seed Badges
    const insertBadge = db.prepare(`
      INSERT INTO badges (badge_id, manufacture_date, expiry_date, status)
      VALUES (?, ?, ?, ?)
    `);

    insertBadge.run('BDG-1001', '2026-01-10', '2027-01-10', 'active');
    insertBadge.run('BDG-1002', '2026-01-15', '2027-01-15', 'active');
    insertBadge.run('BDG-1003', '2026-02-01', '2027-02-01', 'active');
    insertBadge.run('BDG-1004', '2025-01-01', '2026-01-01', 'expired');

    // Seed Workers
    const insertWorker = db.prepare(`
      INSERT INTO workers (worker_id, name, department, badge_id, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    insertWorker.run('W-101', 'John Doe', 'Refining & Processing', 'BDG-1001');
    insertWorker.run('W-102', 'Jane Smith', 'Pipeline Inspection', 'BDG-1002');
    insertWorker.run('W-103', 'Robert Chen', 'Safety Compliance', 'BDG-1003');
    insertWorker.run('W-104', 'Maria Garcia', 'Drilling Operations', 'BDG-1004');

    // Seed Active Shifts
    const insertShift = db.prepare(`
      INSERT INTO shifts (worker_id, badge_id, start_time, status)
      VALUES (?, ?, ?, ?)
    `);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    insertShift.run('W-101', 'BDG-1001', twoHoursAgo, 'active');
    insertShift.run('W-102', 'BDG-1002', fourHoursAgo, 'active');

    // Seed Scans
    const insertScan = db.prepare(`
      INSERT INTO scans (worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate, confidence, quality, status, detected_hex, expiry_indicator_status, validity_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertScan.run('W-101', 1, 'pre-shift', '/uploads/scans/sample_preshift_1.jpg', '#215F9A', null, 0.98, 'High', 'pending', '#215F9A', 'VALID', 100);
    insertScan.run('W-102', 2, 'pre-shift', '/uploads/scans/sample_preshift_2.jpg', '#215F9A', null, 0.96, 'High', 'pending', '#215F9A', 'VALID', 100);
    insertScan.run('W-103', null, 'post-shift', '/uploads/scans/sample_postshift_3.jpg', '#8B7355', 3.8, 0.91, 'Medium', 'completed', '#8B7355', 'VALID', 85);

    console.log('[Database] Demo data seeded successfully.');
  }

  // Seed Default Configurable Settings
  const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('high_exposure_threshold', '10.0');
    insertSetting.run('provisional_label', 'Provisional Exposure Estimate (Pending Laboratory/Algorithm Validation)');
    insertSetting.run('shift_max_hours', '12');
  }

  // Seed Admin & Worker Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('[Database] Seeding initial role-based users with secure hashed credentials...');
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, worker_id, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Admin Account (Safety Officer)
    const adminCreds = hashPassword('Admin@Safety2026!');
    insertUser.run('admin', adminCreds.hash, adminCreds.salt, 'admin', null, 'Safety Officer');

    // Worker Accounts (Linked to Workers with unique salt-hashed PINs)
    const workers = db.prepare('SELECT worker_id, name FROM workers').all();
    workers.forEach(w => {
      // Non-predictable salt-hashed password for workers
      const pin = `${w.worker_id.replace(/[^0-9]/g, '') || '101'}89!pass`;
      const workerCreds = hashPassword(pin);
      insertUser.run(w.worker_id.toLowerCase(), workerCreds.hash, workerCreds.salt, 'worker', w.worker_id, w.name);
    });

    console.log('[Database] Users seeded successfully.');
  }

  // Seed Initial Alerts if empty
  const alertCount = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;
  if (alertCount === 0) {
    const insertAlert = db.prepare(`
      INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowIso = new Date().toISOString();
    // 1. Invalid Badge Alert
    insertAlert.run('admin', null, '🔴 Invalid Physical Badge Flagged', 'Worker Maria Garcia (W-104) badge BDG-1004 is expired. Physical scan required.', 'invalid_badge', 'danger', 0, nowIso);
    insertAlert.run('worker', 'W-104', '🔴 Physical Badge Expiry Notice', 'Your badge BDG-1004 has failed physical expiry indicator scan. Contact safety officer for replacement.', 'invalid_badge', 'danger', 0, nowIso);

    // 2. High/Provisional Exposure Alert
    insertAlert.run('worker', 'W-101', '⚠️ Provisional High H2S Exposure Alert', 'Post-shift scan recorded a provisional exposure of 11.2 ppm-h exceeding threshold (10.0 ppm-h).', 'high_exposure', 'danger', 0, nowIso);

    // 3. Retake Required Alert
    insertAlert.run('worker', 'W-102', '📷 Scan Quality Warning: Retake Required', 'Your pre-shift image capture had inadequate illumination. Please retake photo.', 'retake_required', 'warning', 0, nowIso);

    // 4. Analysis Unavailable Alert
    insertAlert.run('worker', 'W-101', '⏳ Analysis Result Pending', 'External analysis module is processing your badge scan #SCN-1. Status: Pending Analysis.', 'analysis_unavailable', 'info', 0, nowIso);

    // 5. Repeated Exposure Alert
    insertAlert.run('worker', 'W-103', '⚠️ Cumulative Exposure Precaution', 'Worker W-103 recorded 2 consecutive shifts with detectable H2S exposure traces.', 'repeated_exposure', 'warning', 0, nowIso);

    // 6. Shift Issue Alert
    insertAlert.run('worker', 'W-101', 'ℹ️ Shift Active Notice', 'Your pre-shift scan was verified for BDG-1001. Shift currently active.', 'shift_issue', 'info', 0, nowIso);
  }
}

// Execute schema initialization
initSchema();

console.log(`[Database] SQLite database initialized successfully at: ${dbPath}`);

module.exports = {
  db,
  hashPassword,
  verifyPassword,
  generateRandomToken
};

