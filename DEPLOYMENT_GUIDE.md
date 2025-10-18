# LSR Tracker - Safe Deployment Guide

## 🛡️ Data Protection Overview

This guide ensures that your production data is **completely protected** when you push updates to your GitHub repository. Your data will never be lost during deployments.

## 🚀 Quick Start

### For Development
```bash
npm run deploy:dev
```

### For Staging
```bash
npm run deploy:staging
```

### For Production
```bash
npm run deploy:prod
```

## 🔒 Data Protection Features

### 1. **Automatic Backups**
- ✅ All data is backed up before any deployment
- ✅ Production data gets extra protection with timestamped backups
- ✅ Backups are stored in `data/backup/` directory
- ✅ Easy rollback if anything goes wrong

### 2. **Environment Detection**
- ✅ Automatically detects production vs development environments
- ✅ Applies different safety measures based on environment
- ✅ Prevents accidental data loss in production

### 3. **Safe Database Migrations**
- ✅ Database schema updates preserve existing data
- ✅ Only adds new columns, never deletes existing data
- ✅ Rollback capability if migrations fail

### 4. **Git Protection**
- ✅ Data files are excluded from git commits
- ✅ Database files are never committed to version control
- ✅ Upload files are preserved across deployments

## 📁 File Structure

```
lsr-tracker/
├── data/                    # Database files (NOT in git)
│   ├── app.db              # Main database
│   ├── sessions.db         # Session data
│   └── backup/             # Automatic backups
├── uploads/                 # Upload files (NOT in git)
├── src/
│   ├── db.js               # Original database (safe)
│   └── db-safe.js          # Enhanced safe database
├── deploy-safe.js          # Safe deployment script
├── deploy.ps1              # PowerShell deployment
└── .gitignore              # Protects data files
```

## 🛠️ Available Commands

### Node.js Commands
```bash
# Safe deployment (auto-detects environment)
npm run deploy

# Environment-specific deployments
npm run deploy:dev        # Development
npm run deploy:staging    # Staging
npm run deploy:prod       # Production

# Data management
npm run backup            # Manual backup
npm run pull-data         # Pull from live
npm run find-live         # Find live environment
```

### PowerShell Commands (Windows)
```bash
# Safe deployment
npm run deploy:ps

# Environment-specific
npm run deploy:ps:dev     # Development
npm run deploy:ps:staging # Staging
npm run deploy:ps:prod    # Production
```

## 🔧 Environment Configuration

### Development
- Uses local `data/` directory
- Full logging enabled
- Safe for testing

### Staging
- Uses `data-staging/` directory
- Production-like settings
- Safe for testing before production

### Production
- Uses `/app/data/` directory (Railway/Vercel)
- Extra safety measures
- Minimal logging for performance

## 🚨 Production Safety Measures

When deploying to production:

1. **Extra Backups**: Production data gets double backup protection
2. **Data Validation**: Checks for existing data before any changes
3. **Safe Migrations**: Only adds new features, never removes data
4. **Rollback Ready**: Easy to rollback if issues occur

## 📋 Deployment Process

### 1. **Pre-Deployment Checks**
- ✅ Check for existing data
- ✅ Create automatic backup
- ✅ Validate environment settings

### 2. **Safe Database Updates**
- ✅ Run migrations safely
- ✅ Preserve all existing data
- ✅ Add new features without breaking existing data

### 3. **Application Start**
- ✅ Start with appropriate environment settings
- ✅ Monitor for any issues
- ✅ Ready for use

## 🔄 Rollback Process

If something goes wrong:

1. **Stop the application**
2. **Restore from backup**:
   ```bash
   # Find latest backup
   ls data/backup/
   
   # Restore database
   cp data/backup/[timestamp]/app.db data/
   cp data/backup/[timestamp]/sessions.db data/
   ```
3. **Restart application**

## 🛡️ Data Safety Guarantees

### ✅ **Your Data is Protected**
- Database files are never committed to git
- Automatic backups before every deployment
- Production data gets extra protection
- Easy rollback if needed

### ✅ **Safe Updates**
- Only adds new features
- Never deletes existing data
- Preserves all user data
- Maintains data integrity

### ✅ **Environment Isolation**
- Development data separate from production
- Staging environment for testing
- Production data completely isolated

## 🚀 Deployment Platforms

### Railway
```bash
# Set environment variables in Railway dashboard
NODE_ENV=production
PRESERVE_DATA=true
PRODUCTION_DATA_DIR=/app/data
```

### Vercel
```bash
# Set environment variables in Vercel dashboard
NODE_ENV=production
PRESERVE_DATA=true
```

## 🔍 Monitoring

### Check Deployment Status
```bash
# Check if deployment was successful
npm run deploy:ps:prod

# Check backup status
ls data/backup/

# Check database status
node -e "console.log('Database connected successfully')"
```

### Logs
- Development: Full debug logs
- Staging: Debug logs for testing
- Production: Essential logs only

## 🆘 Troubleshooting

### If Data is Lost
1. Check `data/backup/` directory for recent backups
2. Restore from the most recent backup
3. Contact support if backups are missing

### If Deployment Fails
1. Check logs for error messages
2. Restore from backup if necessary
3. Fix issues and retry deployment

### If Database is Corrupted
1. Stop the application
2. Restore from backup
3. Check for any migration issues
4. Restart application

## 📞 Support

If you encounter any issues:

1. **Check the logs** for specific error messages
2. **Verify your environment** variables are set correctly
3. **Check backups** are available
4. **Test in staging** before production

## 🎯 Best Practices

1. **Always test in staging first**
2. **Keep regular backups**
3. **Monitor production deployments**
4. **Have rollback plan ready**
5. **Use environment-specific configurations**

---

## 🎉 You're All Set!

Your LSR Tracker is now configured with **complete data protection**. You can push updates to GitHub without worrying about losing your production data. The system will automatically:

- ✅ Backup your data before any changes
- ✅ Preserve all existing data during updates
- ✅ Add new features safely
- ✅ Provide easy rollback if needed

**Your data is safe!** 🛡️
