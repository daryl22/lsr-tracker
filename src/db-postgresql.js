import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment-aware database configuration
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

// Get PostgreSQL connection string
const getConnectionString = () => {
  if (isProduction) {
    return process.env.DATABASE_URL;
  }
  if (isStaging) {
    return process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL;
};

const connectionString = getConnectionString();

if (!connectionString) {
  throw new Error('PostgreSQL connection string not found. Please set DATABASE_URL or STAGING_DATABASE_URL environment variable.');
}

let clientInstance = null;

export function getDb() {
  if (!clientInstance) {
    clientInstance = new Client({ connectionString });
    
    // Log database connection
    console.log(`🐘 PostgreSQL connected: ${connectionString.replace(/\/\/.*@/, '//***:***@')}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  }
  return clientInstance;
}

export async function ensureDatabase() {
  const client = getDb();
  
  try {
    await client.connect();
    console.log('✅ PostgreSQL connection established');
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'entries', 'uploads', 'events', 'event_participants')
    `);
    
    console.log(`📊 Found ${tables.rows.length} existing tables`);
    
    if (tables.rows.length === 0) {
      console.log('📊 No tables found, creating schema...');
      await createTables(client);
    } else {
      console.log('📊 Tables already exist, skipping schema creation');
    }
    
    // Check if we have data
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Users in database: ${userCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    throw error;
  }
}

async function createTables(client) {
  console.log('📊 Creating PostgreSQL tables...');
  
  // Create users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      gender VARCHAR(10) DEFAULT 'male',
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Created users table');
  
  // Create entries table
  await client.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      entry_date DATE NOT NULL,
      km_run DECIMAL(10,2) DEFAULT 0,
      hours DECIMAL(10,2) DEFAULT 0,
      pace DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  ✅ Created entries table');
  
  // Create uploads table
  await client.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      entry_id INTEGER,
      filename VARCHAR(255) NOT NULL,
      originalname VARCHAR(255) NOT NULL,
      mimetype VARCHAR(100),
      size INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
    )
  `);
  console.log('  ✅ Created uploads table');
  
  // Create events table
  await client.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Created events table');
  
  // Create event_participants table
  await client.query(`
    CREATE TABLE IF NOT EXISTS event_participants (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(event_id, user_id)
    )
  `);
  console.log('  ✅ Created event_participants table');
  
  console.log('🎉 PostgreSQL schema created successfully!');
}

// Helper function to execute queries
export async function query(text, params = []) {
  const client = getDb();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    throw error;
  }
}

// Helper function to get a single row
export async function getOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Helper function to get all rows
export async function getAll(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

// Helper function to insert and return ID
export async function insert(text, params = []) {
  const result = await query(text + ' RETURNING id', params);
  return result.rows[0].id;
}

// Close connection
export async function closeConnection() {
  if (clientInstance) {
    await clientInstance.end();
    clientInstance = null;
    console.log('🔌 PostgreSQL connection closed');
  }
}
