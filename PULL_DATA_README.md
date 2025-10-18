# Pull Data from Live Environment

This guide helps you pull data from your live LSR Tracker environment to your local development environment.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Find your live environment:**
   ```bash
   npm run find-live
   ```

3. **Pull data from live:**
   ```bash
   npm run pull-data
   ```

## Manual Configuration

If the automatic detection doesn't work, you can manually specify your live environment URL:

```bash
# Set your live URL
LIVE_URL=https://your-app.railway.app npm run pull-data

# Or for Vercel
LIVE_URL=https://your-app.vercel.app npm run pull-data
```

## Available Scripts

- `npm run find-live` - Automatically find and test live environments
- `npm run backup` - Create backup of local data before pulling
- `npm run pull-data` - Pull all data from live environment

## What Gets Pulled

The script will pull the following data from your live environment:

- 👥 **Users** - All user accounts and profiles
- 📝 **Entries** - Daily running entries (km, hours, pace)
- 📎 **Uploads** - File uploads and attachments
- 🎯 **Events** - Running events and competitions
- 👥 **Event Participants** - User participation in events

## Safety Features

- ✅ **Automatic Backup** - Your local data is backed up before pulling
- ✅ **Data Validation** - Checks for data integrity during import
- ✅ **Error Handling** - Graceful handling of connection issues
- ✅ **Progress Tracking** - Shows detailed progress during data pull

## Troubleshooting

### "Cannot find live environment"
- Check if your live environment is actually deployed and running
- Verify the URL in your deployment platform (Railway/Vercel)
- Make sure the environment is accessible from your network

### "API endpoints not accessible"
- Your live environment might not have admin endpoints enabled
- Check if authentication is required (set API_KEY environment variable)
- Verify that the live environment is running the same version as your local code

### "Database errors"
- Make sure your local database is not locked by another process
- Check if you have write permissions to the data directory
- Try running the backup script first: `npm run backup`

## Environment Variables

You can set these environment variables to customize the data pull:

```bash
# Required: Your live environment URL
LIVE_URL=https://your-app.railway.app

# Optional: API authentication key
API_KEY=your-api-key-here

# Optional: Disable backup (not recommended)
BACKUP_LOCAL=false
```

## File Structure

After running the data pull, your local environment will have:

```
data/
├── app.db              # Main database with pulled data
├── sessions.db         # Session data
└── backup/             # Automatic backups
    └── 2024-01-15T10-30-00-000Z-app.db
```

## Support

If you encounter issues:

1. Check the console output for specific error messages
2. Verify your live environment is accessible
3. Ensure you have the latest version of the code
4. Try running the backup script first to preserve your local data

## Security Notes

- The script only pulls data, it doesn't push anything to live
- Your local data is automatically backed up before pulling
- Admin endpoints are used to access all data (ensure your live environment has these)
- No sensitive data (like passwords) is logged during the process
