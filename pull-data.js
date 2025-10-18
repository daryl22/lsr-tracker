#!/usr/bin/env node

import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LIVE_URL = process.env.LIVE_URL || 'https://lsr-tracker.railway.app';
const API_KEY = process.env.API_KEY || '';

console.log('🚀 LSR Tracker - Data Pull from Live Environment');
console.log('================================================\n');

// Step 1: Find and test live environment
async function findLiveEnvironment() {
  console.log('🔍 Step 1: Finding live environment...');
  
  const commonUrls = [
    'https://lsr-tracker.railway.app',
    'https://lsr-tracker-production.railway.app',
    'https://lsr-tracker-staging.railway.app',
    'https://lsr-tracker.vercel.app',
    LIVE_URL
  ];
  
  for (const url of commonUrls) {
    try {
      console.log(`  Testing: ${url}`);
      const response = await fetch(url, { timeout: 5000 });
      
      if (response.ok) {
        console.log(`  ✅ Found live environment: ${url}`);
        return url;
      }
    } catch (error) {
      console.log(`  ❌ ${url} - ${error.message}`);
    }
  }
  
  console.log('  ⚠️  Could not find accessible live environment');
  console.log('  💡 Please set LIVE_URL environment variable with your live URL');
  console.log('  Example: LIVE_URL=https://your-app.railway.app node pull-data.js');
  return null;
}

// Step 2: Backup local data
async function backupLocalData() {
  console.log('\n💾 Step 2: Backing up local data...');
  
  const dataDir = path.join(__dirname, 'data');
  const backupDir = path.join(__dirname, 'data', 'backup');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const dbFiles = ['app.db', 'sessions.db'];
  
  for (const file of dbFiles) {
    const sourcePath = path.join(dataDir, file);
    const backupPath = path.join(backupDir, `${timestamp}-${file}`);
    
    if (fs.existsSync(sourcePath)) {
      try {
        fs.copyFileSync(sourcePath, backupPath);
        console.log(`  ✅ Backed up ${file}`);
      } catch (error) {
        console.log(`  ❌ Error backing up ${file}: ${error.message}`);
      }
    }
  }
  
  console.log(`  📁 Backup saved to: ${backupDir}`);
}

// Step 3: Pull data from live
async function pullDataFromLive(liveUrl) {
  console.log(`\n📡 Step 3: Pulling data from ${liveUrl}...`);
  
  const dbPath = path.join(__dirname, 'data', 'app.db');
  const db = new sqlite3.Database(dbPath);
  
  // Helper function for API requests
  async function apiRequest(endpoint) {
    try {
      const response = await fetch(`${liveUrl}${endpoint}`, {
        headers: API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.log(`  ❌ Error fetching ${endpoint}: ${error.message}`);
      return null;
    }
  }
  
  // Pull users
  console.log('  👥 Pulling users...');
  const users = await apiRequest('/api/admin/users');
  if (users && users.users) {
    db.run('DELETE FROM users');
    const stmt = db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)');
    users.users.forEach(user => {
      stmt.run([user.id, user.email, user.password_hash, user.created_at]);
    });
    stmt.finalize();
    console.log(`    ✅ Imported ${users.users.length} users`);
  }
  
  // Pull entries
  console.log('  📝 Pulling entries...');
  const entries = await apiRequest('/api/admin/entries');
  if (entries && entries.entries) {
    db.run('DELETE FROM entries');
    const stmt = db.prepare('INSERT INTO entries (id, user_id, entry_date, km_run, hours, pace, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    entries.entries.forEach(entry => {
      stmt.run([entry.id, entry.user_id, entry.date, entry.km, entry.hours, entry.pace, entry.created_at]);
    });
    stmt.finalize();
    console.log(`    ✅ Imported ${entries.entries.length} entries`);
  }
  
  // Pull uploads
  console.log('  📎 Pulling uploads...');
  const uploads = await apiRequest('/api/admin/uploads');
  if (uploads && uploads.uploads) {
    db.run('DELETE FROM uploads');
    const stmt = db.prepare('INSERT INTO uploads (id, user_id, entry_id, filename, originalname, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    uploads.uploads.forEach(upload => {
      stmt.run([upload.id, upload.user_id, upload.entry_id, upload.filename, upload.originalname, upload.mimetype, upload.size, upload.created_at]);
    });
    stmt.finalize();
    console.log(`    ✅ Imported ${uploads.uploads.length} uploads`);
  }
  
  // Pull events
  console.log('  🎯 Pulling events...');
  const events = await apiRequest('/api/admin/events');
  if (events && events.events) {
    db.run('DELETE FROM events');
    const stmt = db.prepare('INSERT INTO events (id, title, description, start_date, end_date, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    events.events.forEach(event => {
      stmt.run([event.id, event.title, event.description, event.start_date, event.end_date, event.is_active, event.created_at]);
    });
    stmt.finalize();
    console.log(`    ✅ Imported ${events.events.length} events`);
  }
  
  // Pull event participants
  console.log('  👥 Pulling event participants...');
  const participants = await apiRequest('/api/admin/event-participants');
  if (participants && participants.participants) {
    db.run('DELETE FROM event_participants');
    const stmt = db.prepare('INSERT INTO event_participants (id, event_id, user_id, joined_at) VALUES (?, ?, ?, ?)');
    participants.participants.forEach(participant => {
      stmt.run([participant.id, participant.event_id, participant.user_id, participant.joined_at]);
    });
    stmt.finalize();
    console.log(`    ✅ Imported ${participants.participants.length} event participants`);
  }
  
  db.close();
}

// Step 4: Show final summary
async function showSummary() {
  console.log('\n📊 Step 4: Final summary...');
  
  const dbPath = path.join(__dirname, 'data', 'app.db');
  const db = new sqlite3.Database(dbPath);
  
  db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
    console.log(`  👥 Users: ${result.count}`);
    
    db.get('SELECT COUNT(*) as count FROM entries', (err, result) => {
      console.log(`  📝 Entries: ${result.count}`);
      
      db.get('SELECT COUNT(*) as count FROM uploads', (err, result) => {
        console.log(`  📎 Uploads: ${result.count}`);
        
        db.get('SELECT COUNT(*) as count FROM events', (err, result) => {
          console.log(`  🎯 Events: ${result.count}`);
          
          db.get('SELECT COUNT(*) as count FROM event_participants', (err, result) => {
            console.log(`  👥 Event Participants: ${result.count}`);
            
            db.close();
            console.log('\n🎉 Data pull completed successfully!');
            console.log('✨ Your local database now has the latest data from live.');
          });
        });
      });
    });
  });
}

// Main execution
async function main() {
  try {
    const liveUrl = await findLiveEnvironment();
    
    if (!liveUrl) {
      console.log('\n❌ Cannot proceed without a live environment URL');
      console.log('💡 Please provide the LIVE_URL environment variable');
      process.exit(1);
    }
    
    await backupLocalData();
    await pullDataFromLive(liveUrl);
    await showSummary();
    
  } catch (error) {
    console.error('\n❌ Error during data pull:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
