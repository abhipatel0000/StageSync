const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Controllers & Middlewares
const authRoutes = require('./auth');
const eventRoutes = require('./events');
const guestRoutes = require('./guest');
const sessionController = require('../controllers/sessionController');
const fileController = require('../controllers/fileController');
const { authenticateOrganizer } = require('../middlewares/authMiddleware');

// Configure multer for disk storage uploads (default max 100MB size limit)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { storageKey } = req.query;
    if (!storageKey) {
      return cb(new Error('storageKey query parameter is required.'));
    }

    // Strict validation of the storageKey structure to prevent directory traversal
    const storageKeyRegex = /^users\/[a-zA-Z0-9\-_]+\/events\/[a-zA-Z0-9\-_]+\/files\/[a-zA-Z0-9\-_]+\/[a-zA-Z0-9.\-_]+$/;
    if (!storageKeyRegex.test(storageKey)) {
      return cb(new Error('Invalid storage key format.'));
    }

    const localDir = path.resolve(process.env.LOCAL_STORAGE_DIR || './uploads');
    const targetFile = path.join(localDir, storageKey);
    const resolvedPath = path.resolve(targetFile);

    // Verify resolved path is strictly inside the uploads directory
    if (!resolvedPath.startsWith(localDir)) {
      return cb(new Error('Invalid storage key: directory traversal detected.'));
    }

    const destDir = path.dirname(resolvedPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const { storageKey } = req.query;
    if (!storageKey) {
      return cb(new Error('storageKey query parameter is required.'));
    }
    cb(null, path.basename(storageKey));
  }
});

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

// Organizer Authentication Routes
router.use('/auth', authRoutes);

// Organizer Event Management Routes
router.use('/events', eventRoutes);

// Guest Workspace Routes
router.use('/guest', guestRoutes);

// Dashboard Statistics (Organizer Protected)
router.get('/dashboard/activity', authenticateOrganizer, sessionController.getDashboardStats);

// Local Storage Fallback Endpoints
// Local upload (Organizer only)
router.post('/files/upload-local', authenticateOrganizer, upload.single('file'), fileController.uploadLocalFile);

// Local download (Self-authenticated inside handler for both Organizer and Guest)
router.get('/files/download-local', fileController.downloadLocalFile);

module.exports = router;
