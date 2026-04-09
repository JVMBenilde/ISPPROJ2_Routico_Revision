const runNotificationsMigration = async (db) => {
  try {
    const [tables] = await db.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'"
    );

    if (tables.length > 0) {
      console.log('Notifications table already exists, skipping migration.');
      return;
    }

    await db.query(`
      CREATE TABLE notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSON,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_id_read (user_id, is_read),
        INDEX idx_created_at (created_at)
      )
    `);

    console.log('Notifications table created successfully.');
  } catch (error) {
    console.error('Error running notifications migration:', error);
  }
};

module.exports = { runNotificationsMigration };
