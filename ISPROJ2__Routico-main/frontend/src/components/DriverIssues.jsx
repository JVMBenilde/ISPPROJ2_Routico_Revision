import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const DriverIssues = () => {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [issues, setIssues] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [formData, setFormData] = useState({ categoryId: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const token = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [issuesRes, categoriesRes] = await Promise.all([
        fetch('/api/issues', { headers }),
        fetch('/api/issues/categories', { headers })
      ]);

      if (issuesRes.ok) setIssues(await issuesRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async (e) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.description) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const token = getToken();
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
        toast.success('Issue reported successfully');
        setShowCreateForm(false);
        setFormData({ categoryId: '', description: '' });
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create issue');
      }
    } catch (err) {
      toast.error('Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-red-900/50 text-red-400';
      case 'in_progress': return 'bg-yellow-900/50 text-yellow-400';
      case 'resolved': return 'bg-green-900/50 text-green-400';
      case 'closed': return 'bg-gray-700 text-gray-400';
      default: return 'bg-gray-700 text-gray-300';
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

  const filteredIssues = statusFilter === 'all'
    ? issues
    : issues.filter(i => i.status === statusFilter);

  const statuses = ['all', 'open', 'in_progress', 'resolved', 'closed'];

  const getStatusCount = (status) => {
    if (status === 'all') return issues.length;
    return issues.filter(i => i.status === status).length;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-3"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-black/20">
                {getStatusCount(status)}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Report Issue
        </button>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">No Issues</h3>
          <p className="text-gray-400">
            {statusFilter === 'all' ? 'You haven\'t reported any issues yet.' : `No "${statusFilter.replace('_', ' ')}" issues.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map(issue => (
            <div
              key={issue.issue_id}
              onClick={() => setSelectedIssue(issue)}
              className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(issue.category_name)}</span>
                    <h3 className="text-white font-semibold">{issue.category_name}</h3>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                  {issue.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">{issue.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Issue #{issue.issue_id}</span>
                <span>{new Date(issue.reported_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Report Web App Issue</h3>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe the issue you're experiencing with the web app..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Issue'}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Issue #{selectedIssue.issue_id}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedIssue.status)}`}>
                  {selectedIssue.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="text-gray-400 text-sm">
                  {getCategoryIcon(selectedIssue.category_name)} {selectedIssue.category_name}
                </span>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Description</p>
                <p className="text-gray-200">{selectedIssue.description}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Reported</p>
                <p className="text-gray-300">{new Date(selectedIssue.reported_at).toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedIssue(null)}
              className="mt-6 w-full px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverIssues;
