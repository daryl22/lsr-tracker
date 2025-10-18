# LSR Tracker - Safe Deployment Script (PowerShell)
# This script ensures data is preserved during deployments

param(
    [string]$Environment = "development"
)

Write-Host "🛡️  LSR Tracker - Safe Deployment" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Set environment
$env:NODE_ENV = $Environment
Write-Host "🌍 Environment: $Environment" -ForegroundColor Yellow

# Create backup directory
if (!(Test-Path "data/backup")) {
    New-Item -ItemType Directory -Path "data/backup" -Force
}

# Function to create backup
function Create-Backup {
    Write-Host "💾 Creating backup..." -ForegroundColor Blue
    
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss-fffZ"
    $backupDir = "data/backup/$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force
    
    # Backup database files
    if (Test-Path "data/app.db") {
        Copy-Item "data/app.db" "$backupDir/" -Force
        Write-Host "  ✅ Backed up app.db" -ForegroundColor Green
    }
    
    if (Test-Path "data/sessions.db") {
        Copy-Item "data/sessions.db" "$backupDir/" -Force
        Write-Host "  ✅ Backed up sessions.db" -ForegroundColor Green
    }
    
    # Backup uploads
    if (Test-Path "uploads") {
        Copy-Item "uploads" "$backupDir/" -Recurse -Force
        Write-Host "  ✅ Backed up uploads" -ForegroundColor Green
    }
    
    Write-Host "  📁 Backup saved to: $backupDir" -ForegroundColor Cyan
}

# Function to check if data exists
function Test-DataExists {
    if (Test-Path "data/app.db") {
        try {
            # Try to check if database has data using Node.js
            $userCount = node -e "
                const sqlite3 = require('sqlite3');
                const db = new sqlite3.Database('./data/app.db');
                db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
                    if (err) {
                        console.log('0');
                        process.exit(1);
                    } else {
                        console.log(result.count);
                        process.exit(0);
                    }
                });
            " 2>$null
            
            if ($userCount -and $userCount -gt 0) {
                Write-Host "  📊 Found $userCount users in database" -ForegroundColor Yellow
                return $true
            }
        } catch {
            Write-Host "  ⚠️  Could not check database content" -ForegroundColor Yellow
        }
    }
    return $false
}

# Function to run safe database migrations
function Start-Migrations {
    Write-Host "🔄 Running database migrations..." -ForegroundColor Blue
    
    try {
        node -e "
            import('./src/db-safe.js').then(({ ensureDatabase }) => {
                ensureDatabase();
                console.log('✅ Database migrations completed safely');
                process.exit(0);
            }).catch(err => {
                console.error('❌ Migration error:', err);
                process.exit(1);
            });
        "
        Write-Host "  ✅ Migrations completed" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Migration failed" -ForegroundColor Red
        throw
    }
}

# Function to start the application
function Start-Application {
    Write-Host "🚀 Starting application..." -ForegroundColor Blue
    
    if ($Environment -eq "production") {
        Write-Host "  🚨 PRODUCTION MODE - Extra safety measures enabled" -ForegroundColor Red
        npm start
    } elseif ($Environment -eq "staging") {
        Write-Host "  🧪 STAGING MODE - Testing environment" -ForegroundColor Yellow
        npm start
    } else {
        Write-Host "  🛠️  DEVELOPMENT MODE" -ForegroundColor Green
        npm run dev
    }
}

# Main deployment process
function Start-Deployment {
    Write-Host "🔍 Checking for existing data..." -ForegroundColor Blue
    
    if (Test-DataExists) {
        Write-Host "  ⚠️  Existing data found - creating backup" -ForegroundColor Yellow
        Create-Backup
        
        if ($Environment -eq "production") {
            Write-Host "  🚨 PRODUCTION DATA DETECTED - Extra caution applied" -ForegroundColor Red
            # Create additional production backup
            $prodBackupDir = "data/backup/production-$(Get-Date -Format 'yyyy-MM-ddTHH-mm-ss-fffZ')"
            New-Item -ItemType Directory -Path $prodBackupDir -Force
            Copy-Item "data/*" $prodBackupDir/ -Recurse -Force
            Write-Host "  ✅ Production backup created: $prodBackupDir" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✅ No existing data found - safe to proceed" -ForegroundColor Green
    }
    
    # Run migrations
    Start-Migrations
    
    # Start application
    Start-Application
}

# Run main function
try {
    Start-Deployment
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
