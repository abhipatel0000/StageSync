const { Event, EventCredential, File, GuestSession, DownloadLog, AuditLog, QrAccessToken } = require('../models');
const { generateEventCode, generatePin, hashToken, generateSecureToken } = require('../utils/security');
const { Op } = require('sequelize');

/**
 * Determine event status based on dates
 */
function getEventStatus(startsAt, expiresAt) {
  const now = new Date();
  const start = new Date(startsAt);
  const expiry = new Date(expiresAt);

  if (now < start) return 'UPCOMING';
  if (now >= start && now <= expiry) return 'ACTIVE';
  return 'EXPIRED';
}

/**
 * Create a new event workspace
 */
async function createEvent(req, res) {
  try {
    const {
      name,
      description,
      venueName,
      eventDate,
      accessStartsAt,
      accessExpiresAt,
      retentionExpiresAt,
      maxGuestSessions,
      allowDownload,
      allowDownloadAll
    } = req.body;

    // Validation
    if (!name || !eventDate || !accessStartsAt || !accessExpiresAt) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, date, access start time, and access expiration time are required.' }
      });
    }

    if (new Date(accessStartsAt) >= new Date(accessExpiresAt)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Access start time must be before access expiration time.' }
      });
    }

    // Determine initial status
    const status = getEventStatus(accessStartsAt, accessExpiresAt);

    // Calculate default retention time if not provided (e.g. 7 days after access expiration)
    const finalRetention = retentionExpiresAt 
      ? new Date(retentionExpiresAt) 
      : new Date(new Date(accessExpiresAt).getTime() + 7 * 24 * 60 * 60 * 1000);

    // Create Event
    const event = await Event.create({
      owner_id: req.user.id,
      name,
      description,
      venue_name: venueName,
      event_date: eventDate,
      access_starts_at: accessStartsAt,
      access_expires_at: accessExpiresAt,
      retention_expires_at: finalRetention,
      status,
      allow_download: allowDownload !== undefined ? allowDownload : true,
      allow_download_all: allowDownloadAll !== undefined ? allowDownloadAll : true,
      max_guest_sessions: maxGuestSessions || 5
    });

    // Generate unique Event Code
    let eventCode;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      eventCode = generateEventCode();
      const existing = await EventCredential.findOne({ where: { event_code: eventCode } });
      if (!existing) isUnique = true;
      attempts++;
    }

    // Generate plaintext PIN to show once
    const rawPin = generatePin();
    const pinHash = hashToken(rawPin);

    // Create Event Credentials
    await EventCredential.create({
      event_id: event.id,
      event_code: eventCode,
      pin_hash: pinHash,
      pin_expires_at: accessExpiresAt // PIN expires when event access expires
    });

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'EVENT_CREATED',
      resource_type: 'events',
      resource_id: event.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(201).json({
      success: true,
      data: {
        event: {
          publicId: event.public_id,
          name: event.name,
          description: event.description,
          venueName: event.venue_name,
          eventDate: event.event_date,
          accessStartsAt: event.access_starts_at,
          accessExpiresAt: event.access_expires_at,
          retentionExpiresAt: event.retention_expires_at,
          status: event.status,
          allowDownload: event.allow_download,
          allowDownloadAll: event.allow_download_all,
          maxGuestSessions: event.max_guest_sessions,
          createdAt: event.created_at
        },
        credentials: {
          eventCode,
          pin: rawPin // Returned once to show to the user
        }
      },
      message: 'Event created successfully.'
    });
  } catch (error) {
    console.error('Create Event Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create event.' }
    });
  }
}

/**
 * List all events for the organizer
 */
async function listEvents(req, res) {
  try {
    const { status, limit = 10, offset = 0 } = req.query;
    const where = { owner_id: req.user.id };

    if (status) {
      where.status = status;
    } else {
      // Don't show deleted events in default list
      where.status = { [Op.ne]: 'DELETED' };
    }

    const { count, rows: events } = await Event.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: EventCredential,
          attributes: ['event_code']
        }
      ]
    });

    // Format output
    const formattedEvents = events.map(e => ({
      publicId: e.public_id,
      name: e.name,
      description: e.description,
      venueName: e.venue_name,
      eventDate: e.event_date,
      accessStartsAt: e.access_starts_at,
      accessExpiresAt: e.access_expires_at,
      retentionExpiresAt: e.retention_expires_at,
      status: e.status,
      eventCode: e.EventCredential ? e.EventCredential.event_code : null,
      createdAt: e.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        events: formattedEvents
      }
    });
  } catch (error) {
    console.error('List Events Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve events.' }
    });
  }
}

/**
 * Get detailed event info
 */
async function getEventDetails(req, res) {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id },
      include: [
        {
          model: EventCredential,
          attributes: ['event_code', 'failed_attempts', 'locked_until']
        }
      ]
    });

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    // Refresh status if time elapsed
    const currentStatus = getEventStatus(event.access_starts_at, event.access_expires_at);
    if (event.status !== currentStatus && event.status !== 'ARCHIVED') {
      event.status = currentStatus;
      await event.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        publicId: event.public_id,
        name: event.name,
        description: event.description,
        venueName: event.venue_name,
        eventDate: event.event_date,
        accessStartsAt: event.access_starts_at,
        accessExpiresAt: event.access_expires_at,
        retentionExpiresAt: event.retention_expires_at,
        status: event.status,
        allowDownload: event.allow_download,
        allowDownloadAll: event.allow_download_all,
        maxGuestSessions: event.max_guest_sessions,
        eventCode: event.EventCredential ? event.EventCredential.event_code : null,
        failedAttempts: event.EventCredential ? event.EventCredential.failed_attempts : 0,
        lockedUntil: event.EventCredential ? event.EventCredential.locked_until : null,
        createdAt: event.created_at
      }
    });
  } catch (error) {
    console.error('Get Event Details Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve event details.' }
    });
  }
}

