import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment-aware database configuration
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

// Use different data directories for different environments
const getDataDir = () => {
  if (isProduction) {
    return process.env.PRODUCTION_DATA_DIR || '/app/data';
  }
  if (isStaging) {
    return process.env.STAGING_DATA_DIR || path.join(__dirname, '..', 'data-staging');
  }
  return path.join(__dirname, '..', 'data');
};

const dataDir = getDataDir();
const dbPath = path.join(dataDir, 'app.db');

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    dbInstance = new sqlite3.Database(dbPath);
    
    // Log database connection
    console.log(`📊 Database connected: ${dbPath}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  }
  return dbInstance;
}

export function ensureDatabase() {
  // Create data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = getDb();

  // Check if database already exists and has data
  const dbExists = fs.existsSync(dbPath);
  let hasData = false;
  
  if (dbExists) {
    try {
      const testDb = new sqlite3.Database(dbPath);
      testDb.get('SELECT COUNT(*) as count FROM users', (err, result) => {
        if (!err && result && result.count > 0) {
          hasData = true;
        }
        testDb.close();
      });
    } catch (error) {
      console.log('⚠️  Could not check existing data:', error.message);
    }
  }

  // Log database status
  console.log(`📊 Database exists: ${dbExists}`);
  console.log(`📊 Has data: ${hasData}`);
  
  if (isProduction && hasData) {
    console.log('🚨 PRODUCTION DATABASE WITH DATA DETECTED');
    console.log('⚠️  Extra caution: Preserving all existing data');
  }

  db.serialize(() => {
    // Create tables with IF NOT EXISTS to preserve existing data
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
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
        created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
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
        created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
      )`
    );

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
        created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        created_by INTEGER NOT NULL,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    // Create event_participants table
    db.run(
      `CREATE TABLE IF NOT EXISTS event_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(event_id, user_id)
      )`
    );

    // Safe column additions (only if column doesn't exist)
    addColumnIfNotExists(db, 'entries', 'pace', 'REAL');
    addColumnIfNotExists(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'users', 'gender', 'TEXT CHECK (gender IN (\'male\', \'female\'))');
    addColumnIfNotExists(db, 'uploads', 'entry_id', 'INTEGER');
    addColumnIfNotExists(db, 'events', 'km_goal', 'REAL NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'events', 'is_ended', 'INTEGER NOT NULL DEFAULT 0');

    // Only seed admin user if no users exist (safe for production)
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
      if (err) return;
      
      if (result.count === 0) {
        console.log('📊 No users found, seeding admin user...');
        import('bcrypt')
          .then(mod => {
            const bcrypt = mod.default;
            const passwordHash = bcrypt.hashSync('admin', 10);
            const stmt = db.prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)');
            stmt.run('admin', passwordHash);
            console.log('✅ Admin user seeded');
          })
          .catch(err => {
            console.error('❌ Error seeding admin user:', err);
          });
      } else {
        console.log(`📊 Found ${result.count} existing users, skipping admin seed`);
      }
    });
  });
}

// Helper function to safely add columns
function addColumnIfNotExists(db, tableName, columnName, columnDef) {
  db.all(`PRAGMA table_info(${tableName})`, (err, cols) => {
    if (err) return;
    
    if (!cols.some(c => c.name === columnName)) {
      try {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
        console.log(`✅ Added column ${columnName} to ${tableName}`);
      } catch (error) {
        console.log(`⚠️  Could not add column ${columnName} to ${tableName}: ${error.message}`);
      }
    }
  });
}

// Function to create backup before any changes
export function createBackup() {
  const backupDir = path.join(dataDir, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);
  
  try {
    fs.mkdirSync(backupPath, { recursive: true });
    fs.cpSync(dataDir, backupPath, { recursive: true });
    console.log(`✅ Backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error(`❌ Error creating backup: ${error.message}`);
    return null;
  }
}

// Function to check if database has data
export function hasData() {
  return new Promise((resolve) => {
    const db = getDb();
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(result.count > 0);
    });
  });
}
