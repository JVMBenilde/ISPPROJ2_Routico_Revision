const express = require('express');
const router = express.Router();
const { requireAnyAuth } = require('../middleware/auth');
const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// DB-backed notification helpers (always save, regardless of FCM status)
// ---------------------------------------------------------------------------

const saveNotification = async (userId, title, message, type, data = {}, db) => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type, data) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, JSON.stringify(data)]
    );
  } catch (error) {
    console.error(`Error saving notification for user ${userId}:`, error);
  }
};

const saveNotificationToUsers = async (userIds, title, message, type, data = {}, db) => {
  for (const userId of userIds) {
    await saveNotification(userId, title, message, type, data, db);
  }
};

// ---------------------------------------------------------------------------
// API: fetch notifications for current user
// ---------------------------------------------------------------------------

router.get('/', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    console.log(`📬 Fetching notifications for user ${userId}`);

    const [rows] = await db.query(
      `SELECT notification_id, title, message, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    console.log(`✅ Found ${rows.length} notifications for user ${userId}`);

    // Parse JSON data field for each notification
    const parsedRows = rows.map(row => {
      let parsedData = {};
      try {
        if (row.data) {
          if (typeof row.data === 'string') {
            parsedData = JSON.parse(row.data);
          } else if (typeof row.data === 'object') {
            parsedData = row.data;
          }
        }
      } catch (parseError) {
        console.error(`❌ Error parsing notification data for notification ${row.notification_id}:`, parseError);
        parsedData = {};
      }
      return {
        ...row,
        data: parsedData
      };
    });

    res.json(parsedRows);
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
});

// API: mark all notifications as read for current user
router.put('/mark-read', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// ---------------------------------------------------------------------------
// Register device for FCM push notifications
// ---------------------------------------------------------------------------

router.post('/register-device', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { fcmToken } = req.body;
    const userId = req.user.user_id;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

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

// ---------------------------------------------------------------------------
// FCM push helpers — save to DB first, then attempt FCM push
// ---------------------------------------------------------------------------

const sendNotificationToUser = async (userId, title, message, data = {}, db = null) => {
  try {
    // Always save to DB so the bell works regardless of FCM status
    if (db) {
      await saveNotification(userId, title, message, data.type || 'info', data, db);
    }

    let tokens = [];
    if (db) {
      const [results] = await db.query(
        'SELECT fcm_token FROM fcm_tokens WHERE user_id = ?',
        [userId]
      );
      tokens = results.map(r => r.fcm_token);
    }

    if (tokens.length === 0) {
      console.warn(`⚠️ No FCM tokens for user ${userId} — DB notification saved, push skipped.`);
      return { success: true, reason: 'Saved to DB, no push devices registered' };
    }

    const stringData = Object.fromEntries(
      Object.entries({ ...data, timestamp: new Date().toISOString() }).map(([k, v]) => [k, String(v)])
    );
    const payload = { notification: { title, body: message }, data: stringData };

    const results = await Promise.allSettled(
      tokens.map(token => admin.messaging().send({ token, ...payload }))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    const staleTokens = tokens.filter((token, i) => {
      const r = results[i];
      if (r.status === 'rejected') {
        const code = r.reason?.errorInfo?.code || r.reason?.code || '';
        return code === 'messaging/registration-token-not-registered' ||
               code === 'messaging/invalid-registration-token';
      }
      return false;
    });

    if (staleTokens.length > 0 && db) {
      await db.query('DELETE FROM fcm_tokens WHERE fcm_token IN (?)', [staleTokens]);
      console.log(`🗑️ Deleted ${staleTokens.length} stale FCM token(s) for user ${userId}`);
    }

    failed.forEach(r => console.error(`❌ FCM send failed:`, r.reason?.message || r.reason));
    console.log(`✅ Notification sent to user ${userId}: ${successful} push, ${failed.length} failed`);

    return { success: true, sent: successful, failed };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

const sendNotificationToUsers = async (userIds, title, message, data = {}, db = null) => {
  try {
    // Always save to DB for each user
    if (db) {
      await saveNotificationToUsers(userIds, title, message, data.type || 'info', data, db);
    }

    let allTokens = [];
    if (db) {
      const [results] = await db.query(
        'SELECT DISTINCT fcm_token FROM fcm_tokens WHERE user_id IN (?)',
        [userIds]
      );
      allTokens = results.map(r => r.fcm_token);
    }

    if (allTokens.length === 0) {
      console.warn(`⚠️ No FCM tokens for users [${userIds}] — DB notifications saved, push skipped.`);
      return { success: true, reason: 'Saved to DB, no push devices registered' };
    }

    const stringData = Object.fromEntries(
      Object.entries({ ...data, timestamp: new Date().toISOString() }).map(([k, v]) => [k, String(v)])
    );
    const payload = { notification: { title, body: message }, data: stringData };

    const results = await Promise.allSettled(
      allTokens.map(token => admin.messaging().send({ token, ...payload }))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    const staleTokens = allTokens.filter((token, i) => {
      const r = results[i];
      if (r.status === 'rejected') {
        const code = r.reason?.errorInfo?.code || r.reason?.code || '';
        return code === 'messaging/registration-token-not-registered' ||
               code === 'messaging/invalid-registration-token';
      }
      return false;
    });

    if (staleTokens.length > 0 && db) {
      await db.query('DELETE FROM fcm_tokens WHERE fcm_token IN (?)', [staleTokens]);
      console.log(`🗑️ Deleted ${staleTokens.length} stale FCM token(s)`);
    }

    failed.forEach(r => console.error(`❌ FCM send failed:`, r.reason?.message || r.reason));
    console.log(`✅ Broadcast notification sent: ${successful} push, ${failed.length} failed`);

    return { success: true, sent: successful, failed };
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Debug endpoints
// ---------------------------------------------------------------------------

router.get('/debug-tokens', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [tokens] = await db.query(
      'SELECT user_id, LEFT(fcm_token, 30) as token_preview, last_used_at FROM fcm_tokens ORDER BY last_used_at DESC'
    );
    res.json({ count: tokens.length, tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test-send/:userId', requireAnyAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = parseInt(req.params.userId);
    const result = await sendNotificationToUser(
      userId, '🔔 Test Notification', 'Direct test send', { type: 'test' }, db
    );
    res.json({ userId, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.saveNotification = saveNotification;
module.exports.saveNotificationToUsers = saveNotificationToUsers;
module.exports.sendNotificationToUser = sendNotificationToUser;
module.exports.sendNotificationToUsers = sendNotificationToUsers;
