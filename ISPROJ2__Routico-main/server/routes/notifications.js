const express = require('express');
const router = express.Router();
const { requireAnyAuth } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

router.post('/device-token', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const notificationService = new NotificationService(db);

    const userId = req.user.user_id;
    const { token, platform } = req.body;

    if (!token || typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ error: 'A valid push token is required' });
    }

    await notificationService.upsertDeviceToken(userId, token.trim(), platform || 'web');

    res.json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

router.delete('/device-token', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const notificationService = new NotificationService(db);

    const userId = req.user.user_id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    await notificationService.deactivateDeviceToken(userId, token.trim());

    res.json({ success: true, message: 'Push token deactivated' });
  } catch (error) {
    console.error('Error deactivating push token:', error);
    res.status(500).json({ error: 'Failed to deactivate push token' });
  }
});

module.exports = router;
