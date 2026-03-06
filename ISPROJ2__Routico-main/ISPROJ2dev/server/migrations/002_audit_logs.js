const runAuditLogMigration = async (db) => {
  // Create table if it doesn't exist
  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'"
  );
  if (tables.length === 0) {
    console.log('Running audit logs migration...');

    await db.query(`
      CREATE TABLE audit_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        user_email VARCHAR(255),
        user_role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        target_type VARCHAR(50),
        target_id VARCHAR(100),
        metadata JSON,
        ip_address VARCHAR(45),
        status ENUM('success', 'failure') DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_category (category),
        INDEX idx_created_at (created_at),
        INDEX idx_user_created (user_id, created_at)
      )
    `);

    console.log('Audit logs table created.');
  }

  // Always ensure the permission exists (runs even if table already existed)
  const [existingPerm] = await db.query(
    "SELECT permission_id FROM permissions WHERE permission_key = 'view_audit_logs'"
  );
  if (existingPerm.length === 0) {
    const [insertResult] = await db.query(
      "INSERT INTO permissions (permission_key, display_name, description, category) VALUES ('view_audit_logs', 'View Audit Logs', 'View system audit logs and activity history', 'system')"
    );
    // Grant to administrator role
    const [adminRole] = await db.query("SELECT role_id FROM roles WHERE role_name = 'administrator'");
    if (adminRole.length > 0) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [adminRole[0].role_id, insertResult.insertId]
      );
    }
    console.log('Added view_audit_logs permission.');
  }

  console.log('Audit logs migration complete.');
};

module.exports = { runAuditLogMigration };
