const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');
const fileController = require('../controllers/fileController');
const { authenticateGuest } = require('../middlewares/guestAuthMiddleware');

// Public Guest authentication routes
router.post('/authenticate', guestController.authenticate);
router.post('/authenticate-qr', guestController.authenticateQr);
router.post('/logout', guestController.logout);

// Protected Guest workspace routes
router.get('/event', authenticateGuest, guestController.getGuestEvent);
router.get('/files', authenticateGuest, fileController.getFiles);
router.get('/files/download-all', authenticateGuest, fileController.downloadAllFiles);
router.get('/files/:fileId/download', authenticateGuest, fileController.downloadFile);

module.exports = router;
