const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Middleware to verify both Firebase tokens and JWT tokens
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Try to verify as JWT token first (for admin login)
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = {
        email: decodedToken.email,
        uid: decodedToken.userId.toString()
      };
      req.isJWT = true;
      return next();
    } catch (jwtError) {
      // If JWT fails, try Firebase
    }

    // If JWT fails, try Firebase token verification
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      req.isJWT = false;
      next();
    } catch (firebaseError) {
      console.error('Token verification error - both JWT and Firebase failed');
      console.error('Firebase error:', firebaseError.code, firebaseError.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user has required role
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const db = req.app.locals.db;
      
      // Get user role from database using email
      const result = await db.query(
        'SELECT user_id, role, account_status, active_status FROM users WHERE email = ?',
        [req.user.email]
      );

      if (result[0].length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = result[0][0];
      
      // Check if user has required role
      if (!roles.includes(userData.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Check if account is approved and active (for business owners only)
      if (userData.role === 'business_owner') {
        if (userData.account_status !== 'approved') {
          return res.status(403).json({ error: 'Account pending approval' });
        }
        if (userData.active_status !== 'active') {
          return res.status(403).json({ error: 'Account inactive' });
        }
      }
      // Administrators don't need account_status or active_status checks

      req.userRole = userData.role;
      req.userStatus = userData;
      req.user.user_id = userData.user_id; // Add user_id to req.user for API endpoints
      next();
    } catch (error) {
      console.error('Role verification error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Middleware to check if user has a specific permission (RBAC)
const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const db = req.app.locals.db;
      const permissionCache = req.app.locals.permissionCache;

      const [result] = await db.query(
        'SELECT user_id, role, role_id, account_status, active_status FROM users WHERE email = ?',
        [req.user.email]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = result[0];

      // Business owner status checks
      if (userData.role === 'business_owner') {
        if (userData.account_status !== 'approved') {
          return res.status(403).json({ error: 'Account pending approval' });
        }
        if (userData.active_status !== 'active') {
          return res.status(403).json({ error: 'Account inactive' });
        }
      }

      // Check permission from cache
      if (!permissionCache || !permissionCache.hasPermission(userData.role_id, permissionKey)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.userRole = userData.role;
      req.userStatus = userData;
      req.user.user_id = userData.user_id;
      req.user.role_id = userData.role_id;
      next();
    } catch (error) {
      console.error('Permission verification error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Helper to create permission-based middleware chain
const requirePerm = (permissionKey) => [verifyFirebaseToken, requirePermission(permissionKey)];

// Middleware specifically for admin routes
const requireAdmin = [verifyFirebaseToken, requireRole(['administrator'])];

// Middleware for business owner routes
const requireBusinessOwner = [verifyFirebaseToken, requireRole(['business_owner'])];

// Middleware for business owners (including inactive ones) - allows payment uploads
const requireBusinessOwnerOrInactive = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const db = req.app.locals.db;
    
    // Get user role from database using email
    const result = await db.query(
      'SELECT user_id, role, account_status, active_status FROM users WHERE email = ?',
      [req.user.email]
    );

    if (result[0].length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = result[0][0];

    // Check if user is a business owner
    if (userData.role !== 'business_owner') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if account is approved (but allow inactive accounts for payment uploads)
    if (userData.account_status !== 'approved') {
      return res.status(403).json({ error: 'Account pending approval' });
    }

    req.userRole = userData.role;
    req.userStatus = userData;
    req.user.user_id = userData.user_id;
    next();
  } catch (error) {
    console.error('Business owner or inactive verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware for both roles
const requireAuth = [verifyFirebaseToken, requireRole(['business_owner', 'administrator'])];

// Middleware for any authenticated user (business owner, administrator, or driver)
const requireAnyAuth = [verifyFirebaseToken, requireRole(['business_owner', 'administrator', 'driver'])];

// Middleware specifically for driver routes
const requireDriverMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const db = req.app.locals.db;

    const [result] = await db.query(
      'SELECT user_id, role, account_status, active_status FROM users WHERE email = ?',
      [req.user.email]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = result[0];

    if (userData.role !== 'driver') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.userRole = 'driver';
    req.user.user_id = userData.user_id;

    // Attach driver_id and owner_id for convenience
    const [driverResult] = await db.query(
      'SELECT driver_id, owner_id FROM drivers WHERE user_id = ?',
      [userData.user_id]
    );

    if (driverResult.length === 0) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    req.driverId = driverResult[0].driver_id;
    req.driverOwnerId = driverResult[0].owner_id;

    next();
  } catch (error) {
    console.error('Driver auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const requireDriver = [verifyFirebaseToken, requireDriverMiddleware];

module.exports = {
  verifyFirebaseToken,
  requireRole,
  requirePermission,
  requirePerm,
  requireAdmin,
  requireBusinessOwner,
  requireAuth,
  requireAnyAuth,
  requireDriver,
  requireBusinessOwnerOrInactive: [verifyFirebaseToken, requireBusinessOwnerOrInactive]
};
