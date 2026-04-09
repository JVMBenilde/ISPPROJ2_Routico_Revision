const updateNotificationsTableMigration = async (db) => {
  try {
    // Get existing columns
    const [columns] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'notifications'"
    );
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    console.log('📋 Existing columns:', existingColumns.join(', '));

    // If title and all needed columns exist, we're done
    if (existingColumns.includes('title') && existingColumns.includes('is_read')) {
      console.log('✅ Notifications table already has proper structure.');
      return;
    }

    console.log('🔧 Updating notifications table structure...');

    // Step 1: Add title column if missing
    if (!existingColumns.includes('title')) {
      await db.query(`ALTER TABLE notifications ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id`);
      console.log('  ✓ Added title column');
    }

    // Step 2: Add data column if missing
    if (!existingColumns.includes('data')) {
      await db.query(`ALTER TABLE notifications ADD COLUMN data JSON AFTER type`);
      console.log('  ✓ Added data column');
    }

    // Step 3: Handle is_read - we need to convert from status 'unread'/'read' to integer
    if (!existingColumns.includes('is_read')) {
      // First, add the is_read column as integer
      await db.query(`ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0`);
      console.log('  ✓ Added is_read column');
      
      // Then update values: 'read' -> 1, 'unread' -> 0
      await db.query(`UPDATE notifications SET is_read = CASE WHEN status = 'read' THEN 1 ELSE 0 END`);
      console.log('  ✓ Migrated status values to is_read');
    }

    // Step 4: Add indexes (ignore if they already exist)
    try {
      await db.query(`ALTER TABLE notifications ADD INDEX idx_user_id_read (user_id, is_read)`);
      console.log('  ✓ Added indexes');
    } catch (e) {
      // Index might already exist, that's ok
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('  ✓ Indexes already exist');
      }
    }

    console.log('✅ Notifications table updated successfully.');
  } catch (error) {
    console.error('❌ Error updating notifications table:', error.message);
    throw error;
  }
};

module.exports = { updateNotificationsTableMigration };
