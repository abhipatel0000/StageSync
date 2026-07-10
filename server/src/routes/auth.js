const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateOrganizer } = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticateOrganizer, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', authenticateOrganizer, authController.me);
router.patch('/profile', authenticateOrganizer, authController.updateProfile);

module.exports = router;
