import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import AdministratorBillingCharts from '../components/AdministratorBillingCharts';
import AdministratorCharts from '../components/AdministratorCharts';
import AdministratorIssues from '../components/AdministratorIssues';
import AdministratorPaymentReview from '../components/AdministratorPaymentReview';
import AdministratorRoleManagement from '../components/AdministratorRoleManagement';
import AdministratorAuditLogs from '../components/AdministratorAuditLogs';
import AdministratorUserManagement from '../components/AdministratorUserManagement';

const AdministratorDashboard = () => {
  const { user, getToken, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    activeBusinesses: 0,
    suspendedBusinesses: 0,
    totalApprovedBusinesses: 0,
    totalRevenue: 0,
    totalDrivers: 0
  });

  const [pendingUsers, setPendingUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      // Fetch dashboard statistics
      const statsResponse = await fetch('http://localhost:3001/api/auth/dashboard-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      } else {
        throw new Error('Failed to fetch dashboard statistics');
      }

      // Fetch pending users
      const pendingResponse = await fetch('http://localhost:3001/api/auth/pending-users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        setPendingUsers(pendingData);
      } else {
        setPendingUsers([]);
      }

      // Fetch recent audit logs for activity timeline
      const activityResponse = await fetch('http://localhost:3001/api/audit-logs?limit=10&page=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setRecentActivity(activityData.logs || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/user/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          account_status: 'approved',
          active_status: 'active'
        })
      });

      if (response.ok) {
        // Update local state
        setPendingUsers(prev => prev.filter(user => user.user_id !== userId));
        setStats(prev => ({ ...prev, pendingApprovals: prev.pendingApprovals - 1, activeBusinesses: prev.activeBusinesses + 1 }));
        toast.success('User approved successfully!');
      } else {
        const errorData = await response.json();
        toast.error(`Error approving user: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Error approving user. Please try again.');
    }
  };

  const handleRejectUser = async (userId) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/user/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          account_status: 'rejected'
        })
      });

      if (response.ok) {
        // Update local state
        setPendingUsers(prev => prev.filter(user => user.user_id !== userId));
        setStats(prev => ({ ...prev, pendingApprovals: prev.pendingApprovals - 1 }));
        toast.success('User rejected successfully!');
      } else {
        const errorData = await response.json();
        toast.error(`Error rejecting user: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
  };

  const handleViewDocument = async (userId, userName) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/document/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Create blob from response
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `${userName.replace(/\s+/g, '_')}_company_document.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const errorData = await response.json();
        toast.error(`Error downloading document: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Error downloading document. Please try again.');
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'analytics', label: 'Analytics & Charts', icon: 'chart' },
    { id: 'users', label: 'User Management', icon: 'users' },
    { id: 'billing', label: 'Billing Management', icon: 'credit-card' },
    { id: 'issues', label: 'Issues', icon: 'alert' },
    { id: 'roles', label: 'Role Management', icon: 'shield' },
    { id: 'audit', label: 'Audit Logs', icon: 'clipboard' },
    { id: 'settings', label: 'System Settings', icon: 'settings' }
  ];

  const sidebarSections = [
    { label: 'General', items: ['overview'] },
    { label: 'Management', items: ['users', 'roles'] },
    { label: 'Finance', items: ['billing', 'analytics'] },
    { label: 'System', items: ['issues', 'audit', 'settings'] }
  ];

  const getIcon = (iconType) => {
    switch (iconType) {
      case 'home':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'chart':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'users':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'credit-card':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'alert':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'shield':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'clipboard':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case 'settings':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const StatCard = ({ title, value, icon, color, subtitle, subtitleColor }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 transition-all duration-300 hover:border-slate-700">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">{title}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${subtitleColor || 'text-slate-500'}`}>{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );

  const getCategoryColor = (category) => {
    const colors = {
      auth: 'bg-blue-500',
      users: 'bg-indigo-500',
      orders: 'bg-emerald-500',
      drivers: 'bg-cyan-500',
      billing: 'bg-amber-500',
      roles: 'bg-purple-500',
      routes: 'bg-teal-500',
      tracking: 'bg-orange-500',
      issues: 'bg-red-500',
      analytics: 'bg-pink-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  const formatAction = (action) => {
    return (action || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen flex bg-[#111621]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out flex flex-col sticky top-0 h-screen overflow-hidden`}>
        {/* Sidebar Header - Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 flex-shrink-0">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          {sidebarOpen && (
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Routico</h2>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">Enterprise Logistics</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu - Grouped */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {sidebarOpen ? (
            sidebarSections.map((section) => (
              <div key={section.label}>
                <p className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase px-4 mb-2 mt-6">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {section.items.map((itemId) => {
                    const item = menuItems.find(m => m.id === itemId);
                    if (!item) return null;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-600/10 text-blue-500 font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex-shrink-0 w-5 h-5">
                          {getIcon(item.icon)}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1 mt-4">
              {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-center px-2 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600/10 text-blue-500'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    title={item.label}
                  >
                    <span className="w-6 h-6">
                      {getIcon(item.icon)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* User Info at Bottom */}
        <div className="p-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.email}
                  </p>
                  <p className="text-xs text-slate-500">Administrator</p>
                </div>
                <button
                  onClick={async () => { await logout(); window.location.href = '/login'; }}
                  title="Sign out"
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </>
            )}
            {!sidebarOpen && (
              <button
                onClick={async () => { await logout(); window.location.href = '/login'; }}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#111621]">
        {/* Inline Header / Topbar */}
        <div className="h-16 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Admin Dashboard</h2>
          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative">
              <svg className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search sections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    const match = menuItems.find(item =>
                      item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
                    );
                    if (match) {
                      setActiveTab(match.id);
                      setSearchQuery('');
                    }
                  }
                }}
                className="w-56 pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  {menuItems
                    .filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); setSearchQuery(''); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <span className="w-4 h-4">{getIcon(item.icon)}</span>
                        {item.label}
                      </button>
                    ))
                  }
                  {menuItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-4 py-2.5 text-sm text-slate-500">No results found</div>
                  )}
                </div>
              )}
            </div>
            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {stats.pendingApprovals > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 rounded-full text-[10px] font-bold text-white px-1">
                    {stats.pendingApprovals}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {pendingUsers.length > 0 ? (
                      pendingUsers.slice(0, 5).map((pu) => (
                        <button
                          key={pu.user_id}
                          onClick={() => { setActiveTab('overview'); setShowNotifications(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0"
                        >
                          <p className="text-sm text-white font-medium">{pu.company_name || pu.email}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Pending registration approval</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        No new notifications
                      </div>
                    )}
                  </div>
                  {pendingUsers.length > 0 && (
                    <div className="p-3 border-t border-slate-700">
                      <button
                        onClick={() => { setActiveTab('overview'); setShowNotifications(false); }}
                        className="w-full text-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View all pending approvals
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white">
                {menuItems.find(item => item.id === activeTab)?.label || 'Administrator Dashboard'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Welcome back, {user?.email}! Manage the Routico platform and business owners.
              </p>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <>
                {/* Error Display */}
                {error && (
                  <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-red-300">Error</h3>
                        <p className="text-sm text-red-400/80 mt-0.5">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Grid - 4 cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    title="Pending Registrations"
                    value={stats.pendingApprovals}
                    color="bg-blue-500/15"
                    subtitle="+2 from yesterday"
                    subtitleColor="text-blue-400"
                    icon={
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <StatCard
                    title="Active Business Owners"
                    value={stats.activeBusinesses}
                    color="bg-emerald-500/15"
                    subtitle="+5 this week"
                    subtitleColor="text-emerald-400"
                    icon={
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    }
                  />
                  <StatCard
                    title="Suspended Accounts"
                    value={stats.suspendedBusinesses}
                    color="bg-rose-500/15"
                    subtitle="Needs attention"
                    subtitleColor="text-rose-400"
                    icon={
                      <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                      </svg>
                    }
                  />
                  <StatCard
                    title="Total Drivers"
                    value={stats.totalDrivers}
                    color="bg-amber-500/15"
                    subtitle="Across all businesses"
                    subtitleColor="text-amber-400"
                    icon={
                      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    }
                  />
                </div>

                {/* Main Content Grid - Two column layout */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Pending Approvals - Left 2/3 */}
                  <div className="xl:col-span-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="px-6 py-5">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-base font-semibold text-white">
                            Pending Business Owner Approvals
                          </h3>
                          <button
                            onClick={() => setActiveTab('users')}
                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            View all
                          </button>
                        </div>
                        <div className="space-y-3">
                          {pendingUsers.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-8">No pending approvals</p>
                          )}
                          {pendingUsers.map((pendingUser) => (
                            <div key={pendingUser.user_id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-800/50 border border-slate-800">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-slate-700">
                                  <span className="text-sm font-semibold text-blue-400">
                                    {pendingUser.full_name.charAt(0)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {pendingUser.full_name}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {pendingUser.email} &middot; {pendingUser.phone}
                                  </p>
                                  <p className="text-[10px] text-slate-600">
                                    Submitted: {new Date(pendingUser.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                <button
                                  onClick={() => handleApproveUser(pendingUser.user_id)}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectUser(pendingUser.user_id)}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleViewDocument(pendingUser.user_id, pendingUser.full_name)}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors"
                                >
                                  View Doc
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right column - Recent Activity Timeline */}
                  <div className="xl:col-span-1">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="px-6 py-5">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-base font-semibold text-white">
                            Recent Activity
                          </h3>
                          <button onClick={() => setActiveTab('audit')} className="text-xs text-blue-400 hover:text-blue-300">View All</button>
                        </div>
                        <div className="relative">
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800"></div>
                          <div className="space-y-4">
                            {recentActivity.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
                            ) : recentActivity.map((log, index) => (
                              <div key={log.log_id || index} className="relative flex items-start gap-4">
                                <div className={`relative z-10 w-3.5 h-3.5 rounded-full ${getCategoryColor(log.category)} flex-shrink-0 ring-4 ring-slate-900 mt-1`}></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{formatAction(log.action)}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {log.user_name || log.user_email || 'System'} &middot; {formatTimeAgo(log.created_at)}
                                  </p>
                                  {log.description && <p className="text-xs text-slate-600 mt-0.5 truncate">{log.description}</p>}
                                </div>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {log.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <AdministratorCharts stats={stats} loading={loading} error={error} />
                <AdministratorBillingCharts />
              </div>
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && (
              <AdministratorUserManagement />
            )}

            {/* Billing Management Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <AdministratorBillingCharts />
                <AdministratorPaymentReview />
              </div>
            )}

            {/* Issues Tab */}
            {activeTab === 'issues' && (
              <AdministratorIssues />
            )}

            {/* Role Management Tab */}
            {activeTab === 'roles' && (
              <AdministratorRoleManagement />
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
              <AdministratorAuditLogs />
            )}

            {/* System Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">System Settings</h2>
                <p className="text-gray-400">Configure platform-wide settings and preferences.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* General Settings */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-white mb-4">General</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Platform Name</label>
                        <input type="text" defaultValue="Routico" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Support Email</label>
                        <input type="email" defaultValue="support@routico.com" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Default Currency</label>
                        <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="PHP">PHP (&#8369;)</option>
                          <option value="USD">USD ($)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Billing Settings */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-white mb-4">Billing</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Monthly Base Fee</label>
                        <input type="number" defaultValue="2000" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Per Delivery Fee</label>
                        <input type="number" defaultValue="10" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Payment Due Days</label>
                        <input type="number" defaultValue="30" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* Notification Settings */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-white mb-4">Notifications</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'New user registration alerts', defaultChecked: true },
                        { label: 'Payment received notifications', defaultChecked: true },
                        { label: 'Overdue payment reminders', defaultChecked: true },
                        { label: 'System error alerts', defaultChecked: false },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">{item.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked={item.defaultChecked} className="sr-only peer" />
                            <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-white mb-4">Security</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Session Timeout (minutes)</label>
                        <input type="number" defaultValue="60" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Minimum Password Length</label>
                        <input type="number" defaultValue="6" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Auto-suspend on missed payments</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={true} className="sr-only peer" />
                          <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministratorDashboard;
