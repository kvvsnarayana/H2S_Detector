require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

async function runMigration() {
  console.log('===========================================================');
  console.log('  Sulfide Sentinels - SQLite to PostgreSQL Migration Tool');
  console.log('===========================================================');

  // 1. Verify SQLite Database File
  const sqliteDbPath = path.join(__dirname, '..', 'database', 'sulfide_sentinels.db');
  if (!fs.existsSync(sqliteDbPath)) {
    console.error(`❌ SQLite database file not found at: ${sqliteDbPath}`);
    process.exit(1);
  }

  // 2. Create Safety Backup of SQLite Database
  const backupDir = path.join(__dirname, '..', 'database', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestampStr = new Date().toISOString().replace(/[^0-9]/g, '');
  const backupPath = path.join(backupDir, `sulfide_sentinels_backup_${timestampStr}.db`);
  fs.copyFileSync(sqliteDbPath, backupPath);
  console.log(`✅ Step 1: Safety backup created at:\n   ${backupPath}`);

  // 3. Connect to Source SQLite Database
  const sqliteDb = new Database(sqliteDbPath, { readonly: true });
  console.log(`✅ Step 2: Source SQLite database opened successfully.`);

  // 4. Connect to Target PostgreSQL Database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(`❌ DATABASE_URL is missing in .env! Please set DATABASE_URL in .env before running migration.`);
    process.exit(1);
  }

  if (connectionString.includes('[YOUR-PASSWORD]')) {
    console.error(`\n❌ Error: Your .env file contains [YOUR-PASSWORD] inside DATABASE_URL.`);
    console.error(`Please replace [YOUR-PASSWORD] with your actual Supabase database password in .env and rerun this script.\n`);
    process.exit(1);
  }

  const isSslRequired = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
  const pgPool = new Pool({
    connectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : false
  });

  let pgClient;
  try {
    pgClient = await pgPool.connect();
    console.log(`✅ Step 3: Connected to target PostgreSQL database.`);
  } catch (err) {
    console.error(`❌ PostgreSQL Connection Failed: ${err.message}`);
    console.error(`Please verify DATABASE_URL and password in .env.`);
    process.exit(1);
  }

  try {
    // 5. Initialize PostgreSQL Schema if not already present
    console.log(`\n--- Step 4: Ensuring Target PostgreSQL Schema Exists ---`);
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS workers (
        id SERIAL PRIMARY KEY,
        worker_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        badge_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        badge_id VARCHAR(100) UNIQUE NOT NULL,
        manufacture_date VARCHAR(50),
        expiry_date VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`✅ Schema check completed.`);

    // 6. Execute Import Inside Transaction
    console.log(`\n--- Step 5: Executing Transactional Import ---`);
    await pgClient.query('BEGIN');

    // 6a. Migrate Workers
    const sqliteWorkers = sqliteDb.prepare('SELECT * FROM workers').all();
    console.log(`Migrating ${sqliteWorkers.length} worker records...`);
    for (const w of sqliteWorkers) {
      await pgClient.query(`
        INSERT INTO workers (id, worker_id, name, department, badge_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (worker_id) DO UPDATE SET 
          name = EXCLUDED.name, 
          department = EXCLUDED.department, 
          badge_id = EXCLUDED.badge_id, 
          status = EXCLUDED.status
      `, [w.id, w.worker_id, w.name, w.department || null, w.badge_id || null, w.status || 'active', w.created_at || new Date().toISOString()]);
    }

    // 6b. Migrate Badges
    const sqliteBadges = sqliteDb.prepare('SELECT * FROM badges').all();
    console.log(`Migrating ${sqliteBadges.length} badge records...`);
    for (const b of sqliteBadges) {
      await pgClient.query(`
        INSERT INTO badges (id, badge_id, manufacture_date, expiry_date, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (badge_id) DO UPDATE SET 
          manufacture_date = EXCLUDED.manufacture_date, 
          expiry_date = EXCLUDED.expiry_date, 
          status = EXCLUDED.status
      `, [b.id, b.badge_id, b.manufacture_date || null, b.expiry_date || null, b.status || 'active', b.created_at || new Date().toISOString()]);
    }

    // 6c. Migrate Shifts
    const sqliteShifts = sqliteDb.prepare('SELECT * FROM shifts').all();
    console.log(`Migrating ${sqliteShifts.length} shift records...`);
    for (const s of sqliteShifts) {
      await pgClient.query(`
        INSERT INTO shifts (id, worker_id, badge_id, start_time, end_time, duration_minutes, status, pre_shift_ppm, post_shift_ppm, delta_ppm, final_exposure_ppm_h, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET 
          end_time = EXCLUDED.end_time, 
          duration_minutes = EXCLUDED.duration_minutes, 
          status = EXCLUDED.status,
          pre_shift_ppm = EXCLUDED.pre_shift_ppm,
          post_shift_ppm = EXCLUDED.post_shift_ppm,
          delta_ppm = EXCLUDED.delta_ppm,
          final_exposure_ppm_h = EXCLUDED.final_exposure_ppm_h
      `, [
        s.id, s.worker_id, s.badge_id, s.start_time, s.end_time || null, 
        s.duration_minutes !== undefined ? s.duration_minutes : null, 
        s.status || 'active', s.pre_shift_ppm !== undefined ? s.pre_shift_ppm : null, 
        s.post_shift_ppm !== undefined ? s.post_shift_ppm : null, 
        s.delta_ppm !== undefined ? s.delta_ppm : null, 
        s.final_exposure_ppm_h !== undefined ? s.final_exposure_ppm_h : null, 
        s.created_at || new Date().toISOString()
      ]);
    }

    // 6d. Migrate Scans
    const sqliteScans = sqliteDb.prepare('SELECT * FROM scans').all();
    console.log(`Migrating ${sqliteScans.length} scan records...`);
    for (const sc of sqliteScans) {
      await pgClient.query(`
        INSERT INTO scans (
          id, worker_id, shift_id, scan_type, image_path, detected_color, exposure_estimate,
          unit, confidence, quality, status, analysis_notes, expiry_indicator_status,
          reference_color, validity_percentage, detected_hex, corrected_hex, h2s_ppm,
          pre_shift_ppm, post_shift_ppm, delta_ppm, shift_exposure_ppm_h, closest_h2s_reference, warnings, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        ON CONFLICT (id) DO UPDATE SET 
          exposure_estimate = EXCLUDED.exposure_estimate,
          status = EXCLUDED.status,
          h2s_ppm = EXCLUDED.h2s_ppm
      `, [
        sc.id, sc.worker_id, sc.shift_id || null, sc.scan_type, sc.image_path || null,
        sc.detected_color || null, sc.exposure_estimate !== undefined ? sc.exposure_estimate : null,
        sc.unit || 'ppm-h', sc.confidence !== undefined ? sc.confidence : null,
        sc.quality || 'High', sc.status || 'completed', sc.analysis_notes || null,
        sc.expiry_indicator_status || 'VALID', sc.reference_color || null,
        sc.validity_percentage !== undefined ? sc.validity_percentage : null,
        sc.detected_hex || null, sc.corrected_hex || null, sc.h2s_ppm !== undefined ? sc.h2s_ppm : null,
        sc.pre_shift_ppm !== undefined ? sc.pre_shift_ppm : null, sc.post_shift_ppm !== undefined ? sc.post_shift_ppm : null,
        sc.delta_ppm !== undefined ? sc.delta_ppm : null, sc.shift_exposure_ppm_h !== undefined ? sc.shift_exposure_ppm_h : null,
        sc.closest_h2s_reference || null, sc.warnings || null, sc.created_at || new Date().toISOString()
      ]);
    }

    // 6e. Migrate Users
    const sqliteUsers = sqliteDb.prepare('SELECT * FROM users').all();
    console.log(`Migrating ${sqliteUsers.length} user account records...`);
    for (const u of sqliteUsers) {
      await pgClient.query(`
        INSERT INTO users (id, username, password_hash, salt, role, worker_id, name, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (username) DO UPDATE SET 
          password_hash = EXCLUDED.password_hash, 
          salt = EXCLUDED.salt, 
          role = EXCLUDED.role, 
          name = EXCLUDED.name
      `, [u.id, u.username, u.password_hash, u.salt, u.role, u.worker_id || null, u.name, u.created_at || new Date().toISOString()]);
    }

    // 6f. Migrate Alerts
    const sqliteAlerts = sqliteDb.prepare('SELECT * FROM alerts').all();
    console.log(`Migrating ${sqliteAlerts.length} alert records...`);
    for (const a of sqliteAlerts) {
      await pgClient.query(`
        INSERT INTO alerts (id, target_role, worker_id, title, message, alert_type, severity, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET 
          is_read = EXCLUDED.is_read
      `, [a.id, a.target_role || 'worker', a.worker_id || null, a.title, a.message, a.alert_type, a.severity, a.is_read || 0, a.created_at || new Date().toISOString()]);
    }

    // 6g. Migrate Settings
    const sqliteSettings = sqliteDb.prepare('SELECT * FROM settings').all();
    console.log(`Migrating ${sqliteSettings.length} system setting records...`);
    for (const st of sqliteSettings) {
      await pgClient.query(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value, 
          updated_at = EXCLUDED.updated_at
      `, [st.key, st.value, st.updated_at || new Date().toISOString()]);
    }

    // 7. Reset PostgreSQL Primary Key Sequences
    console.log(`\n--- Step 6: Updating PostgreSQL Auto-Increment Sequences ---`);
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('workers', 'id'), COALESCE((SELECT MAX(id) FROM workers), 1));`);
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('badges', 'id'), COALESCE((SELECT MAX(id) FROM badges), 1));`);
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('shifts', 'id'), COALESCE((SELECT MAX(id) FROM shifts), 1));`);
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('scans', 'id'), COALESCE((SELECT MAX(id) FROM scans), 1));`);
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));`);
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('alerts', 'id'), COALESCE((SELECT MAX(id) FROM alerts), 1));`);
    console.log(`✅ Sequences updated successfully.`);

    await pgClient.query('COMMIT');
    console.log(`\n🎉 TRANSACTION COMMITTED SUCCESSFULLY!`);

    // 8. Row Count Comparison & Summary Verification
    console.log(`\n===========================================================`);
    console.log(`  ROW COUNT COMPARISON SUMMARY (SQLite vs PostgreSQL)`);
    console.log(`===========================================================`);

    const tablesToCompare = ['workers', 'badges', 'shifts', 'scans', 'users', 'alerts', 'settings'];
    let mismatchCount = 0;

    for (const tableName of tablesToCompare) {
      const sqliteCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
      const pgRes = await pgClient.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const pgCount = parseInt(pgRes.rows[0].count, 10);

      const isMatch = sqliteCount === pgCount;
      if (!isMatch) mismatchCount++;

      const statusSymbol = isMatch ? '✅' : '❌ MISMATCH';
      console.log(`  ${statusSymbol} ${tableName.toUpperCase().padEnd(12)} | SQLite: ${String(sqliteCount).padStart(4)} | Postgres: ${String(pgCount).padStart(4)}`);
    }

    console.log(`===========================================================`);
    console.log(`  Excluded Tables (By Requirement):`);
    console.log(`  - sessions (Server-side sessions re-authenticate on login)`);
    console.log(`  - temporary files / cache`);
    console.log(`===========================================================`);

    if (mismatchCount === 0) {
      console.log(`\n🏆 MIGRATION COMPLETE: All ${tablesToCompare.length} entities imported with 100% row count match!`);
    } else {
      console.warn(`\n⚠️ Warning: ${mismatchCount} table(s) had row count mismatches. Please inspect log details.`);
    }

  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error(`\n❌ Migration Transaction Failed: ${err.message}`);
    console.error(`Transaction rolled back. Target PostgreSQL database remains untouched.`);
    process.exit(1);
  } finally {
    pgClient.release();
    sqliteDb.close();
    await pgPool.end();
  }
}

runMigration().catch(err => {
  console.error('Unhandled migration exception:', err);
  process.exit(1);
});
