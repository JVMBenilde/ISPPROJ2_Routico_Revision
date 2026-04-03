import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const AdministratorAuditLogs = () => {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const token = getToken();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (selectedUser) params.append('user_id', selectedUser);
      if (selectedCategory) params.append('category', selectedCategory);
      params.append('page', page);
      params.append('limit', limit);

      const res = await fetch(`/api/audit-logs?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [usersRes, catsRes] = await Promise.all([
        fetch('/api/audit-logs/users', { headers }),
        fetch('/api/audit-logs/categories', { headers })
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  useEffect(() => { fetchFilters(); }, []);
  useEffect(() => { fetchLogs(); }, [selectedDate, selectedUser, selectedCategory, page]);

  const handleClearFilters = () => {
    setSelectedDate('');
    setSelectedUser('');
    setSelectedCategory('');
    setPage(1);
  };

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getActionBadgeColor = (category) => {
    const colors = {
      auth: 'bg-blue-900/50 text-blue-300',
      users: 'bg-purple-900/50 text-purple-300',
      orders: 'bg-green-900/50 text-green-300',
      drivers: 'bg-yellow-900/50 text-yellow-300',
      billing: 'bg-orange-900/50 text-orange-300',
      roles: 'bg-red-900/50 text-red-300',
      routes: 'bg-cyan-900/50 text-cyan-300',
      tracking: 'bg-teal-900/50 text-teal-300',
      issues: 'bg-pink-900/50 text-pink-300',
      analytics: 'bg-indigo-900/50 text-indigo-300',
    };
    return colors[category] || 'bg-gray-700 text-gray-300';
  };

  const getStatusBadge = (status) => {
    if (status === 'success') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-300">Success</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-300">Failed</span>;
  };

  const formatAction = (action) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const hasActiveFilters = selectedDate || selectedUser || selectedCategory;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Audit Logs</h2>
        <p className="text-gray-400">Track all user actions and system events. Filter by date, user, or category.</p>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date Picker */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* User Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">User</label>
            <select
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_name} - {u.user_email} ({u.user_role})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span>Showing:</span>
            {selectedDate && <span className="px-2 py-0.5 bg-gray-700 rounded">{selectedDate}</span>}
            {selectedUser && (
              <span className="px-2 py-0.5 bg-gray-700 rounded">
                {users.find(u => String(u.user_id) === selectedUser)?.user_name || users.find(u => String(u.user_id) === selectedUser)?.user_email || 'User ' + selectedUser}
              </span>
            )}
            {selectedCategory && <span className="px-2 py-0.5 bg-gray-700 rounded">{selectedCategory}</span>}
            <span className="text-gray-500">({total} result{total !== 1 ? 's' : ''})</span>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">Error: {error}</p>
          <button onClick={fetchLogs} className="mt-2 px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-600">
            Retry
          </button>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Action</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Category</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Details</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">Loading audit logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-white">
                      {hasActiveFilters ? 'No logs match your filters' : 'No audit logs yet'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {hasActiveFilters ? 'Try adjusting your filters or selecting a different date.' : 'System activity will be recorded here as actions are performed.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.log_id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-center text-sm text-gray-300 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div>
                        <p className="text-sm text-white">{log.user_name || log.user_email || 'System'}</p>
                        {log.user_role && (
                          <p className="text-xs text-gray-400">{log.user_role}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-white">
                      {formatAction(log.action)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadgeColor(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-300 max-w-[300px]">
                      <p className="truncate">{log.description}</p>
                      {log.target_type && log.target_id && (
                        <p className="text-xs text-gray-500">{log.target_type} #{log.target_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(log.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total} logs
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdministratorAuditLogs;
