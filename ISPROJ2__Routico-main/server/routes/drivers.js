const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requirePerm, requireDriver } = require('../middleware/auth');

const LICENSE_REGEX = /^(?=.{6,20}$)(?=.*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

const normalizeDriverLicense = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
};

const normalizeDateOnly = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    return value.trim().split('T')[0];
  }
  return String(value).split('T')[0];
};

const parseDateOnly = (dateString) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const validateDriverLicenseFields = (licenseNumber, licenseExpiry) => {
  const normalizedLicense = normalizeDriverLicense(licenseNumber);
  const normalizedExpiry = normalizeDateOnly(licenseExpiry);

  if ((normalizedLicense && !normalizedExpiry) || (!normalizedLicense && normalizedExpiry)) {
    return {
      ok: false,
      status: 400,
      error: 'License number and license expiry must both be provided'
    };
  }

  if (normalizedLicense && !LICENSE_REGEX.test(normalizedLicense)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid license number format. Use 6-20 uppercase letters/numbers and optional hyphens (example: N01-23-123456)'
    };
  }

  if (normalizedExpiry) {
    const expiryDate = parseDateOnly(normalizedExpiry);
    if (!expiryDate) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid license expiry date format. Use YYYY-MM-DD'
      };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (expiryDate < today) {
      return {
        ok: false,
        status: 400,
        error: 'License expiry date must be today or a future date'
      };
    }
  }

  return {
    ok: true,
    normalizedLicense,
    normalizedExpiry
  };
};

