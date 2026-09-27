const { Pool } = require('pg');

/**
 * PostgreSQL Database Adapter for Supabase / Neon / Cloud Postgres
 */
class PostgresAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    const isSslRequired = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

    this.pool = new Pool({
      connectionString,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err.message);
    });
  }

  /**
   * Convert SQLite '?' positional placeholders to PostgreSQL '$1, $2, $3'
   * and replace SQLite specific statements with PostgreSQL equivalents.
   */
  translateSql(sql) {
    let cleanSql = sql.trim();

    // 1. Replace SQLite INSERT OR REPLACE INTO settings
    if (/INSERT\s+OR\s+REPLACE\s+INTO\s+settings/i.test(cleanSql)) {
      cleanSql = cleanSql.replace(
        /INSERT\s+OR\s+REPLACE\s+INTO\s+settings\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
        'INSERT INTO settings ($1) VALUES ($2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP'
      );
    } else if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(cleanSql)) {
      cleanSql = cleanSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
    }

    // 2. Translate '?' parameters to '$1, $2, $3'
    let paramIndex = 1;
    let inString = false;
    let stringChar = '';
    let result = '';

    for (let i = 0; i < cleanSql.length; i++) {
      const char = cleanSql[i];
      if (inString) {
        result += char;
        if (char === stringChar && cleanSql[i - 1] !== '\\') {
          inString = false;
        }
      } else {
        if (char === "'" || char === '"' || char === '`') {
          inString = true;
          stringChar = char;
          result += char;
        } else if (char === '?') {
          result += `$${paramIndex++}`;
        } else {
          result += char;
        }
      }
    }

    return result;
  }

  /**
   * Execute single query returning first row or null
   */
  async get(sql, params = []) {
    const translatedSql = this.translateSql(sql);
    const cleanParams = Array.isArray(params) ? params : [params];
    const res = await this.pool.query(translatedSql, cleanParams);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Execute query returning all rows array
   */
  async all(sql, params = []) {
    const translatedSql = this.translateSql(sql);
    const cleanParams = Array.isArray(params) ? params : [params];
    const res = await this.pool.query(translatedSql, cleanParams);
    return res.rows;
  }

  /**
   * Execute INSERT / UPDATE / DELETE statement returning changes & lastInsertRowid
   */
  async run(sql, params = []) {
    let translatedSql = this.translateSql(sql);
    const cleanParams = Array.isArray(params) ? params : [params];

    // If INSERT and doesn't have RETURNING, append RETURNING id
    const isInsert = /^\s*INSERT\s+INTO/i.test(translatedSql);
    if (isInsert && !/RETURNING/i.test(translatedSql)) {
      translatedSql += ' RETURNING id';
    }

    const res = await this.pool.query(translatedSql, cleanParams);
    let lastInsertRowid = null;

    if (res.rows && res.rows.length > 0) {
      const firstRow = res.rows[0];
      lastInsertRowid = firstRow.id !== undefined ? firstRow.id : (firstRow.key !== undefined ? firstRow.key : firstRow[Object.keys(firstRow)[0]]);
    }

    return {
      changes: res.rowCount || 0,
      lastInsertRowid
    };
  }

  /**
   * Execute raw DDL / multi-statement script
   */
  async exec(sql) {
    return await this.pool.query(sql);
  }

  /**
   * Execute transaction block with automatic COMMIT / ROLLBACK
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txAdapter = {
        get: async (sql, params = []) => {
          const res = await client.query(this.translateSql(sql), Array.isArray(params) ? params : [params]);
          return res.rows.length > 0 ? res.rows[0] : null;
        },
        all: async (sql, params = []) => {
          const res = await client.query(this.translateSql(sql), Array.isArray(params) ? params : [params]);
          return res.rows;
        },
        run: async (sql, params = []) => {
          let txSql = this.translateSql(sql);
          if (/^\s*INSERT\s+INTO/i.test(txSql) && !/RETURNING/i.test(txSql)) {
            txSql += ' RETURNING id';
          }
          const res = await client.query(txSql, Array.isArray(params) ? params : [params]);
          return {
            changes: res.rowCount || 0,
            lastInsertRowid: res.rows && res.rows[0] ? (res.rows[0].id || res.rows[0].key || null) : null
          };
        },
        exec: async (sql) => client.query(sql)
      };

      const result = await callback(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Compatibility wrapper for db.prepare(sql)
   */
  prepare(sql) {
    return {
      get: (...params) => this.get(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params),
      all: (...params) => this.all(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params),
      run: (...params) => this.run(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params)
    };
  }

  /**
   * Health check method
   */
  async healthCheck() {
    try {
      const res = await this.pool.query('SELECT 1 as connected');
      return {
        status: res.rows && res.rows[0] && res.rows[0].connected === 1 ? 'connected' : 'disconnected',
        provider: 'postgres',
        connectionString: this.connectionString.replace(/:[^:@]+@/, ':****@')
      };
    } catch (err) {
      return {
        status: 'disconnected',
        provider: 'postgres',
        error: err.message
      };
    }
  }
}

module.exports = PostgresAdapter;