/**
 * Update event details
 */
async function updateEvent(req, res) {
  try {
    const { eventId } = req.params;
    const {
      name,
      description,
      venueName,
      eventDate,
      accessStartsAt,
      accessExpiresAt,
      retentionExpiresAt,
      maxGuestSessions,
      allowDownload,
      allowDownloadAll,
      status
    } = req.body;

    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    // Update fields if provided
    if (name) event.name = name;
    if (description !== undefined) event.description = description;
    if (venueName !== undefined) event.venue_name = venueName;
    if (eventDate) event.event_date = eventDate;
    if (accessStartsAt) event.access_starts_at = accessStartsAt;
    if (accessExpiresAt) event.access_expires_at = accessExpiresAt;
    if (retentionExpiresAt) event.retention_expires_at = retentionExpiresAt;
    if (maxGuestSessions) event.max_guest_sessions = maxGuestSessions;
    if (allowDownload !== undefined) event.allow_download = allowDownload;
    if (allowDownloadAll !== undefined) event.allow_download_all = allowDownloadAll;

    // Status transition checks
    if (status && ['DRAFT', 'ARCHIVED', 'ACTIVE'].includes(status)) {
      event.status = status;
    } else {
      // Re-evaluate automatically based on times if not explicitly set to template statuses
      event.status = getEventStatus(event.access_starts_at, event.access_expires_at);
    }

    await event.save();

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'EVENT_UPDATED',
      resource_type: 'events',
      resource_id: event.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {
        event: {
          publicId: event.public_id,
          name: event.name,
          description: event.description,
          venueName: event.venue_name,
          eventDate: event.event_date,
          accessStartsAt: event.access_starts_at,
          accessExpiresAt: event.access_expires_at,
          retentionExpiresAt: event.retention_expires_at,
          status: event.status,
          allowDownload: event.allow_download,
          allowDownloadAll: event.allow_download_all,
          maxGuestSessions: event.max_guest_sessions,
          updatedAt: event.updated_at
        }
      },
      message: 'Event updated successfully.'
    });
  } catch (error) {
    console.error('Update Event Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update event.' }
    });
  }
}

/**
 * Delete event (soft delete)
 */
async function deleteEvent(req, res) {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    event.status = 'DELETED';
    await event.save();
    
    // Perform Sequelize soft delete
    await event.destroy();

    // Revoke all sessions connected to this event
    await GuestSession.update(
      { revoked_at: new Date() },
      { where: { event_id: event.id, revoked_at: null } }
    );

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'EVENT_DELETED',
      resource_type: 'events',
      resource_id: event.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {},
      message: 'Event deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Event Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete event.' }
    });
  }
}

/**
 * Regenerate event credentials (PIN or event code)
 */
async function regenerateCredentials(req, res) {
  try {
    const { eventId } = req.params;
    const { regenerateCode = false } = req.body;

    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id },
      include: [EventCredential]
    });

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const credentials = event.EventCredential;
    if (!credentials) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Event credentials missing.' }
      });
    }

    // Generate new PIN
    const rawPin = generatePin();
    credentials.pin_hash = hashToken(rawPin);

    // Optionally generate new code
    if (regenerateCode) {
      let eventCode;
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        eventCode = generateEventCode();
        const existing = await EventCredential.findOne({ where: { event_code: eventCode } });
        if (!existing) isUnique = true;
        attempts++;
      }
      credentials.event_code = eventCode;
    }

    // Increment version (this immediately invalidates active guest sessions)
    credentials.credentials_version += 1;
    credentials.failed_attempts = 0;
    credentials.locked_until = null;
    await credentials.save();

    // Revoke all sessions connected to this event immediately (due to version mismatch check)
    // Wait, the guestAuthMiddleware checks version matching, but we can also actively mark sessions as revoked for clean DB
    await GuestSession.update(
      { revoked_at: new Date() },
      { where: { event_id: event.id, revoked_at: null } }
    );

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'CREDENTIALS_REGENERATED',
      resource_type: 'event_credentials',
      resource_id: credentials.id.toString(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {
        eventCode: credentials.event_code,
        pin: rawPin, // Returned once to show to user
        credentialsVersion: credentials.credentials_version
      },
      message: 'Credentials regenerated successfully. All active sessions have been invalidated.'
    });
  } catch (error) {
    console.error('Regenerate Credentials Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to regenerate credentials.' }
    });
  }
}

/**
 * Generate a short-lived single-use QR access token for an event
 */
async function createQrToken(req, res) {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await QrAccessToken.create({
      event_id: event.id,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: event.id,
      action: 'QR_TOKEN_GENERATED',
      resource_type: 'events',
      resource_id: event.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(201).json({
      success: true,
      data: {
        token: rawToken,
        expiresAt
      },
      message: 'QR Access token generated. Valid for 5 minutes.'
    });
  } catch (error) {
    console.error('Create QR Token Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate QR token.' }
    });
  }
}

module.exports = {
  createEvent,
  listEvents,
  getEventDetails,
  updateEvent,
  deleteEvent,
  regenerateCredentials,
  createQrToken
};
