import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import BusinessOwnerBilling from '../components/BusinessOwnerBilling';
import BusinessOwnerCharts from '../components/BusinessOwnerCharts';
import BusinessOwnerDrivers from '../components/BusinessOwnerDrivers';
import BusinessOwnerOrders from '../components/BusinessOwnerOrders';
import BusinessOwnerIssues from '../components/BusinessOwnerIssues';
import BusinessOwnerSettings from '../components/BusinessOwnerSettings';
import BusinessOwnerFleet from '../components/BusinessOwnerFleet';
import BusinessOwnerReports from '../components/BusinessOwnerReports';

const BusinessOwnerDashboard = () => {
  const { user, getToken, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState(null);
  const [companyName, setCompanyName] = useState('Routico');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // default dark
  });
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeDrivers: 0,
    completedDeliveries: 0,
    activeDeliveries: 0,
    delayedDeliveries: 0,
    monthlyRevenue: 0,
    subscriptionStatus: 'pending',
    weeklyVolume: [0, 0, 0, 0, 0, 0, 0]
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);

  // Apply dark/light mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const savedLogo = localStorage.getItem('companyLogo');
    const savedName = localStorage.getItem('companyName');
    if (savedLogo) setLogo(savedLogo);
    if (savedName) setCompanyName(savedName);

    const handleLogoUpdate = (event) => {
      if (event.detail.logo) setLogo(event.detail.logo);
      else setLogo(null);
      if (event.detail.companyName) setCompanyName(event.detail.companyName);
    };

    const handleDriversUpdate = () => fetchDashboardData();
    const handleOrdersUpdate = () => fetchDashboardData();

    window.addEventListener('logoUpdated', handleLogoUpdate);
    window.addEventListener('driversUpdated', handleDriversUpdate);
    window.addEventListener('ordersUpdated', handleOrdersUpdate);
    fetchDashboardData();

    // Auto-refresh every 30 seconds so stats stay up to date
    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdate);
      window.removeEventListener('driversUpdated', handleDriversUpdate);
      window.removeEventListener('ordersUpdated', handleOrdersUpdate);
      clearInterval(pollInterval);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsResponse = await fetch('http://localhost:3001/api/auth/business-dashboard-stats-test');
      let statsData = {
        totalOrders: 0,
        activeDrivers: 0,
        completedDeliveries: 0,
        monthlyRevenue: 0,
        subscriptionStatus: 'pending'
      };

      if (statsResponse.ok) {
        statsData = await statsResponse.json();
      }

      if (user) {
        try {
          const token = getToken();
          const driversResponse = await fetch('http://localhost:3001/api/drivers', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (driversResponse.ok) {
            const driversData = await driversResponse.json();
            statsData.activeDrivers = driversData.filter(d => d.status === 'active').length;
            setDrivers(driversData.slice(0, 5));
          }
        } catch (e) {
          console.error('Error fetching drivers:', e);
        }
      }

      setStats(statsData);

      if (user) {
        const token = getToken();
        const ordersResponse = await fetch('http://localhost:3001/api/orders?includeRouted=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          statsData.totalOrders = ordersData.length;
          statsData.completedDeliveries = ordersData.filter(o => o.order_status === 'completed').length;
          statsData.activeDeliveries = ordersData.filter(o => o.order_status === 'in_transit').length;
          statsData.delayedDeliveries = ordersData.filter(o => o.order_status === 'delayed' || o.order_status === 'failed').length;
          statsData.cancelledOrders = ordersData.filter(o => o.order_status === 'cancelled').length;
          const currentMonth = new Date().toISOString().slice(0, 7);
          statsData.monthlyRevenue = ordersData
            .filter(o => o.order_created_at && o.order_created_at.startsWith(currentMonth))
            .reduce((sum, o) => sum + (parseFloat(o.delivery_fee) || 0), 0);

          // Compute weekly volume (Mon=0, Sun=6) for the current week
          const now = new Date();
          const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const monday = new Date(now);
          monday.setHours(0, 0, 0, 0);
          monday.setDate(now.getDate() + mondayOffset);
          const weeklyCount = [0, 0, 0, 0, 0, 0, 0];
          ordersData.forEach(o => {
            if (!o.order_created_at) return;
            const orderDate = new Date(o.order_created_at);
            const diffDays = Math.floor((orderDate - monday) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
              weeklyCount[diffDays]++;
            }
          });
          statsData.weeklyVolume = weeklyCount;

          setStats({ ...statsData });
          setRecentOrders(ordersData.slice(0, 5));
        } else {
          setRecentOrders([]);
        }

        // Fetch recent activity
        try {
          const activityResponse = await fetch('http://localhost:3001/api/auth/my-activity', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (activityResponse.ok) {
            const activityData = await activityResponse.json();
            setRecentActivity(activityData.logs || []);
          }
        } catch (e) {
          console.error('Error fetching activity:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
      setStats({
        totalOrders: 0,
        activeDrivers: 0,
        completedDeliveries: 0,
        activeDeliveries: 0,
        delayedDeliveries: 0,
        monthlyRevenue: 0,
        subscriptionStatus: 'pending',
        weeklyVolume: [0, 0, 0, 0, 0, 0, 0]
      });
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
    { id: 'orders', label: 'Delivery Orders', icon: 'orders' },
    { id: 'routes', label: 'Route Optimization', icon: 'route' },
    { id: 'charts', label: 'Tracking', icon: 'tracking' },
    { id: 'drivers', label: 'Drivers', icon: 'drivers' },
    { id: 'fleet', label: 'Trucks', icon: 'trucks' },
  ];

  const supportItems = [
    { id: 'issues', label: 'Issues', icon: 'issues' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'billing', label: 'Billing', icon: 'billing' },
    { id: 'settings', label: 'Admin Panel', icon: 'settings' },
  ];

  const allMenuItems = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
    { id: 'orders', label: 'Delivery Orders', icon: 'orders' },
    { id: 'routes', label: 'Route Optimization', icon: 'route' },
    { id: 'fleet', label: 'Trucks', icon: 'trucks' },
    { id: 'charts', label: 'Tracking', icon: 'tracking' },
    { id: 'drivers', label: 'Drivers', icon: 'drivers' },
    { id: 'issues', label: 'Issues', icon: 'issues' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'billing', label: 'Billing', icon: 'billing' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const getIcon = (iconType) => {
    switch (iconType) {
      case 'dashboard':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
      case 'orders':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'route':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        );
      case 'tracking':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'drivers':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
        );
      case 'trucks':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'issues':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'reports':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'billing':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'settings':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.26 2.37 1.806a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.26 3.31-1.806 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.26-2.37-1.806a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.26-3.31 1.806-2.37a1.724 1.724 0 002.572-1.065zM12 15a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const delayedOrders = stats.delayedDeliveries || 0;
  const cancelledOrders = stats.cancelledOrders || 0;
  const inTransitOrders = stats.activeDeliveries || 0;

  const getActivityCategoryColor = (category) => {
    const colors = { auth: 'bg-blue-500', users: 'bg-indigo-500', orders: 'bg-emerald-500', drivers: 'bg-cyan-500', billing: 'bg-amber-500', roles: 'bg-purple-500', routes: 'bg-teal-500', tracking: 'bg-orange-500', issues: 'bg-red-500', analytics: 'bg-pink-500' };
    return colors[category] || 'bg-gray-500';
  };

  const formatActivityAction = (action) => (action || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const formatTimeAgo = (dateStr) => {
    const diffMs = new Date() - new Date(dateStr);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#111621]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[#2463eb]">
            {logo ? (
              <img src={logo} alt={companyName} className="h-8 w-8 object-contain rounded-lg" />
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            )}
            <h1 className="text-xl font-bold tracking-tight text-white">{companyName}</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Logistics Management</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id + item.icon}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-[#2463eb] text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="flex-shrink-0">{getIcon(item.icon)}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Support & Ops Section */}
          <div className="pt-4 pb-2">
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Support & Ops</p>
          </div>
          {supportItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-[#2463eb] text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="flex-shrink-0">{getIcon(item.icon)}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info at Bottom */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
              <p className="text-[10px] text-slate-500 truncate">Business Owner</p>
            </div>
            <button
              onClick={async () => { await logout(); window.location.href = '/login'; }}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">
              {allMenuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
            </h2>
            {/* Search */}
            <div className="relative w-72">
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tracking, orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    const match = allMenuItems.find(item =>
                      item.label.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    if (match) { setActiveTab(match.id); setSearchQuery(''); }
                  }
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border-none rounded-xl text-sm text-slate-300 placeholder-slate-500 focus:ring-2 focus:ring-[#2463eb]/20 outline-none"
              />
              {searchQuery && (
                <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  {allMenuItems
                    .filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
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
                  {allMenuItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-4 py-2.5 text-sm text-slate-500">No results found</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Dark/Light Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-[#2463eb]/10 hover:text-[#2463eb] transition-all"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center border-2 border-[#2463eb]/20">
              <span className="text-sm font-semibold text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Tab Content */}
          {activeTab === 'overview' && (
            <>
              {/* Error Display */}
              {error && (
                <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Stats Grid - 4 cards */}
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Orders */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Total Orders</p>
                      <h3 className="text-3xl font-bold mt-1 text-white">
                        {loading ? '...' : stats.totalOrders.toLocaleString()}
                      </h3>
                      <p className="text-xs text-green-500 font-medium mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        All time total
                      </p>
                    </div>
                    <div className="p-3 bg-[#2463eb]/10 rounded-xl text-[#2463eb]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Active Deliveries */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Active Deliveries</p>
                      <h3 className="text-3xl font-bold mt-1 text-white">
                        {loading ? '...' : inTransitOrders}
                      </h3>
                      <p className="text-xs text-[#2463eb] font-medium mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        In progress
                      </p>
                    </div>
                    <div className="p-3 bg-blue-900/30 rounded-xl text-blue-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Delayed Deliveries */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Delayed Deliveries</p>
                      <h3 className="text-3xl font-bold mt-1 text-red-500">
                        {loading ? '...' : delayedOrders}
                      </h3>
                      <p className="text-xs text-red-400 font-medium mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                        </svg>
                        Attention required
                      </p>
                    </div>
                    <div className="p-3 bg-red-900/30 rounded-xl text-red-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Available Drivers */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-400">Available Drivers</p>
                      <h3 className="text-3xl font-bold mt-1 text-white">
                        {loading ? '...' : stats.activeDrivers}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Active drivers
                      </p>
                    </div>
                    <div className="p-3 bg-green-900/30 rounded-xl text-green-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </section>

              {/* Middle Section: Chart + Delivery Status */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Delivery Volume Chart */}
                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-lg text-white">Delivery Volume Overview</h4>
                  </div>
                  {(() => {
                    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const wv = stats.weeklyVolume || [0, 0, 0, 0, 0, 0, 0];
                    const chartData = dayLabels.map((day, i) => ({
                      day,
                      value: wv[i] || 0
                    }));
                    const maxVal = Math.max(...chartData.map(d => d.value)) || 1;
                    const points = chartData.map((d, i) => ({
                      x: 8 + (i * (84 / 6)),
                      y: 85 - (d.value / maxVal) * 65,
                      ...d
                    }));
                    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                    const areaPath = `${linePath} L${points[points.length-1].x},90 L${points[0].x},90 Z`;
                    return (
                      <div className="h-[240px] w-full relative">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: '#2463eb', stopOpacity: 0.3 }} />
                              <stop offset="100%" style={{ stopColor: '#2463eb', stopOpacity: 0.02 }} />
                            </linearGradient>
                          </defs>
                          <line x1="8" y1="25" x2="92" y2="25" stroke="#1e293b" strokeWidth="0.3" />
                          <line x1="8" y1="50" x2="92" y2="50" stroke="#1e293b" strokeWidth="0.3" />
                          <line x1="8" y1="75" x2="92" y2="75" stroke="#1e293b" strokeWidth="0.3" />
                          <path d={areaPath} fill="url(#grad1)" />
                          <path d={linePath} fill="none" stroke="#2463eb" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {/* Interactive data points as HTML overlays */}
                        {points.map((p, i) => (
                          <div
                            key={i}
                            className="absolute group"
                            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                          >
                            <div className="w-3 h-3 rounded-full border-2 border-[#2463eb] bg-slate-900 group-hover:bg-[#2463eb] group-hover:scale-150 transition-all cursor-pointer" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-700 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
                              {p.value} orders
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
                            </div>
                          </div>
                        ))}
                        {/* Day labels */}
                        <div className="absolute bottom-0 left-0 w-full flex justify-between text-[10px] text-slate-400 px-[6%] pb-0 font-bold uppercase tracking-wider">
                          {chartData.map(d => <span key={d.day}>{d.day}</span>)}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Delivery Status Donut */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
                  <h4 className="font-bold text-lg text-white mb-6">Delivery Status</h4>
                  <div className="relative h-[200px] flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                      <circle className="text-slate-800" cx="64" cy="64" fill="transparent" r="50" stroke="currentColor" strokeWidth="12" />
                      <circle className="text-[#2463eb]" cx="64" cy="64" fill="transparent" r="50" stroke="currentColor"
                        strokeDasharray="314"
                        strokeDashoffset={stats.totalOrders > 0 ? 314 - (314 * stats.completedDeliveries / stats.totalOrders) : 314}
                        strokeWidth="12" />
                      <circle className="text-red-500" cx="64" cy="64" fill="transparent" r="50" stroke="currentColor"
                        strokeDasharray="314"
                        strokeDashoffset={stats.totalOrders > 0 ? 314 - (314 * delayedOrders / stats.totalOrders) : 314}
                        strokeWidth="12" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-bold text-white">{loading ? '...' : stats.totalOrders}</span>
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Total</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#2463eb]"></span>
                        <span className="text-slate-400">Delivered</span>
                      </div>
                      <span className="font-semibold text-white">{loading ? '...' : stats.completedDeliveries}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-600"></span>
                        <span className="text-slate-400">Pending</span>
                      </div>
                      <span className="font-semibold text-white">{loading ? '...' : stats.totalOrders - stats.completedDeliveries - delayedOrders - cancelledOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span className="text-slate-400">Delayed</span>
                      </div>
                      <span className="font-semibold text-white">{loading ? '...' : delayedOrders}</span>
                    </div>
                    {cancelledOrders > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                        <span className="text-slate-400">Cancelled</span>
                      </div>
                      <span className="font-semibold text-white">{cancelledOrders}</span>
                    </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Bottom Section: Orders Table + Quick Actions + Drivers */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  {/* Recent Orders Table */}
                  <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="font-bold text-lg text-white">Recent Delivery Orders</h4>
                      <button onClick={() => setActiveTab('orders')} className="text-[#2463eb] text-sm font-semibold hover:underline">View All</button>
                    </div>
                    <div className="overflow-x-auto">
                      {loading ? (
                        <div className="p-6 space-y-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse flex items-center gap-4">
                              <div className="h-4 bg-slate-700/50 rounded w-20"></div>
                              <div className="h-4 bg-slate-700/50 rounded w-32"></div>
                              <div className="h-4 bg-slate-700/50 rounded w-16"></div>
                              <div className="h-4 bg-slate-700/50 rounded w-20"></div>
                            </div>
                          ))}
                        </div>
                      ) : recentOrders.length > 0 ? (
                        <table className="w-full text-left">
                          <thead className="bg-slate-800/50 text-[10px] uppercase text-slate-400 font-bold tracking-widest">
                            <tr>
                              <th className="px-6 py-4">Order ID</th>
                              <th className="px-6 py-4">Customer</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {recentOrders.map((order) => (
                              <tr key={order.order_id}>
                                <td className="px-6 py-4 text-sm font-medium text-white">#{order.order_id}</td>
                                <td className="px-6 py-4 text-sm text-slate-300">{order.customer_name || 'Customer'}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                    order.order_status === 'completed' ? 'bg-green-900/40 text-green-300' :
                                    order.order_status === 'in_transit' ? 'bg-blue-900/40 text-blue-300' :
                                    order.order_status === 'delayed' || order.order_status === 'failed' ? 'bg-red-900/40 text-red-300' :
                                    'bg-yellow-900/40 text-yellow-300'
                                  }`}>
                                    {order.order_status === 'in_transit' ? 'In Transit' :
                                     order.order_status === 'completed' ? 'Delivered' :
                                     order.order_status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-[200px]">{order.drop_off_location || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center py-10">
                          <svg className="mx-auto h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <h3 className="mt-3 text-sm font-medium text-slate-300">No recent orders</h3>
                          <p className="mt-1 text-xs text-slate-500">Orders will appear here once created.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions + Account Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Quick Actions */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
                      <h4 className="font-bold text-lg text-white mb-4">Quick Actions</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setActiveTab('orders')}
                          className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-[#2463eb]/5 hover:text-[#2463eb] border border-transparent hover:border-[#2463eb]/20 transition-all gap-2 text-slate-300"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">Create Order</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('drivers')}
                          className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-[#2463eb]/5 hover:text-[#2463eb] border border-transparent hover:border-[#2463eb]/20 transition-all gap-2 text-slate-300"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">Add Driver</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('fleet')}
                          className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-[#2463eb]/5 hover:text-[#2463eb] border border-transparent hover:border-[#2463eb]/20 transition-all gap-2 text-slate-300"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">Add Truck</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('charts')}
                          className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-[#2463eb]/5 hover:text-[#2463eb] border border-transparent hover:border-[#2463eb]/20 transition-all gap-2 text-slate-300"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">View Reports</span>
                        </button>
                      </div>
                    </div>

                    {/* Account Status */}
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
                      <h4 className="font-bold text-lg text-white mb-4">Account Status</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Subscription</span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            loading ? 'bg-slate-700/30 text-slate-400' :
                            stats.subscriptionStatus === 'paid' ? 'bg-green-900/40 text-green-300' : 'bg-yellow-900/40 text-yellow-300'
                          }`}>
                            {loading ? 'Loading...' : stats.subscriptionStatus === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Plan</span>
                          <span className="text-sm font-medium text-white">
                            {loading ? 'Loading...' : 'Routico Professional'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Monthly Fee</span>
                          <span className="text-sm font-medium text-white">
                            {loading ? 'Loading...' : '₱2,000 + ₱10/delivery'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Revenue</span>
                          <span className="text-sm font-bold text-white">
                            {loading ? 'Loading...' : `₱${stats.monthlyRevenue.toLocaleString()}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="lg:col-span-2">
                  <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="font-bold text-lg text-white">Recent Activity</h4>
                    </div>
                    <div className="p-6">
                      {recentActivity.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
                      ) : (
                        <div className="relative">
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800"></div>
                          <div className="space-y-4">
                            {recentActivity.map((log, index) => (
                              <div key={log.log_id || index} className="relative flex items-start gap-4">
                                <div className={`relative z-10 w-3.5 h-3.5 rounded-full ${getActivityCategoryColor(log.category)} flex-shrink-0 ring-4 ring-slate-900 mt-1`}></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{formatActivityAction(log.action)}</p>
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
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Drivers Panel */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm flex flex-col h-full">
                  <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <h4 className="font-bold text-lg text-white">Active Drivers</h4>
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded font-bold text-slate-300">
                      {loading ? '...' : `${stats.activeDrivers} Active`}
                    </span>
                  </div>
                  <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[500px]">
                    {loading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-700/50 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
                              <div className="h-3 bg-slate-700/50 rounded w-1/2"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : drivers.length > 0 ? (
                      drivers.map((driver) => (
                        <div key={driver.driver_id || driver.id} className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                              <span className="text-xs font-semibold text-white">
                                {(driver.first_name || driver.email || 'D').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                              driver.status === 'active' ? 'bg-green-500' : driver.status === 'on_delivery' ? 'bg-orange-500' : 'bg-red-500'
                            }`}></span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">
                              {driver.first_name && driver.last_name ? `${driver.first_name} ${driver.last_name}` : driver.email}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {driver.status === 'active' ? 'Available' : driver.status === 'on_delivery' ? 'On Delivery' : driver.status}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-slate-500">No drivers yet</p>
                        <button
                          onClick={() => setActiveTab('drivers')}
                          className="mt-2 text-xs text-[#2463eb] hover:underline font-medium"
                        >
                          Add your first driver
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-6 border-t border-slate-800">
                    <button
                      onClick={() => setActiveTab('drivers')}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors text-slate-300"
                    >
                      Manage All Drivers
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'charts' && (
            <BusinessOwnerCharts stats={stats} loading={loading} error={error} />
          )}
          {activeTab === 'orders' && <BusinessOwnerOrders />}
          {activeTab === 'routes' && <BusinessOwnerOrders routeOptimizationOnly />}
          {activeTab === 'drivers' && <BusinessOwnerDrivers />}
          {activeTab === 'fleet' && <BusinessOwnerFleet />}
          {activeTab === 'billing' && <BusinessOwnerBilling />}
          {activeTab === 'reports' && <BusinessOwnerReports />}
          {activeTab === 'issues' && <BusinessOwnerIssues />}
          {activeTab === 'settings' && <BusinessOwnerSettings />}
        </div>
      </main>
    </div>
  );
};

export default BusinessOwnerDashboard;
