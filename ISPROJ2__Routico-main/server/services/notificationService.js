const admin = require('firebase-admin');

let Vonage = null;
try {
  ({ Vonage } = require('@vonage/server-sdk'));
} catch (error) {
  Vonage = null;
}

class NotificationService {
  constructor(db) {
    this.db = db;

    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    const fromName = process.env.VONAGE_SMS_FROM;

    this.vonageSmsFrom = fromName || null;
    this.vonageClient = apiKey && apiSecret && Vonage
      ? new Vonage({ apiKey, apiSecret })
      : null;
  }

  isPushEnabled() {
    return admin.apps && admin.apps.length > 0;
  }

  isSmsEnabled() {
    return !!(this.vonageClient && this.vonageSmsFrom);
  }

  normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).trim();
    if (/^\+63\d{10}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  async upsertDeviceToken(userId, deviceToken, platform = 'web') {
    await this.db.query(
      `INSERT INTO notification_device_tokens (user_id, device_token, platform, is_active, last_seen_at)
       VALUES (?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         platform = VALUES(platform),
         is_active = 1,
         last_seen_at = NOW()`,
      [userId, deviceToken, platform]
    );
  }

  async deactivateDeviceToken(userId, deviceToken) {
    await this.db.query(
      'UPDATE notification_device_tokens SET is_active = 0, last_seen_at = NOW() WHERE user_id = ? AND device_token = ?',
      [userId, deviceToken]
    );
  }

  async getActiveDeviceTokens(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];

    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) return [];

    const [rows] = await this.db.query(
      `SELECT user_id, device_token
       FROM notification_device_tokens
       WHERE is_active = 1 AND user_id IN (?)`,
      [uniqueUserIds]
    );

    return rows;
  }

  async createInAppNotifications(userIds, message) {
    const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
    if (uniqueUserIds.length === 0 || !message) return;

    const values = uniqueUserIds.map((userId) => [userId, message]);
    await this.db.query(
      'INSERT INTO notifications (user_id, message, status, created_at) VALUES ?',
      [values.map((row) => [row[0], row[1], 'unread', new Date()])]
    );
  }

  async sendPush(userIds, { title, body, data = {} }) {
    if (!this.isPushEnabled()) {
      return { sent: 0, failed: 0, skipped: true, reason: 'firebase_not_initialized' };
    }

    const rows = await this.getActiveDeviceTokens(userIds);
    const tokens = [...new Set(rows.map((row) => row.device_token).filter(Boolean))];

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, skipped: true, reason: 'no_device_tokens' };
    }

    const message = {
      tokens,
      notification: {
        title: title || 'Routico Update',
        body: body || 'You have a new alert.'
      },
      data: Object.entries(data || {}).reduce((acc, [key, value]) => {
        acc[key] = value === undefined || value === null ? '' : String(value);
        return acc;
      }, {})
    };

    const result = await admin.messaging().sendEachForMulticast(message);

    if (result.failureCount > 0) {
      const invalidTokens = [];
      result.responses.forEach((response, index) => {
        if (!response.success && response.error && response.error.code) {
          const code = response.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[index]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await this.db.query(
          'UPDATE notification_device_tokens SET is_active = 0, last_seen_at = NOW() WHERE device_token IN (?)',
          [invalidTokens]
        );
      }
    }

    return { sent: result.successCount, failed: result.failureCount, skipped: false };
  }

  async sendSms(userIds, smsMessage) {
    if (!this.isSmsEnabled()) {
      return { sent: 0, failed: 0, skipped: true, reason: 'sms_not_configured' };
    }

    if (!smsMessage) {
      return { sent: 0, failed: 0, skipped: true, reason: 'empty_message' };
    }

    const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return { sent: 0, failed: 0, skipped: true, reason: 'no_recipients' };
    }

    const [users] = await this.db.query(
      'SELECT user_id, phone FROM users WHERE user_id IN (?)',
      [uniqueUserIds]
    );

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const phone = this.normalizePhone(user.phone);
      if (!phone) continue;

      try {
        await this.vonageClient.sms.send({
          to: phone,
          from: this.vonageSmsFrom,
          text: smsMessage
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`SMS send failed for user ${user.user_id}:`, error.message || error);
      }
    }

    return { sent, failed, skipped: false };
  }

  async notifyUsers(userIds, payload) {
    const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
    if (uniqueUserIds.length === 0) return;

    await this.createInAppNotifications(uniqueUserIds, payload.inAppMessage || payload.pushBody);

    await Promise.all([
      this.sendPush(uniqueUserIds, {
        title: payload.pushTitle,
        body: payload.pushBody,
        data: payload.data || {}
      }),
      this.sendSms(uniqueUserIds, payload.smsMessage)
    ]);
  }

  async notifyOrderAssignment({ orderId, ownerId, driverId }) {
    if (!orderId || !ownerId || !driverId) return;

    const [rows] = await this.db.query(
      `SELECT o.order_id,
              o.order_status,
              c.company_name AS customer_name,
              bo.user_id AS owner_user_id,
              d.user_id AS driver_user_id,
              CONCAT(d.first_name, ' ', d.last_name) AS driver_name
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN businessowners bo ON bo.owner_id = o.business_owner_id
       LEFT JOIN drivers d ON d.driver_id = o.assigned_driver_id
       WHERE o.order_id = ? AND o.business_owner_id = ?`,
      [orderId, ownerId]
    );

    if (rows.length === 0) return;

    const row = rows[0];
    if (!row.owner_user_id || !row.driver_user_id) return;

    const customerLabel = row.customer_name ? ` for ${row.customer_name}` : '';
    const message = `Order #${row.order_id} was assigned to ${row.driver_name || 'a driver'}${customerLabel}.`;

    await this.notifyUsers([row.owner_user_id, row.driver_user_id], {
      pushTitle: 'Order Assignment',
      pushBody: message,
      inAppMessage: message,
      smsMessage: `Routico: ${message}`,
      data: {
        type: 'order_assignment',
        orderId: row.order_id,
        driverId
      }
    });
  }

  async notifyOrderStatusUpdate({ orderId, oldStatus, newStatus, actorRole = 'user' }) {
    if (!orderId || !newStatus) return;

    const [rows] = await this.db.query(
      `SELECT o.order_id,
              bo.user_id AS owner_user_id,
              d.user_id AS driver_user_id
       FROM orders o
       LEFT JOIN businessowners bo ON bo.owner_id = o.business_owner_id
       LEFT JOIN drivers d ON d.driver_id = o.assigned_driver_id
       WHERE o.order_id = ?`,
      [orderId]
    );

    if (rows.length === 0) return;
    const row = rows[0];

    const recipients = [row.owner_user_id, row.driver_user_id].filter(Boolean);
    if (recipients.length === 0) return;

    const transition = oldStatus ? `${oldStatus} -> ${newStatus}` : `${newStatus}`;
    const message = `Order #${row.order_id} status changed to ${transition} by ${actorRole}.`;

    await this.notifyUsers(recipients, {
      pushTitle: 'Order Status Update',
      pushBody: message,
      inAppMessage: message,
      smsMessage: `Routico: ${message}`,
      data: {
        type: 'order_status_update',
        orderId: row.order_id,
        status: newStatus
      }
    });
  }

  async notifyIssueReported({ issueId }) {
    if (!issueId) return;

    const [rows] = await this.db.query(
      `SELECT i.issue_id,
              i.reported_by,
              i.description,
              u.role AS reporter_role,
              ic.category_name,
              d.owner_id AS driver_owner_id
       FROM issues i
       LEFT JOIN users u ON u.user_id = i.reported_by
       LEFT JOIN issuescategories ic ON ic.category_id = i.category_id
       LEFT JOIN drivers d ON d.user_id = i.reported_by
       WHERE i.issue_id = ?`,
      [issueId]
    );

    if (rows.length === 0) return;
    const row = rows[0];

    let recipientUserIds = [];

    if (row.reporter_role === 'driver' && row.driver_owner_id) {
      const [ownerRows] = await this.db.query(
        'SELECT user_id FROM businessowners WHERE owner_id = ?',
        [row.driver_owner_id]
      );
      recipientUserIds = ownerRows.map((r) => r.user_id);
    } else if (row.reporter_role === 'business_owner') {
      const [ownerRows] = await this.db.query(
        'SELECT owner_id FROM businessowners WHERE user_id = ?',
        [row.reported_by]
      );
      if (ownerRows.length > 0) {
        const [driverRows] = await this.db.query(
          'SELECT user_id FROM drivers WHERE owner_id = ?',
          [ownerRows[0].owner_id]
        );
        recipientUserIds = driverRows.map((r) => r.user_id);
      }
    }

    if (recipientUserIds.length === 0) return;

    const shortDescription = row.description
      ? row.description.substring(0, 80)
      : 'No issue details provided.';
    const issueCategory = row.category_name || 'General';
    const message = `New ${issueCategory} issue (#${row.issue_id}): ${shortDescription}`;

    await this.notifyUsers(recipientUserIds, {
      pushTitle: 'Issue Reported',
      pushBody: message,
      inAppMessage: message,
      smsMessage: `Routico: ${message}`,
      data: {
        type: 'issue_reported',
        issueId: row.issue_id,
        category: issueCategory
      }
    });
  }
}

module.exports = NotificationService;
