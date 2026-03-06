import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import BusinessOwnerBilling from '../components/BusinessOwnerBilling';
import BusinessOwnerCharts from '../components/BusinessOwnerCharts';
import BusinessOwnerDrivers from '../components/BusinessOwnerDrivers';
import BusinessOwnerOrders from '../components/BusinessOwnerOrders';
import BusinessOwnerIssues from '../components/BusinessOwnerIssues';
import BusinessOwnerSettings from '../components/BusinessOwnerSettings';
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
    { id: 'billing', label: 'Billing & Payments', icon: 'credit-card' },
    { id: 'charts', label: 'Analytics & Charts', icon: 'chart' },
    { id: 'issues', label: 'Issues', icon: 'issues' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
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
    <div className="min-h-screen flex bg-gray-900">
      {/* Sidebar - Sticky position */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-800 transition-all duration-300 ease-in-out flex flex-col sticky top-0 h-screen overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          {sidebarOpen && (
            <div className="flex items-center space-x-3 flex-1">
              {logo ? (
                <>
                  <img src={logo} alt={companyName} className="h-8 w-8 object-contain" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-white truncate">{companyName}</h2>
                  </div>
                </>
              ) : (
                <h2 className="text-xl font-bold text-white">Dashboard</h2>
              )}
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className={`flex-shrink-0 ${sidebarOpen ? 'w-5 h-5' : 'w-6 h-6'}`}>
                {getIcon(item.icon)}
              </span>
              {sidebarOpen && (
                <span className="font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-400">Business Owner</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Adjusts automatically based on sidebar width */}
      <div className="flex-1 flex flex-col min-h-screen bg-gray-900">
        {/* Header within main content */}
        <Header />
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white">
                {menuItems.find(item => item.id === activeTab)?.label || 'Business Dashboard'}
              </h1>
              <p className="mt-2 text-gray-300">
                Welcome back, {user?.email}! Manage your trucking operations efficiently.
              </p>
            </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Error Display */}
            {error && (
              <div className="bg-red-900 border border-red-700 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-200">Error</h3>
                    <div className="mt-2 text-sm text-red-300">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-8">
              {/* Total Orders Card */}
              <div className="group bg-gradient-to-br from-blue-900/30 to-blue-900/10 backdrop-blur-sm shadow-lg rounded-xl border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-blue-500/20">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Total Orders</p>
                      <p className="text-2xl font-bold text-white mt-2">
                        {loading ? '...' : stats.totalOrders}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Drivers Card */}
              <div className="group bg-gradient-to-br from-green-900/30 to-green-900/10 backdrop-blur-sm shadow-lg rounded-xl border border-green-500/30 hover:border-green-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-green-500/20">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Active Drivers</p>
                      <p className="text-2xl font-bold text-white mt-2">
                        {loading ? '...' : stats.activeDrivers}
                      </p>
                    </div>
                    <div className="p-3 bg-green-500/20 rounded-lg">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Completed Deliveries Card */}
              <div className="group bg-gradient-to-br from-purple-900/30 to-purple-900/10 backdrop-blur-sm shadow-lg rounded-xl border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-purple-500/20">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Completed Deliveries</p>
                      <p className="text-2xl font-bold text-white mt-2">
                        {loading ? '...' : stats.completedDeliveries}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Revenue Card */}
              <div className="group bg-gradient-to-br from-orange-900/30 to-orange-900/10 backdrop-blur-sm shadow-lg rounded-xl border border-orange-500/30 hover:border-orange-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-orange-500/20">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-white mt-2">
                        {loading ? '...' : `₱${stats.monthlyRevenue.toLocaleString()}`}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-500/20 rounded-lg">
                      <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6C6.48 6 2 9.58 2 14s4.48 8 10 8 10-3.58 10-8-4.48-8-10-8zm0 14c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 10 15.5 10 14 10.67 14 11.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 10 8.5 10 7 10.67 7 11.5 7.67 13 8.5 13zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Recent Orders */}
          <div className="xl:col-span-2">
            <div className="group bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-500 transform hover:scale-[1.01] hover:shadow-2xl hover:shadow-blue-500/20">
              <div className="px-6 py-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300">
                    Recent Orders
                  </h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="group/link text-sm font-medium text-blue-400 hover:text-blue-300 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                  >
                    <span className="group-hover/link:animate-pulse">View all</span>
                  </button>
                </div>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center space-x-4">
                        <div className="h-8 w-8 bg-gray-700 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                        </div>
                        <div className="h-6 w-16 bg-gray-700 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                ) : recentOrders.length > 0 ? (
                  <div className="flow-root">
                    <ul className="-my-5 divide-y divide-gray-700">
                      {recentOrders.map((order, index) => (
                        <li key={order.order_id} className="py-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 bg-gray-700 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {index + 1}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {order.customer_name || 'Customer'}
                              </p>
                              <p className="text-sm text-gray-400 truncate">
                                {order.drop_off_location}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                order.order_status === 'completed' ? 'bg-green-900/50 text-green-400' :
                                order.order_status === 'in_transit' ? 'bg-blue-900/50 text-blue-400' :
                                'bg-yellow-900/50 text-yellow-400'
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
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-white">No recent orders</h3>
                    <p className="mt-1 text-sm text-gray-400">Orders will appear here once you start receiving deliveries.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="xl:col-span-1">
            <div className="group bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-700/50 hover:border-green-500/50 transition-all duration-500 transform hover:scale-[1.01] hover:shadow-2xl hover:shadow-green-500/20">
              <div className="px-6 py-6 sm:p-8">
                <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors duration-300 mb-6">
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New Order
                  </button>
                  <button
                    onClick={() => setActiveTab('drivers')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Add Driver
                  </button>
                  <Link
                    to="/routes/optimize"
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Optimize Routes
                  </Link>
                  <button
                    onClick={() => setActiveTab('charts')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    View Analytics
                  </button>
                </div>
              </div>
            </div>

            {/* Account Status */}
            <div className="mt-6 group bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-500 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="px-6 py-6 sm:p-8">
                <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors duration-300 mb-6">
                  Account Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Subscription</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      loading ? 'bg-gray-700 text-gray-300' :
                      stats.subscriptionStatus === 'paid' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                    }`}>
                      {loading ? 'Loading...' : stats.subscriptionStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Plan</span>
                    <span className="text-sm font-medium text-white">
                      {loading ? 'Loading...' : 'Routico Professional'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Monthly Fee</span>
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

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <BusinessOwnerBilling />
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
        
        {/* Footer within main content */}
        <Footer />
      </div>
    </div>
  );
};

export default BusinessOwnerDashboard;
