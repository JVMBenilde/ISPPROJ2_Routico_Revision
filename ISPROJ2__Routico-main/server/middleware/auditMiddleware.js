// Automatic audit logging middleware
// Captures all mutating API requests (POST, PUT, DELETE, PATCH)

const routeDescriptions = {
  // Auth
  'POST /api/auth/register': { action: 'user_register', category: 'auth', description: 'New user registration' },
  'POST /api/auth/login': { action: 'user_login', category: 'auth', description: 'User login' },
  'POST /api/auth/admin/login': { action: 'admin_login', category: 'auth', description: 'Admin/Driver login' },
  'PUT /api/auth/user/:userId/status': { action: 'update_user_status', category: 'users', description: 'Updated user account status' },
  'PUT /api/auth/user/:userId/active-status': { action: 'update_active_status', category: 'users', description: 'Updated user active status' },
  'PUT /api/auth/user/:userId/suspend': { action: 'suspend_user', category: 'users', description: 'Suspended a user account' },
  'PUT /api/auth/user/:userId/reactivate': { action: 'reactivate_user', category: 'users', description: 'Reactivated a user account' },
  'PUT /api/auth/user/:userId/reset-password': { action: 'reset_user_password', category: 'users', description: 'Reset user password' },
  'PUT /api/auth/driver/:driverId/reset-password': { action: 'reset_driver_password', category: 'drivers', description: 'Reset driver password' },
  'PUT /api/auth/driver/change-password': { action: 'driver_change_password', category: 'auth', description: 'Driver changed their password' },
  'DELETE /api/auth/user/:userId': { action: 'delete_user', category: 'users', description: 'Deleted a user' },
  'POST /api/auth/admin/billing-statements/bulk-suspend': { action: 'bulk_suspend', category: 'billing', description: 'Bulk suspended overdue accounts' },
  'POST /api/auth/admin/billing-statements/generate': { action: 'generate_billing', category: 'billing', description: 'Generated monthly billing statements' },
  'POST /api/auth/admin/billing-statements/:statementId/approve': { action: 'approve_payment', category: 'billing', description: 'Approved a payment submission' },
  'POST /api/auth/billing-statements/:statementId/payment-proof': { action: 'upload_payment_proof', category: 'billing', description: 'Uploaded payment proof for billing' },
  'POST /api/auth/subscription/payment-proof': { action: 'upload_subscription_proof', category: 'billing', description: 'Uploaded subscription payment proof' },

  // Orders
  'POST /api/orders': { action: 'create_order', category: 'orders', description: 'Created a new delivery order' },
  'PUT /api/orders/:orderId': { action: 'update_order', category: 'orders', description: 'Updated order details' },
  'PUT /api/orders/:orderId/status': { action: 'update_order_status', category: 'orders', description: 'Changed order delivery status' },
  'PUT /api/orders/:orderId/assign': { action: 'assign_order', category: 'orders', description: 'Assigned a driver to an order' },
  'DELETE /api/orders/:orderId': { action: 'delete_order', category: 'orders', description: 'Deleted a delivery order' },

  // Drivers
  'POST /api/drivers': { action: 'create_driver', category: 'drivers', description: 'Added a new driver' },
  'PUT /api/drivers/:driverId': { action: 'update_driver', category: 'drivers', description: 'Updated driver information' },
  'PUT /api/drivers/:driverId/status': { action: 'update_driver_status', category: 'drivers', description: 'Changed driver status' },
  'DELETE /api/drivers/:driverId': { action: 'delete_driver', category: 'drivers', description: 'Removed a driver' },

  // Vehicles & Fleet
  'POST /api/vehicles': { action: 'add_vehicle', category: 'fleet', description: 'Added a new vehicle' },
  'PUT /api/vehicles/:truckId': { action: 'update_vehicle', category: 'fleet', description: 'Updated vehicle details' },
  'PUT /api/vehicles/:truckId/assign-driver': { action: 'assign_vehicle_driver', category: 'fleet', description: 'Assigned a driver to a vehicle' },
  'DELETE /api/vehicles/:truckId': { action: 'delete_vehicle', category: 'fleet', description: 'Removed a vehicle' },

  // Maintenance
  'POST /api/vehicles/:truckId/maintenance': { action: 'add_maintenance', category: 'fleet', description: 'Added a maintenance record' },
  'PUT /api/vehicles/maintenance/:maintenanceId': { action: 'update_maintenance', category: 'fleet', description: 'Updated maintenance record status' },
  'DELETE /api/vehicles/maintenance/:maintenanceId': { action: 'delete_maintenance', category: 'fleet', description: 'Deleted a maintenance record' },

  // Mechanics
  'POST /api/vehicles/mechanics': { action: 'add_mechanic', category: 'fleet', description: 'Added an in-house mechanic' },
  'DELETE /api/vehicles/mechanics/:mechanicId': { action: 'remove_mechanic', category: 'fleet', description: 'Removed an in-house mechanic' },

  // Partner Shops
  'POST /api/vehicles/partner-shops': { action: 'add_partner_shop', category: 'fleet', description: 'Added a partner repair shop' },
  'DELETE /api/vehicles/partner-shops/:shopId': { action: 'remove_partner_shop', category: 'fleet', description: 'Removed a partner repair shop' },

  // Billing
  'POST /api/billing/upload-payment': { action: 'upload_payment', category: 'billing', description: 'Uploaded payment proof' },
  'PUT /api/billing/statements/:statementId': { action: 'update_billing', category: 'billing', description: 'Updated billing statement' },

  // Routes
  'POST /api/routes/optimize': { action: 'optimize_routes', category: 'routes', description: 'Ran route optimization' },
  'POST /api/routes/assign-driver': { action: 'assign_route_driver', category: 'routes', description: 'Assigned a driver to optimized route' },

  // Tracking
  'POST /api/tracking/:orderId/update-status': { action: 'update_tracking', category: 'tracking', description: 'Updated delivery tracking status' },

  // Issues
  'POST /api/issues': { action: 'create_issue', category: 'issues', description: 'Reported a new issue' },
  'PUT /api/issues/:issueId/status': { action: 'update_issue_status', category: 'issues', description: 'Updated issue status' },

  // Roles
  'POST /api/roles': { action: 'create_role', category: 'roles', description: 'Created a new role' },
  'PUT /api/roles/:roleId': { action: 'update_role', category: 'roles', description: 'Updated role details' },
  'DELETE /api/roles/:roleId': { action: 'delete_role', category: 'roles', description: 'Deleted a role' },
  'PUT /api/roles/:roleId/permissions': { action: 'update_role_permissions', category: 'roles', description: 'Updated role permissions' },
  'PUT /api/roles/users/:userId/role': { action: 'assign_user_role', category: 'roles', description: 'Assigned a role to user' },

  // Stripe
  'POST /api/stripe/create-checkout-session': { action: 'create_payment_session', category: 'billing', description: 'Started online payment checkout' },
  'POST /api/stripe/webhook': { action: 'stripe_webhook', category: 'billing', description: 'Processed payment webhook' },

  // AI Analytics
  'POST /api/ai-analytics/predict': { action: 'ai_prediction', category: 'analytics', description: 'Generated AI business insights' },
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
