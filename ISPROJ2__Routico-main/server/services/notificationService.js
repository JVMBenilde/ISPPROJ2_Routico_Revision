class NotificationService {
  constructor(db) {
    this.db = db;
  }

  async create(userId, message, type = 'general', referenceId = null, referenceType = null) {
    try {
      const [result] = await this.db.query(
        'INSERT INTO notifications (user_id, message, type, reference_id, reference_type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, message, type, referenceId, referenceType, 'unread']
      );
      return result.insertId;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  async createForDriver(driverId, message, type = 'general', referenceId = null, referenceType = null) {
    try {
      const [drivers] = await this.db.query(
        'SELECT user_id FROM drivers WHERE driver_id = ?', [driverId]
      );
      if (drivers.length === 0) return null;
      return this.create(drivers[0].user_id, message, type, referenceId, referenceType);
    } catch (error) {
      console.error('Error creating driver notification:', error);
      return null;
    }
  }

  async createForBusinessOwner(ownerId, message, type = 'general', referenceId = null, referenceType = null) {
    try {
      const [owners] = await this.db.query(
        'SELECT user_id FROM businessowners WHERE owner_id = ?', [ownerId]
      );
      if (owners.length === 0) return null;
      return this.create(owners[0].user_id, message, type, referenceId, referenceType);
    } catch (error) {
      console.error('Error creating business owner notification:', error);
      return null;
    }
  }

  async getUnread(userId) {
    const [rows] = await this.db.query(
      "SELECT * FROM notifications WHERE user_id = ? AND status = 'unread' ORDER BY created_at DESC LIMIT 50",
      [userId]
    );
    return rows;
  }

  async getUnreadCount(userId) {
    const [rows] = await this.db.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND status = 'unread'",
      [userId]
    );
    return rows[0].count;
  }

  async getAll(userId, limit = 50, offset = 0) {
    const [rows] = await this.db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows;
  }

  async markAsRead(notificationId, userId) {
    await this.db.query(
      "UPDATE notifications SET status = 'read' WHERE notification_id = ? AND user_id = ?",
      [notificationId, userId]
    );
  }

  async markAllAsRead(userId) {
    await this.db.query(
      "UPDATE notifications SET status = 'read' WHERE user_id = ? AND status = 'unread'",
      [userId]
    );
  }
}

module.exports = NotificationService;
