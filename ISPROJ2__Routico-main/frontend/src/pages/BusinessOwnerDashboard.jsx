import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import BusinessOwnerBilling from '../components/BusinessOwnerBilling';
import BusinessOwnerCharts from '../components/BusinessOwnerCharts';
import BusinessOwnerDrivers from '../components/BusinessOwnerDrivers';
import BusinessOwnerOrders from '../components/BusinessOwnerOrders';
import BusinessOwnerIssues from '../components/BusinessOwnerIssues';
import BusinessOwnerSettings from '../components/BusinessOwnerSettings';
import BusinessOwnerFleet from '../components/BusinessOwnerFleet';
import BusinessOwnerReports from '../components/BusinessOwnerReports';
import Footer from '../components/Footer';
import Header from '../components/Header';

const BusinessOwnerDashboard = () => {
  const { user, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState(null);
  const [companyName, setCompanyName] = useState('Routico');
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeDrivers: 0,
    completedDeliveries: 0,
    monthlyRevenue: 0,
    subscriptionStatus: 'pending'
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load logo from localStorage on mount
    const savedLogo = localStorage.getItem('companyLogo');
    const savedName = localStorage.getItem('companyName');

    if (savedLogo) {
      setLogo(savedLogo);
    }
    if (savedName) {
      setCompanyName(savedName);
    }

    // Listen for logo updates
    const handleLogoUpdate = (event) => {
      if (event.detail.logo) {
        setLogo(event.detail.logo);
      } else {
        setLogo(null);
      }
      if (event.detail.companyName) {
        setCompanyName(event.detail.companyName);
      }
    };

    // Listen for driver updates
    const handleDriversUpdate = (event) => {
      fetchDashboardData();
    };

    window.addEventListener('logoUpdated', handleLogoUpdate);
    window.addEventListener('driversUpdated', handleDriversUpdate);

    // Fetch dashboard data
    fetchDashboardData();

    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdate);
      window.removeEventListener('driversUpdated', handleDriversUpdate);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch dashboard statistics - using test endpoint for now
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

      // Fetch active drivers count from API
      if (user) {
        try {
          const token = getToken();
          const driversResponse = await fetch('http://localhost:3001/api/drivers', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (driversResponse.ok) {
            const driversData = await driversResponse.json();
            statsData.activeDrivers = driversData.filter(d => d.status === 'active').length;
          }
        } catch (e) {
          console.error('Error fetching drivers:', e);
        }
      }

      setStats(statsData);

      // Fetch recent orders from the real orders API
      if (user) {
        const token = getToken();
        const ordersResponse = await fetch('http://localhost:3001/api/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          // Update total orders stat from real data
          statsData.totalOrders = ordersData.length;
          statsData.completedDeliveries = ordersData.filter(o => o.order_status === 'completed').length;
          setStats({ ...statsData });
          // Show the 5 most recent orders
          setRecentOrders(ordersData.slice(0, 5));
        } else {
          setRecentOrders([]);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');

      // Fallback to default values if API fails
      setStats({
        totalOrders: 0,
        activeDrivers: 0,
        completedDeliveries: 0,
        monthlyRevenue: 0,
        subscriptionStatus: 'pending'
      });
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };


  const menuItems = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'orders', label: 'Orders', icon: 'orders' },
    { id: 'drivers', label: 'Drivers', icon: 'drivers' },
    { id: 'fleet', label: 'Fleet Management', icon: 'fleet' },
    { id: 'billing', label: 'Billing & Payments', icon: 'credit-card' },
    { id: 'charts', label: 'Analytics & Charts', icon: 'chart' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'issues', label: 'Issues', icon: 'issues' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  // Section grouping for sidebar
  const sidebarSections = [
    { label: 'GENERAL', items: ['overview'] },
    { label: 'MANAGEMENT', items: ['orders', 'drivers', 'fleet'] },
    { label: 'FINANCE', items: ['billing', 'charts', 'reports'] },
    { label: 'OTHER', items: ['issues', 'settings'] }
  ];

  const getIcon = (iconType) => {
    switch (iconType) {
      case 'home':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'credit-card':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'chart':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'orders':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'drivers':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'issues':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'fleet':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'reports':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

  return (
    <div className="min-h-screen flex bg-[#0a0f1a]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#0c1222] transition-all duration-300 ease-in-out flex flex-col sticky top-0 h-screen overflow-hidden border-r border-gray-800/40`}>
        {/* Sidebar Header - Logo Section */}
        <div className="flex items-center justify-between px-4 py-5 flex-shrink-0">
          {sidebarOpen && (
            <div className="flex items-center space-x-3 flex-1">
              {logo ? (
                <>
                  <img src={logo} alt={companyName} className="h-9 w-9 object-contain rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-white truncate">{companyName}</h2>
                    <p className="text-[11px] text-gray-500">Business Portal</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Routico</h2>
                    <p className="text-[11px] text-gray-500">Business Portal</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu with Section Groups */}
        <nav className="flex-1 px-3 pb-4 overflow-y-auto">
          {sidebarSections.map((section) => (
            <div key={section.label}>
              {sidebarOpen && (
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-4 mb-2 mt-6">
                  {section.label}
                </p>
              )}
              {!sidebarOpen && <div className="mt-4" />}
              <div className="space-y-1">
                {section.items.map((itemId) => {
                  const item = menuItems.find(m => m.id === itemId);
                  if (!item) return null;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                        activeTab === item.id
                          ? 'bg-blue-600/15 text-blue-400 border-r-2 border-blue-400'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                    >
                      <span className="flex-shrink-0">
                        {getIcon(item.icon)}
                      </span>
                      {sidebarOpen && (
                        <span className="text-sm font-medium">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Info at Bottom */}
        <div className="p-4 border-t border-gray-800/40 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[2px]">
                <div className="w-full h-full bg-[#0c1222] rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0c1222]"></div>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500">Business Owner</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#0a0f1a]">
        {/* Header */}
        <Header />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white">
                {menuItems.find(item => item.id === activeTab)?.label || 'Business Dashboard'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, {user?.email}! Manage your trucking operations efficiently.
              </p>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <>
                {/* Error Display */}
                {error && (
                  <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-200">Error</h3>
                        <div className="mt-1 text-sm text-red-300">
                          <p>{error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8">
                  {/* Total Orders Card */}
                  <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Total Orders</p>
                        <p className="text-2xl font-bold text-white mt-0.5">
                          {loading ? '...' : stats.totalOrders}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Active Drivers Card */}
                  <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Active Drivers</p>
                        <p className="text-2xl font-bold text-white mt-0.5">
                          {loading ? '...' : stats.activeDrivers}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Completed Deliveries Card */}
                  <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Completed</p>
                        <p className="text-2xl font-bold text-white mt-0.5">
                          {loading ? '...' : stats.completedDeliveries}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Revenue Card */}
                  <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Revenue</p>
                        <p className="text-2xl font-bold text-white mt-0.5">
                          {loading ? '...' : `₱${stats.monthlyRevenue.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content Grid - 2/3 + 1/3 */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  {/* Recent Orders */}
                  <div className="xl:col-span-2">
                    <div className="bg-[#111827] border border-gray-800/60 rounded-2xl">
                      <div className="px-6 py-5">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-base font-semibold text-white">
                            Recent Orders
                          </h3>
                          <button
                            onClick={() => setActiveTab('orders')}
                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          >
                            View all
                          </button>
                        </div>
                        {loading ? (
                          <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="animate-pulse flex items-center space-x-4">
                                <div className="h-8 w-8 bg-gray-700/50 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-gray-700/50 rounded w-3/4"></div>
                                  <div className="h-3 bg-gray-700/50 rounded w-1/2"></div>
                                </div>
                                <div className="h-6 w-16 bg-gray-700/50 rounded-full"></div>
                              </div>
                            ))}
                          </div>
                        ) : recentOrders.length > 0 ? (
                          <div className="flow-root">
                            <ul className="-my-4 divide-y divide-gray-800/60">
                              {recentOrders.map((order, index) => (
                                <li key={order.order_id} className="py-3.5">
                                  <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                      <div className="h-8 w-8 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-semibold text-blue-400">
                                          {index + 1}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">
                                        {order.customer_name || 'Customer'}
                                      </p>
                                      <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {order.drop_off_location}
                                      </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                        order.order_status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                        order.order_status === 'in_transit' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                        'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                      }`}>
                                        {order.order_status}
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-center py-10">
                            <svg className="mx-auto h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <h3 className="mt-3 text-sm font-medium text-gray-300">No recent orders</h3>
                            <p className="mt-1 text-xs text-gray-500">Orders will appear here once you start receiving deliveries.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Quick Actions + Account Status */}
                  <div className="xl:col-span-1 space-y-5">
                    {/* Quick Actions */}
                    <div className="bg-[#111827] border border-gray-800/60 rounded-2xl">
                      <div className="px-6 py-5">
                        <h3 className="text-base font-semibold text-white mb-4">
                          Quick Actions
                        </h3>
                        <div className="space-y-2.5">
                          <button
                            onClick={() => setActiveTab('orders')}
                            className="w-full flex items-center px-4 py-3 bg-[#1a2235] border border-gray-700/40 rounded-xl hover:bg-[#1e2a3f] transition-colors text-sm font-medium text-white"
                          >
                            <svg className="w-4 h-4 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Create New Order
                          </button>
                          <button
                            onClick={() => setActiveTab('drivers')}
                            className="w-full flex items-center px-4 py-3 bg-[#1a2235] border border-gray-700/40 rounded-xl hover:bg-[#1e2a3f] transition-colors text-sm font-medium text-gray-300"
                          >
                            <svg className="w-4 h-4 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Add Driver
                          </button>
                          <Link
                            to="/routes/optimize"
                            className="w-full flex items-center px-4 py-3 bg-[#1a2235] border border-gray-700/40 rounded-xl hover:bg-[#1e2a3f] transition-colors text-sm font-medium text-gray-300"
                          >
                            <svg className="w-4 h-4 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Optimize Routes
                          </Link>
                          <button
                            onClick={() => setActiveTab('charts')}
                            className="w-full flex items-center px-4 py-3 bg-[#1a2235] border border-gray-700/40 rounded-xl hover:bg-[#1e2a3f] transition-colors text-sm font-medium text-gray-300"
                          >
                            <svg className="w-4 h-4 mr-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            View Analytics
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Account Status */}
                    <div className="bg-[#111827] border border-gray-800/60 rounded-2xl">
                      <div className="px-6 py-5">
                        <h3 className="text-base font-semibold text-white mb-4">
                          Account Status
                        </h3>
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Subscription</span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
                              loading ? 'bg-gray-700/30 text-gray-400' :
                              stats.subscriptionStatus === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            }`}>
                              {loading ? 'Loading...' : stats.subscriptionStatus === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Plan</span>
                            <span className="text-sm font-medium text-white">
                              {loading ? 'Loading...' : 'Routico Professional'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Monthly Fee</span>
                            <span className="text-sm font-medium text-white">
                              {loading ? 'Loading...' : '₱2,000 + ₱10/delivery'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && (
              <BusinessOwnerCharts stats={stats} loading={loading} error={error} />
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <BusinessOwnerOrders />
            )}

            {/* Drivers Tab */}
            {activeTab === 'drivers' && (
              <BusinessOwnerDrivers />
            )}

            {/* Fleet Management Tab */}
            {activeTab === 'fleet' && (
              <BusinessOwnerFleet />
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <BusinessOwnerBilling />
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <BusinessOwnerReports />
            )}

            {/* Issues Tab */}
            {activeTab === 'issues' && (
              <BusinessOwnerIssues />
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <BusinessOwnerSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessOwnerDashboard;
