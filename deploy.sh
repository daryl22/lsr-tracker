#!/bin/bash

# LSR Tracker - Safe Deployment Script
# This script ensures data is preserved during deployments

set -e  # Exit on any error

echo "🛡️  LSR Tracker - Safe Deployment"
echo "================================="

# Check environment
ENVIRONMENT=${NODE_ENV:-development}
echo "🌍 Environment: $ENVIRONMENT"

# Create backup directory
mkdir -p data/backup

# Function to create backup
create_backup() {
    echo "💾 Creating backup..."
    timestamp=$(date -u +"%Y-%m-%dT%H-%M-%S-%3NZ")
    backup_dir="data/backup/$timestamp"
    mkdir -p "$backup_dir"
    
    # Backup database files
    if [ -f "data/app.db" ]; then
        cp data/app.db "$backup_dir/"
        echo "  ✅ Backed up app.db"
    fi
    
    if [ -f "data/sessions.db" ]; then
        cp data/sessions.db "$backup_dir/"
        echo "  ✅ Backed up sessions.db"
    fi
    
    # Backup uploads
    if [ -d "uploads" ]; then
        cp -r uploads "$backup_dir/"
        echo "  ✅ Backed up uploads"
    fi
    
    echo "  📁 Backup saved to: $backup_dir"
}

# Function to check if data exists
check_data_exists() {
    if [ -f "data/app.db" ]; then
        # Check if database has data
        user_count=$(sqlite3 data/app.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
        if [ "$user_count" -gt 0 ]; then
            echo "  📊 Found $user_count users in database"
            return 0
        fi
    fi
    return 1
}

# Function to run safe database migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    # Use the safe database module
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
}

# Function to start the application
start_app() {
    echo "🚀 Starting application..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "  🚨 PRODUCTION MODE - Extra safety measures enabled"
        npm start
    elif [ "$ENVIRONMENT" = "staging" ]; then
        echo "  🧪 STAGING MODE - Testing environment"
        npm start
    else
        echo "  🛠️  DEVELOPMENT MODE"
        npm run dev
    fi
}

# Main deployment process
main() {
    echo "🔍 Checking for existing data..."
    
    if check_data_exists; then
        echo "  ⚠️  Existing data found - creating backup"
        create_backup
        
        if [ "$ENVIRONMENT" = "production" ]; then
            echo "  🚨 PRODUCTION DATA DETECTED - Extra caution applied"
            # Create additional production backup
            prod_backup_dir="data/backup/production-$(date -u +"%Y-%m-%dT%H-%M-%S-%3NZ")"
            mkdir -p "$prod_backup_dir"
            cp -r data/ "$prod_backup_dir/"
            echo "  ✅ Production backup created: $prod_backup_dir"
        fi
    else
        echo "  ✅ No existing data found - safe to proceed"
    fi
    
    # Run migrations
    run_migrations
    
    # Start application
    start_app
}

# Run main function
main "$@"
