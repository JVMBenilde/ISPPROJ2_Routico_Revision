const runMigration = async (db) => {
  // Check if migration already ran
  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles'"
  );
  if (tables.length > 0) {
    console.log('RBAC tables already exist, skipping migration.');
    return;
  }

  console.log('Running RBAC migration...');

  // Create roles table
  await db.query(`
    CREATE TABLE roles (
      role_id INT AUTO_INCREMENT PRIMARY KEY,
      role_name VARCHAR(50) UNIQUE NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE,
      dashboard_type ENUM('admin','business','driver') DEFAULT 'business',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create permissions table
  await db.query(`
    CREATE TABLE permissions (
      permission_id INT AUTO_INCREMENT PRIMARY KEY,
      permission_key VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(150) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL
    )
  `);

  // Create role_permissions junction table
  await db.query(`
    CREATE TABLE role_permissions (
      role_permission_id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      permission_id INT NOT NULL,
      UNIQUE KEY unique_role_perm (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
    )
  `);

  // Add role_id column to users table
  const [cols] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id'"
  );
  if (cols.length === 0) {
    await db.query('ALTER TABLE users ADD COLUMN role_id INT AFTER role');
  }

  // Seed system roles
  await db.query(`
    INSERT INTO roles (role_name, display_name, description, is_system, dashboard_type) VALUES
    ('administrator', 'Administrator', 'Full system access, user management, billing oversight', TRUE, 'admin'),
    ('business_owner', 'Business Owner', 'Manage orders, drivers, billing, and analytics', TRUE, 'business'),
    ('driver', 'Driver', 'View assigned orders, update delivery status, tracking', TRUE, 'driver')
  `);

  // Seed permissions
  const permissions = [
    // Users
    ['manage_users', 'Manage Users', 'Approve, reject, suspend, and reactivate user accounts', 'users'],
    ['view_pending_users', 'View Pending Users', 'View pending business owner registrations', 'users'],
    ['view_all_users', 'View All Users', 'View all users in the system', 'users'],
    ['view_user_documents', 'View User Documents', 'View user registration documents', 'users'],

    // Orders
    ['view_orders', 'View Orders', 'View order listings', 'orders'],
    ['create_orders', 'Create Orders', 'Create new orders', 'orders'],
    ['edit_orders', 'Edit Orders', 'Edit existing orders', 'orders'],
    ['delete_orders', 'Delete Orders', 'Delete orders', 'orders'],
    ['assign_orders', 'Assign Orders', 'Assign orders to drivers', 'orders'],
    ['update_order_status', 'Update Order Status', 'Update the status of orders', 'orders'],

    // Drivers
    ['view_drivers', 'View Drivers', 'View driver listings', 'drivers'],
    ['manage_drivers', 'Manage Drivers', 'Create, edit, and delete drivers', 'drivers'],

    // Billing
    ['view_billing', 'View Billing', 'View billing information and statements', 'billing'],
    ['upload_payment_proof', 'Upload Payment Proof', 'Upload proof of payment for subscriptions', 'billing'],
    ['view_admin_billing_stats', 'View Admin Billing Stats', 'View platform-wide billing statistics', 'billing'],
    ['manage_subscriptions', 'Manage Subscriptions', 'Approve or reject subscription payments', 'billing'],
    ['manage_billing_statements', 'Manage Billing Statements', 'Generate, approve, reject billing statements', 'billing'],
    ['view_subscription_payments', 'View Subscription Payments', 'View pending and suspended subscription payments', 'billing'],
    ['bulk_suspend_accounts', 'Bulk Suspend Accounts', 'Suspend multiple accounts for overdue billing', 'billing'],

    // Routes
    ['view_routes', 'View Routes', 'View route optimization history', 'routes'],
    ['optimize_routes', 'Optimize Routes', 'Run route optimization', 'routes'],

    // Tracking
    ['view_tracking', 'View Tracking', 'View delivery tracking information', 'tracking'],
    ['update_tracking', 'Update Tracking', 'Update delivery status and tracking', 'tracking'],

    // Issues
    ['view_issues', 'View Issues', 'View reported issues', 'issues'],
    ['manage_issues', 'Manage Issues', 'Create and update issues', 'issues'],

    // Analytics
    ['view_analytics', 'View Analytics', 'View analytics and charts', 'analytics'],
    ['use_ai_analytics', 'Use AI Analytics', 'Use AI predictive analytics', 'analytics'],

    // Dashboard
    ['view_dashboard_stats', 'View Dashboard Stats', 'View admin dashboard statistics', 'dashboard'],
    ['view_business_dashboard', 'View Business Dashboard', 'View business owner dashboard statistics', 'dashboard'],

    // System
    ['manage_roles', 'Manage Roles', 'Create, edit, and delete roles and permissions', 'system'],
  ];

  for (const [key, name, desc, cat] of permissions) {
    await db.query(
      'INSERT INTO permissions (permission_key, display_name, description, category) VALUES (?, ?, ?, ?)',
      [key, name, desc, cat]
    );
  }

  // Get role IDs
  const [roles] = await db.query('SELECT role_id, role_name FROM roles');
  const roleMap = {};
  for (const r of roles) roleMap[r.role_name] = r.role_id;

  // Get permission IDs
  const [perms] = await db.query('SELECT permission_id, permission_key FROM permissions');
  const permMap = {};
  for (const p of perms) permMap[p.permission_key] = p.permission_id;

  // Administrator gets ALL permissions
  const adminPerms = Object.keys(permMap);
  for (const key of adminPerms) {
    await db.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
      [roleMap.administrator, permMap[key]]
    );
  }

  // Business Owner permissions
  const boPerms = [
    'view_orders', 'create_orders', 'edit_orders', 'delete_orders', 'assign_orders', 'update_order_status',
    'view_drivers', 'manage_drivers',
    'view_billing', 'upload_payment_proof', 'view_routes', 'optimize_routes',
    'view_tracking', 'update_tracking',
    'view_issues', 'manage_issues',
    'view_analytics', 'use_ai_analytics',
    'view_business_dashboard'
  ];
  for (const key of boPerms) {
    await db.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
      [roleMap.business_owner, permMap[key]]
    );
  }

  // Driver permissions
  const driverPerms = ['update_order_status', 'view_tracking', 'update_tracking'];
  for (const key of driverPerms) {
    await db.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
      [roleMap.driver, permMap[key]]
    );
  }

  // Backfill users.role_id from users.role
  await db.query(`
    UPDATE users u
    JOIN roles r ON r.role_name = u.role
    SET u.role_id = r.role_id
    WHERE u.role_id IS NULL
  `);

  // Add foreign key constraint
  try {
    await db.query('ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(role_id)');
  } catch (e) {
    // FK may already exist or fail if there are orphan rows
    console.log('Note: FK constraint not added (may already exist):', e.message);
  }

  console.log('RBAC migration completed successfully.');
};

module.exports = { runMigration };
