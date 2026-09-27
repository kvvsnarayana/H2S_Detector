const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * SQLite Database Adapter for Offline Local Development
 */
class SqliteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, 'sulfide_sentinels.db');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.sqliteDb = new Database(this.dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    // Enable WAL mode for performance
    this.sqliteDb.pragma('journal_mode = WAL');
  }

  async get(sql, params = []) {
    const cleanParams = Array.isArray(params) ? params : [params];
    const row = this.sqliteDb.prepare(sql).get(...cleanParams);
    return row !== undefined ? row : null;
  }

  async all(sql, params = []) {
    const cleanParams = Array.isArray(params) ? params : [params];
    return this.sqliteDb.prepare(sql).all(...cleanParams);
  }

  async run(sql, params = []) {
    const cleanParams = Array.isArray(params) ? params : [params];
    const res = this.sqliteDb.prepare(sql).run(...cleanParams);
    return {
      changes: res.changes,
      lastInsertRowid: res.lastInsertRowid
    };
  }

  async exec(sql) {
    return this.sqliteDb.exec(sql);
  }

  pragma(pragmaSql, options) {
    return this.sqliteDb.pragma(pragmaSql, options);
  }

  async transaction(callback) {
    const tx = this.sqliteDb.transaction((txAdapter) => callback(txAdapter));
    const txAdapter = {
      get: (sql, params = []) => this.sqliteDb.prepare(sql).get(...(Array.isArray(params) ? params : [params])),
      all: (sql, params = []) => this.sqliteDb.prepare(sql).all(...(Array.isArray(params) ? params : [params])),
      run: (sql, params = []) => {
        const res = this.sqliteDb.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
        return { changes: res.changes, lastInsertRowid: res.lastInsertRowid };
      },
      exec: (sql) => this.sqliteDb.exec(sql)
    };
    return tx(txAdapter);
  }

  prepare(sql) {
    const stmt = this.sqliteDb.prepare(sql);
    return {
      get: (...params) => {
        const cleanParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = stmt.get(...cleanParams);
        return Promise.resolve(res !== undefined ? res : null);
      },
      all: (...params) => {
        const cleanParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return Promise.resolve(stmt.all(...cleanParams));
      },
      run: (...params) => {
        const cleanParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = stmt.run(...cleanParams);
        return Promise.resolve({ changes: res.changes, lastInsertRowid: res.lastInsertRowid });
      }
    };
  }

  async healthCheck() {
    try {
      const res = this.sqliteDb.prepare('SELECT 1 as connected').get();
      return {
        status: res && res.connected === 1 ? 'connected' : 'disconnected',
        provider: 'sqlite',
        dbPath: this.dbPath
      };
    } catch (err) {
      return {
        status: 'disconnected',
        provider: 'sqlite',
        error: err.message
      };
    }
  }
}

module.exports = SqliteAdapter;
