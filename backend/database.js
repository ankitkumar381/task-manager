const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'taskmanager.db');

let db; // sql.js Database instance

// ── Persist helper ──────────────────────────────────────────────────────────
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Auto-save every 30 seconds ───────────────────────────────────────────────
function startAutosave(intervalMs = 30000) {
  setInterval(saveDb, intervalMs);
  process.on('exit', saveDb);
  process.on('SIGINT', () => { saveDb(); process.exit(0); });
  process.on('SIGTERM', () => { saveDb(); process.exit(0); });
}

// ── Schema ───────────────────────────────────────────────────────────────────
const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    created_by  INTEGER NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'member',
    PRIMARY KEY (project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    due_date    TEXT,
    priority    TEXT    DEFAULT 'medium',
    status      TEXT    DEFAULT 'todo',
    assigned_to INTEGER,
    created_by  INTEGER NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`;

// ── Initialise (async) ───────────────────────────────────────────────────────
async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  saveDb(); // initial save
  startAutosave();
  return db;
}

let transactionDepth = 0;

// ── Helper wrappers that mimic better-sqlite3 sync API ───────────────────────
const dbWrapper = {
  // Run a statement (INSERT, UPDATE, DELETE, DDL)
  run(sql, ...params) {
    db.run(sql, params.flat());
    // Use prepare/step to get lastInsertRowid safely — db.exec() auto-commits
    // open transactions in sql.js, so we must avoid it here.
    const stmt = db.prepare("SELECT last_insert_rowid() as id");
    stmt.step();
    const lastInsertRowid = stmt.getAsObject().id ?? null;
    stmt.free();
    if (transactionDepth === 0) saveDb();
    return { lastInsertRowid, changes: db.getRowsModified() };
  },

  // Return first matching row as object, or undefined
  get(sql, ...params) {
    const stmt = db.prepare(sql);
    stmt.bind(params.flat());
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  // Return all matching rows as array of objects
  all(sql, ...params) {
    const stmt = db.prepare(sql);
    stmt.bind(params.flat());
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  },

  // Execute raw SQL (schema, etc.)
  exec(sql) {
    db.run(sql);
    if (transactionDepth === 0) saveDb();
  },

  // Transaction helper
  transaction(fn) {
    return (...args) => {
      if (transactionDepth === 0) db.run('BEGIN');
      transactionDepth++;
      try {
        const result = fn(...args);
        transactionDepth--;
        if (transactionDepth === 0) {
          db.run('COMMIT');
          saveDb();
        }
        return result;
      } catch (e) {
        transactionDepth--;
        if (transactionDepth === 0) {
          console.error('Transaction failed, original error:', e);
          try { db.run('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr.message); }
        }
        throw e;
      }
    };
  },

  // Expose prepare for complex queries (returns our wrapper)
  prepare(sql) {
    const self = this;
    return {
      run: (...params) => self.run(sql, ...params),
      get:  (...params) => self.get(sql, ...params),
      all:  (...params) => self.all(sql, ...params),
    };
  }
};

module.exports = { initDb, db: dbWrapper };
