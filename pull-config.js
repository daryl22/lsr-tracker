// Configuration for pulling data from live environment
export const config = {
  // Update this with your actual live environment URL
  LIVE_URL: process.env.LIVE_URL || 'https://your-live-app.railway.app',
  
  // API authentication (if required)
  API_KEY: process.env.API_KEY || '',
  
  // Database backup settings
  BACKUP_LOCAL: true, // Create backup before pulling
  BACKUP_PATH: './data/backup',
  
  // Data pull options
  PULL_USERS: true,
  PULL_ENTRIES: true,
  PULL_UPLOADS: true,
  PULL_EVENTS: true,
  PULL_EVENT_PARTICIPANTS: true,
  
  // Clear existing data before pulling (be careful!)
  CLEAR_EXISTING: true,
  
  // API endpoints (these should match your live API)
  ENDPOINTS: {
    HEALTH: '/api/health',
    USERS: '/api/admin/users',
    ENTRIES: '/api/admin/entries',
    UPLOADS: '/api/admin/uploads',
    EVENTS: '/api/admin/events',
    EVENT_PARTICIPANTS: '/api/admin/event-participants'
  }
};

// Common Railway deployment URLs (update with your actual URL)
export const commonUrls = [
  'https://lsr-tracker-production.railway.app',
  'https://lsr-tracker-staging.railway.app',
  'https://lsr-tracker.railway.app',
  'https://your-app-name.railway.app'
];

// Vercel deployment URLs (if using Vercel)
export const vercelUrls = [
  'https://lsr-tracker.vercel.app',
  'https://lsr-tracker-git-main.vercel.app'
];
