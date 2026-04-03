const express = require('express');
const router = express.Router();
const { requireAnyAuth } = require('../middleware/auth');

// Get all notifications for current user (paginated)
router.get('/', requireAnyAuth, async (req, res) => {
  try {
    const notifications = req.app.locals.notifications;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const items = await notifications.getAll(req.user.user_id, limit, offset);
    res.json(items);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread count (lightweight for polling)
router.get('/unread-count', requireAnyAuth, async (req, res) => {
  try {
    const notifications = req.app.locals.notifications;
    const count = await notifications.getUnreadCount(req.user.user_id);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark single notification as read
router.put('/:id/read', requireAnyAuth, async (req, res) => {
  try {
    const notifications = req.app.locals.notifications;
    await notifications.markAsRead(req.params.id, req.user.user_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', requireAnyAuth, async (req, res) => {
  try {
    const notifications = req.app.locals.notifications;
    await notifications.markAllAsRead(req.user.user_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;
