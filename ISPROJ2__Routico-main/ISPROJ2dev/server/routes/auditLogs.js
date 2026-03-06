const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');

// GET /api/audit-logs - Fetch audit logs with filters
router.get('/', requirePerm('view_audit_logs'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { date, user_id, category, page = 1, limit = 50 } = req.query;

    let where = [];
    let params = [];

    if (date) {
      where.push('DATE(al.created_at) = ?');
      params.push(date);
    }

    if (user_id) {
      where.push('al.user_id = ?');
      params.push(user_id);
    }

    if (category) {
      where.push('al.category = ?');
      params.push(category);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [logs] = await db.query(
      `SELECT al.*, u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params
    );

    // Parse metadata JSON
    const parsed = logs.map(log => ({
      ...log,
      metadata: log.metadata ? (typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata) : null
    }));

    res.json({
      logs: parsed,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult[0].total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit-logs/users - Get all user accounts for the filter dropdown
router.get('/users', requirePerm('view_audit_logs'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [users] = await db.query(`
      SELECT u.user_id, u.full_name as user_name, u.email as user_email, u.role as user_role
      FROM users u
      ORDER BY u.full_name ASC
    `);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit-logs/categories - Get list of categories
router.get('/categories', requirePerm('view_audit_logs'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [categories] = await db.query(`
      SELECT DISTINCT category FROM audit_logs ORDER BY category ASC
    `);
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error fetching audit log categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
