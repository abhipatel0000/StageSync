const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Hash a plaintext password using bcrypt
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Compare a plaintext password with a bcrypt hash
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Hash a PIN or temporary token using SHA-256
 * @param {string} token 
 * @returns {string}
 */
function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a raw token with a stored SHA-256 hash in constant time
 * @param {string} token 
 * @param {string} hash 
 * @returns {boolean}
 */
function compareToken(token, hash) {
  if (!token || !hash) return false;
  const hashedInput = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(hashedInput, 'hex'), Buffer.from(hash, 'hex'));
}

/**
 * Generate a cryptographically secure random event code (e.g. EV-A7K9P2)
 * @returns {string}
 */
function generateEventCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit confusing letters like O, I, 1, 0
  let code = 'EV-';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  return code;
}

/**
 * Generate a cryptographically secure 6-digit numeric PIN
 * @returns {string}
 */
function generatePin() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate a secure random token (e.g. for guest sessions or QR tokens)
 * @returns {string}
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  hashToken,
  compareToken,
  generateEventCode,
  generatePin,
  generateSecureToken
};
