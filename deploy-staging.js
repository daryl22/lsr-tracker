#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 LSR Tracker - Staging Deployment');
console.log('==================================\n');

// Staging configuration
const config = {
  environment: 'staging',
  dataDir: path.join(__dirname, 'data-staging'),
  backupDir: path.join(__dirname, 'data-staging', 'backup'),
  port: process.env.PORT || 3001,
  preserveData: process.env.PRESERVE_DATA !== 'false'
};

console.log(`🌍 Environment: ${config.environment}`);
console.log(`💾 Data Directory: ${config.dataDir}`);
console.log(`🔌 Port: ${config.port}`);
console.log(`🔄 Preserve Data: ${config.preserveData}`);

// Function to setup staging environment
async function setupStagingEnvironment() {
  console.log('\n🔧 Setting up staging environment...');
  
  // Create staging data directory
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
    console.log(`  ✅ Created staging data directory: ${config.dataDir}`);
  }
  
  // Create backup directory
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
    console.log(`  ✅ Created staging backup directory: ${config.backupDir}`);
  }
  
  // Copy production data to staging if it exists
  const productionDataDir = path.join(__dirname, 'data');
  if (fs.existsSync(productionDataDir)) {
    console.log('  📊 Found production data, copying to staging...');
    
    try {
      // Copy database files
      if (fs.existsSync(path.join(productionDataDir, 'app.db'))) {
        fs.copyFileSync(
          path.join(productionDataDir, 'app.db'),
          path.join(config.dataDir, 'app.db')
        );
        console.log('    ✅ Copied app.db to staging');
      }
      
      if (fs.existsSync(path.join(productionDataDir, 'sessions.db'))) {
        fs.copyFileSync(
          path.join(productionDataDir, 'sessions.db'),
          path.join(config.dataDir, 'sessions.db')
        );
        console.log('    ✅ Copied sessions.db to staging');
      }
      
      // Copy uploads if they exist
      const productionUploads = path.join(__dirname, 'uploads');
      const stagingUploads = path.join(__dirname, 'uploads-staging');
      if (fs.existsSync(productionUploads)) {
        fs.cpSync(productionUploads, stagingUploads, { recursive: true });
        console.log('    ✅ Copied uploads to staging');
      }
      
    } catch (error) {
      console.log(`    ⚠️  Error copying production data: ${error.message}`);
    }
  } else {
    console.log('  📊 No production data found, starting with clean staging environment');
  }
}

// Function to initialize staging database
async function initializeStagingDatabase() {
  console.log('\n🔄 Initializing staging database...');
  
  const dbPath = path.join(config.dataDir, 'app.db');
  const db = new sqlite3.Database(dbPath);
  
  // Create tables with staging-specific settings
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        is_admin INTEGER NOT NULL DEFAULT 0,
        gender TEXT CHECK (gender IN ('male', 'female'))
      )
    `);
    
    // Entries table
    db.run(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        entry_date DATE NOT NULL,
        km_run REAL NOT NULL DEFAULT 0,
        hours REAL NOT NULL DEFAULT 0,
        pace REAL,
        created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Uploads table
    db.run(`
      CREATE TABLE IF NOT EXISTS uploads (
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
      )
    `);
    
    // Events table
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('advanced', 'intermediate')),
        gender_restriction TEXT NOT NULL CHECK (gender_restriction IN ('male', 'female', 'both')),
        km_goal REAL NOT NULL DEFAULT 0,
        is_ended INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        created_by INTEGER NOT NULL,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Event participants table
    db.run(`
      CREATE TABLE IF NOT EXISTS event_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT (datetime('now', '+8 hours')),
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(event_id, user_id)
      )
    `);
    
    // Seed staging admin user
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
      if (err) return;
      
      if (result.count === 0) {
        console.log('  📊 No users found, seeding staging admin user...');
        import('bcrypt')
          .then(mod => {
            const bcrypt = mod.default;
            const passwordHash = bcrypt.hashSync('admin', 10);
            const stmt = db.prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)');
            stmt.run('admin@staging', passwordHash);
            console.log('  ✅ Staging admin user seeded (email: admin@staging, password: admin)');
          })
          .catch(err => {
            console.error('  ❌ Error seeding staging admin user:', err);
          });
      } else {
        console.log(`  📊 Found ${result.count} existing users in staging`);
      }
    });
  });
  
  db.close();
  console.log('  ✅ Staging database initialized');
}

// Function to create staging backup
function createStagingBackup() {
  console.log('\n💾 Creating staging backup...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(config.backupDir, `staging-backup-${timestamp}`);
  
  try {
    fs.mkdirSync(backupPath, { recursive: true });
    fs.cpSync(config.dataDir, backupPath, { recursive: true });
    console.log(`  ✅ Staging backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error(`  ❌ Error creating staging backup: ${error.message}`);
    return null;
  }
}

// Function to start staging application
function startStagingApplication() {
  console.log('\n🚀 Starting staging application...');
  console.log(`  🌐 Staging URL: http://localhost:${config.port}`);
  console.log(`  📊 Database: ${config.dataDir}/app.db`);
  console.log(`  🔧 Environment: ${config.environment}`);
  
  // Set environment variables for staging
  process.env.NODE_ENV = 'staging';
  process.env.PORT = config.port.toString();
  process.env.STAGING_DATA_DIR = config.dataDir;
  
  console.log('\n🎉 Staging environment ready!');
  console.log('\n📋 Next Steps:');
  console.log('1. Test your changes in staging');
  console.log('2. Verify all features work correctly');
  console.log('3. When ready, merge to main branch for production');
  console.log('4. Deploy to production with: npm run deploy:prod');
}

// Main execution
async function main() {
  try {
    await setupStagingEnvironment();
    await initializeStagingDatabase();
    createStagingBackup();
    startStagingApplication();
    
  } catch (error) {
    console.error('\n❌ Error setting up staging environment:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();
