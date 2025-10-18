# Safe Deployment Guide

## Overview
This guide ensures that your production data is protected when deploying updates to your LSR Tracker application.

## Data Protection Features

### 1. Automatic Backups
- All data is automatically backed up before any deployment
- Production data gets extra protection with timestamped backups
- Backups are stored in `data/backup/` directory

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
```bash
npm run dev
```

### For Staging
```bash
NODE_ENV=staging npm start
```

### For Production
```bash
NODE_ENV=production npm start
```

## Safety Measures

### 1. Data Files Protection
- `data/` directory is excluded from git commits
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
1. Check `data/backup/` directory for recent backups
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

- `.env.development` - Development settings
- `.env.staging` - Staging settings  
- `.env.production` - Production settings

## Scripts

- `deploy-safe.sh` - Safe deployment script
- `backup-local.js` - Manual backup script
- `pull-data.js` - Data synchronization script
