import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const BusinessOwnerIssues = () => {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [issues, setIssues] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [formData, setFormData] = useState({
    categoryId: '',
    description: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchIssues();
      fetchCategories();
    }
  }, [user]);

const fetchIssues = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
      toast('Failed to load issues', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/issues/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleCreateIssue = async (e) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.description) {
      toast('Please fill in all fields', 'error');
      return;
    }

    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          categoryId: formData.categoryId,
          description: formData.description
        })
      });

      if (res.ok) {
        const newIssue = await res.json();
        setIssues(prev => [newIssue, ...prev]);
        setFormData({ categoryId: '', description: '' });
        setShowCreateForm(false);
        toast('Issue reported successfully', 'success');
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to create issue', 'error');
      }
    } catch (err) {
      toast('Failed to create issue', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (issueId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const updated = await res.json();
        setIssues(prev => prev.map(i => i.issue_id === issueId ? updated : i));
        if (selectedIssue?.issue_id === issueId) setSelectedIssue(updated);
        toast('Issue status updated', 'success');
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      toast('Failed to update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-red-900/50 text-red-400 border-red-500/30';
      case 'in_progress': return 'bg-yellow-900/50 text-yellow-400 border-yellow-500/30';
      case 'resolved': return 'bg-green-900/50 text-green-400 border-green-500/30';
      case 'closed': return 'bg-gray-700/50 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-700/50 text-gray-400 border-gray-500/30';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Bug / Error': return '🐛';
      case 'UI / Display Issue': return '🖥️';
      case 'Performance Issue': return '⚡';
      case 'Maps / Navigation': return '🗺️';
      case 'Login / Authentication': return '🔐';
      default: return '📋';
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'business_owner': return 'bg-purple-900/50 text-purple-400';
      case 'driver': return 'bg-blue-900/50 text-blue-400';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  const filteredIssues = statusFilter === 'all'
    ? issues
    : issues.filter(i => i.status === statusFilter);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Issue Reporting</h2>
          <p className="text-gray-400 mt-1">Report and track web app issues</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Report Issue
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            {status !== 'all' && (
              <span className="ml-2 text-xs opacity-70">
                ({issues.filter(i => i.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Create Issue Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Report Web App Issue</h3>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a category...</option>
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Describe the issue you're experiencing with the web app..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? 'Submitting...' : 'Submit Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Issue #{selectedIssue.issue_id}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedIssue.status)}`}>
                  {selectedIssue.status?.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-gray-400 text-sm">
                  {getCategoryIcon(selectedIssue.category_name)} {selectedIssue.category_name}
                </span>
                {selectedIssue.reporter_role && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(selectedIssue.reporter_role)}`}>
                    {selectedIssue.reporter_role === 'business_owner' ? 'You' : 'Driver'}
                  </span>
                )}
              </div>

              {selectedIssue.reporter_name && selectedIssue.reporter_role === 'driver' && (
                <div>
                  <p className="text-sm text-gray-400">Reported by</p>
                  <p className="text-white">{selectedIssue.reporter_name}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-400">Description</p>
                <p className="text-white">{selectedIssue.description}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Reported</p>
                <p className="text-white">
                  {selectedIssue.reported_at ? new Date(selectedIssue.reported_at).toLocaleString() : 'N/A'}
                </p>
              </div>

              {/* Status Update Buttons */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Update Status</p>
                <div className="flex gap-2 flex-wrap">
                  {['open', 'in_progress', 'resolved', 'closed'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedIssue.issue_id, status)}
                      disabled={updatingStatus || selectedIssue.status === status}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 ${
                        selectedIssue.status === status
                          ? 'bg-blue-600 text-white cursor-default'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-white">No issues found</h3>
          <p className="mt-1 text-sm text-gray-400">
            {statusFilter === 'all' ? 'No issues have been reported yet.' : `No ${statusFilter.replace('_', ' ')} issues.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map(issue => (
            <div
              key={issue.issue_id}
              onClick={() => setSelectedIssue(issue)}
              className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-500 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getCategoryIcon(issue.category_name)}</span>
                    <h4 className="text-white font-medium">{issue.category_name || 'Issue'}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(issue.status)}`}>
                      {issue.status?.replace('_', ' ')}
                    </span>
                    {issue.reporter_role === 'driver' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(issue.reporter_role)}`}>
                        Driver
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2">{issue.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {issue.reporter_name && issue.reporter_role === 'driver' && <span>By: {issue.reporter_name}</span>}
                    <span>{issue.reported_at ? new Date(issue.reported_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerIssues;
