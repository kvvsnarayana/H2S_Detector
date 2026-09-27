-- =============================================================
-- Sulfide Sentinels H2S Exposure Monitoring System
-- Supabase PostgreSQL Master Database Schema
-- =============================================================

-- Enable UUID Extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WORKERS TABLE
CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  worker_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  badge_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BADGES TABLE
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  badge_id VARCHAR(100) UNIQUE NOT NULL,
  manufacture_date VARCHAR(50),
  expiry_date VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SHIFTS TABLE
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

-- 4. SCANS TABLE
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

-- 5. USERS TABLE (Role-Based Authentication)
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

-- 6. SESSIONS TABLE (Server-Side Managed Token Sessions)
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  worker_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 7. ALERTS TABLE (System Notifications & Critical Warnings)
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

-- 8. CONFIGURABLE SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_workers_worker_id ON workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_worker_id ON shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_scans_worker_id ON scans(worker_id);
CREATE INDEX IF NOT EXISTS idx_scans_shift_id ON scans(shift_id);
CREATE INDEX IF NOT EXISTS idx_alerts_worker_id ON alerts(worker_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
