const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../config/jwt');

/**
 * Middleware to authenticate organizer JWT tokens
 */
async function authenticateOrganizer(req, res, next) {
  try {
    let token = null;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Check cookies (if parsed by cookie-parser, or parsed manually)
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } 
    // Fallback manual cookie parsing in case cookie-parser is not active
    else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/accessToken=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication token is required.'
        }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Load user
    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Account is inactive or does not exist.'
        }
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Organizer Auth Error:', error);
    
    let errCode = 'INVALID_CREDENTIALS';
    let errMsg = 'Invalid or expired session.';
    
    if (error.name === 'TokenExpiredError') {
      errCode = 'SESSION_EXPIRED';
      errMsg = 'Your session has expired. Please log in again.';
    }

    return res.status(401).json({
      success: false,
      error: {
        code: errCode,
        message: errMsg
      }
    });
  }
}

module.exports = {
  authenticateOrganizer
};
