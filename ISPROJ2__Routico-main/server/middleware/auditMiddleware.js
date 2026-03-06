// Automatic audit logging middleware
// Captures all mutating API requests (POST, PUT, DELETE, PATCH)

const routeDescriptions = {
  // Auth
  'POST /api/auth/register': { action: 'user_register', category: 'auth', description: 'New user registration' },
  'POST /api/auth/login': { action: 'user_login', category: 'auth', description: 'User login' },
  'POST /api/auth/admin/login': { action: 'admin_login', category: 'auth', description: 'Admin/Driver login' },
  'PUT /api/auth/user/:userId/status': { action: 'update_user_status', category: 'users', description: 'Updated user account status' },
  'PUT /api/auth/user/:userId/active-status': { action: 'update_active_status', category: 'users', description: 'Updated user active status' },
  'DELETE /api/auth/user/:userId': { action: 'delete_user', category: 'users', description: 'Deleted a user' },
  'POST /api/auth/admin/billing-statements/bulk-suspend': { action: 'bulk_suspend', category: 'billing', description: 'Bulk suspended accounts' },

  // Orders
  'POST /api/orders': { action: 'create_order', category: 'orders', description: 'Created a new order' },
  'PUT /api/orders/:orderId': { action: 'update_order', category: 'orders', description: 'Updated an order' },
  'PUT /api/orders/:orderId/status': { action: 'update_order_status', category: 'orders', description: 'Updated order status' },
  'PUT /api/orders/:orderId/assign': { action: 'assign_order', category: 'orders', description: 'Assigned order to driver' },
  'DELETE /api/orders/:orderId': { action: 'delete_order', category: 'orders', description: 'Deleted an order' },

  // Drivers
  'POST /api/drivers': { action: 'create_driver', category: 'drivers', description: 'Created a new driver' },
  'PUT /api/drivers/:driverId': { action: 'update_driver', category: 'drivers', description: 'Updated driver info' },
  'DELETE /api/drivers/:driverId': { action: 'delete_driver', category: 'drivers', description: 'Deleted a driver' },

  // Billing
  'POST /api/billing/upload-payment': { action: 'upload_payment', category: 'billing', description: 'Uploaded payment proof' },
  'PUT /api/billing/statements/:statementId': { action: 'update_billing', category: 'billing', description: 'Updated billing statement' },

  // Routes
  'POST /api/routes/optimize': { action: 'optimize_routes', category: 'routes', description: 'Ran route optimization' },

  // Tracking
  'PUT /api/tracking/:orderId': { action: 'update_tracking', category: 'tracking', description: 'Updated tracking status' },

  // Issues
  'POST /api/issues': { action: 'create_issue', category: 'issues', description: 'Created a new issue' },
  'PUT /api/issues/:issueId': { action: 'update_issue', category: 'issues', description: 'Updated an issue' },

  // Roles
  'POST /api/roles': { action: 'create_role', category: 'roles', description: 'Created a new role' },
  'PUT /api/roles/:roleId': { action: 'update_role', category: 'roles', description: 'Updated a role' },
  'DELETE /api/roles/:roleId': { action: 'delete_role', category: 'roles', description: 'Deleted a role' },
  'PUT /api/roles/:roleId/permissions': { action: 'update_role_permissions', category: 'roles', description: 'Updated role permissions' },
  'PUT /api/roles/users/:userId/role': { action: 'assign_user_role', category: 'roles', description: 'Assigned role to user' },

  // AI Analytics
  'POST /api/ai-analytics/predict': { action: 'ai_prediction', category: 'analytics', description: 'Ran AI prediction' },
};

// Match a request against the route patterns
function matchRoute(method, path) {
  const key = `${method} ${path}`;

  // Try exact match first
  if (routeDescriptions[key]) return routeDescriptions[key];

  // Try pattern matching (replace :param with actual values)
  for (const [pattern, info] of Object.entries(routeDescriptions)) {
    const [pMethod, pPath] = pattern.split(' ');
    if (pMethod !== method) continue;

    const regex = new RegExp('^' + pPath.replace(/:[^/]+/g, '[^/]+') + '$');
    if (regex.test(path)) return info;
  }

  return null;
}

function auditMiddleware(req, res, next) {
  // Skip health checks, static files, and most GET requests
  if (req.originalUrl === '/api/health' || req.originalUrl.startsWith('/uploads')) {
    return next();
  }

  // Only log mutating requests (GET requests are not logged to avoid noise)
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Capture the full URL path NOW before Express routers strip it
  const fullPath = req.originalUrl.split('?')[0];

  // Capture the original res.json to intercept the response
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Log after response is sent
    const auditLog = req.app.locals.auditLog;
    if (auditLog) {
      const routeInfo = matchRoute(req.method, fullPath);
      const status = res.statusCode >= 400 ? 'failure' : 'success';

      let action, category, description;
      if (routeInfo) {
        action = routeInfo.action;
        category = routeInfo.category;
        description = routeInfo.description;
      } else {
        // Generic fallback
        action = `${req.method.toLowerCase()}_${fullPath.split('/').filter(Boolean).slice(1).join('_')}`;
        category = fullPath.split('/')[2] || 'system';
        description = `${req.method} ${fullPath}`;
      }

      // Extract target info from params
      const targetId = req.params?.orderId || req.params?.driverId || req.params?.userId || req.params?.roleId || req.params?.issueId || req.params?.statementId || null;
      const targetType = targetId ? category.replace(/s$/, '') : null;

      // Build metadata - include relevant non-sensitive body data
      const metadata = {};
      if (req.body && typeof req.body === 'object') {
        // Exclude sensitive fields
        const { password, password_hash, token, ...safeBody } = req.body;
        if (Object.keys(safeBody).length > 0) {
          metadata.requestBody = safeBody;
        }
      }
      if (res.statusCode >= 400 && body?.error) {
        metadata.error = body.error;
      }

      // For login routes, extract user info from response body
      let userId = req.user?.user_id || null;
      let userEmail = req.user?.email || null;
      let userRole = req.userRole || null;
      if ((action === 'user_login' || action === 'admin_login') && body?.user) {
        userId = body.user.userId || userId;
        userEmail = body.user.email || req.body?.email || userEmail;
        userRole = body.user.role || userRole;
      } else if ((action === 'user_login' || action === 'admin_login') && !body?.user) {
        userEmail = req.body?.email || userEmail;
      }
      if (action === 'user_register') {
        userEmail = req.body?.email || userEmail;
      }

      auditLog.log({
        userId,
        userEmail,
        userRole,
        action,
        category,
        description,
        targetType,
        targetId,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        ipAddress: req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress,
        status
      });
    }

    return originalJson(body);
  };

  next();
}

module.exports = auditMiddleware;
