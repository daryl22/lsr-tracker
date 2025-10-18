import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
const backupDir = path.join(__dirname, 'data', 'backup');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

console.log('💾 Creating backup of local database...');

// Create backup directory
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Backup database files
const dbFiles = ['app.db', 'sessions.db'];

dbFiles.forEach(file => {
  const sourcePath = path.join(dataDir, file);
  const backupPath = path.join(backupDir, `${timestamp}-${file}`);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, backupPath);
      console.log(`✅ Backed up ${file} to ${backupPath}`);
    } catch (error) {
      console.error(`❌ Error backing up ${file}:`, error.message);
    }
  } else {
    console.log(`⚠️  ${file} not found, skipping...`);
  }
});

// Backup uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
const backupUploadsDir = path.join(backupDir, `${timestamp}-uploads`);

if (fs.existsSync(uploadsDir)) {
  try {
    fs.cpSync(uploadsDir, backupUploadsDir, { recursive: true });
    console.log(`✅ Backed up uploads to ${backupUploadsDir}`);
  } catch (error) {
    console.error(`❌ Error backing up uploads:`, error.message);
  }
} else {
  console.log(`⚠️  uploads directory not found, skipping...`);
}

console.log('\n🎉 Backup completed!');
console.log(`📁 Backup location: ${backupDir}`);
console.log(`⏰ Timestamp: ${timestamp}`);
