async function runNotificationsTrackingMigration(db) {
  try {
    // Add type column to notifications
    const [typeCols] = await db.query(
      "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'"
    );
    if (typeCols.length === 0) {
      await db.query("ALTER TABLE notifications ADD COLUMN type VARCHAR(50) DEFAULT 'general' AFTER message");
      await db.query("ALTER TABLE notifications ADD COLUMN reference_id INT NULL AFTER type");
      await db.query("ALTER TABLE notifications ADD COLUMN reference_type VARCHAR(50) NULL AFTER reference_id");
      console.log('Notifications table enhanced with type, reference_id, reference_type columns.');
    }

    // Add indexes for efficient polling
    try {
      await db.query("CREATE INDEX idx_notifications_user_status ON notifications(user_id, status)");
    } catch (e) { /* index may already exist */ }

    try {
      await db.query("CREATE INDEX idx_tracking_driver_time ON tracking(driver_id, timestamp)");
    } catch (e) { /* index may already exist */ }

    console.log('Notifications/tracking migration complete.');
  } catch (error) {
    console.error('Notifications/tracking migration error:', error);
  }
}

module.exports = { runNotificationsTrackingMigration };
