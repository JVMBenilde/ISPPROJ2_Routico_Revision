const runNotificationDeviceTokensMigration = async (db) => {
  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_device_tokens'"
  );

  if (tables.length > 0) {
    console.log('Notification device tokens table already exists, skipping migration.');
    return;
  }

  console.log('Running notification device tokens migration...');

  await db.query(`
    CREATE TABLE notification_device_tokens (
      token_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      device_token VARCHAR(512) NOT NULL,
      platform VARCHAR(30) DEFAULT 'web',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_device_token (user_id, device_token),
      INDEX idx_device_token (device_token(255)),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  console.log('Notification device tokens migration complete.');
};

module.exports = { runNotificationDeviceTokensMigration };
