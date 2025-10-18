#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🛡️  LSR Tracker - Safe Deployment Setup');
console.log('=====================================\n');

// Configuration
const config = {
  dataDir: path.join(__dirname, 'data'),
  backupDir: path.join(__dirname, 'data', 'backup'),
  productionDataDir: process.env.PRODUCTION_DATA_DIR || '/app/data',
  preserveData: process.env.PRESERVE_DATA !== 'false', // Default to true
  environment: process.env.NODE_ENV || 'development'
};

console.log(`🌍 Environment: ${config.environment}`);
console.log(`💾 Data Directory: ${config.dataDir}`);
console.log(`🔄 Preserve Data: ${config.preserveData}`);

// Function to create backup
function createBackup() {
  console.log('\n💾 Creating data backup...');
  
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFiles = ['app.db', 'sessions.db'];
  
  backupFiles.forEach(file => {
    const sourcePath = path.join(config.dataDir, file);
    const backupPath = path.join(config.backupDir, `${timestamp}-${file}`);
    
    if (fs.existsSync(sourcePath)) {
      try {
        fs.copyFileSync(sourcePath, backupPath);
        console.log(`  ✅ Backed up ${file}`);
      } catch (error) {
        console.log(`  ❌ Error backing up ${file}: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  ${file} not found, skipping...`);
    }
  });
  
  console.log(`  📁 Backup saved to: ${config.backupDir}`);
}

// Function to check if data exists
function checkDataExists() {
  console.log('\n🔍 Checking existing data...');
  
  const dbPath = path.join(config.dataDir, 'app.db');
  
  if (!fs.existsSync(dbPath)) {
    console.log('  📊 No existing database found - safe to deploy');
    return false;
  }
  
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
      if (err) {
        console.log('  ❌ Error checking database:', err.message);
        resolve(false);
        return;
      }
      
      const userCount = result.count;
      console.log(`  👥 Users: ${userCount}`);
      
      db.get('SELECT COUNT(*) as count FROM entries', (err, result) => {
        if (err) {
          console.log('  ❌ Error checking entries:', err.message);
          resolve(userCount > 0);
          return;
        }
        
        const entryCount = result.count;
        console.log(`  📝 Entries: ${entryCount}`);
        
        db.get('SELECT COUNT(*) as count FROM uploads', (err, result) => {
          if (err) {
            console.log('  ❌ Error checking uploads:', err.message);
            resolve(userCount > 0 || entryCount > 0);
            return;
          }
          
          const uploadCount = result.count;
          console.log(`  📎 Uploads: ${uploadCount}`);
          
          const hasData = userCount > 0 || entryCount > 0 || uploadCount > 0;
          console.log(`  📊 Has Data: ${hasData ? 'Yes' : 'No'}`);
          
          db.close();
          resolve(hasData);
        });
      });
    });
  });
}

