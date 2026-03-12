const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');

// Get all orders for the authenticated business owner
router.get('/', requirePerm('view_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    // Get the owner_id for this user
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.json([]); // Return empty array if no business owner record
    }

    const ownerId = ownerResult[0].owner_id;

    // Get orders with customer and driver information via JOIN
    const [orders] = await db.query(
      `SELECT
        o.*,
        c.company_name as customer_name,
        c.contact_number as customer_phone,
        CONCAT(d.first_name, ' ', d.last_name) as driver_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
      WHERE o.business_owner_id = ?
      ORDER BY o.order_created_at DESC`,
      [ownerId]
    );

    console.log(`Fetched ${orders.length} orders for business owner ${ownerId}`);

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order by ID
router.get('/:orderId', requirePerm('view_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;

    const [orders] = await db.query(
      `SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(orders[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create new order
router.post('/', requirePerm('create_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    const {
      customerName,
      customerPhone,
      pickupAddress,
      deliveryAddress,
      itemWeight,
      size,
      scheduledDate,
      scheduledTime,
      distance,
      estimatedTime,
      deliveryFee
    } = req.body;

    console.log('Received order data:', req.body);

    // Get the owner_id for this user
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.status(404).json({ 
        error: 'Business owner record not found',
        message: 'Please ensure your business owner profile is set up'
      });
    }

    const ownerId = ownerResult[0].owner_id;
    console.log('Business owner ID:', ownerId);

    // Get or create customer in Customers table
    let customerId;
    const [existingCustomer] = await db.query(
      'SELECT customer_id FROM customers WHERE company_name = ? AND contact_number = ?',
      [customerName, customerPhone]
    );

    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].customer_id;
      console.log('Using existing customer ID:', customerId);
    } else {
      // Create new customer
      const [newCustomer] = await db.query(
        'INSERT INTO customers (company_name, contact_number) VALUES (?, ?)',
        [customerName, customerPhone]
      );
      customerId = newCustomer.insertId;
      console.log('Created new customer ID:', customerId);
    }

    // Calculate schedule datetime (combine date and time)
    let scheduledDeliveryTime = null;
    if (scheduledDate && scheduledTime) {
      scheduledDeliveryTime = `${scheduledDate} ${scheduledTime}:00`;
    }

    // Insert order - matching actual database schema
    const [result] = await db.query(
      `INSERT INTO orders (
        business_owner_id,
        customer_id,
        pickup_location,
        drop_off_location,
        delivery_fee,
        weight,
        size,
        scheduled_delivery_time,
        order_status,
        order_created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        ownerId,
        customerId,
        pickupAddress,
        deliveryAddress,
        parseFloat(deliveryFee) || null,
        parseFloat(itemWeight) || 0,
        size || null,
        scheduledDeliveryTime
      ]
    );

    // Fetch the created order
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE order_id = ?`,
      [result.insertId]
    );

    res.status(201).json(orders[0]);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message,
      details: error.sqlMessage || error.toString()
    });
  }
});

// Update order status
router.put('/:orderId/status', requirePerm('update_order_status'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;
    const { status } = req.body;

    const validStatuses = ['pending', 'assigned', 'in_transit', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Define valid status transitions
    const validTransitions = {
      pending: ['assigned', 'cancelled'],
      assigned: ['in_transit', 'cancelled'],
      in_transit: ['delivered', 'cancelled'],
      delivered: ['completed'],
      completed: [],   // terminal state
      cancelled: []    // terminal state
    };

    // Get owner_id for this user
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }
    const ownerId = ownerResult[0].owner_id;

    // Verify order belongs to the owner
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?`,
      [orderId, ownerId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Validate status transition
    const currentStatus = orders[0].order_status;
    const allowedNext = validTransitions[currentStatus] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNext.length > 0 ? allowedNext.join(', ') : 'none (terminal state)'}`
      });
    }

    // Update order_status (correct column name)
    await db.query(
      `UPDATE orders SET order_status = ?, order_updated_at = NOW() WHERE order_id = ?`,
      [status, orderId]
    );

    // Log status change to deliverystatuslogs
    await db.query(
      `INSERT INTO deliverystatuslogs (order_id, status) VALUES (?, ?)`,
      [orderId, status]
    );

    // Fetch updated order with joins
    const [updatedOrders] = await db.query(
      `SELECT o.*, c.company_name as customer_name, c.contact_number as customer_phone,
              CONCAT(d.first_name, ' ', d.last_name) as driver_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
       WHERE o.order_id = ?`,
      [orderId]
    );

    res.json(updatedOrders[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Assign driver to order
router.put('/:orderId/assign', requirePerm('assign_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;
    const { driverId } = req.body;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }
    const ownerId = ownerResult[0].owner_id;

    // Verify order belongs to owner
    const [orderRows] = await db.query(
      'SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?',
      [orderId, ownerId]
    );
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify driver belongs to same owner
    if (driverId) {
      const [driverRows] = await db.query(
        'SELECT * FROM drivers WHERE driver_id = ? AND owner_id = ?',
        [driverId, ownerId]
      );
      if (driverRows.length === 0) {
        return res.status(404).json({ error: 'Driver not found' });
      }
    }

    // Assign driver and update status to 'assigned' if currently 'pending'
    const newStatus = orderRows[0].order_status === 'pending' && driverId ? 'assigned' : orderRows[0].order_status;

    await db.query(
      `UPDATE orders SET assigned_driver_id = ?, order_status = ?, order_updated_at = NOW() WHERE order_id = ?`,
      [driverId || null, newStatus, orderId]
    );

    // Log if status changed
    if (newStatus !== orderRows[0].order_status) {
      await db.query(
        `INSERT INTO deliverystatuslogs (order_id, status) VALUES (?, ?)`,
        [orderId, newStatus]
      );
    }

    // Fetch updated order
    const [updatedOrders] = await db.query(
      `SELECT o.*, c.company_name as customer_name, c.contact_number as customer_phone,
              CONCAT(d.first_name, ' ', d.last_name) as driver_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       LEFT JOIN drivers d ON o.assigned_driver_id = d.driver_id
       WHERE o.order_id = ?`,
      [orderId]
    );

    res.json(updatedOrders[0]);
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

// Get order analytics for business owner
router.get('/analytics/summary', requirePerm('view_analytics'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) {
      return res.json({ monthly: [], statusCounts: {}, topCustomers: [] });
    }
    const ownerId = ownerResult[0].owner_id;

    // Orders per month (last 6 months)
    const [monthly] = await db.query(
      `SELECT
        DATE_FORMAT(order_created_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        COALESCE(SUM(delivery_fee), 0) as revenue,
        SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM orders
      WHERE business_owner_id = ? AND order_created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(order_created_at, '%Y-%m')
      ORDER BY month ASC`,
      [ownerId]
    );

    // Status breakdown
    const [statusRows] = await db.query(
      `SELECT order_status, COUNT(*) as count
       FROM orders WHERE business_owner_id = ?
       GROUP BY order_status`,
      [ownerId]
    );
    const statusCounts = {};
    statusRows.forEach(r => { statusCounts[r.order_status] = r.count; });

    // Top customers by order count
    const [topCustomers] = await db.query(
      `SELECT c.company_name, COUNT(*) as order_count, COALESCE(SUM(o.delivery_fee), 0) as total_revenue
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       WHERE o.business_owner_id = ?
       GROUP BY o.customer_id, c.company_name
       ORDER BY order_count DESC
       LIMIT 5`,
      [ownerId]
    );

    res.json({ monthly, statusCounts, topCustomers });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Edit (update) an existing order
router.put('/:orderId', requirePerm('edit_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;
    const {
      pickup_location,
      drop_off_location,
      weight,
      size,
      scheduled_delivery_time,
      delivery_fee
    } = req.body;

    // Get owner id and verify ownership
    const [ownerRows] = await db.query('SELECT owner_id FROM businessowners WHERE user_id = ?', [userId]);
    if (!ownerRows.length) return res.status(403).json({ error: 'No owner profile for user.' });
    const ownerId = ownerRows[0].owner_id;
    // Only update if order belongs to owner
    const [orderRows] = await db.query('SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?', [orderId, ownerId]);
    if (!orderRows.length) return res.status(404).json({ error: 'Order not found or unauthorized' });

    // Convert ISO datetime to MySQL format if needed
    let formattedSchedule = scheduled_delivery_time;
    if (scheduled_delivery_time && scheduled_delivery_time.includes('T')) {
      formattedSchedule = new Date(scheduled_delivery_time).toISOString().slice(0, 19).replace('T', ' ');
    }

    // Perform update
    await db.query(
      `UPDATE orders SET pickup_location=?, drop_off_location=?, weight=?, size=?, scheduled_delivery_time=?, delivery_fee=?, order_updated_at=NOW() WHERE order_id=? AND business_owner_id=?`,
      [pickup_location, drop_off_location, weight, size, formattedSchedule, delivery_fee || null, orderId, ownerId]
    );
    const [updatedOrder] = await db.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    res.json(updatedOrder[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order', details: error.message });
  }
});

// Delete an order
router.delete('/:orderId', requirePerm('delete_orders'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;
    // Get owner id and verify ownership
    const [ownerRows] = await db.query('SELECT owner_id FROM businessowners WHERE user_id = ?', [userId]);
    if (!ownerRows.length) return res.status(403).json({ error: 'No owner profile for user.' });
    const ownerId = ownerRows[0].owner_id;
    // Only allow delete if order belongs to owner
    const [orderRows] = await db.query('SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?', [orderId, ownerId]);
    if (!orderRows.length) return res.status(404).json({ error: 'Order not found or unauthorized' });

    await db.query('DELETE FROM orders WHERE order_id = ? AND business_owner_id = ?', [orderId, ownerId]);
    res.json({ message: 'Order deleted', order_id: orderId });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order', details: error.message });
  }
});

module.exports = router;

