const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { requireBusinessOwnerOrInactive, requireDriver, requirePerm } = require('../middleware/auth');
const RegistrationService = require('../services/registrationService');
const SubscriptionService = require('../services/subscriptionService');
const BillingStatementService = require('../services/billingStatementService');
const fileStorageService = require('../services/fileStorageService');

// Database will be accessed through req.app.locals.db

// Configure multer for file uploads (using memory storage for MinIO)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG) and PDF files are allowed'));
    }
  }
});

// Register Business Owner
router.post('/register', upload.single('companyDocument'), async (req, res) => {
  const db = req.app.locals.db;
  const registrationService = new RegistrationService(db);
  
  try {
    const { fullName, email, phone, password } = req.body;
    
    // Use registration service for data integrity
    const result = await registrationService.registerBusinessOwner(
      { fullName, email, phone, password },
      req.file
    );

    res.status(201).json({
      message: result.message,
      userId: result.userId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific error types
    if (error.message.includes('already exists')) {
      return res.status(409).json({ 
        error: error.message 
      });
    }
    
    if (error.message.includes('required') || error.message.includes('valid')) {
      return res.status(400).json({ 
        error: error.message 
      });
    }
    
    // Handle database errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'User with this email or Firebase UID already exists' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error during registration. Please try again.' 
    });
  }
});