// Function to preserve data during deployment
async function preserveData() {
  console.log('\n🛡️  Preserving data during deployment...');
  
  if (!config.preserveData) {
    console.log('  ⚠️  Data preservation is disabled');
    return;
  }
  
  const hasData = await checkDataExists();
  
  if (!hasData) {
    console.log('  ✅ No existing data to preserve');
    return;
  }
  
  // Create backup before any changes
  createBackup();
  
  // Check if we're in production environment
  if (config.environment === 'production') {
    console.log('  🚨 PRODUCTION ENVIRONMENT DETECTED');
    console.log('  ⚠️  Extra caution: Preserving all production data');
    
    // Additional production safety measures
    const productionBackupDir = path.join(config.backupDir, 'production');
    if (!fs.existsSync(productionBackupDir)) {
      fs.mkdirSync(productionBackupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const productionBackupPath = path.join(productionBackupDir, `production-${timestamp}`);
    
    try {
      fs.cpSync(config.dataDir, productionBackupPath, { recursive: true });
      console.log(`  ✅ Production backup created: ${productionBackupPath}`);
    } catch (error) {
      console.log(`  ❌ Error creating production backup: ${error.message}`);
    }
  }
  
  console.log('  ✅ Data preservation completed');
}

// Function to set up deployment safety
function setupDeploymentSafety() {
  console.log('\n🔧 Setting up deployment safety...');
  
  // Create .gitignore entries for data files
  const gitignorePath = path.join(__dirname, '.gitignore');
  const gitignoreContent = `
# Data files - DO NOT COMMIT TO GIT
data/
uploads/
*.db
*.sqlite
*.sqlite3

# Backup files
data/backup/
*.backup

# Environment files
.env
.env.local
.env.production
.env.staging

# Logs
*.log
logs/

# Temporary files
tmp/
temp/
`.trim();
  
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log('  ✅ Created .gitignore to protect data files');
  } else {
    console.log('  ✅ .gitignore already exists');
  }
  
  // Create deployment script
  const deployScript = `#!/bin/bash
# Safe deployment script for LSR Tracker

echo "🛡️  Starting safe deployment..."

# Check if we're in production
if [ "$NODE_ENV" = "production" ]; then
    echo "🚨 PRODUCTION DEPLOYMENT DETECTED"
    echo "⚠️  Preserving all production data"
    
    # Create production backup
    mkdir -p data/backup/production
    timestamp=$(date -u +"%Y-%m-%dT%H-%M-%S-%3NZ")
    cp -r data/ data/backup/production/production-$timestamp/
    echo "✅ Production backup created"
fi

# Run database migrations safely
echo "🔄 Running database migrations..."
node -e "
import('./src/db.js').then(({ ensureDatabase }) => {
    ensureDatabase();
    console.log('✅ Database migrations completed');
    process.exit(0);
}).catch(err => {
    console.error('❌ Migration error:', err);
    process.exit(1);
});
"

echo "✅ Safe deployment completed"
`;
  
  const deployScriptPath = path.join(__dirname, 'deploy-safe.sh');
  fs.writeFileSync(deployScriptPath, deployScript);
  fs.chmodSync(deployScriptPath, '755');
  console.log('  ✅ Created safe deployment script');
  
  // Create environment-specific configurations
  const envConfig = {
    development: {
      PRESERVE_DATA: 'true',
      NODE_ENV: 'development'
    },
    staging: {
      PRESERVE_DATA: 'true',
      NODE_ENV: 'staging'
    },
    production: {
      PRESERVE_DATA: 'true',
      NODE_ENV: 'production'
    }
  };
  
  Object.entries(envConfig).forEach(([env, config]) => {
    const envFile = path.join(__dirname, `.env.${env}`);
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    fs.writeFileSync(envFile, envContent);
    console.log(`  ✅ Created .env.${env}`);
  });
}

// Function to create deployment documentation
function createDeploymentDocs() {
  console.log('\n📚 Creating deployment documentation...');
  
  const docsContent = `# Safe Deployment Guide

## Overview
This guide ensures that your production data is protected when deploying updates to your LSR Tracker application.

## Data Protection Features

### 1. Automatic Backups
- All data is automatically backed up before any deployment
- Production data gets extra protection with timestamped backups
- Backups are stored in \`data/backup/\` directory

### 2. Environment Detection
- Automatically detects production vs development environments
- Applies different safety measures based on environment
- Prevents accidental data loss in production

### 3. Database Migrations
- Safe database schema updates
- Preserves existing data during migrations
- Rollback capability if migrations fail

## Deployment Process

### For Development
\`\`\`bash
npm run dev
\`\`\`

### For Staging
\`\`\`bash
NODE_ENV=staging npm start
\`\`\`

### For Production
\`\`\`bash
NODE_ENV=production npm start
\`\`\`

## Safety Measures

### 1. Data Files Protection
- \`data/\` directory is excluded from git commits
- Database files are never committed to version control
- Upload files are preserved across deployments

### 2. Environment Variables
- Different configurations for different environments
- Production-specific safety settings
- Staging environment for testing

### 3. Backup Strategy
- Automatic backups before deployments
- Production backups with timestamps
- Easy rollback if issues occur

## Troubleshooting

### If Data is Lost
1. Check \`data/backup/\` directory for recent backups
2. Restore from the most recent backup
3. Contact support if backups are missing

### If Deployment Fails
1. Check logs for error messages
2. Restore from backup if necessary
3. Fix issues and retry deployment

## Best Practices

1. **Always test in staging first**
2. **Keep regular backups**
3. **Monitor production deployments**
4. **Have rollback plan ready**

## Environment Files

- \`.env.development\` - Development settings
- \`.env.staging\` - Staging settings  
- \`.env.production\` - Production settings

## Scripts

- \`deploy-safe.sh\` - Safe deployment script
- \`backup-local.js\` - Manual backup script
- \`pull-data.js\` - Data synchronization script
`;

  const docsPath = path.join(__dirname, 'DEPLOYMENT_SAFETY.md');
  fs.writeFileSync(docsPath, docsContent);
  console.log('  ✅ Created deployment documentation');
}

// Main execution
async function main() {
  try {
    await preserveData();
    setupDeploymentSafety();
    createDeploymentDocs();
    
    console.log('\n🎉 Safe deployment setup completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Review the created configuration files');
    console.log('2. Test deployment in staging environment');
    console.log('3. Set up proper environment variables');
    console.log('4. Configure your deployment platform (Railway/Vercel)');
    console.log('5. Test production deployment with safety measures');
    
  } catch (error) {
    console.error('\n❌ Error setting up safe deployment:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();
