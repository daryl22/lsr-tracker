#!/bin/bash
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
