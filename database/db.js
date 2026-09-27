require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const SqliteAdapter = require('./sqliteAdapter');
const PostgresAdapter = require('./postgresAdapter');

// Determine Database Provider ('sqlite' | 'postgres')
const dbProvider = (process.env.DB_PROVIDER || (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();

let dbInstance = null;

if (dbProvider === 'postgres' && process.env.DATABASE_URL) {
  console.log('[Database] Initializing PostgreSQL Adapter for Supabase / Cloud Postgres...');
  dbInstance = new PostgresAdapter(process.env.DATABASE_URL);
} else {
  console.log('[Database] Initializing SQLite Adapter for Local Offline Development...');
  const dbPath = path.join(__dirname, 'sulfide_sentinels.db');
  dbInstance = new SqliteAdapter(dbPath);
}

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
 * Initialize Tables & Migrations
 */
async function initSchema() {
  try {
    if (dbProvider === 'postgres') {
      // 1. Workers Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS workers (
          id SERIAL PRIMARY KEY,
          worker_id VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          department VARCHAR(255),
          badge_id VARCHAR(100),
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Badges Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS badges (
          id SERIAL PRIMARY KEY,
          badge_id VARCHAR(100) UNIQUE NOT NULL,
          manufacture_date VARCHAR(50),
          expiry_date VARCHAR(50),
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Shifts Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
          id SERIAL PRIMARY KEY,
          worker_id VARCHAR(100) NOT NULL,
          badge_id VARCHAR(100) NOT NULL,
          start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP WITH TIME ZONE,
          duration_minutes INTEGER,
          status VARCHAR(50) DEFAULT 'active',
          pre_shift_ppm NUMERIC(10, 2),
          post_shift_ppm NUMERIC(10, 2),
          delta_ppm NUMERIC(10, 2),
          final_exposure_ppm_h NUMERIC(10, 2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Scans Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS scans (
          id SERIAL PRIMARY KEY,
          worker_id VARCHAR(100) NOT NULL,
          shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
          scan_type VARCHAR(50) NOT NULL,
          image_path TEXT,
          detected_color VARCHAR(50),
          exposure_estimate NUMERIC(10, 2),
          unit VARCHAR(50) DEFAULT 'ppm-h',
          confidence NUMERIC(5, 4),
          quality VARCHAR(50),
          status VARCHAR(50) DEFAULT 'completed',
          analysis_notes TEXT,
          expiry_indicator_status VARCHAR(50) DEFAULT 'VALID',
          reference_color VARCHAR(50),
          validity_percentage NUMERIC(5, 2),
          detected_hex VARCHAR(50),
          corrected_hex VARCHAR(50),
          h2s_ppm NUMERIC(10, 2),
          pre_shift_ppm NUMERIC(10, 2),
          post_shift_ppm NUMERIC(10, 2),
          delta_ppm NUMERIC(10, 2),
          shift_exposure_ppm_h NUMERIC(10, 2),
          closest_h2s_reference VARCHAR(100),
          warnings TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Users Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'worker')),
          worker_id VARCHAR(100) UNIQUE,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Sessions Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL,
          worker_id VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `);

      // 7. Alerts Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
          id SERIAL PRIMARY KEY,
          target_role VARCHAR(50) DEFAULT 'worker',
          worker_id VARCHAR(100),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          alert_type VARCHAR(100) NOT NULL,
          severity VARCHAR(50) NOT NULL CHECK(severity IN ('danger', 'warning', 'info')),
          is_read INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. Settings Table
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      // SQLite Mode
      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS workers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          worker_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          department TEXT,
          badge_id TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS badges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          badge_id TEXT UNIQUE NOT NULL,
          manufacture_date TEXT,
          expiry_date TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          worker_id TEXT NOT NULL,
          badge_id TEXT NOT NULL,
          start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_time DATETIME,
          duration_minutes INTEGER,
          status TEXT DEFAULT 'active',
          pre_shift_ppm REAL,
          post_shift_ppm REAL,
          delta_ppm REAL,
          final_exposure_ppm_h REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS scans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          worker_id TEXT NOT NULL,
          shift_id INTEGER,
          scan_type TEXT NOT NULL,
          image_path TEXT,
          detected_color TEXT,
          exposure_estimate REAL,
          unit TEXT DEFAULT 'ppm-h',
          confidence REAL,
          quality TEXT,
          status TEXT DEFAULT 'completed',
          analysis_notes TEXT,
          expiry_indicator_status TEXT DEFAULT 'VALID',
          reference_color TEXT,
          validity_percentage REAL,
          detected_hex TEXT,
          corrected_hex TEXT,
          h2s_ppm REAL,
          pre_shift_ppm REAL,
          post_shift_ppm REAL,
          delta_ppm REAL,
          shift_exposure_ppm_h REAL,
          closest_h2s_reference TEXT,
          warnings TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

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

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          worker_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

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

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      try { await dbInstance.exec(`ALTER TABLE shifts ADD COLUMN pre_shift_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE shifts ADD COLUMN post_shift_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE shifts ADD COLUMN delta_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE shifts ADD COLUMN final_exposure_ppm_h REAL;`); } catch (err) {}

      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN unit TEXT DEFAULT 'ppm-h';`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN analysis_notes TEXT;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN expiry_indicator_status TEXT DEFAULT 'VALID';`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN reference_color TEXT;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN validity_percentage REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN detected_hex TEXT;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN corrected_hex TEXT;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN h2s_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN pre_shift_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN post_shift_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN delta_ppm REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN shift_exposure_ppm_h REAL;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN closest_h2s_reference TEXT;`); } catch (err) {}
      try { await dbInstance.exec(`ALTER TABLE scans ADD COLUMN warnings TEXT;`); } catch (err) {}
    }

    await seedInitialData();
  } catch (err) {
    console.error('[Database Init Error]:', err.message);
  }
}

/**
 * Seed Initial Demo Data if Tables are Empty
 */
async function seedInitialData() {
  try {
    const workerRow = await dbInstance.get('SELECT COUNT(*) as count FROM workers');
    const workerCount = workerRow ? parseInt(workerRow.count, 10) : 0;

    if (workerCount === 0) {
      console.log(`[Database] Seeding initial demo data into ${dbProvider.toUpperCase()}...`);

      // Badges
      await dbInstance.run('INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)', ['BDG-1001', '2026-01-10', '2027-01-10', 'active']);
      await dbInstance.run('INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)', ['BDG-1002', '2026-01-15', '2027-01-15', 'active']);
      await dbInstance.run('INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)', ['BDG-1003', '2026-02-01', '2027-02-01', 'active']);
      await dbInstance.run('INSERT INTO badges (badge_id, manufacture_date, expiry_date, status) VALUES (?, ?, ?, ?)', ['BDG-1004', '2025-01-01', '2026-01-01', 'expired']);

      // Workers
      await dbInstance.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-101', 'John Doe', 'Refining & Processing', 'BDG-1001']);
      await dbInstance.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-102', 'Jane Smith', 'Pipeline Inspection', 'BDG-1002']);
      await dbInstance.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-103', 'Robert Chen', 'Safety Compliance', 'BDG-1003']);
      await dbInstance.run("INSERT INTO workers (worker_id, name, department, badge_id, status) VALUES (?, ?, ?, ?, 'active')", ['W-104', 'Maria Garcia', 'Drilling Operations', 'BDG-1004']);

      // Shifts
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

      await dbInstance.run('INSERT INTO shifts (worker_id, badge_id, start_time, status) VALUES (?, ?, ?, ?)', ['W-101', 'BDG-1001', twoHoursAgo, 'active']);
      await dbInstance.run('INSERT INTO shifts (worker_id, badge_id, start_time, status) VALUES (?, ?, ?, ?)', ['W-102', 'BDG-1002', fourHoursAgo, 'active']);

      // Scans
      await dbInstance.run(
        'INSERT INTO scans (worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate, confidence, quality, status, detected_hex, expiry_indicator_status, validity_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['W-101', 1, 'pre-shift', '/uploads/scans/sample_preshift_1.jpg', '#215F9A', null, 0.98, 'High', 'pending', '#215F9A', 'VALID', 100]
      );
      await dbInstance.run(
        'INSERT INTO scans (worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate, confidence, quality, status, detected_hex, expiry_indicator_status, validity_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['W-102', 2, 'pre-shift', '/uploads/scans/sample_preshift_2.jpg', '#215F9A', null, 0.96, 'High', 'pending', '#215F9A', 'VALID', 100]
      );
      await dbInstance.run(
        'INSERT INTO scans (worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate, confidence, quality, status, detected_hex, expiry_indicator_status, validity_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['W-103', null, 'post-shift', '/uploads/scans/sample_postshift_3.jpg', '#8B7355', 3.8, 0.91, 'Medium', 'completed', '#8B7355', 'VALID', 85]
      );

      console.log(`[Database] Initial demo data seeded successfully into ${dbProvider.toUpperCase()}.`);
    }

    // Configurable Settings
    const settingRow = await dbInstance.get('SELECT COUNT(*) as count FROM settings');
    const settingCount = settingRow ? parseInt(settingRow.count, 10) : 0;
    if (settingCount === 0) {
      await dbInstance.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['high_exposure_threshold', '10.0']);
      await dbInstance.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['provisional_label', 'Provisional Exposure Estimate (Pending Laboratory/Algorithm Validation)']);
      await dbInstance.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['shift_max_hours', '12']);
    }

    // Users
    const userRow = await dbInstance.get('SELECT COUNT(*) as count FROM users');
    const userCount = userRow ? parseInt(userRow.count, 10) : 0;
    if (userCount === 0) {
      console.log(`[Database] Seeding initial role-based users into ${dbProvider.toUpperCase()}...`);
      const adminCreds = hashPassword('Admin@Safety2026!');
      await dbInstance.run('INSERT INTO users (username, password_hash, salt, role, worker_id, name) VALUES (?, ?, ?, ?, ?, ?)', [
        'admin',
        adminCreds.hash,
        adminCreds.salt,
        'admin',
        null,
        'Safety Officer'
      ]);

      const workers = await dbInstance.all('SELECT worker_id, name FROM workers');
      for (const w of workers) {
        const pin = `${w.worker_id.replace(/[^0-9]/g, '') || '101'}89!pass`;
        const workerCreds = hashPassword(pin);
        await dbInstance.run('INSERT INTO users (username, password_hash, salt, role, worker_id, name) VALUES (?, ?, ?, ?, ?, ?)', [
          w.worker_id.toLowerCase(),
          workerCreds.hash,
          workerCreds.salt,
          'worker',
          w.worker_id,
          w.name
        ]);
      }
    }

    // Alerts
    const alertRow = await dbInstance.get('SELECT COUNT(*) as count FROM alerts');
    const alertCount = alertRow ? parseInt(alertRow.count, 10) : 0;
    if (alertCount === 0) {
      const nowIso = new Date().toISOString();
      await dbInstance.run(
        'INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['admin', null, '🔴 Invalid Physical Badge Flagged', 'Worker Maria Garcia (W-104) badge BDG-1004 is expired. Physical scan required.', 'invalid_badge', 'danger', 0, nowIso]
      );
      await dbInstance.run(
        'INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['worker', 'W-104', '🔴 Physical Badge Expiry Notice', 'Your badge BDG-1004 has failed physical expiry indicator scan. Contact safety officer for replacement.', 'invalid_badge', 'danger', 0, nowIso]
      );
      await dbInstance.run(
        'INSERT INTO alerts (target_role, worker_id, title, message, alert_type, severity, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['worker', 'W-101', '⚠️ Provisional High H2S Exposure Alert', 'Post-shift scan recorded a provisional exposure of 11.2 ppm-h exceeding threshold (10.0 ppm-h).', 'high_exposure', 'danger', 0, nowIso]
      );
    }
  } catch (err) {
    console.error('[Database Seed Error]:', err.message);
  }
}

// Execute Schema Init
initSchema();

module.exports = {
  db: dbInstance,
  getProvider: () => dbProvider,
  healthCheck: () => dbInstance.healthCheck(),
  hashPassword,
  verifyPassword,
  generateRandomToken
};
