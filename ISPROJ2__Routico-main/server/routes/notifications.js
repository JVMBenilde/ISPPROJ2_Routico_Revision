const express = require('express');
const router = express.Router();
const { requireAnyAuth } = require('../middleware/auth');
const admin = require('firebase-admin');

// Register device for push notifications
router.post('/register-device', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { fcmToken } = req.body;
    const userId = req.user.user_id;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    // Store token in database
    await db.query(
      `INSERT INTO fcm_tokens (user_id, fcm_token)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_used_at = CURRENT_TIMESTAMP`,
      [userId, fcmToken]
    );

    console.log(`✅ Device registered for user ${userId}`);

    res.json({ success: true, message: 'Device registered for notifications' });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Send push notification to a user
const sendNotificationToUser = async (userId, title, message, data = {}, db = null) => {
  try {
    // Get tokens from database if db is provided, otherwise use in-memory lookup
    let tokens = [];

    if (db) {
      const [results] = await db.query(
        'SELECT fcm_token FROM fcm_tokens WHERE user_id = ?',
        [userId]
      );
      tokens = results.map(r => r.fcm_token);
    }

    if (tokens.length === 0) {
      console.log(`⚠️ No tokens found for user ${userId}`);
      return { success: false, reason: 'No registered devices' };
    }

    // FCM requires all data values to be strings
    const stringData = Object.fromEntries(
      Object.entries({ ...data, timestamp: new Date().toISOString() }).map(([k, v]) => [k, String(v)])
    );

    const payload = {
      notification: { title, body: message },
      data: stringData
    };

    // Send to all tokens
    const results = await Promise.allSettled(
      tokens.map(token => admin.messaging().send({ token, ...payload }))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    failed.forEach(r => console.error(`❌ FCM send failed:`, r.reason?.message || r.reason));

    console.log(`✅ Notification sent to user ${userId}: ${successful} successful, ${failed.length} failed`);

    return {
      success: true,
      sent: successful,
      failed: failed
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// Send push notification to multiple users
const sendNotificationToUsers = async (userIds, title, message, data = {}, db = null) => {
  try {
    let allTokens = [];

    if (db) {
      const [results] = await db.query(
        'SELECT DISTINCT fcm_token FROM fcm_tokens WHERE user_id IN (?)',
        [userIds]
      );
      allTokens = results.map(r => r.fcm_token);
    }

    if (allTokens.length === 0) {
      console.log('⚠️ No tokens found for the specified users');
      return { success: false, reason: 'No registered devices' };
    }

    // FCM requires all data values to be strings
    const stringData = Object.fromEntries(
      Object.entries({ ...data, timestamp: new Date().toISOString() }).map(([k, v]) => [k, String(v)])
    );

    const payload = {
      notification: { title, body: message },
      data: stringData
    };

    const results = await Promise.allSettled(
      allTokens.map(token => admin.messaging().send({ token, ...payload }))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    failed.forEach(r => console.error(`❌ FCM send failed:`, r.reason?.message || r.reason));

    console.log(`✅ Broadcast notification sent: ${successful} successful, ${failed.length} failed`);

    return {
      success: true,
      sent: successful,
      failed: failed
    };
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    return { success: false, error: error.message };
  }
};

// Debug: List FCM tokens in DB (remove before prod)
router.get('/debug-tokens', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [tokens] = await db.query('SELECT user_id, LEFT(fcm_token, 30) as token_preview, last_used_at FROM fcm_tokens ORDER BY last_used_at DESC');
    res.json({ count: tokens.length, tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Send test notification to a specific user_id
router.post('/test-send/:userId', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = parseInt(req.params.userId);
    const result = await sendNotificationToUser(userId, '🔔 Test Notification', 'Direct test send', { type: 'test' }, db);
    res.json({ userId, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export functions for use in other routes
module.exports = router;
module.exports.sendNotificationToUser = sendNotificationToUser;
module.exports.sendNotificationToUsers = sendNotificationToUsers;
