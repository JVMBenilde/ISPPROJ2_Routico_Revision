const db = require('../config/database');

const runFCMTokensMigration = async () => {
  try {
    // Check if table exists
    const [tables] = await db.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fcm_tokens'"
    );

    if (tables.length > 0) {
      console.log('FCM tokens table already exists, skipping migration.');
      return;
    }

    // Create FCM tokens table
    await db.query(`
      CREATE TABLE fcm_tokens (
        token_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fcm_token VARCHAR(500) NOT NULL UNIQUE,
        device_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_fcm_token (fcm_token)
      )
    `);

    console.log('FCM tokens table created successfully.');
  } catch (error) {
    console.error('Error running FCM tokens migration:', error);
  }
};

module.exports = { runFCMTokensMigration };
