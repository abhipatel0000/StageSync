const { File, Event, DownloadLog, AuditLog } = require('../models');
const storageService = require('../services/storageService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Set up local file size limits (100MB default instead of 2GB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024;

/**
 * Helper to sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

/**
 * Initiate a file upload session
 */
async function initiateUpload(req, res) {
  try {
    const { eventId } = req.params;
    const { originalName, mimeType, sizeBytes } = req.body;

    if (!originalName || !mimeType || sizeBytes === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Original name, MIME type, and size in bytes are required.' }
      });
    }

    if (sizeBytes > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: { code: 'STORAGE_LIMIT_EXCEEDED', message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB.` }
      });
    }

    // Find the event
    const event = await Event.findOne({
      where: { public_id: eventId, owner_id: req.user.id }
    });

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const filePublicId = uuidv4();
    const sanitizedName = sanitizeFilename(originalName);
    const extension = path.extname(originalName).toLowerCase();

    // Call storage service to get upload url / instructions
    const uploadDetails = await storageService.initiateUpload(
      req.user.public_id,
      event.public_id,
      filePublicId,
      sanitizedName,
      mimeType
    );

    // Create database file record (PENDING state)
    const file = await File.create({
      public_id: filePublicId,
      event_id: event.id,
      uploader_id: req.user.id,
      original_name: originalName,
      display_name: originalName,
      storage_key: uploadDetails.storageKey,
      mime_type: mimeType,
      extension,
      size_bytes: sizeBytes,
      upload_status: 'PENDING'
    });

    return res.status(200).json({
      success: true,
      data: {
        fileId: file.public_id,
        originalName: file.original_name,
        storageKey: file.storage_key,
        uploadUrl: uploadDetails.uploadUrl,
        method: uploadDetails.method,
        fields: uploadDetails.fields,
        provider: uploadDetails.provider
      },
      message: 'Upload initiated successfully.'
    });
  } catch (error) {
    console.error('Initiate Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initiate upload.' }
    });
  }
}

/**
 * Handle direct local file upload (used only in local storage provider mode)
 */
async function uploadLocalFile(req, res) {
  try {
    const { storageKey } = req.query;
    if (!storageKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'storageKey query parameter is required.' }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No file found in the request.' }
      });
    }

    // Verify file record exists in database
    const file = await File.findOne({ where: { storage_key: storageKey } });
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File upload session not found.' }
      });
    }

    // Save local file if buffer is provided (for memory storage compatibility/tests),
    // otherwise the file is already written directly to disk via diskStorage config.
    if (req.file && req.file.buffer) {
      await storageService.saveLocalFile(storageKey, req.file.buffer);
    }

    // Update status to READY
    file.upload_status = 'READY';
    file.uploaded_at = new Date();
    await file.save();

    return res.status(200).json({
      success: true,
      data: {
        fileId: file.public_id,
        uploadStatus: file.upload_status
      },
      message: 'Local upload completed successfully.'
    });
  } catch (error) {
    console.error('Local File Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: 'Failed to process file upload.' }
    });
  }
}

/**
 * Complete a file upload (verify upload success, mostly for S3/R2 flow)
 */
async function completeUpload(req, res) {
  try {
    const { eventId } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'fileId is required.' }
      });
    }

    // Find the file and verify event ownership
    const file = await File.findOne({
      where: { public_id: fileId },
      include: [
        {
          model: Event,
          where: { public_id: eventId, owner_id: req.user.id }
        }
      ]
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File record not found.' }
      });
    }

    // Set file status to READY
    file.upload_status = 'READY';
    file.uploaded_at = new Date();
    await file.save();

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: file.event_id,
      action: 'FILE_UPLOADED',
      resource_type: 'files',
      resource_id: file.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {
        fileId: file.public_id,
        displayName: file.display_name,
        status: file.upload_status,
        uploadedAt: file.uploaded_at
      },
      message: 'File upload completed.'
    });
  } catch (error) {
    console.error('Complete Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to complete file upload.' }
    });
  }
}

/**
 * Get files for an event
 */
async function getFiles(req, res) {
  try {
    const { eventId } = req.params;
    const isGuest = !!req.guestSession;
    
    // Check access permissions
    let event;
    if (isGuest) {
      event = req.event;
    } else {
      event = await Event.findOne({
        where: { public_id: eventId, owner_id: req.user.id }
      });
    }

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const files = await File.findAll({
      where: {
        event_id: event.id,
        upload_status: 'READY'
      },
      order: [['created_at', 'ASC']]
    });

    const formattedFiles = files.map(f => ({
      publicId: f.public_id,
      displayName: f.display_name,
      originalName: f.original_name,
      extension: f.extension,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      uploadedAt: f.uploaded_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        files: formattedFiles
      }
    });
  } catch (error) {
    console.error('Get Files Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve files.' }
    });
  }
}

/**
 * Rename file display name
 */
async function renameFile(req, res) {
  try {
    const { eventId, fileId } = req.params;
    const { displayName } = req.body;

    if (!displayName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'displayName is required.' }
      });
    }

    const file = await File.findOne({
      where: { public_id: fileId },
      include: [
        {
          model: Event,
          where: { public_id: eventId, owner_id: req.user.id }
        }
      ]
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File not found.' }
      });
    }

    // Retain extension if not provided in rename
    let finalName = displayName;
    const originalExt = file.extension;
    if (originalExt && !displayName.toLowerCase().endsWith(originalExt.toLowerCase())) {
      finalName = displayName + originalExt;
    }

    file.display_name = finalName;
    await file.save();

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: file.event_id,
      action: 'FILE_RENAMED',
      resource_type: 'files',
      resource_id: file.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      metadata: { newName: finalName }
    });

    return res.status(200).json({
      success: true,
      data: {
        fileId: file.public_id,
        displayName: file.display_name
      },
      message: 'File renamed successfully.'
    });
  } catch (error) {
    console.error('Rename File Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to rename file.' }
    });
  }
}

/**
 * Delete a file (soft delete)
 */
async function deleteFile(req, res) {
  try {
    const { eventId, fileId } = req.params;

    const file = await File.findOne({
      where: { public_id: fileId },
      include: [
        {
          model: Event,
          where: { public_id: eventId, owner_id: req.user.id }
        }
      ]
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File not found.' }
      });
    }

    file.upload_status = 'DELETED';
    await file.save();

    // Soft delete in database
    await file.destroy();

    // Delete object from physical storage (async)
    storageService.deleteObject(file.storage_key).catch(err => {
      console.error(`Failed to delete object ${file.storage_key} from physical storage:`, err);
    });

    // Create Audit Log
    await AuditLog.create({
      user_id: req.user.id,
      event_id: file.event_id,
      action: 'FILE_DELETED',
      resource_type: 'files',
      resource_id: file.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {},
      message: 'File deleted successfully.'
    });
  } catch (error) {
    console.error('Delete File Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete file.' }
    });
  }
}

/**
 * Initiate file download (works for both organizer and guest session)
 */
async function downloadFile(req, res) {
  try {
    const { eventId, fileId } = req.params;
    const isGuest = !!req.guestSession;

    // Check event and access
    let event;
    if (isGuest) {
      event = req.event;
      if (!event.allow_download) {
        return res.status(403).json({
          success: false,
          error: { code: 'DOWNLOAD_NOT_ALLOWED', message: 'Downloads are disabled for this event.' }
        });
      }
    } else {
      event = await Event.findOne({
        where: { public_id: eventId, owner_id: req.user.id }
      });
    }

    if (!event || event.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    const file = await File.findOne({
      where: { public_id: fileId, event_id: event.id, upload_status: 'READY' }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File not found or not ready.' }
      });
    }

    // Log the download event
    await DownloadLog.create({
      event_id: event.id,
      file_id: file.id,
      guest_session_id: isGuest ? req.guestSession.id : null,
      download_type: 'SINGLE_FILE',
      status: 'AUTHORIZED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Generate signed download URL (R2 S3 or local download link)
    const downloadUrl = await storageService.getSignedDownloadUrl(file.storage_key, file.display_name);

    return res.status(200).json({
      success: true,
      data: {
        downloadUrl
      }
    });
  } catch (error) {
    console.error('Download File Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate download link.' }
    });
  }
}

/**
 * Handle direct local file download serving (used only in local storage provider mode)
 */
async function downloadLocalFile(req, res) {
  try {
    const { storageKey } = req.query;
    if (!storageKey) {
      return res.status(400).send('storageKey query parameter is required.');
    }

    // Validate that the file exists and retrieve event/file details to check ownership
    const file = await File.findOne({
      where: { storage_key: storageKey, upload_status: 'READY' },
      include: [Event]
    });

    if (!file || !file.Event || file.Event.status === 'DELETED') {
      return res.status(404).send('File not found or associated event is unavailable.');
    }

    let authorized = false;
    let filename = req.query.filename || file.display_name || 'download';

    // 1. Check organizer JWT in cookies and verify ownership
    if (req.cookies && req.cookies.accessToken) {
      try {
        const token = req.cookies.accessToken;
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userId === file.Event.owner_id) {
          authorized = true;
        }
      } catch (e) {}
    }

    // 2. Check guest session cookie and verify event access
    if (!authorized && req.cookies && req.cookies.guestSessionToken) {
      try {
        const token = req.cookies.guestSessionToken;
        const tokenHash = require('../utils/security').hashToken(token);
        const session = await require('../models').GuestSession.findOne({
          where: { session_token_hash: tokenHash, revoked_at: null, event_id: file.Event.id }
        });
        if (session && new Date(session.expires_at) > new Date()) {
          // Verify that downloads are allowed for this event
          if (file.Event.allow_download) {
            authorized = true;
          }
        }
      } catch (e) {}
    }

    if (!authorized) {
      return res.status(401).send('Unauthorized. Active authorized session is required to download this file.');
    }

    const filePath = storageService.getLocalFilePath(storageKey);
    if (!filePath) {
      return res.status(404).send('File not found on local disk.');
    }

    res.download(filePath, filename);
  } catch (error) {
    console.error('Download Local File Error:', error);
    return res.status(500).send('Internal server error during download.');
  }
}

/**
 * Package all event files as a ZIP and stream download to the client
 */
async function downloadAllFiles(req, res) {
  try {
    const event = req.event;
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
      });
    }

    if (!event.allow_download_all) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Download all option is disabled for this event.' }
      });
    }

    // Get all ready files for the event
    const files = await File.findAll({
      where: { event_id: event.id, upload_status: 'READY' }
    });

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No files uploaded to this event yet.' }
      });
    }

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archiver Error:', err);
      if (!res.headersSent) {
        res.status(500).send('Failed to generate ZIP package.');
      }
    });

    // Set download headers
    const zipName = `${event.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_assets.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    archive.pipe(res);

    for (const file of files) {
      // Log the download event
      await DownloadLog.create({
        event_id: event.id,
        file_id: file.id,
        guest_session_id: req.guestSession ? req.guestSession.id : null,
        user_id: req.user ? req.user.id : null,
        download_type: 'EVENT_PACKAGE',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Stream file to archive
      if (process.env.STORAGE_PROVIDER === 's3') {
        const fileStream = await storageService.getObjectStream(file.storage_key);
        if (fileStream) {
          archive.append(fileStream, { name: file.display_name });
        }
      } else {
        const filePath = storageService.getLocalFilePath(file.storage_key);
        if (filePath && fs.existsSync(filePath)) {
          archive.file(filePath, { name: file.display_name });
        }
      }
    }

    await archive.finalize();

  } catch (error) {
    console.error('Download All Files Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to package files.' }
      });
    }
  }
}

module.exports = {
  initiateUpload,
  uploadLocalFile,
  completeUpload,
  getFiles,
  renameFile,
  deleteFile,
  downloadFile,
  downloadLocalFile,
  downloadAllFiles
};
