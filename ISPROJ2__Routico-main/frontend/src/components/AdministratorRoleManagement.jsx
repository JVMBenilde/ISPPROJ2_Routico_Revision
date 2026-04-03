import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const AdministratorRoleManagement = () => {
  const { getToken } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ role_name: '', display_name: '', description: '', dashboard_type: 'business' });
  const [saving, setSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const token = getToken();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('http://localhost:3001/api/roles', { headers }),
        fetch('http://localhost:3001/api/roles/permissions', { headers })
      ]);

      if (!rolesRes.ok || !permsRes.ok) throw new Error('Failed to fetch roles data');

      setRoles(await rolesRes.json());
      setPermissions(await permsRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (roles.length > 0 && !selectedRoleId) setSelectedRoleId(roles[0].role_id); }, [roles]);

  const selectedRole = roles.find(r => r.role_id === selectedRoleId);

  const handleCreateRole = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/roles', {
        method: 'POST', headers, body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowCreateModal(false);
      setFormData({ role_name: '', display_name: '', description: '', dashboard_type: 'business' });
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:3001/api/roles/${editingRole.role_id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ display_name: formData.display_name, description: formData.description, dashboard_type: formData.dashboard_type })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setEditingRole(null);
      setFormData({ role_name: '', display_name: '', description: '', dashboard_type: 'business' });
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!confirm(`Delete role "${role.display_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`http://localhost:3001/api/roles/${role.role_id}`, {
        method: 'DELETE', headers
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTogglePermission = async (roleId, permissionId, currentlyHas) => {
    const role = roles.find(r => r.role_id === roleId);
    if (!role) return;

    const currentPermIds = role.permissions.map(p => p.permission_id);
    const newPermIds = currentlyHas
      ? currentPermIds.filter(id => id !== permissionId)
      : [...currentPermIds, permissionId];

    try {
      const res = await fetch(`http://localhost:3001/api/roles/${roleId}/permissions`, {
        method: 'PUT', headers,
        body: JSON.stringify({ permission_ids: newPermIds })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({
      role_name: role.role_name,
      display_name: role.display_name,
      description: role.description || '',
      dashboard_type: role.dashboard_type || 'business'
    });
  };

  const roleHasPermission = (role, permKey) => {
    return role.permissions.some(p => p.permission_key === permKey);
  };

  const isProtectedPerm = (role, permKey) => {
    return role.is_system && role.role_name === 'administrator' &&
      (permKey === 'manage_roles' || permKey === 'manage_users');
  };

  const categoryLabels = {
    users: 'User Management',
    orders: 'Orders',
    drivers: 'Drivers',
    billing: 'Billing',
    routes: 'Routes',
    tracking: 'Tracking',
    issues: 'Issues',
    analytics: 'Analytics',
    dashboard: 'Dashboard',
    system: 'System'
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-300">Error: {error}</p>
        <button onClick={fetchData} className="mt-2 px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-600">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Role Management</h2>
          <p className="text-gray-400">Manage user roles and permissions across the platform.</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setFormData({ role_name: '', display_name: '', description: '', dashboard_type: 'business' }); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + Create Role
        </button>
      </div>

      {/* Roles Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '25%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Users</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {roles.map(role => (
              <tr key={role.role_id} className="hover:bg-gray-700/50">
                <td className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      role.role_name === 'administrator' ? 'bg-red-900 text-red-200' :
                      role.role_name === 'business_owner' ? 'bg-blue-900 text-blue-200' :
                      role.role_name === 'driver' ? 'bg-purple-900 text-purple-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {role.display_name}
                    </span>
                    {role.is_system && (
                      <span className="text-xs text-yellow-500" title="System role - cannot be deleted">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-left text-sm text-gray-300">{role.description}</td>
                <td className="px-4 py-3 text-center text-sm text-white">{role.user_count}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    role.dashboard_type === 'admin' ? 'bg-red-900/50 text-red-300' :
                    role.dashboard_type === 'driver' ? 'bg-purple-900/50 text-purple-300' :
                    'bg-blue-900/50 text-blue-300'
                  }`}>
                    {role.dashboard_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(role)}
                      className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                    >
                      Edit
                    </button>
                    {!role.is_system && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="text-xs px-2 py-1 bg-red-900/50 text-red-300 rounded hover:bg-red-800 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permission Matrix */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-white">Permission Matrix</h3>
            <p className="text-sm text-gray-400 mt-1">Select a role to view and toggle its permissions.</p>
          </div>
          <select
            value={selectedRoleId || ''}
            onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 min-w-[220px]"
          >
            {roles.map(role => (
              <option key={role.role_id} value={role.role_id}>
                {role.display_name}{role.is_system ? ' (System)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedRole && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Permission</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-[120px]">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(permissions).map(([category, perms]) => (
                <PermissionCategoryRows
                  key={category}
                  categoryLabel={categoryLabels[category] || category}
                  perms={perms}
                  role={selectedRole}
                  roleHasPermission={roleHasPermission}
                  isProtectedPerm={isProtectedPerm}
                  onToggle={handleTogglePermission}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRole) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </h3>
            <div className="space-y-4">
              {!editingRole && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role Name (internal)</label>
                  <input
                    type="text"
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. support_agent"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Support Agent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  rows={2}
                  placeholder="What can this role do?"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Dashboard Type</label>
                <select
                  value={formData.dashboard_type}
                  onChange={(e) => setFormData({ ...formData, dashboard_type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="admin">Admin Dashboard</option>
                  <option value="business">Business Owner Dashboard</option>
                  <option value="driver">Driver Dashboard</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowCreateModal(false); setEditingRole(null); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                disabled={saving || (!editingRole && (!formData.role_name || !formData.display_name))}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingRole ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PermissionCategoryRows = ({ categoryLabel, perms, role, roleHasPermission, isProtectedPerm, onToggle }) => {
  return (
    <>
      <tr className="bg-gray-700/30">
        <td colSpan={2} className="px-6 py-2.5 text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {categoryLabel}
        </td>
      </tr>
      {perms.map(perm => {
        const has = roleHasPermission(role, perm.permission_key);
        const locked = isProtectedPerm(role, perm.permission_key);
        return (
          <tr key={perm.permission_id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
            <td className="pl-10 pr-4 py-2.5">
              <span className="text-sm text-gray-200">{perm.display_name}</span>
              {locked && <span className="ml-2 text-xs text-gray-500">(locked)</span>}
            </td>
            <td className="px-6 py-2.5">
              <div className="flex justify-center">
                {locked ? (
                  <button
                    disabled
                    className="inline-flex items-center w-9 h-5 rounded-full bg-green-600 cursor-not-allowed opacity-60 p-0.5"
                    title="This permission is locked for the administrator role"
                  >
                    <span className="block w-4 h-4 rounded-full bg-white ml-auto"></span>
                  </button>
                ) : (
                  <button
                    onClick={() => onToggle(role.role_id, perm.permission_id, has)}
                    className={`inline-flex items-center w-9 h-5 rounded-full transition-colors p-0.5 ${
                      has ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                    title={has ? 'Click to revoke' : 'Click to grant'}
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      has ? 'ml-auto' : 'mr-auto'
                    }`}></span>
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
};

export default AdministratorRoleManagement;
