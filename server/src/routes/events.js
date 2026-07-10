const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const fileController = require('../controllers/fileController');
const sessionController = require('../controllers/sessionController');
const { authenticateOrganizer } = require('../middlewares/authMiddleware');

// Protect all routes in this router
router.use(authenticateOrganizer);

// Event CRUD routes
router.post('/', eventController.createEvent);
router.get('/', eventController.listEvents);
router.get('/:eventId', eventController.getEventDetails);
router.patch('/:eventId', eventController.updateEvent);
router.delete('/:eventId', eventController.deleteEvent);

// Credentials rotation
router.post('/:eventId/credentials/regenerate', eventController.regenerateCredentials);
router.post('/:eventId/qr-tokens', eventController.createQrToken);

// Event Files routes
router.post('/:eventId/files/upload/initiate', fileController.initiateUpload);
router.post('/:eventId/files/upload/complete', fileController.completeUpload);
router.get('/:eventId/files', fileController.getFiles);
router.patch('/:eventId/files/:fileId', fileController.renameFile);
router.delete('/:eventId/files/:fileId', fileController.deleteFile);
router.get('/:eventId/files/:fileId/download', fileController.downloadFile);

// Event Guest Sessions management
router.get('/:eventId/sessions', sessionController.listSessions);
router.post('/:eventId/sessions/:sessionId/revoke', sessionController.revokeSession);
router.post('/:eventId/sessions/revoke-all', sessionController.revokeAllSessions);

// Event activity
router.get('/:eventId/downloads', sessionController.getDownloadLogs);

module.exports = router;
