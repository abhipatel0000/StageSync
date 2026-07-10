const { Event, EventCredential, GuestSession, File, QrAccessToken } = require('../models');
const { hashToken, compareToken, generateSecureToken } = require('../utils/security');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

// Helper to parse user agent to a readable device name
function getDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device';
  
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Macintosh')) os = 'macOS';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('Linux')) os = 'Linux';

  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';

  return `${browser} on ${os}`;
}

/**
 * Authenticate guest via Event Code + PIN
 */
async function authenticate(req, res) {
  try {
    const { eventCode, pin } = req.body;

    if (!eventCode || !pin) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Event Code and PIN are required.' }
      });
    }

    const cleanEventCode = eventCode.trim().toUpperCase();

    // Find credentials (case-insensitive search)
    const credentials = await EventCredential.findOne({
      where: sequelize.where(
        sequelize.fn('upper', sequelize.col('event_code')),
        cleanEventCode
      ),
      include: [Event]
    });

    if (!credentials || !credentials.Event || credentials.Event.status === 'DELETED') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_EVENT_CODE', message: 'Incorrect Event Code.' }
      });
    }

    const event = credentials.Event;
    const now = new Date();

    // Check Lockout
    if (credentials.locked_until && new Date(credentials.locked_until) > now) {
      const minutesLeft = Math.ceil((new Date(credentials.locked_until) - now) / 60000);
      return res.status(403).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: `Too many failed attempts. This event is temporarily locked. Try again in ${minutesLeft} minutes.`
        }
      });
    }

    // Verify PIN
    const isMatch = compareToken(pin, credentials.pin_hash);
    if (!isMatch) {
      // Increment failed attempts
      credentials.failed_attempts += 1;
      let isLocked = false;
      
      if (credentials.failed_attempts >= 5) {
        // Lock for 15 minutes
        credentials.locked_until = new Date(Date.now() + 15 * 60 * 1000);
        isLocked = true;
      }
      
      await credentials.save();

      if (isLocked) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Too many failed attempts. This event has been locked for 15 minutes.'
          }
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PIN',
          message: `Incorrect PIN. ${5 - credentials.failed_attempts} attempts remaining.`
        }
      });
    }

    // Validate access times
    if (now < new Date(event.access_starts_at)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EVENT_NOT_ACTIVE',
          message: 'Access to this event has not started yet.'
        }
      });
    }

    if (now > new Date(event.access_expires_at) || event.status === 'EXPIRED') {
      // Mark as EXPIRED in DB if needed
      if (event.status !== 'EXPIRED') {
        event.status = 'EXPIRED';
        await event.save();
      }
      return res.status(403).json({
        success: false,
        error: { code: 'EVENT_EXPIRED', message: 'This event has expired.' }
      });
    }

    // Check maximum sessions limit
    const activeSessionsCount = await GuestSession.count({
      where: {
        event_id: event.id,
        revoked_at: null,
        expires_at: { [Op.gt]: now }
      }
    });

    if (activeSessionsCount >= event.max_guest_sessions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TOO_MANY_SESSIONS',
          message: 'Maximum active guest sessions limit reached for this event.'
        }
      });
    }

    // Reset failed attempts on success
    credentials.failed_attempts = 0;
    credentials.locked_until = null;
    await credentials.save();

    // Generate secure token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Session duration matches event access expiration
    const expiresAt = new Date(event.access_expires_at);

    // Create session
    const userAgent = req.headers['user-agent'];
    const session = await GuestSession.create({
      event_id: event.id,
      session_token_hash: tokenHash,
      auth_method: 'CODE_PIN',
      credentials_version: credentials.credentials_version,
      ip_address: req.ip,
      user_agent: userAgent,
      device_name: getDeviceName(userAgent),
      expires_at: expiresAt
    });

    // Set cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('guestSessionToken', rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      expires: expiresAt
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionToken: rawToken,
        session: {
          publicId: session.public_id,
          deviceName: session.device_name,
          expiresAt: session.expires_at
        },
        event: {
          publicId: event.public_id,
          name: event.name,
          allowDownload: event.allow_download,
          allowDownloadAll: event.allow_download_all
        }
      },
      message: 'Guest authenticated successfully.'
    });
  } catch (error) {
    console.error('Guest Auth Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Authentication failed.' }
    });
  }
}

