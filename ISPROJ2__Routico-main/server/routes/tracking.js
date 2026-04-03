const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

// Get status log for an order
router.get('/:orderId/status-log', requirePerm('view_tracking'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;

    // Verify ownership
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) return res.status(403).json({ error: 'No owner profile' });
    const ownerId = ownerResult[0].owner_id;

    const [orderCheck] = await db.query(
      'SELECT order_id FROM orders WHERE order_id = ? AND business_owner_id = ?',
      [orderId, ownerId]
    );
    if (orderCheck.length === 0) return res.status(404).json({ error: 'Order not found' });

    const [logs] = await db.query(
      `SELECT * FROM deliverystatuslogs WHERE order_id = ? ORDER BY timestamp ASC`,
      [orderId]
    );

    res.json(logs);
  } catch (error) {
    console.error('Error fetching status log:', error);
    res.status(500).json({ error: 'Failed to fetch status log' });
  }
});

// Add a status update with optional location
router.post('/:orderId/update-status', requirePerm('update_tracking'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const notificationService = new NotificationService(db);
    const userId = req.user.user_id;
    const orderId = req.params.orderId;
    const { status, location, notes } = req.body;

    const validStatuses = ['pending', 'assigned', 'in_transit', 'delivered', 'completed', 'cancelled', 'delayed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify ownership
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) return res.status(403).json({ error: 'No owner profile' });
    const ownerId = ownerResult[0].owner_id;

    const [orderCheck] = await db.query(
      'SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?',
      [orderId, ownerId]
    );
    if (orderCheck.length === 0) return res.status(404).json({ error: 'Order not found' });

    const previousStatus = orderCheck[0].order_status;

    // Update order status
    await db.query(
      'UPDATE orders SET order_status = ?, order_updated_at = NOW() WHERE order_id = ?',
      [status, orderId]
    );

    // Log to deliverystatuslogs
    await db.query(
      'INSERT INTO deliverystatuslogs (order_id, status) VALUES (?, ?)',
      [orderId, status]
    );

    // If completed, increment the assigned driver's rides_completed count
    if (status === 'completed' && orderCheck[0].assigned_driver_id) {
      await db.query(
        'UPDATE drivers SET rides_completed = rides_completed + 1 WHERE driver_id = ?',
        [orderCheck[0].assigned_driver_id]
      );
    }

    // If location provided, update tracking table
    if (location) {
      const driverId = orderCheck[0].assigned_driver_id;
      await db.query(
        'INSERT INTO tracking (order_id, driver_id, current_location) VALUES (?, ?, ?)',
        [orderId, driverId, location]
      );
    }

    try {
      await notificationService.notifyOrderStatusUpdate({
        orderId: Number(orderId),
        oldStatus: previousStatus,
        newStatus: status,
        actorRole: req.userRole || 'user'
      });
    } catch (notificationError) {
      console.error('Tracking status notification error:', notificationError);
    }

    // Fetch updated order
    const [updated] = await db.query(
      `SELECT o.*, c.company_name as customer_name,
              CONCAT(d.first_name, ' ', d.last_name) as driver_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
       WHERE o.order_id = ?`,
      [orderId]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating tracking status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get all active (in-transit) deliveries
router.get('/active/deliveries', requirePerm('view_tracking'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) return res.json([]);
    const ownerId = ownerResult[0].owner_id;

    const [activeOrders] = await db.query(
      `SELECT o.*, c.company_name as customer_name,
              CONCAT(d.first_name, ' ', d.last_name) as driver_name,
              t.current_location as last_known_location,
              t.timestamp as location_updated_at
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
       LEFT JOIN tracking t ON t.order_id = o.order_id
         AND t.tracking_id = (SELECT MAX(tracking_id) FROM tracking WHERE order_id = o.order_id)
       WHERE o.business_owner_id = ? AND o.order_status IN ('assigned', 'in_transit')
       ORDER BY o.order_updated_at DESC`,
      [ownerId]
    );

    res.json(activeOrders);
  } catch (error) {
    console.error('Error fetching active deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch active deliveries' });
  }
});

module.exports = router;