// Get all drivers for the authenticated business owner
router.get('/', requirePerm('view_drivers'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.json([]);
    }

    const ownerId = ownerResult[0].owner_id;

    const [drivers] = await db.query(
      `SELECT * FROM drivers WHERE owner_id = ? ORDER BY created_at DESC`,
      [ownerId]
    );

    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// Get single driver
router.get('/:driverId', requirePerm('view_drivers'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const driverId = req.params.driverId;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }

    const ownerId = ownerResult[0].owner_id;

    const [drivers] = await db.query(
      'SELECT * FROM drivers WHERE driver_id = ? AND owner_id = ?',
      [driverId, ownerId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(drivers[0]);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Failed to fetch driver' });
  }
});

// Create a new driver (also creates a user account for driver login)
router.post('/', requirePerm('manage_drivers'), async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.user_id;
  const { firstName, lastName, email, phone, licenseNumber, licenseExpiry, status } = req.body;

  const licenseValidation = validateDriverLicenseFields(licenseNumber, licenseExpiry);
  if (!licenseValidation.ok) {
    return res.status(licenseValidation.status).json({ error: licenseValidation.error });
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  // Validate name fields (letters, spaces, hyphens, apostrophes only)
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(firstName)) {
    return res.status(400).json({ error: 'First name must contain only letters' });
  }
  if (!nameRegex.test(lastName)) {
    return res.status(400).json({ error: 'Last name must contain only letters' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required for driver login' });
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9._%+-]{2,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address (e.g., name@example.com)' });
  }

  try {
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }

    const ownerId = ownerResult[0].owner_id;

    // Validate driver phone must be Philippine number (+63)
    if (phone) {
      if (!phone.startsWith('+63') || !/^\+63\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Please enter a valid Philippine phone number (e.g., +639171234567)' });
      }
    }

    // Check if email already exists in users
    const [existingUser] = await db.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Auto-generate password: firstName + first letter of lastName
      const rawPassword = `${firstName}${lastName.charAt(0)}`;
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      // Get the driver role_id
      const [driverRole] = await connection.query(
        "SELECT role_id FROM roles WHERE role_name = 'driver'"
      );
      const driverRoleId = driverRole.length > 0 ? driverRole[0].role_id : null;

      // Create user account for driver
      const [userInsert] = await connection.query(
        `INSERT INTO users (full_name, first_name, last_name, email, password_hash, phone, account_status, active_status, role, role_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'approved', 'active', 'driver', ?, NOW())`,
        [`${firstName} ${lastName}`, firstName, lastName, email, passwordHash, phone || null, driverRoleId]
      );
      const newUserId = userInsert.insertId;

      // Create driver record linked to user
      const [driverInsert] = await connection.query(
        `INSERT INTO drivers (owner_id, user_id, first_name, last_name, email, phone, license_number, license_expiry, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ownerId,
          newUserId,
          firstName,
          lastName,
          email,
          phone || null,
          licenseValidation.normalizedLicense || null,
          licenseValidation.normalizedExpiry || null,
          status || 'active'
        ]
      );

      await connection.commit();

      const [newDriver] = await db.query('SELECT * FROM drivers WHERE driver_id = ?', [driverInsert.insertId]);
      res.status(201).json({
        ...newDriver[0],
        loginCredentials: {
          email,
          temporaryPassword: rawPassword
        }
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Failed to create driver', details: error.message });
  }
});

// Update driver details
router.put('/:driverId', requirePerm('manage_drivers'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const driverId = req.params.driverId;

    const { firstName, lastName, email, phone, licenseNumber, licenseExpiry, ridesCompleted, status } = req.body;

    const licenseValidation = validateDriverLicenseFields(licenseNumber, licenseExpiry);
    if (!licenseValidation.ok) {
      return res.status(licenseValidation.status).json({ error: licenseValidation.error });
    }

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }

    const ownerId = ownerResult[0].owner_id;

    // Verify driver belongs to this owner
    const [existing] = await db.query(
      'SELECT * FROM drivers WHERE driver_id = ? AND owner_id = ?',
      [driverId, ownerId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Driver not found or unauthorized' });
    }

    await db.query(
      `UPDATE drivers SET first_name=?, last_name=?, email=?, phone=?, license_number=?, license_expiry=?, rides_completed=?, status=?
       WHERE driver_id=? AND owner_id=?`,
      [
        firstName,
        lastName,
        email || null,
        phone || null,
        licenseValidation.normalizedLicense || null,
        licenseValidation.normalizedExpiry || null,
        parseInt(ridesCompleted) || 0,
        status || 'active',
        driverId,
        ownerId
      ]
    );

    const [updated] = await db.query('SELECT * FROM drivers WHERE driver_id = ?', [driverId]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Failed to update driver', details: error.message });
  }
});

// Update driver status only
router.put('/:driverId/status', requirePerm('manage_drivers'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const driverId = req.params.driverId;
    const { status } = req.body;

    const validStatuses = ['active', 'on_leave', 'sick_leave', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }

    const ownerId = ownerResult[0].owner_id;

    const [existing] = await db.query(
      'SELECT * FROM drivers WHERE driver_id = ? AND owner_id = ?',
      [driverId, ownerId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Driver not found or unauthorized' });
    }

    await db.query(
      'UPDATE drivers SET status = ? WHERE driver_id = ? AND owner_id = ?',
      [status, driverId, ownerId]
    );

    const [updated] = await db.query('SELECT * FROM drivers WHERE driver_id = ?', [driverId]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
});

// Delete a driver
router.delete('/:driverId', requirePerm('manage_drivers'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const driverId = req.params.driverId;

    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );

    if (ownerResult.length === 0) {
      return res.status(403).json({ error: 'No owner profile' });
    }

    const ownerId = ownerResult[0].owner_id;

    const [existing] = await db.query(
      'SELECT * FROM drivers WHERE driver_id = ? AND owner_id = ?',
      [driverId, ownerId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Driver not found or unauthorized' });
    }

    await db.query('DELETE FROM drivers WHERE driver_id = ? AND owner_id = ?', [driverId, ownerId]);
    res.json({ message: 'Driver deleted', driver_id: driverId });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Failed to delete driver', details: error.message });
  }
});

// Get orders assigned to the authenticated driver
router.get('/me/orders', requireDriver, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [orders] = await db.query(
      `SELECT o.*, c.company_name as customer_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       WHERE o.assigned_driver_id = ?
       ORDER BY o.order_created_at DESC`,
      [req.driverId]
    );
    res.json(orders);
  } catch (error) {
    console.error('Error fetching driver orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
