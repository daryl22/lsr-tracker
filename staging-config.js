// Staging Environment Configuration
export const stagingConfig = {
  // Environment settings
  NODE_ENV: 'staging',
  PORT: process.env.PORT || 3001, // Different port for staging
  
  // Data protection
  PRESERVE_DATA: true,
  STAGING_DATA_DIR: './data-staging',
  
  // Database safety
  DB_BACKUP_ENABLED: true,
  DB_MIGRATION_SAFE: true,
  
  // Security settings
  CORS_ORIGIN: process.env.STAGING_CORS_ORIGIN || 'http://localhost:3001',
  TRUST_PROXY: false,
  
  // Logging
  LOG_LEVEL: 'debug',
  
  // Staging-specific features
  ENABLE_DEBUG_ROUTES: true,
  ENABLE_TEST_DATA: true,
  ENABLE_MOCK_DATA: false,
  
  // Deployment settings
  DEPLOYMENT_BRANCH: 'staging',
  DEPLOYMENT_URL: process.env.STAGING_URL || 'https://lsr-tracker-staging.railway.app',
  
  // API settings
  API_VERSION: 'v1',
  ENABLE_SWAGGER: true,
  ENABLE_HEALTH_CHECK: true
};

// Staging-specific database configuration
export const stagingDbConfig = {
  // Use separate database for staging
  database: './data-staging/app.db',
  sessions: './data-staging/sessions.db',
  
  // Staging-specific settings
  enableLogging: true,
  enableBackup: true,
  backupInterval: '1h', // Backup every hour in staging
  
  // Test data settings
  seedTestData: true,
  resetOnDeploy: false // Don't reset data on each deploy
};

// Staging deployment settings
export const stagingDeployConfig = {
  // Branch protection
  requirePullRequest: true,
  requireReviews: 1,
  requireStatusChecks: true,
  
  // Deployment settings
  autoDeploy: false, // Manual deployment for staging
  notifyOnDeploy: true,
  
  // Environment variables
  envVars: {
    NODE_ENV: 'staging',
    PRESERVE_DATA: 'true',
    STAGING_DATA_DIR: './data-staging',
    LOG_LEVEL: 'debug'
  }
};

export default stagingConfig;
