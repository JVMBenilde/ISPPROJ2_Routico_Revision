class PermissionCacheService {
  constructor(db) {
    this.db = db;
    this.cache = {}; // { [role_id]: Set(['perm_key1', ...]) }
    this.lastLoaded = 0;
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  async loadAll() {
    const [rows] = await this.db.query(`
      SELECT r.role_id, p.permission_key
      FROM roles r
      JOIN role_permissions rp ON r.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.permission_id
    `);

    this.cache = {};
    for (const row of rows) {
      if (!this.cache[row.role_id]) {
        this.cache[row.role_id] = new Set();
      }
      this.cache[row.role_id].add(row.permission_key);
    }
    this.lastLoaded = Date.now();
    console.log(`Permission cache loaded: ${rows.length} mappings for ${Object.keys(this.cache).length} roles`);
  }

  hasPermission(roleId, permissionKey) {
    // Auto-refresh if stale
    if (Date.now() - this.lastLoaded > this.ttl) {
      this.loadAll().catch(err => console.error('Permission cache refresh error:', err));
    }
    return this.cache[roleId]?.has(permissionKey) || false;
  }

  async invalidate() {
    await this.loadAll();
  }
}

module.exports = PermissionCacheService;