// Get user by email (from Firebase authentication)
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const db = req.app.locals.db;
    
    const [rows] = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.account_status, u.active_status, u.role, u.role_id, u.created_at,
              r.dashboard_type
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];

    // Fetch user's permissions from role
    let permissions = [];
    if (user.role_id) {
      const [permRows] = await db.query(
        `SELECT p.permission_key FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      permissions = permRows.map(r => r.permission_key);
    }

    res.json({ ...user, permissions });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
});

// Admin login endpoint (uses database authentication, not Firebase)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = req.app.locals.db;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user from database (admins and drivers use JWT auth)
    const [rows] = await db.query(
      'SELECT user_id, full_name, email, password_hash, role, account_status, active_status FROM users WHERE email = ? AND role IN (?, ?)',
      [email, 'administrator', 'driver']
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Compare password with hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account and active status
    if (user.account_status !== 'approved') {
      return res.status(403).json({ error: 'Account not approved' });
    }

    if (user.active_status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data and token
    res.json({
      success: true,
      token: token,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        accountStatus: user.account_status,
        activeStatus: user.active_status
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Regular user login endpoint (for non-Firebase users)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = req.app.locals.db;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user from database
    const [rows] = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.role, u.role_id, u.account_status, u.active_status,
              r.dashboard_type
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Compare password with hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account and active status
    if (user.account_status !== 'approved') {
      return res.status(403).json({ error: 'Account not approved' });
    }

    if (user.active_status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Fetch user's permissions
    let permissions = [];
    if (user.role_id) {
      const [permRows] = await db.query(
        `SELECT p.permission_key FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      permissions = permRows.map(r => r.permission_key);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role, roleId: user.role_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data and token
    res.json({
      success: true,
      token: token,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        roleId: user.role_id,
        accountStatus: user.account_status,
        activeStatus: user.active_status,
        dashboardType: user.dashboard_type || 'business',
        permissions
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user account status (Admin only)
router.put('/user/:userId/status', requirePerm('manage_users'), async (req, res) => {
  try {
    const { userId } = req.params;
    const db = req.app.locals.db;
    const { account_status, active_status } = req.body;

    // Validate status values
    const validAccountStatuses = ['pending', 'approved', 'rejected'];
    const validActiveStatuses = ['active', 'inactive'];

    if (account_status && !validAccountStatuses.includes(account_status)) {
      return res.status(400).json({ error: 'Invalid account status' });
    }

    if (active_status && !validActiveStatuses.includes(active_status)) {
      return res.status(400).json({ error: 'Invalid active status' });
    }

    let updateQuery = 'UPDATE users SET ';
    let updateValues = [];
    let updateFields = [];

    if (account_status) {
      updateFields.push('account_status = ?');
      updateValues.push(account_status);
    }

    if (active_status) {
      updateFields.push('active_status = ?');
      updateValues.push(active_status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateQuery += updateFields.join(', ') + ' WHERE user_id = ?';
    updateValues.push(userId);

    const result = await db.query(updateQuery, updateValues);

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is being approved, create free first month subscription
    if (account_status === 'approved') {
      try {
        const subscriptionService = new SubscriptionService(db);
        
        // Get the owner_id for this user
        const businessOwnerResult = await db.query(
          'SELECT owner_id FROM businessowners WHERE user_id = ?',
          [userId]
        );
        
        if (businessOwnerResult[0].length > 0) {
          const ownerId = businessOwnerResult[0][0].owner_id;
          await subscriptionService.createFreeFirstMonth(ownerId, new Date());
          console.log(`Free first month subscription created for owner ${ownerId}`);
        } else {
          console.log(`No business owner record found for user ${userId}`);
        }
      } catch (subscriptionError) {
        console.error('Error creating free subscription:', subscriptionError);
        // Don't fail the request if subscription creation fails
      }
    }

    res.json({ message: 'User status updated successfully' });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suspend user account (Admin only)
router.put('/user/:userId/suspend', requirePerm('manage_users'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const db = req.app.locals.db;

    // Validate input
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Suspension reason is required' });
    }

    // Update user status to inactive
    const result = await db.query(
      'UPDATE users SET active_status = ? WHERE user_id = ?',
      ['inactive', userId]
    );

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log the suspension reason (you could create a separate table for this)
    console.log(`User ${userId} suspended. Reason: ${reason}`);

    res.json({ 
      message: 'User account suspended successfully',
      reason: reason
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reactivate user account (Admin only)
router.put('/user/:userId/reactivate', requirePerm('manage_users'), async (req, res) => {
  try {
    const { userId } = req.params;
    const db = req.app.locals.db;

    // Update user status to active
    const result = await db.query(
      'UPDATE users SET active_status = ? WHERE user_id = ?',
      ['active', userId]
    );

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`User ${userId} reactivated`);

    res.json({ message: 'User account reactivated successfully' });
  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all suspended accounts (Admin only)
router.get('/subscription/suspended-accounts', requirePerm('manage_subscriptions'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    const suspendedAccounts = await subscriptionService.getAllSuspendedAccounts();
    
    res.json(suspendedAccounts);
  } catch (error) {
    console.error('Get suspended accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending payment proofs (Admin only)
router.get('/subscription/pending-payments', requirePerm('view_subscription_payments'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    const pendingPayments = await subscriptionService.getPendingPayments();
    
    res.json(pendingPayments);
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve payment proof (Admin only)
router.put('/subscription/:subscriptionId/approve', requirePerm('manage_subscriptions'), async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    await subscriptionService.approvePayment(subscriptionId, req.user.user_id);
    
    res.json({ message: 'Payment proof approved successfully' });
  } catch (error) {
    console.error('Approve payment proof error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Reject payment proof (Admin only)
router.put('/subscription/:subscriptionId/reject', requirePerm('manage_subscriptions'), async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    await subscriptionService.rejectPayment(subscriptionId, req.user.user_id, reason);
    
    res.json({ message: 'Payment proof rejected successfully' });
  } catch (error) {
    console.error('Reject payment proof error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get payment proof document (Admin only)
router.get('/subscription/:subscriptionId/document', requirePerm('view_subscription_payments'), async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const db = req.app.locals.db;
    
    // Get subscription with file path and user name
    const [subscriptionRows] = await db.query(
      `SELECT s.payment_proof, u.full_name 
       FROM subscriptions s 
       JOIN businessowners bo ON s.owner_id = bo.owner_id
       JOIN users u ON bo.user_id = u.user_id 
       WHERE s.subscription_id = ?`,
      [subscriptionId]
    );
    
    if (subscriptionRows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    const { payment_proof: filePath, full_name } = subscriptionRows[0];
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Set appropriate headers and send file
    const fileName = `${full_name.replace(/\s+/g, '_')}_payment_proof${path.extname(filePath)}`;
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Get payment document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all pending business owners (Admin only)
router.get('/pending-users', requirePerm('view_pending_users'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT user_id, full_name, email, phone, account_status, active_status, created_at 
       FROM users 
       WHERE role = 'business_owner' AND account_status = 'pending' 
       ORDER BY created_at DESC`
    );

    res.json(result[0]);

  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (Admin only)
router.get('/users', requirePerm('view_all_users'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.account_status, u.active_status, u.role, u.created_at,
              b.owner_id
       FROM users u
       LEFT JOIN businessowners b ON b.user_id = u.user_id
       ORDER BY u.created_at DESC`
    );

    res.json(result[0]);

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all drivers (Admin only)
router.get('/all-drivers', requirePerm('view_drivers'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [drivers] = await db.query(
      `SELECT d.*,
              b.company_name,
              u.full_name as owner_name, u.email as owner_email
       FROM drivers d
       LEFT JOIN businessowners b ON d.owner_id = b.owner_id
       LEFT JOIN users u ON b.user_id = u.user_id
       ORDER BY d.created_at DESC`
    );
    res.json(drivers);
  } catch (error) {
    console.error('Get all drivers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin reset driver password
router.put('/driver/:driverId/reset-password', requirePerm('manage_users'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { driverId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [driver] = await db.query('SELECT user_id FROM drivers WHERE driver_id = ?', [driverId]);
    if (driver.length === 0) return res.status(404).json({ error: 'Driver not found' });
    if (!driver[0].user_id) return res.status(400).json({ error: 'Driver has no login account' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, driver[0].user_id]);

    res.json({ message: 'Driver password reset successfully' });
  } catch (error) {
    console.error('Reset driver password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin reset business owner password
router.put('/user/:userId/reset-password', requirePerm('manage_users'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [user] = await db.query('SELECT user_id, role FROM users WHERE user_id = ?', [userId]);
    if (user.length === 0) return res.status(404).json({ error: 'User not found' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, userId]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin toggle driver active status
router.put('/driver/:driverId/status', requirePerm('manage_users'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { driverId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    const [driver] = await db.query('SELECT user_id FROM drivers WHERE driver_id = ?', [driverId]);
    if (driver.length === 0) return res.status(404).json({ error: 'Driver not found' });

    // Update driver status
    await db.query('UPDATE drivers SET status = ? WHERE driver_id = ?', [status, driverId]);

    // Also update user account active_status if they have a login
    if (driver[0].user_id) {
      await db.query('UPDATE users SET active_status = ? WHERE user_id = ?', [status, driver[0].user_id]);
    }

    res.json({ message: `Driver ${status === 'active' ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Toggle driver status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user payment status (Admin only)
router.get('/user/:userId/payment-status', requirePerm('view_subscription_payments'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { userId } = req.params;
    
    // Get business owner ID
    const businessOwnerResult = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    
    if (businessOwnerResult[0].length === 0) {
      return res.json({ status: 'no_account', amount: 0 });
    }
    
    const ownerId = businessOwnerResult[0][0].owner_id;
    
    // Get current month billing
    const currentMonth = new Date().toISOString().slice(0, 7);
    const billingResult = await db.query(
      'SELECT total_due, status FROM billing WHERE owner_id = ? AND billing_period LIKE ? ORDER BY billing_period DESC LIMIT 1',
      [ownerId, currentMonth + '%']
    );
    
    let status = 'unknown';
    let amount = 0;

    if (billingResult[0].length > 0) {
      // Current month billing exists — use it as the source of truth
      const billing = billingResult[0][0];
      amount = parseFloat(billing.total_due);
      if (billing.status === 'free' || billing.status === 'paid') {
        status = 'paid';
      } else {
        status = 'unpaid';
      }
    } else {
      // No billing record for current month — not paid for this period
      status = 'unpaid';
      amount = 2000;
    }

    res.json({ status, amount });
  } catch (error) {
    console.error('Get user payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics (Admin only)
router.get('/dashboard-stats', requirePerm('view_dashboard_stats'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get total users count
    const [totalUsersResult] = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalUsersResult[0].count;
    
    // Get pending approvals count
    const [pendingResult] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "business_owner" AND account_status = "pending"'
    );
    const pendingApprovals = pendingResult[0].count;
    
    // Get active businesses count (approved AND active)
    const [activeResult] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "business_owner" AND account_status = "approved" AND active_status = "active"'
    );
    const activeBusinesses = activeResult[0].count;
    
    // Get suspended businesses count (approved BUT inactive)
    const [suspendedResult] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "business_owner" AND account_status = "approved" AND active_status = "inactive"'
    );
    const suspendedBusinesses = suspendedResult[0].count;
    
    // Get total approved businesses (active + suspended)
    const totalApprovedBusinesses = activeBusinesses + suspendedBusinesses;
    
    // Get total revenue from billing table
    const [revenueResult] = await db.query(
      'SELECT SUM(total_due) as totalRevenue FROM billing WHERE status = "paid"'
    );
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Get total drivers count
    const [driversResult] = await db.query('SELECT COUNT(*) as count FROM drivers');
    const totalDrivers = driversResult[0].count;

    res.json({
      totalUsers,
      pendingApprovals,
      activeBusinesses,
      suspendedBusinesses,
      totalApprovedBusinesses,
      totalRevenue,
      totalDrivers
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's uploaded document (Admin only)
router.get('/document/:userId', requirePerm('view_user_documents'), async (req, res) => {
  try {
    const { userId } = req.params;
    const db = req.app.locals.db;
    
    console.log(`Admin requesting document for userId: ${userId}`);
    
    // Get user info
    const result = await db.query(
      'SELECT full_name, email FROM users WHERE user_id = ?',
      [userId]
    );

    if (result[0].length === 0) {
      console.log(`User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const { full_name } = result[0][0];
    console.log(`Found user: ${full_name} (${userId})`);

    // Find the user's document in MinIO by userId metadata
    const objectKey = await fileStorageService.findCompanyDocumentByUserId(userId);
    
    if (!objectKey) {
      console.log(`No document found in MinIO for userId: ${userId}`);
      return res.status(404).json({ 
        error: 'No document found for this user',
        hint: 'The user may have registered before MinIO was set up, or no document was uploaded during registration.'
      });
    }
    
    console.log(`Found document: ${objectKey}`);

    // Download file from MinIO and stream to client
    try {
      const fileStream = await fileStorageService.downloadCompanyDocument(objectKey);
      const metadata = await fileStorageService.getFileMetadata(
        'documents',
        objectKey
      );
      
      // Generate a friendly filename
      const extension = path.extname(objectKey);
      const fileName = `${full_name.replace(/\s+/g, '_')}_company_document${extension}`;
      
      // Set response headers
      res.setHeader('Content-Type', metadata.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      
      // Pipe the stream to response
      fileStream.pipe(res);
    } catch (downloadError) {
      console.error('Error downloading document from MinIO:', downloadError);
      res.status(500).json({ error: 'Failed to load document' });
    }

  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SUBSCRIPTION ROUTES ====================

// Get next payment due date for business owner
router.get('/subscription/next-payment-due', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get the owner_id for this user
    const [ownerResult] = await db.query(
      'SELECT bo.owner_id FROM businessowners bo WHERE bo.user_id = ?',
      [req.user.user_id]
    );
    
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    
    const ownerId = ownerResult[0].owner_id;
    
    // Get user's approval date (created_at for approved users)
    const [userResult] = await db.query(
      'SELECT created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const approvalDate = new Date(userResult[0].created_at);
    const today = new Date();
    
    // Calculate how many months have passed since approval
    const monthsSinceApproval = (today.getFullYear() - approvalDate.getFullYear()) * 12 + 
                               (today.getMonth() - approvalDate.getMonth());
    
    // Payment is due exactly one month after approval, then every month after that
    const nextDueMonth = monthsSinceApproval + 1;
    
    const dueDate = new Date(approvalDate);
    dueDate.setMonth(dueDate.getMonth() + nextDueMonth);
    // Keep the same day of the month as approval date
    
    // Calculate days until due
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    res.json({
      dueDate: dueDate.toISOString(),
      daysUntilDue: daysUntilDue,
      monthsSinceApproval: monthsSinceApproval,
      nextDueMonth: nextDueMonth
    });
  } catch (error) {
    console.error('Get next payment due date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current subscription (Business Owner)
router.get('/subscription/current', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    // Get the owner_id for this user
    const businessOwnerResult = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [req.user.user_id]
    );
    
    if (businessOwnerResult[0].length === 0) {
      return res.json(null);
    }
    
    const ownerId = businessOwnerResult[0][0].owner_id;
    const subscription = await subscriptionService.getCurrentSubscription(ownerId);
    
    res.json(subscription);
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all subscriptions for user (Business Owner)
router.get('/subscriptions', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    // Get the owner_id for this user
    const businessOwnerResult = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [req.user.user_id]
    );
    
    if (businessOwnerResult[0].length === 0) {
      return res.json([]);
    }
    
    const ownerId = businessOwnerResult[0][0].owner_id;
    const subscriptions = await subscriptionService.getOwnerSubscriptions(ownerId);
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get billing information (Business Owner)
router.get('/billing', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    // Get the owner_id for this user
    const businessOwnerResult = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [req.user.user_id]
    );
    
    if (businessOwnerResult[0].length === 0) {
      return res.json([]);
    }
    
    const ownerId = businessOwnerResult[0][0].owner_id;
    const billing = await subscriptionService.getOwnerBilling(ownerId);
    
    res.json(billing);
  } catch (error) {
    console.error('Get billing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Calculate dynamic subscription fee
router.get('/subscription/calculate-fee', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    
    // Get current month's deliveries count
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Query to count orders for current month
    const [orderRows] = await db.execute(`
      SELECT COUNT(*) as order_count 
      FROM orders 
      WHERE business_owner_id = ? 
      AND order_created_at >= ? 
      AND order_created_at <= ?
    `, [userId, startOfMonth, endOfMonth]);
    
    const deliveryCount = orderRows[0].order_count || 0;
    
    // Calculate subscription fee: ₱2,000 base + (deliveries × ₱10)
    const baseFee = 2000;
    const perDeliveryFee = 10;
    const totalFee = baseFee + (deliveryCount * perDeliveryFee);
    
    res.json({
      baseFee,
      perDeliveryFee,
      deliveryCount,
      totalFee,
      breakdown: {
        base: baseFee,
        deliveries: deliveryCount * perDeliveryFee,
        total: totalFee
      }
    });
  } catch (error) {
    console.error('Calculate subscription fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload payment proof (Business Owner - including inactive accounts)
router.post('/subscription/payment-proof', requireBusinessOwnerOrInactive, upload.single('paymentProof'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    const { amount } = req.body;
    
    console.log('Payment proof upload request:', {
      userId: req.user.user_id,
      email: req.user.email,
      file: req.file ? req.file.filename : 'No file',
      amount: amount
    });
    
    if (!req.file) {
      return res.status(400).json({ error: 'Payment proof file is required' });
    }
    
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }
    
    const paymentAmount = parseFloat(amount);
    
    // Get the owner_id for this user
    const businessOwnerResult = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [req.user.user_id]
    );
    
    if (businessOwnerResult[0].length === 0) {
      return res.status(404).json({ error: 'Business owner record not found' });
    }
    
    const ownerId = businessOwnerResult[0][0].owner_id;
    
    // For suspended accounts, allow any amount >= 2000 (monthly fee)
    if (paymentAmount < 2000) {
      return res.status(400).json({ 
        error: 'Payment amount must be at least ₱2,000 (monthly subscription fee)' 
      });
    }
    
    // Upload payment proof to MinIO
    const objectKey = await fileStorageService.uploadPaymentProof(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { ownerId, uploadedAt: new Date().toISOString() }
    );
    
    await subscriptionService.uploadPaymentProof(ownerId, objectKey, paymentAmount);
    
    res.json({ message: 'Payment proof uploaded successfully. Waiting for administrator approval.' });
  } catch (error) {
    console.error('Upload payment proof error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get pending payments (Admin only)
router.get('/pending-payments', requirePerm('view_subscription_payments'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    
    const pendingPayments = await subscriptionService.getPendingPayments();
    
    res.json(pendingPayments);
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve payment (Admin only)
router.put('/subscription/:subscriptionId/approve', requirePerm('manage_subscriptions'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    const { subscriptionId } = req.params;
    
    await subscriptionService.approvePayment(subscriptionId, req.user.user_id);
    
    res.json({ message: 'Payment approved successfully' });
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Reject payment (Admin only)
router.put('/subscription/:subscriptionId/reject', requirePerm('manage_subscriptions'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const subscriptionService = new SubscriptionService(db);
    const { subscriptionId } = req.params;
    
    await subscriptionService.rejectPayment(subscriptionId, req.user.user_id);
    
    res.json({ message: 'Payment rejected successfully' });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


// ==================== BUSINESS OWNER DASHBOARD ROUTES ====================

// Get business owner dashboard statistics
router.get('/business-dashboard-stats', requirePerm('view_business_dashboard'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    let userId = req.user.user_id;
    
    // If user_id is not set, try to get it from email
    if (!userId && req.user.email) {
      const [userResult] = await db.query(
        'SELECT user_id FROM users WHERE email = ?',
        [req.user.email]
      );
      if (userResult.length > 0) {
        userId = userResult[0].user_id;
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get current month for calculations
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    // Get business owner ID first
    const businessOwnerResult = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    
    if (businessOwnerResult[0].length === 0) {
      return res.json({
        totalOrders: 0,
        activeDrivers: 0,
        completedDeliveries: 0,
        monthlyRevenue: 0
      });
    }
    
    const ownerId = businessOwnerResult[0][0].owner_id;
    
    // Get billing data for current month
    const billingResult = await db.query(
      'SELECT * FROM billing WHERE owner_id = ? AND billing_period LIKE ?',
      [ownerId, `${currentMonth}%`]
    );
    
    // Get current subscription status
    const subscriptionResult = await db.query(
      'SELECT approval_status, payment_proof FROM subscriptions WHERE owner_id = ? ORDER BY payment_date DESC LIMIT 1',
      [ownerId]
    );
    
    // Calculate stats from billing data
    let totalOrders = 0;
    let completedDeliveries = 0;
    let monthlyRevenue = 0;
    
    if (billingResult[0].length > 0) {
      const billing = billingResult[0][0];
      completedDeliveries = billing.total_commission / 10; // ₱10 per delivery
      totalOrders = completedDeliveries; // Assuming 1 order = 1 delivery
      monthlyRevenue = billing.total_due;
    }
    
    // Determine subscription status
    let subscriptionStatus = 'pending';
    if (subscriptionResult[0].length > 0) {
      const subscription = subscriptionResult[0][0];
      subscriptionStatus = subscription.approval_status === 'approved' ? 'paid' : 'pending';
    }
    
    // Get active drivers count (mock for now - would need drivers table)
    const activeDrivers = 0; // TODO: Implement when drivers table is created
    
    res.json({
      totalOrders,
      activeDrivers,
      completedDeliveries,
      monthlyRevenue,
      subscriptionStatus
    });
  } catch (error) {
    console.error('Business dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent orders for business owner
router.get('/business-dashboard-stats-test', async (req, res) => {
  try {
    // Test endpoint - returns mock data for development
    res.json({
      totalOrders: 0,
      activeDrivers: 0,
      completedDeliveries: 0,
      monthlyRevenue: 0,
      subscriptionStatus: 'pending'
    });
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent orders for business owner
router.get('/recent-orders', async (req, res) => {
  try {
    // For now, return empty array since orders table doesn't exist yet
    // This endpoint is ready for when orders functionality is implemented
    res.json([]);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ADMIN BILLING STATISTICS ROUTES ====================

// Get admin billing statistics
router.get('/admin/billing-stats', requirePerm('view_admin_billing_stats'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    console.log('Fetching admin billing stats...');
    
    // Get total revenue from billing table
    const revenueResult = await db.query(
      'SELECT SUM(total_due) as totalRevenue FROM billing WHERE status = "paid"'
    );
    console.log('Revenue result:', revenueResult[0]);
    
    // Get monthly subscriptions count
    const subscriptionsResult = await db.query(
      'SELECT COUNT(*) as monthlySubscriptions FROM subscriptions WHERE approval_status = "approved"'
    );
    console.log('Subscriptions result:', subscriptionsResult[0]);
    
    // Get overdue accounts (business owners who are actually overdue on payments)
    // This counts users who are inactive AND have a payment due date that has passed
    const overdueResult = await db.query(
      `SELECT COUNT(*) as overdueAccounts 
       FROM (
         SELECT u.user_id, u.created_at,
                DATE_ADD(DATE(u.created_at), INTERVAL 
                  (YEAR(CURDATE()) - YEAR(u.created_at)) * 12 + 
                  (MONTH(CURDATE()) - MONTH(u.created_at)) + 1 
                MONTH) as payment_due_date
         FROM users u 
         JOIN businessowners bo ON u.user_id = bo.user_id 
         WHERE u.role = 'business_owner' 
           AND u.account_status = 'approved' 
           AND u.active_status = 'inactive'
       ) overdue_check
       WHERE payment_due_date < CURDATE()`
    );
    console.log('Overdue result:', overdueResult[0]);
    
    const totalRevenue = revenueResult[0][0]?.totalRevenue || 0;
    const monthlySubscriptions = subscriptionsResult[0][0]?.monthlySubscriptions || 0;
    const overdueAccounts = overdueResult[0][0]?.overdueAccounts || 0;
    
    console.log('Final billing stats:', { totalRevenue, monthlySubscriptions, overdueAccounts });
    
    res.json({
      totalRevenue,
      monthlySubscriptions,
      overdueAccounts
    });
  } catch (error) {
    console.error('Admin billing stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== BILLING STATEMENT ROUTES ====================

// Get billing statements for business owner
router.get('/billing-statements', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    
    // Get owner_id from user
    const [ownerResult] = await db.query(
      'SELECT bo.owner_id FROM businessowners bo WHERE bo.user_id = ?',
      [req.user.user_id]
    );
    
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    
    const ownerId = ownerResult[0].owner_id;
    const statements = await billingStatementService.getStatementsByOwner(ownerId);
    
    res.json(statements);
  } catch (error) {
    console.error('Get billing statements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get orders for a specific billing period
router.get('/billing-statements/orders/:period', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { period } = req.params; // YYYY-MM format

    const [ownerResult] = await db.query(
      'SELECT bo.owner_id FROM businessowners bo WHERE bo.user_id = ?',
      [req.user.user_id]
    );

    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }

    const ownerId = ownerResult[0].owner_id;

    const [orders] = await db.query(
      `SELECT
        o.order_id,
        o.pickup_location,
        o.drop_off_location,
        o.delivery_fee,
        o.order_status,
        o.order_created_at,
        c.company_name as customer_name,
        CONCAT(d.first_name, ' ', d.last_name) as driver_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
      WHERE o.business_owner_id = ?
      AND DATE_FORMAT(o.order_created_at, '%Y-%m') = ?
      ORDER BY o.order_created_at DESC`,
      [ownerId, period]
    );

    res.json(orders);
  } catch (error) {
    console.error('Get billing period orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific billing statement
router.get('/billing-statements/:statementId', requirePerm('view_billing'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    const { statementId } = req.params;
    
    // Get owner_id from user
    const [ownerResult] = await db.query(
      'SELECT bo.owner_id FROM businessowners bo WHERE bo.user_id = ?',
      [req.user.user_id]
    );
    
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    
    const ownerId = ownerResult[0].owner_id;
    
    // Get statement and verify ownership
    const [statementResult] = await db.query(
      'SELECT * FROM billing WHERE billing_id = ? AND owner_id = ?',
      [statementId, ownerId]
    );
    
    if (statementResult.length === 0) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    
    const statement = statementResult[0];
    res.json(statement);
  } catch (error) {
    console.error('Get billing statement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload payment proof for specific statement
router.post('/billing-statements/:statementId/payment-proof', requireBusinessOwnerOrInactive, upload.single('paymentProof'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    const { statementId } = req.params;
    const { amount } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Payment proof file is required' });
    }
    
    if (!amount || parseFloat(amount) < 2000) {
      return res.status(400).json({ error: 'Amount must be at least ₱2,000' });
    }
    
    // Get owner_id from user
    const [ownerResult] = await db.query(
      'SELECT bo.owner_id FROM businessowners bo WHERE bo.user_id = ?',
      [req.user.user_id]
    );
    
    if (ownerResult.length === 0) {
      return res.status(404).json({ error: 'Business owner not found' });
    }
    
    const ownerId = ownerResult[0].owner_id;
    
    // Verify statement ownership
    const [statementResult] = await db.query(
      'SELECT * FROM billing WHERE billing_id = ? AND owner_id = ?',
      [statementId, ownerId]
    );
    
    if (statementResult.length === 0) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    
    const statement = statementResult[0];
    
    // Check if statement is already paid
    if (statement.status === 'paid') {
      return res.status(400).json({ error: 'Statement is already paid' });
    }
    
    // Upload payment proof to MinIO
    const objectKey = await fileStorageService.uploadPaymentProof(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { ownerId, statementId, uploadedAt: new Date().toISOString() }
    );
    
    // Update statement with payment proof
    await billingStatementService.updateStatementStatus(statementId, 'pending', objectKey);
    
    res.json({ 
      success: true, 
      message: 'Payment proof uploaded successfully. Waiting for administrator review.',
      statementId: parseInt(statementId)
    });
  } catch (error) {
    console.error('Upload payment proof error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all pending statements
router.get('/admin/billing-statements/pending', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    
    const pendingStatements = await billingStatementService.getPendingStatements();
    res.json(pendingStatements);
  } catch (error) {
    console.error('Get pending statements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Approve payment for statement
router.post('/admin/billing-statements/:statementId/approve', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    const { statementId } = req.params;
    
    // Update statement status to paid
    await billingStatementService.updateStatementStatus(statementId, 'paid');
    
    // Get statement details to update user status if needed
    const [statementResult] = await db.query(
      `SELECT b.*, bo.user_id 
       FROM billing b 
       JOIN businessowners bo ON b.owner_id = bo.owner_id 
       WHERE b.billing_id = ?`,
      [statementId]
    );
    
    if (statementResult.length > 0) {
      const statement = statementResult[0];
      
      // Reactivate user if they were suspended
      await db.query(
        'UPDATE users SET active_status = ? WHERE user_id = ?',
        ['active', statement.user_id]
      );
    }
    
    res.json({ 
      success: true, 
      message: 'Payment approved successfully. Account reactivated.' 
    });
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Reject payment for statement
router.post('/admin/billing-statements/:statementId/reject', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    const { statementId } = req.params;
    
    // Update statement status back to overdue
    await billingStatementService.updateStatementStatus(statementId, 'overdue');
    
    res.json({ 
      success: true, 
      message: 'Payment rejected successfully.' 
    });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Generate statements for all owners
router.post('/admin/billing-statements/generate', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    const { statementPeriod } = req.body;
    
    if (!statementPeriod || !/^\d{4}-\d{2}$/.test(statementPeriod)) {
      return res.status(400).json({ error: 'Valid statement period (YYYY-MM) is required' });
    }
    
    const generatedStatements = await billingStatementService.generateStatementsForAllOwners(statementPeriod);
    
    res.json({ 
      success: true, 
      message: `Generated ${generatedStatements.length} billing statements for ${statementPeriod}`,
      statements: generatedStatements
    });
  } catch (error) {
    console.error('Generate statements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Check and update overdue statements
router.post('/admin/billing-statements/check-overdue', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    
    const overdueStatements = await billingStatementService.checkOverdueStatements();
    
    res.json({ 
      success: true, 
      message: `Updated ${overdueStatements.length} statements to overdue status`,
      overdueStatements
    });
  } catch (error) {
    console.error('Check overdue statements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Check and suspend accounts past grace period
router.post('/admin/billing-statements/check-suspensions', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const billingStatementService = new BillingStatementService(db);
    
    const suspendedAccounts = await billingStatementService.checkSuspensionCandidates();
    
    res.json({ 
      success: true, 
      message: `Suspended ${suspendedAccounts.length} accounts past grace period`,
      suspendedAccounts
    });
  } catch (error) {
    console.error('Check suspension candidates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all business owners with their billing summaries
router.get('/admin/business-owners/billing', requirePerm('view_admin_billing_stats'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const [owners] = await db.query(
      `SELECT 
        bo.owner_id,
        bo.company_name,
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.account_status,
        u.active_status,
        u.created_at,
        -- Count of statements
        COUNT(DISTINCT b.billing_id) as total_statements,
        -- Count of pending/overdue statements
        SUM(CASE WHEN b.status IN ('pending', 'overdue') THEN 1 ELSE 0 END) as unpaid_statements,
        -- Total amount due
        SUM(CASE WHEN b.status IN ('pending', 'overdue') THEN b.total_due ELSE 0 END) as total_due,
        -- Most recent statement status
        (SELECT b2.status FROM billing b2 WHERE b2.owner_id = bo.owner_id ORDER BY b2.billing_period DESC LIMIT 1) as latest_statement_status,
        -- Most recent statement period
        (SELECT DATE_FORMAT(b2.billing_period, '%Y-%m') FROM billing b2 WHERE b2.owner_id = bo.owner_id ORDER BY b2.billing_period DESC LIMIT 1) as latest_statement_period
      FROM businessowners bo
      JOIN users u ON bo.user_id = u.user_id
      LEFT JOIN billing b ON bo.owner_id = b.owner_id
      WHERE u.account_status = 'approved'
      GROUP BY bo.owner_id, bo.company_name, u.user_id, u.full_name, u.email, u.phone, u.account_status, u.active_status, u.created_at
      ORDER BY u.active_status ASC, total_due DESC`
    );
    
    res.json(owners);
  } catch (error) {
    console.error('Get business owners billing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all billing statements for a specific business owner
router.get('/admin/business-owners/:ownerId/statements', requirePerm('view_admin_billing_stats'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { ownerId } = req.params;
    const billingStatementService = new BillingStatementService(db);
    
    const statements = await billingStatementService.getStatementsByOwner(parseInt(ownerId));
    res.json(statements);
  } catch (error) {
    console.error('Get owner statements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get overdue/late accounts grouped
router.get('/admin/billing-statements/overdue-accounts', requirePerm('view_admin_billing_stats'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const [overdueAccounts] = await db.query(
      `SELECT 
        bo.owner_id,
        bo.company_name,
        u.user_id,
        u.full_name,
        u.email,
        u.active_status,
        b.billing_id as statement_id,
        DATE_FORMAT(b.billing_period, '%Y-%m') as statement_period,
        b.total_due,
        b.status,
        b.billing_period as statement_date,
        b.payment_proof_path,
        DATE_ADD(b.billing_period, INTERVAL 1 MONTH) as due_date,
        DATE_ADD(DATE_ADD(b.billing_period, INTERVAL 1 MONTH), INTERVAL 7 DAY) as grace_period_end,
        DATEDIFF(NOW(), DATE_ADD(b.billing_period, INTERVAL 1 MONTH)) as days_overdue,
        ROUND(b.total_commission / 10) as delivery_count
      FROM billing b
      JOIN businessowners bo ON b.owner_id = bo.owner_id
      JOIN users u ON bo.user_id = u.user_id
      WHERE (b.status IN ('overdue', 'suspended', 'pending') 
        AND DATE_ADD(b.billing_period, INTERVAL 1 MONTH) < NOW())
      ORDER BY days_overdue DESC, b.total_due DESC`
    );
    
    res.json(overdueAccounts);
  } catch (error) {
    console.error('Get overdue accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: View payment proof for a billing statement
router.get('/admin/billing-statements/:statementId/payment-proof', requirePerm('manage_billing_statements'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { statementId } = req.params;
    
    // Get statement with payment proof
    const [statementResult] = await db.query(
      'SELECT payment_proof_path FROM billing WHERE billing_id = ?',
      [statementId]
    );
    
    if (statementResult.length === 0) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    
    const statement = statementResult[0];
    
    if (!statement.payment_proof_path) {
      return res.status(404).json({ error: 'No payment proof uploaded for this statement' });
    }
    
    // Download file from MinIO and stream to client
    try {
      const fileStream = await fileStorageService.downloadPaymentProof(statement.payment_proof_path);
      const metadata = await fileStorageService.getFileMetadata(
        'payments',
        statement.payment_proof_path
      );
      
      // Set response headers
      res.setHeader('Content-Type', metadata.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(statement.payment_proof_path)}"`);
      
      // Pipe the stream to response
      fileStream.pipe(res);
    } catch (err) {
      console.error('Error downloading payment proof from MinIO:', err);
      res.status(500).json({ error: 'Failed to load payment proof' });
    }
  } catch (error) {
    console.error('Get payment proof error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Bulk suspend overdue accounts
router.post('/admin/billing-statements/bulk-suspend', requirePerm('bulk_suspend_accounts'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { statementIds } = req.body;
    
    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return res.status(400).json({ error: 'Statement IDs array is required' });
    }
    
    const suspendedAccounts = [];
    
    for (const statementId of statementIds) {
      // Get statement and owner info
      const [statementResult] = await db.query(
        `SELECT b.*, bo.user_id, u.email, u.full_name
         FROM billing b
         JOIN businessowners bo ON b.owner_id = bo.owner_id
         JOIN users u ON bo.user_id = u.user_id
         WHERE b.billing_id = ?`,
        [statementId]
      );
      
      if (statementResult.length > 0) {
        const statement = statementResult[0];
        
        // Update statement status to suspended
        await db.query(
          'UPDATE billing SET status = ? WHERE billing_id = ?',
          ['suspended', statementId]
        );
        
        // Suspend user account
        await db.query(
          'UPDATE users SET active_status = ? WHERE user_id = ?',
          ['inactive', statement.user_id]
        );
        
        suspendedAccounts.push({
          statement_id: statementId,
          user_id: statement.user_id,
          email: statement.email,
          full_name: statement.full_name
        });
      }
    }
    
    res.json({
      success: true,
      message: `Suspended ${suspendedAccounts.length} account(s)`,
      suspendedAccounts
    });
  } catch (error) {
    console.error('Bulk suspend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== DRIVER ROUTES ====================

// Get driver profile
router.get('/driver/me', requireDriver, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [driver] = await db.query(
      `SELECT d.*, u.email, u.full_name, bo.company_name
       FROM drivers d
       JOIN users u ON d.user_id = u.user_id
       JOIN businessowners bo ON d.owner_id = bo.owner_id
       WHERE d.driver_id = ?`,
      [req.driverId]
    );
    if (driver.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver[0]);
  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
});

// Change driver password
router.put('/driver/change-password', requireDriver, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const [users] = await db.query(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [newHash, req.user.user_id]
    );
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
