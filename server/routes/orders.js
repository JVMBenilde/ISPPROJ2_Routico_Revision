const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Get all orders for the authenticated business owner
router.get('/', requireAuth, async (req, res) => {
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

    // Get orders with customer information via JOIN
    const [orders] = await db.query(
      `SELECT 
        o.*,
        c.company_name as customer_name,
        c.contact_number as customer_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
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
router.get('/:orderId', requireAuth, async (req, res) => {
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
router.post('/', requireAuth, async (req, res) => {
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
router.put('/:orderId/status', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const orderId = req.params.orderId;
    const { status } = req.body;

    // Verify order belongs to the user
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE order_id = ? AND business_owner_id = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update status
    await db.query(
      `UPDATE Orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      [status, orderId]
    );

    // Fetch updated order
    const [updatedOrders] = await db.query(
      `SELECT * FROM orders WHERE order_id = ?`,
      [orderId]
    );

    res.json(updatedOrders[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Edit (update) an existing order
router.put('/:orderId', requireAuth, async (req, res) => {
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
router.delete('/:orderId', requireAuth, async (req, res) => {
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