/**
 * Guest logout
 */
async function logout(req, res) {
  try {
    const rawToken = req.cookies.guestSessionToken || req.headers['x-guest-token'];

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await GuestSession.update(
        { revoked_at: new Date() },
        { where: { session_token_hash: tokenHash, revoked_at: null } }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('guestSessionToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax'
    });

    return res.status(200).json({
      success: true,
      data: {},
      message: 'Guest session terminated.'
    });
  } catch (error) {
    console.error('Guest Logout Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Logout failed.' }
    });
  }
}

/**
 * Get guest authorized event info
 */
async function getGuestEvent(req, res) {
  // Available from authenticateGuest middleware
  const event = req.event;
  const session = req.guestSession;

  return res.status(200).json({
    success: true,
    data: {
      event: {
        publicId: event.public_id,
        name: event.name,
        description: event.description,
        venueName: event.venue_name,
        allowDownload: event.allow_download,
        allowDownloadAll: event.allow_download_all
      },
      session: {
        publicId: session.public_id,
        deviceName: session.device_name,
        expiresAt: session.expires_at
      }
    }
  });
}

/**
 * Authenticate guest via QR Token (single-use, short-lived)
 */
async function authenticateQr(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'QR token is required.' }
      });
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    // Find valid QR token
    const qrToken = await QrAccessToken.findOne({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { [Op.gt]: now }
      },
      include: [
        {
          model: Event,
          include: [EventCredential]
        }
      ]
    });

    if (!qrToken || !qrToken.Event || qrToken.Event.status === 'DELETED') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'The QR token is invalid, expired, or has already been used.' }
      });
    }

    const event = qrToken.Event;
    const credentials = event.EventCredential;

    // Validate event status and access times
    if (now < new Date(event.access_starts_at)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EVENT_NOT_ACTIVE',
          message: 'Access to this event has not started yet.'
        }
      });
    }

    if (now > new Date(event.access_expires_at) || event.status === 'EXPIRED') {
      if (event.status !== 'EXPIRED') {
        event.status = 'EXPIRED';
        await event.save();
      }
      return res.status(403).json({
        success: false,
        error: { code: 'EVENT_EXPIRED', message: 'This event has expired.' }
      });
    }

    // Check maximum sessions limit
    const activeSessionsCount = await GuestSession.count({
      where: {
        event_id: event.id,
        revoked_at: null,
        expires_at: { [Op.gt]: now }
      }
    });

    if (activeSessionsCount >= event.max_guest_sessions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TOO_MANY_SESSIONS',
          message: 'Maximum active guest sessions limit reached for this event.'
        }
      });
    }

    // Atomically mark QR token as used
    qrToken.used_at = now;
    await qrToken.save();

    // Generate guest session token
    const rawToken = generateSecureToken();
    const sessionTokenHash = hashToken(rawToken);
    const expiresAt = new Date(event.access_expires_at);

    // Create session
    const userAgent = req.headers['user-agent'];
    const session = await GuestSession.create({
      event_id: event.id,
      session_token_hash: sessionTokenHash,
      auth_method: 'QR_TOKEN',
      credentials_version: credentials ? credentials.credentials_version : 1,
      ip_address: req.ip,
      user_agent: userAgent,
      device_name: getDeviceName(userAgent),
      expires_at: expiresAt
    });

    // Set cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('guestSessionToken', rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      expires: expiresAt
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionToken: rawToken,
        session: {
          publicId: session.public_id,
          deviceName: session.device_name,
          expiresAt: session.expires_at
        },
        event: {
          publicId: event.public_id,
          name: event.name,
          allowDownload: event.allow_download,
          allowDownloadAll: event.allow_download_all
        }
      },
      message: 'Guest authenticated via QR successfully.'
    });
  } catch (error) {
    console.error('QR Auth Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Authentication failed.' }
    });
  }
}

module.exports = {
  authenticate,
  logout,
  getGuestEvent,
  authenticateQr
};
