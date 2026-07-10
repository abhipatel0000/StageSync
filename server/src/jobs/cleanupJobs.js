const cron = require('node-cron');
const { Event, File, GuestSession } = require('../models');
const { Op } = require('sequelize');
const storageService = require('../services/storageService');

/**
 * Job 1: Auto-expire events past their access window
 */
async function autoExpireEvents() {
  try {
    const now = new Date();
    const [updatedCount] = await Event.update(
      { status: 'EXPIRED' },
      {
        where: {
          status: { [Op.in]: ['DRAFT', 'UPCOMING', 'ACTIVE'] },
          access_expires_at: { [Op.lt]: now }
        }
      }
    );

    if (updatedCount > 0) {
      console.log(`[Janitor] Auto-expired ${updatedCount} events.`);
      // Invalidate guest sessions for expired events
      await GuestSession.update(
        { revoked_at: now },
        {
          where: {
            revoked_at: null,
            expires_at: { [Op.lt]: now }
          }
        }
      );
    }
  } catch (error) {
    console.error('[Janitor] Auto-expire events error:', error);
  }
}

/**
 * Job 2: Clean up files past their retention date
 */
async function cleanExpiredRetentionFiles() {
  try {
    const now = new Date();
    
    // Find all events past retention expiration that haven't been archived/deleted yet
    const expiredEvents = await Event.findAll({
      where: {
        retention_expires_at: { [Op.lt]: now },
        status: { [Op.ne]: 'ARCHIVED' }
      }
    });

    for (const event of expiredEvents) {
      console.log(`[Janitor] Processing retention cleanup for event: ${event.name} (${event.public_id})`);

      // Find all ready files for this event
      const files = await File.findAll({
        where: {
          event_id: event.id,
          upload_status: { [Op.in]: ['READY', 'PENDING'] }
        }
      });

      for (const file of files) {
        console.log(`[Janitor] Deleting expired file: ${file.display_name} (${file.storage_key})`);
        
        // Delete from physical storage (local disk or S3/R2)
        await storageService.deleteObject(file.storage_key).catch(err => {
          console.error(`[Janitor] Failed to delete storage object ${file.storage_key}:`, err);
        });

        // Set status to DELETED and soft-delete in DB
        file.upload_status = 'DELETED';
        await file.save();
        await file.destroy();
      }

      // Mark the event as ARCHIVED to avoid re-processing
      event.status = 'ARCHIVED';
      await event.save();
      console.log(`[Janitor] Completed retention cleanup. Event status changed to ARCHIVED.`);
    }
  } catch (error) {
    console.error('[Janitor] Retention file cleanup error:', error);
  }
}

/**
 * Job 3: Clean up abandoned multipart or pending uploads (older than 24 hours)
 */
async function cleanAbandonedUploads() {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const abandonedFiles = await File.findAll({
      where: {
        upload_status: 'PENDING',
        created_at: { [Op.lt]: yesterday }
      }
    });

    for (const file of abandonedFiles) {
      console.log(`[Janitor] Deleting abandoned pending file: ${file.original_name}`);
      await storageService.deleteObject(file.storage_key).catch(err => {});
      file.upload_status = 'FAILED';
      await file.save();
      await file.destroy(); // Soft delete
    }
  } catch (error) {
    console.error('[Janitor] Abandoned upload cleanup error:', error);
  }
}

/**
 * Initialize background cron scheduler
 */
function initCleanupJobs() {
  console.log('[Janitor] Initializing background cleanup tasks...');

  // Run immediately on startup to clean up past-due items
  autoExpireEvents();
  cleanExpiredRetentionFiles();
  cleanAbandonedUploads();

  // Run event expiration check every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    console.log('[Janitor] Running event expiration checks...');
    autoExpireEvents();
  });

  // Run retention cleanup and abandoned uploads every night at midnight (00:00)
  cron.schedule('0 0 * * *', () => {
    console.log('[Janitor] Running scheduled nightly retention and upload cleanups...');
    cleanExpiredRetentionFiles();
    cleanAbandonedUploads();
  });
}

module.exports = {
  initCleanupJobs
};
