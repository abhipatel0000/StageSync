const crypto = require('crypto');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Check for missing or placeholder secret keys in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'stagesync_access_token_secret_key_change_me') {
  if (isProduction) {
    throw new Error('FATAL: JWT_SECRET must be set to a secure, unique secret in production environment!');
  }
}

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === 'stagesync_refresh_token_secret_key_change_me') {
  if (isProduction) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be set to a secure, unique secret in production environment!');
  }
}

// Generate secure random fallback keys for development and test environments if none exist
const fallbackSecret = crypto.randomBytes(32).toString('hex');
const fallbackRefreshSecret = crypto.randomBytes(32).toString('hex');

module.exports = {
  JWT_SECRET: (JWT_SECRET && JWT_SECRET !== 'stagesync_access_token_secret_key_change_me') ? JWT_SECRET : fallbackSecret,
  JWT_REFRESH_SECRET: (JWT_REFRESH_SECRET && JWT_REFRESH_SECRET !== 'stagesync_refresh_token_secret_key_change_me') ? JWT_REFRESH_SECRET : fallbackRefreshSecret
};
