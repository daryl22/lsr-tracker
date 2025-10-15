import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath);
  }
  return dbInstance;
}

export function ensureDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = getDb();

  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        entry_date DATE NOT NULL,
        km_run REAL NOT NULL DEFAULT 0,
        hours REAL NOT NULL DEFAULT 0,
        pace REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        entry_id INTEGER,
        filename TEXT NOT NULL,
        originalname TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
      )`
    );

    // Ensure pace column exists on entries
    db.all('PRAGMA table_info(entries)', (err, cols) => {
      if (!err && cols && !cols.some(c => c.name === 'pace')) {
        db.run('ALTER TABLE entries ADD COLUMN pace REAL');
      }
    });

    // Migrate entries table to drop unique(user_id, entry_date) if present
    db.all('PRAGMA index_list(entries)', (err, idxs) => {
      if (err || !Array.isArray(idxs)) return;
      const hasUnique = idxs.some(i => i.unique === 1);
      if (!hasUnique) return;
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          `CREATE TABLE IF NOT EXISTS entries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            entry_date DATE NOT NULL,
            km_run REAL NOT NULL DEFAULT 0,
            hours REAL NOT NULL DEFAULT 0,
            pace REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`
        );
        db.run(
          'INSERT INTO entries_new (id, user_id, entry_date, km_run, hours, pace, created_at) SELECT id, user_id, entry_date, km_run, hours, pace, created_at FROM entries'
        );
        db.run('DROP TABLE entries');
        db.run('ALTER TABLE entries_new RENAME TO entries');
        db.run('COMMIT');
      });
    });

    // Ensure is_admin column exists
    db.all('PRAGMA table_info(users)', (err, cols) => {
      if (!err && cols && !cols.some(c => c.name === 'is_admin')) {
        db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
      }
    });

    // Ensure entry_id column exists on uploads
    db.all('PRAGMA table_info(uploads)', (err, cols) => {
      if (!err && cols && !cols.some(c => c.name === 'entry_id')) {
        db.run('ALTER TABLE uploads ADD COLUMN entry_id INTEGER');
      }
    });

    // Ensure gender column exists on users
    db.all('PRAGMA table_info(users)', (err, cols) => {
      if (!err && cols && !cols.some(c => c.name === 'gender')) {
        db.run('ALTER TABLE users ADD COLUMN gender TEXT CHECK (gender IN (\'male\', \'female\'))');
      }
    });

    // Create events table
    db.run(
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('advanced', 'intermediate')),
        gender_restriction TEXT NOT NULL CHECK (gender_restriction IN ('male', 'female', 'both')),
        km_goal REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER NOT NULL,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    // Ensure km_goal column exists on events (for existing databases)
    db.all('PRAGMA table_info(events)', (err, cols) => {
      if (!err && cols && !cols.some(c => c.name === 'km_goal')) {
        db.run('ALTER TABLE events ADD COLUMN km_goal REAL NOT NULL DEFAULT 0');
      }
      if (!err && cols && !cols.some(c => c.name === 'is_ended')) {
        db.run('ALTER TABLE events ADD COLUMN is_ended INTEGER NOT NULL DEFAULT 0');
      }
    });

    // Create event_participants table
    db.run(
      `CREATE TABLE IF NOT EXISTS event_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(event_id, user_id)
      )`
    );
    // Seed default admin user (email: admin, password: admin)
    db.get('SELECT id FROM users WHERE email = ? LIMIT 1', ['admin'], (err, row) => {
      if (err) return;
      if (!row) {
        import('bcrypt')
          .then(mod => {
            const bcrypt = mod.default;
            const passwordHash = bcrypt.hashSync('admin', 10);
            const stmt = db.prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)');
            stmt.run('admin', passwordHash);
          })
          .catch(() => {});
      }
    });
  });
}


