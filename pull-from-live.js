import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Update these with your live environment details
const LIVE_URL = process.env.LIVE_URL || 'https://your-live-app.railway.app'; // Update this URL
const API_KEY = process.env.API_KEY || ''; // Add if your live API requires authentication

// Local database setup
const dbPath = path.join(__dirname, 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Starting data pull from live environment...');
console.log(`📡 Live URL: ${LIVE_URL}`);

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${LIVE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Error fetching ${endpoint}:`, error.message);
    return null;
  }
}

// Function to pull users from live
async function pullUsers() {
  console.log('👥 Pulling users from live...');
  
  try {
    // Try to get users via admin endpoint
    const users = await apiRequest('/api/admin/users');
    
    if (users && users.users) {
      console.log(`📊 Found ${users.users.length} users in live environment`);
      
      // Clear existing users (be careful with this!)
      db.run('DELETE FROM users', (err) => {
        if (err) {
          console.error('Error clearing users:', err);
          return;
        }
        
        // Insert users from live
        const stmt = db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)');
        
        users.users.forEach(user => {
          stmt.run([user.id, user.email, user.password_hash, user.created_at], (err) => {
            if (err) {
              console.error('Error inserting user:', err);
            }
          });
        });
        
        stmt.finalize();
        console.log('✅ Users imported successfully');
      });
    } else {
      console.log('⚠️  No users found or admin endpoint not accessible');
    }
  } catch (error) {
    console.error('❌ Error pulling users:', error);
  }
}

// Function to pull entries from live
async function pullEntries() {
  console.log('📝 Pulling entries from live...');
  
  try {
    // Try to get entries via admin endpoint
    const entries = await apiRequest('/api/admin/entries');
    
    if (entries && entries.entries) {
      console.log(`📊 Found ${entries.entries.length} entries in live environment`);
      
      // Clear existing entries
      db.run('DELETE FROM entries', (err) => {
        if (err) {
          console.error('Error clearing entries:', err);
          return;
        }
        
        // Insert entries from live
        const stmt = db.prepare('INSERT INTO entries (id, user_id, entry_date, km_run, hours, pace, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        entries.entries.forEach(entry => {
          stmt.run([
            entry.id, 
            entry.user_id, 
            entry.date, 
            entry.km, 
            entry.hours, 
            entry.pace, 
            entry.created_at
          ], (err) => {
            if (err) {
              console.error('Error inserting entry:', err);
            }
          });
        });
        
        stmt.finalize();
        console.log('✅ Entries imported successfully');
      });
    } else {
      console.log('⚠️  No entries found or admin endpoint not accessible');
    }
  } catch (error) {
    console.error('❌ Error pulling entries:', error);
  }
}

// Function to pull uploads from live
async function pullUploads() {
  console.log('📎 Pulling uploads from live...');
  
  try {
    // Try to get uploads via admin endpoint
    const uploads = await apiRequest('/api/admin/uploads');
    
    if (uploads && uploads.uploads) {
      console.log(`📊 Found ${uploads.uploads.length} uploads in live environment`);
      
      // Clear existing uploads
      db.run('DELETE FROM uploads', (err) => {
        if (err) {
          console.error('Error clearing uploads:', err);
          return;
        }
        
        // Insert uploads from live
        const stmt = db.prepare('INSERT INTO uploads (id, user_id, entry_id, filename, originalname, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        
        uploads.uploads.forEach(upload => {
          stmt.run([
            upload.id,
            upload.user_id,
            upload.entry_id,
            upload.filename,
            upload.originalname,
            upload.mimetype,
            upload.size,
            upload.created_at
          ], (err) => {
            if (err) {
              console.error('Error inserting upload:', err);
            }
          });
        });
        
        stmt.finalize();
        console.log('✅ Uploads imported successfully');
      });
    } else {
      console.log('⚠️  No uploads found or admin endpoint not accessible');
    }
  } catch (error) {
    console.error('❌ Error pulling uploads:', error);
  }
}

// Function to pull events from live
async function pullEvents() {
  console.log('🎯 Pulling events from live...');
  
  try {
    const events = await apiRequest('/api/admin/events');
    
    if (events && events.events) {
      console.log(`📊 Found ${events.events.length} events in live environment`);
      
      // Clear existing events
      db.run('DELETE FROM events', (err) => {
        if (err) {
          console.error('Error clearing events:', err);
          return;
        }
        
        // Insert events from live
        const stmt = db.prepare('INSERT INTO events (id, title, description, start_date, end_date, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        events.events.forEach(event => {
          stmt.run([
            event.id,
            event.title,
            event.description,
            event.start_date,
            event.end_date,
            event.is_active,
            event.created_at
          ], (err) => {
            if (err) {
              console.error('Error inserting event:', err);
            }
          });
        });
        
        stmt.finalize();
        console.log('✅ Events imported successfully');
      });
    } else {
      console.log('⚠️  No events found or admin endpoint not accessible');
    }
  } catch (error) {
    console.error('❌ Error pulling events:', error);
  }
}

// Function to pull event participants from live
async function pullEventParticipants() {
  console.log('👥 Pulling event participants from live...');
  
  try {
    const participants = await apiRequest('/api/admin/event-participants');
    
    if (participants && participants.participants) {
      console.log(`📊 Found ${participants.participants.length} event participants in live environment`);
      
      // Clear existing event participants
      db.run('DELETE FROM event_participants', (err) => {
        if (err) {
          console.error('Error clearing event participants:', err);
          return;
        }
        
        // Insert event participants from live
        const stmt = db.prepare('INSERT INTO event_participants (id, event_id, user_id, joined_at) VALUES (?, ?, ?, ?)');
        
        participants.participants.forEach(participant => {
          stmt.run([
            participant.id,
            participant.event_id,
            participant.user_id,
            participant.joined_at
          ], (err) => {
            if (err) {
              console.error('Error inserting event participant:', err);
            }
          });
        });
        
        stmt.finalize();
        console.log('✅ Event participants imported successfully');
      });
    } else {
      console.log('⚠️  No event participants found or admin endpoint not accessible');
    }
  } catch (error) {
    console.error('❌ Error pulling event participants:', error);
  }
}

// Main function to pull all data
async function pullAllData() {
  console.log('🔄 Starting complete data pull from live environment...\n');
  
  // Test connection first
  console.log('🔍 Testing connection to live environment...');
  const healthCheck = await apiRequest('/api/health');
  if (!healthCheck) {
    console.log('⚠️  Health check failed, but continuing with data pull...\n');
  } else {
    console.log('✅ Live environment is accessible\n');
  }
  
  // Pull data in order (respecting foreign key constraints)
  await pullUsers();
  await pullEvents();
  await pullEventParticipants();
  await pullEntries();
  await pullUploads();
  
  console.log('\n🎉 Data pull completed!');
  console.log('📊 Summary:');
  
  // Show final counts
  db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
    console.log(`👥 Users: ${result.count}`);
    
    db.get('SELECT COUNT(*) as count FROM entries', (err, result) => {
      console.log(`📝 Entries: ${result.count}`);
      
      db.get('SELECT COUNT(*) as count FROM uploads', (err, result) => {
        console.log(`📎 Uploads: ${result.count}`);
        
        db.get('SELECT COUNT(*) as count FROM events', (err, result) => {
          console.log(`🎯 Events: ${result.count}`);
          
          db.get('SELECT COUNT(*) as count FROM event_participants', (err, result) => {
            console.log(`👥 Event Participants: ${result.count}`);
            
            db.close();
            console.log('\n✨ All done! Your local database now has the latest data from live.');
          });
        });
      });
    });
  });
}

// Run the data pull
pullAllData().catch(console.error);
