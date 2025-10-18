# 🧪 Staging Branch Workflow

## Overview
Your LSR Tracker now has a dedicated staging branch for testing changes before deploying to production. This ensures your production data is always safe.

## 🌿 Branch Structure

```
main (production)
├── staging (testing)
└── feature branches
```

## 🚀 Staging Commands

### Setup Staging Environment
```bash
# Set up staging environment with production data
npm run staging

# Start staging server
npm run staging:start

# Start staging with auto-reload
npm run staging:dev
```

### Branch Management
```bash
# Switch to staging branch
git checkout staging

# Create feature branch from staging
git checkout -b feature/new-feature

# Merge feature to staging
git checkout staging
git merge feature/new-feature

# Merge staging to main (production)
git checkout main
git merge staging
```

## 🔄 Workflow Process

### 1. **Development Workflow**
```bash
# Start with staging branch
git checkout staging

# Create feature branch
git checkout -b feature/your-feature

# Make your changes
# Test locally
npm run staging:dev

# Commit changes
git add .
git commit -m "Add new feature"

# Push feature branch
git push origin feature/your-feature
```

### 2. **Testing in Staging**
```bash
# Switch to staging branch
git checkout staging

# Pull latest changes
git pull origin staging

# Set up staging environment
npm run staging

# Test your changes
npm run staging:dev

# Verify everything works
# Test all features
# Check data integrity
```

### 3. **Deploy to Production**
```bash
# When staging is ready, merge to main
git checkout main
git merge staging

# Deploy to production
npm run deploy:prod

# Push to production repository
git push origin main
```

## 🛡️ Data Protection

### Staging Data
- **Separate Database**: `data-staging/app.db`
- **Separate Uploads**: `uploads-staging/`
- **Automatic Backups**: `data-staging/backup/`
- **Production Data Copy**: Staging gets production data for testing

### Production Data Safety
- **Never Modified**: Production data is never touched during staging
- **Isolated Environment**: Staging runs on different port (3001)
- **Safe Testing**: Test all changes without risk to production

## 📋 Staging Features

### Enhanced Debugging
- **Debug Routes**: Additional debugging endpoints
- **Test Data**: Option to seed test data
- **Detailed Logging**: Full debug logging enabled
- **Health Checks**: Enhanced health monitoring

### Staging-Specific Settings
- **Port**: 3001 (different from production)
- **Database**: Separate staging database
- **Logging**: Debug level logging
- **CORS**: Staging-specific origins

## 🔧 Configuration

### Environment Variables
```bash
# Staging environment
NODE_ENV=staging
PORT=3001
STAGING_DATA_DIR=./data-staging
LOG_LEVEL=debug
ENABLE_DEBUG_ROUTES=true
```

### Database Settings
- **Location**: `data-staging/app.db`
- **Backups**: `data-staging/backup/`
- **Sessions**: `data-staging/sessions.db`

## 🚨 Safety Measures

### Before Testing
1. **Backup Production**: Always backup before testing
2. **Check Staging**: Verify staging environment is clean
3. **Test Features**: Test all new features thoroughly
4. **Data Integrity**: Verify data is preserved correctly

### Before Production
1. **Staging Tests**: All tests pass in staging
2. **Data Validation**: Verify data integrity
3. **Feature Complete**: All features working correctly
4. **Performance**: Check performance impact

## 📊 Monitoring

### Staging Health Checks
```bash
# Check staging status
curl http://localhost:3001/api/health

# Check database status
curl http://localhost:3001/api/status

# Check staging logs
npm run staging:dev
```

### Production Health Checks
```bash
# Check production status
curl https://your-production-url.com/api/health

# Check production logs
npm run deploy:prod
```

## 🎯 Best Practices

### 1. **Always Test in Staging First**
- Never deploy directly to production
- Test all changes in staging
- Verify data integrity

### 2. **Use Feature Branches**
- Create feature branches from staging
- Test features in isolation
- Merge to staging when ready

### 3. **Regular Backups**
- Backup staging data regularly
- Backup production before any changes
- Keep backup history

### 4. **Monitor Deployments**
- Watch staging deployment logs
- Monitor production deployment
- Have rollback plan ready

## 🆘 Troubleshooting

### Staging Issues
```bash
# Reset staging environment
rm -rf data-staging/
npm run staging

# Check staging logs
npm run staging:dev

# Restore from backup
cp data-staging/backup/latest/* data-staging/
```

### Production Issues
```bash
# Rollback production
npm run deploy:prod

# Check production logs
npm run deploy:prod

# Restore from backup
cp data/backup/latest/* data/
```

## 🎉 You're Ready!

Your staging branch is now set up with:
- ✅ **Separate Environment**: Staging runs independently
- ✅ **Production Data Copy**: Test with real data safely
- ✅ **Enhanced Debugging**: Full debugging capabilities
- ✅ **Safe Testing**: No risk to production data
- ✅ **Easy Workflow**: Simple commands for testing

**Start testing your changes safely!** 🧪
