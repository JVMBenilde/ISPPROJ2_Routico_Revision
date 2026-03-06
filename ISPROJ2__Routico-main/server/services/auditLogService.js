class AuditLogService {
  constructor(db) {
    this.db = db;
  }

  async log({ userId, userEmail, userRole, action, category, description, targetType, targetId, metadata, ipAddress, status = 'success' }) {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (user_id, user_email, user_role, action, category, description, target_type, target_id, metadata, ip_address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId || null,
          userEmail || null,
          userRole || null,
          action,
          category,
          description || null,
          targetType || null,
          targetId ? String(targetId) : null,
          metadata ? JSON.stringify(metadata) : null,
          ipAddress || null,
          status
        ]
      );
    } catch (err) {
      console.error('Audit log write error:', err.message);
    }
  }

  // Helper to extract common request info
  fromReq(req) {
    return {
      userId: req.user?.user_id || null,
      userEmail: req.user?.email || null,
      userRole: req.userRole || null,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress
    };
  }
}

module.exports = AuditLogService;
