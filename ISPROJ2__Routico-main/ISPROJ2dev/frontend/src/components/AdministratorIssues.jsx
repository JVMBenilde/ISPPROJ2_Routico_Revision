import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const AdministratorIssues = () => {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch('http://localhost:3001/api/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIssues(await res.json());
      } else {
        toast.error('Failed to load issues');
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (issueId, newStatus) => {
    try {
      const token = getToken();
      const res = await fetch(`http://localhost:3001/api/issues/${issueId}/status`, {
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
        if (selectedIssue?.issue_id === issueId) {
          setSelectedIssue(updated);
        }
        toast.success(`Issue status updated to ${newStatus.replace('_', ' ')}`);
      } else {
        toast.error('Failed to update issue status');
      }
    } catch (err) {
      toast.error('Failed to update issue status');
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

  const getRoleBadge = (role) => {
    switch (role) {
      case 'business_owner': return 'bg-purple-900/50 text-purple-400';
      case 'driver': return 'bg-blue-900/50 text-blue-400';
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
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-2xl font-bold text-white">{issues.length}</p>
          <p className="text-gray-400 text-sm">Total Issues</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-2xl font-bold text-red-400">{getStatusCount('open')}</p>
          <p className="text-gray-400 text-sm">Open</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-2xl font-bold text-yellow-400">{getStatusCount('in_progress')}</p>
          <p className="text-gray-400 text-sm">In Progress</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-2xl font-bold text-green-400">{getStatusCount('resolved')}</p>
          <p className="text-gray-400 text-sm">Resolved</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
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

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-2">No Issues</h3>
          <p className="text-gray-400">
            {statusFilter === 'all' ? 'No issues have been reported yet.' : `No "${statusFilter.replace('_', ' ')}" issues.`}
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
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getCategoryIcon(issue.category_name)}</span>
                  <h3 className="text-white font-semibold">{issue.category_name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(issue.reporter_role)}`}>
                    {issue.reporter_role === 'business_owner' ? 'Business Owner' : issue.reporter_role === 'driver' ? 'Driver' : issue.reporter_role}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                  {issue.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">{issue.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Reported by: {issue.reporter_name || issue.reporter_email}</span>
                <span>{new Date(issue.reported_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Issue #{selectedIssue.issue_id}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedIssue.status)}`}>
                  {selectedIssue.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(selectedIssue.reporter_role)}`}>
                  {selectedIssue.reporter_role === 'business_owner' ? 'Business Owner' : selectedIssue.reporter_role === 'driver' ? 'Driver' : selectedIssue.reporter_role}
                </span>
                <span className="text-gray-400 text-sm">
                  {getCategoryIcon(selectedIssue.category_name)} {selectedIssue.category_name}
                </span>
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-1">Reporter</p>
                <p className="text-gray-200">{selectedIssue.reporter_name} ({selectedIssue.reporter_email})</p>
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-1">Description</p>
                <p className="text-gray-200">{selectedIssue.description}</p>
              </div>

              <div>
                <p className="text-gray-500 text-xs">Reported</p>
                <p className="text-gray-300">{new Date(selectedIssue.reported_at).toLocaleString()}</p>
              </div>

              {/* Status Update Buttons */}
              <div>
                <p className="text-gray-500 text-xs mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {['open', 'in_progress', 'resolved', 'closed'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedIssue.issue_id, status)}
                      disabled={selectedIssue.status === status}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedIssue.status === status
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
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

export default AdministratorIssues;
