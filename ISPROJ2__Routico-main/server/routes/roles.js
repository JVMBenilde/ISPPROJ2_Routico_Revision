const express = require('express');
const router = express.Router();
const { requirePerm } = require('../middleware/auth');

// GET /api/roles - List all roles with permissions and user counts
router.get('/', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [roles] = await db.query(`
      SELECT r.*,
        CASE
          WHEN r.role_name = 'driver' THEN (SELECT COUNT(*) FROM drivers)
          ELSE (SELECT COUNT(*) FROM users u WHERE u.role = r.role_name)
        END as user_count
      FROM roles r
      ORDER BY r.is_system DESC, r.role_name ASC
    `);

    // Get permissions for each role
    const [allRolePerms] = await db.query(`
      SELECT rp.role_id, p.permission_id, p.permission_key, p.display_name, p.category
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.permission_id
      ORDER BY p.category, p.display_name
    `);

    const permsByRole = {};
    for (const rp of allRolePerms) {
      if (!permsByRole[rp.role_id]) permsByRole[rp.role_id] = [];
      permsByRole[rp.role_id].push({
        permission_id: rp.permission_id,
        permission_key: rp.permission_key,
        display_name: rp.display_name,
        category: rp.category
      });
    }

    const result = roles.map(r => ({
      ...r,
      permissions: permsByRole[r.role_id] || []
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/roles/permissions - List all permissions grouped by category
router.get('/permissions', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [perms] = await db.query('SELECT * FROM permissions ORDER BY category, display_name');

    const grouped = {};
    for (const p of perms) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/roles - Create a new custom role
router.post('/', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { role_name, display_name, description, dashboard_type } = req.body;

    if (!role_name || !display_name) {
      return res.status(400).json({ error: 'role_name and display_name are required' });
    }

    // Sanitize role_name to lowercase with underscores
    const sanitizedName = role_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const [result] = await db.query(
      'INSERT INTO roles (role_name, display_name, description, is_system, dashboard_type) VALUES (?, ?, ?, FALSE, ?)',
      [sanitizedName, display_name, description || null, dashboard_type || 'business']
    );

    res.status(201).json({
      role_id: result.insertId,
      role_name: sanitizedName,
      display_name,
      description,
      is_system: false,
      dashboard_type: dashboard_type || 'business'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A role with that name already exists' });
    }
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/roles/:roleId - Update a role
router.put('/:roleId', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { roleId } = req.params;
    const { display_name, description, dashboard_type } = req.body;

    const [role] = await db.query('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await db.query(
      'UPDATE roles SET display_name = COALESCE(?, display_name), description = COALESCE(?, description), dashboard_type = COALESCE(?, dashboard_type) WHERE role_id = ?',
      [display_name, description, dashboard_type, roleId]
    );

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/roles/:roleId - Delete a role
router.delete('/:roleId', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { roleId } = req.params;

    const [role] = await db.query('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role[0].is_system) {
      return res.status(403).json({ error: 'Cannot delete a system role' });
    }

    // Check if any users are assigned to this role
    const [users] = await db.query('SELECT COUNT(*) as count FROM users WHERE role_id = ?', [roleId]);
    if (users[0].count > 0) {
      return res.status(409).json({ error: `Cannot delete role: ${users[0].count} user(s) still assigned to it` });
    }

    await db.query('DELETE FROM roles WHERE role_id = ?', [roleId]);

    // Invalidate cache
    const permissionCache = req.app.locals.permissionCache;
    if (permissionCache) await permissionCache.invalidate();

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/roles/:roleId/permissions - Set permissions for a role
router.put('/:roleId/permissions', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { roleId } = req.params;
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }

    const [role] = await db.query('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Safety: if this is the administrator system role, ensure manage_roles and manage_users stay
    if (role[0].is_system && role[0].role_name === 'administrator') {
      const [protectedPerms] = await db.query(
        "SELECT permission_id FROM permissions WHERE permission_key IN ('manage_roles', 'manage_users')"
      );
      const protectedIds = protectedPerms.map(p => p.permission_id);
      for (const id of protectedIds) {
        if (!permission_ids.includes(id)) {
          return res.status(403).json({ error: 'Cannot remove manage_roles or manage_users from administrator role' });
        }
      }
    }

    // Replace all permissions for this role
    await db.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    if (permission_ids.length > 0) {
      const values = permission_ids.map(pid => [parseInt(roleId), pid]);
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
        [values]
      );
    }

    // Invalidate cache
    const permissionCache = req.app.locals.permissionCache;
    if (permissionCache) await permissionCache.invalidate();

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/roles/users/:userId/role - Assign a role to a user
router.put('/users/:userId/role', requirePerm('manage_roles'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { userId } = req.params;
    const { role_id } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: 'role_id is required' });
    }

    // Check role exists
    const [role] = await db.query('SELECT * FROM roles WHERE role_id = ?', [role_id]);
    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check user exists
    const [user] = await db.query('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Safety: prevent demoting the last administrator
    if (user[0].role === 'administrator') {
      const [adminCount] = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'administrator'"
      );
      if (adminCount[0].count <= 1 && role[0].role_name !== 'administrator') {
        return res.status(403).json({ error: 'Cannot change role of the last administrator' });
      }
    }

    // Update both role and role_id
    await db.query(
      'UPDATE users SET role = ?, role_id = ? WHERE user_id = ?',
      [role[0].role_name, role_id, userId]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
