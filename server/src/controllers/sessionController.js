const { Event, GuestSession, DownloadLog, AuditLog, File } = require('../models');
const { Op } = require('sequelize');

/**
 * List all sessions for a specific event
 */
async function listSessions(req, res) {
  try {
    const { eventId } = req.params;

    // Verify event ownership
    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const sessions = await GuestSession.findAll({
      where: { event_id: event.id },
      order: [['created_at', 'DESC']]
    });

    const formattedSessions = sessions.map(s => {
      const now = new Date();
      const isExpired = new Date(s.expires_at) < now;
      const isActive = s.revoked_at === null && !isExpired;

      return {
        publicId: s.public_id,
        deviceName: s.device_name,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        authMethod: s.auth_method,
        createdAt: s.created_at,
        lastActivityAt: s.last_activity_at,
        expiresAt: s.expires_at,
        revokedAt: s.revoked_at,
        status: s.revoked_at ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE'
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        sessions: formattedSessions
      }
    });
  } catch (error) {
    console.error('List Sessions Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve sessions.' }
    });
  }
}

/**
 * Revoke a single guest session
 */
async function revokeSession(req, res) {
  try {
    const { eventId, sessionId } = req.params;

    // Verify event ownership
    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const session = await GuestSession.findOne({
      where: { public_id: sessionId, event_id: event.id }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found.' }
      });
    }

    if (session.revoked_at) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Session has already been revoked.' }
      });
    }

    session.revoked_at = new Date();
    await session.save();

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'SESSION_REVOKED',
      resource_type: 'guest_sessions',
      resource_id: session.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      metadata: { deviceName: session.device_name }
    });

    return res.status(200).json({
      success: true,
      data: {},
      message: 'Guest session revoked successfully.'
    });
  } catch (error) {
    console.error('Revoke Session Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to revoke session.' }
    });
  }
}

/**
 * Revoke all guest sessions for an event
 */
async function revokeAllSessions(req, res) {
  try {
    const { eventId } = req.params;

    // Verify event ownership
    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    await GuestSession.update(
      { revoked_at: new Date() },
      {
        where: {
          event_id: event.id,
          revoked_at: null,
          expires_at: { [Op.gt]: new Date() }
        }
      }
    );

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'ALL_SESSIONS_REVOKED',
      resource_type: 'events',
      resource_id: event.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {},
      message: 'All active guest sessions for this event have been revoked.'
    });
  } catch (error) {
    console.error('Revoke All Sessions Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to revoke sessions.' }
    });
  }
}

/**
 * Get download logs for an event
 */
async function getDownloadLogs(req, res) {
  try {
    const { eventId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const { count, rows: logs } = await DownloadLog.findAndCountAll({
      where: { event_id: event.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: File,
          attributes: ['display_name', 'public_id']
        },
        {
          model: GuestSession,
          attributes: ['device_name', 'public_id']
        }
      ]
    });

    const formattedLogs = logs.map(l => ({
      id: l.id,
      fileName: l.File ? l.File.display_name : 'Deleted File',
      fileId: l.File ? l.File.public_id : null,
      deviceName: l.GuestSession ? l.GuestSession.device_name : 'Organizer / Direct',
      downloadType: l.download_type,
      status: l.status,
      ipAddress: l.ip_address,
      createdAt: l.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        logs: formattedLogs
      }
    });
  } catch (error) {
    console.error('Get Download Logs Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve download logs.' }
    });
  }
}

/**
 * Get dashboard stats and recent activity
 */
async function getDashboardStats(req, res) {
  try {
    const ownerId = req.user.id;

    // 1. Get Event metrics
    const events = await Event.findAll({
      where: { owner_id: ownerId, status: { [Op.ne]: 'DELETED' } }
    });

    let activeCount = 0;
    let upcomingCount = 0;
    let expiredCount = 0;

    const now = new Date();
    events.forEach(e => {
      // Dynamic evaluation in case DB is slightly out of sync
      const starts = new Date(e.access_starts_at);
      const expires = new Date(e.access_expires_at);

      if (e.status === 'ARCHIVED') {
        expiredCount++;
      } else if (now > expires) {
        expiredCount++;
      } else if (now < starts) {
        upcomingCount++;
      } else {
        activeCount++;
      }
    });

    // 2. Get storage usage (sum of file sizes for ready files belonging to user's events)
    const storageResult = await File.sum('size_bytes', {
      where: { upload_status: 'READY' },
      include: [
        {
          model: Event,
          where: { owner_id: ownerId, status: { [Op.ne]: 'DELETED' } },
          attributes: []
        }
      ]
    });

    const totalStorageBytes = storageResult || 0;

    // 3. Get recent guest sessions (last 5 across all user events)
    const recentSessions = await GuestSession.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Event,
          where: { owner_id: ownerId },
          attributes: ['name', 'public_id']
        }
      ]
    });

    const formattedSessions = recentSessions.map(s => ({
      publicId: s.public_id,
      eventName: s.Event.name,
      eventPublicId: s.Event.public_id,
      deviceName: s.device_name,
      ipAddress: s.ip_address,
      createdAt: s.created_at
    }));

    // 4. Get recent downloads (last 5 across all user events)
    const recentDownloads = await DownloadLog.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Event,
          where: { owner_id: ownerId },
          attributes: ['name', 'public_id']
        },
        {
          model: File,
          attributes: ['display_name']
        }
      ]
    });

    const formattedDownloads = recentDownloads.map(d => ({
      id: d.id,
      eventName: d.Event.name,
      eventPublicId: d.Event.public_id,
      fileName: d.File ? d.File.display_name : 'Deleted File',
      createdAt: d.created_at
    }));

    // 5. Get recent audit logs for security alert monitoring
    const recentAudits = await AuditLog.findAll({
      where: { user_id: ownerId },
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Event,
          attributes: ['name']
        }
      ]
    });

    const formattedAudits = recentAudits.map(a => ({
      id: a.id,
      action: a.action,
      eventName: a.Event ? a.Event.name : null,
      ipAddress: a.ip_address,
      createdAt: a.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          activeEvents: activeCount,
          upcomingEvents: upcomingCount,
          expiredEvents: expiredCount,
          totalEvents: events.length,
          storageBytes: totalStorageBytes
        },
        recentSessions: formattedSessions,
        recentDownloads: formattedDownloads,
        recentAudits: formattedAudits
      }
    });
  } catch (error) {
    console.error('Get Dashboard Stats Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve dashboard stats.' }
    });
  }
}

module.exports = {
  listSessions,
  revokeSession,
  revokeAllSessions,
  getDownloadLogs,
  getDashboardStats
};
