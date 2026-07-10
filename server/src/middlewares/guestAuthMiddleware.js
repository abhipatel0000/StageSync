const { GuestSession, Event, EventCredential } = require('../models');
const { hashToken } = require('../utils/security');

/**
 * Middleware to authenticate venue computer guest sessions
 */
async function authenticateGuest(req, res, next) {
  try {
    let token = null;

    // Check custom header
    if (req.headers['x-guest-token']) {
      token = req.headers['x-guest-token'];
    }
    // Check cookies
    else if (req.cookies && req.cookies.guestSessionToken) {
      token = req.cookies.guestSessionToken;
    }
    // Fallback manual cookie parsing
    else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/guestSessionToken=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Guest session token is missing.'
        }
      });
    }

    // Hash the token to compare with DB
    const tokenHash = hashToken(token);

    // Find the session
    const session = await GuestSession.findOne({
      where: {
        session_token_hash: tokenHash,
        revoked_at: null
      },
      include: [
        {
          model: Event,
          include: [EventCredential]
        }
      ]
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_REVOKED',
          message: 'Session is invalid or has been revoked by the organizer.'
        }
      });
    }

    // Check session expiration
    const now = new Date();
    if (new Date(session.expires_at) < now) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your guest session has expired.'
        }
      });
    }

    const event = session.Event;
    if (!event) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Associated event not found.'
        }
      });
    }

    // Verify event status and access windows
    if (event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'This event is no longer available.'
        }
      });
    }

    if (now < new Date(event.access_starts_at)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EVENT_NOT_ACTIVE',
          message: 'Access window to this event has not started yet.'
        }
      });
    }

    if (now > new Date(event.access_expires_at) || event.status === 'EXPIRED') {
      // Proactively update status to EXPIRED in database if it hasn't been done yet
      if (event.status !== 'EXPIRED') {
        event.status = 'EXPIRED';
        await event.save();
      }
      return res.status(403).json({
        success: false,
        error: {
          code: 'EVENT_EXPIRED',
          message: 'This event workspace has expired.'
        }
      });
    }

    // Check credential version mismatch (meaning credentials regenerated, so existing sessions are revoked)
    if (event.EventCredential && session.credentials_version !== event.EventCredential.credentials_version) {
      // Revoke this session immediately
      session.revoked_at = now;
      await session.save();

      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_REVOKED',
          message: 'Organizer regenerated event credentials. Please authenticate again.'
        }
      });
    }

    // Update last activity time
    session.last_activity_at = now;
    await session.save();

    // Attach to request
    req.guestSession = session;
    req.event = event;
    next();
  } catch (error) {
    console.error('Guest Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during verification.'
      }
    });
  }
}

module.exports = {
  authenticateGuest
};
