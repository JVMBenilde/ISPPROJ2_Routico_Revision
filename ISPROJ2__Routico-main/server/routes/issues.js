const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');

// Get all issues (role-based: admin sees all, driver sees own, business owner sees own + their drivers')
router.get('/', requirePerm('view_issues'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const userRole = req.userRole;

    if (userRole === 'administrator') {
      // Admin sees ALL issues with reporter info
      const [issues] = await db.query(
        `SELECT i.*, ic.category_name,
                u.full_name as reporter_name, u.email as reporter_email, u.role as reporter_role
         FROM issues i
         LEFT JOIN issuescategories ic ON i.category_id = ic.category_id
         LEFT JOIN users u ON i.reported_by = u.user_id
         ORDER BY i.reported_at DESC`
      );
      return res.json(issues);
    }

    if (userRole === 'driver') {
      // Driver sees their own issues
      const [issues] = await db.query(
        `SELECT i.*, ic.category_name
         FROM issues i
         LEFT JOIN issuescategories ic ON i.category_id = ic.category_id
         WHERE i.reported_by = ?
         ORDER BY i.reported_at DESC`,
        [userId]
      );
      return res.json(issues);
    }

    // Business owner: sees own issues + issues from their drivers
    const [ownerResult] = await db.query(
      'SELECT owner_id FROM businessowners WHERE user_id = ?',
      [userId]
    );
    if (ownerResult.length === 0) return res.json([]);
    const ownerId = ownerResult[0].owner_id;

    const [issues] = await db.query(
      `SELECT i.*, ic.category_name,
              u.full_name as reporter_name, u.role as reporter_role
       FROM issues i
       LEFT JOIN issuescategories ic ON i.category_id = ic.category_id
       LEFT JOIN users u ON i.reported_by = u.user_id
       WHERE i.reported_by = ?
          OR i.reported_by IN (
            SELECT u2.user_id FROM drivers d
            JOIN users u2 ON d.user_id = u2.user_id
            WHERE d.owner_id = ?
          )
       ORDER BY i.reported_at DESC`,
      [userId, ownerId]
    );

    res.json(issues);
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// Get issue categories
router.get('/categories', requirePerm('view_issues'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [categories] = await db.query('SELECT * FROM issuescategories ORDER BY category_name');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new issue (web app issue - no order association)
router.post('/', requirePerm('manage_issues'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const { categoryId, description } = req.body;

    if (!categoryId || !description) {
      return res.status(400).json({ error: 'Category and description are required' });
    }

    const [result] = await db.query(
      `INSERT INTO issues (reported_by, category_id, description, status)
       VALUES (?, ?, ?, 'open')`,
      [userId, categoryId, description]
    );

    const [newIssue] = await db.query(
      `SELECT i.*, ic.category_name,
              u.full_name as reporter_name, u.email as reporter_email, u.role as reporter_role
       FROM issues i
       LEFT JOIN issuescategories ic ON i.category_id = ic.category_id
       LEFT JOIN users u ON i.reported_by = u.user_id
       WHERE i.issue_id = ?`,
      [result.insertId]
    );

    // Notify relevant parties about the new issue
    if (req.app.locals.notifications) {
      const issueId = result.insertId;
      const shortDesc = description.length > 60 ? description.substring(0, 60) + '...' : description;

      // If reporter is a driver, notify their business owner
      const [driverInfo] = await db.query(
        'SELECT owner_id FROM drivers WHERE user_id = ?', [userId]
      );
      if (driverInfo.length > 0) {
        req.app.locals.notifications.createForBusinessOwner(
          driverInfo[0].owner_id,
          `New issue reported: ${shortDesc}`,
          'issue_report', issueId, 'issue'
        ).catch(err => console.error('Notification error:', err));
      }

      // Notify all administrators
      const [admins] = await db.query("SELECT user_id FROM users WHERE role = 'administrator'");
      for (const admin of admins) {
        req.app.locals.notifications.create(
          admin.user_id,
          `New issue #${issueId} reported`,
          'issue_report', issueId, 'issue'
        ).catch(err => console.error('Notification error:', err));
      }
    }

    res.status(201).json(newIssue[0]);
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue', details: error.message });
  }
});

// Update issue status (admin can update any, others only their own)
router.put('/:issueId/status', requirePerm('manage_issues'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.user_id;
    const userRole = req.userRole;
    const issueId = req.params.issueId;
    const { status } = req.body;

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }

    let existing;
    if (userRole === 'administrator') {
      [existing] = await db.query('SELECT * FROM issues WHERE issue_id = ?', [issueId]);
    } else {
      [existing] = await db.query(
        'SELECT * FROM issues WHERE issue_id = ? AND reported_by = ?',
        [issueId, userId]
      );
    }

    if (existing.length === 0) return res.status(404).json({ error: 'Issue not found' });

    await db.query(
      'UPDATE issues SET status = ? WHERE issue_id = ?',
      [status, issueId]
    );

    const [updated] = await db.query(
      `SELECT i.*, ic.category_name,
              u.full_name as reporter_name, u.email as reporter_email, u.role as reporter_role
       FROM issues i
       LEFT JOIN issuescategories ic ON i.category_id = ic.category_id
       LEFT JOIN users u ON i.reported_by = u.user_id
       WHERE i.issue_id = ?`,
      [issueId]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating issue status:', error);
    res.status(500).json({ error: 'Failed to update issue status' });
  }
});

module.exports = router;
