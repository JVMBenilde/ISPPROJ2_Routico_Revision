import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import DriverOrders from '../components/DriverOrders';
import DriverIssues from '../components/DriverIssues';
import DriverSettings from '../components/DriverSettings';
import BusinessOwnerCharts from '../components/BusinessOwnerCharts';
import Header from '../components/Header';
import useLocationReporter from '../hooks/useLocationReporter';

const DriverDashboard = () => {
  const { user, getToken, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [driverProfile, setDriverProfile] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(() => {
    const saved = localStorage.getItem('locationSharingEnabled');
    return saved !== null ? saved === 'true' : true; // default enabled
  });
  const { isTracking, error: locationError } = useLocationReporter(locationEnabled, 30000);

  useEffect(() => {
    fetchDriverProfile();
  }, []);

  const fetchDriverProfile = async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/auth/driver/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDriverProfile(await res.json());
      }
    } catch (err) {
      console.error('Error fetching driver profile:', err);
    }
  };

  const menuItems = [
    { id: 'orders', label: 'My Orders', icon: 'truck' },
    { id: 'issues', label: 'Report Issue', icon: 'alert' },
    ...(hasPermission('view_analytics') || hasPermission('use_ai_analytics')
      ? [{ id: 'analytics', label: 'Analytics & AI', icon: 'chart' }]
      : []),
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'truck':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        );
      case 'alert':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'chart':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'settings':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'orders': return { title: 'My Orders', subtitle: 'View your assigned deliveries' };
      case 'issues': return { title: 'Report Issue', subtitle: 'Report and track issues' };
      case 'analytics': return { title: 'Analytics & AI', subtitle: 'View analytics and AI insights' };
      case 'settings': return { title: 'Settings', subtitle: 'Manage your account settings' };
      default: return { title: 'Dashboard', subtitle: '' };
    }
  };

  const tabInfo = getTabTitle();

  // Group menu items by section
  const generalItems = menuItems.filter(item => item.id === 'orders');
  const toolsItems = menuItems.filter(item => item.id === 'issues' || item.id === 'analytics');
  const accountItems = menuItems.filter(item => item.id === 'settings');

  const renderMenuItem = (item) => (
    <button
      key={item.id}
      onClick={() => { setActiveTab(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
      className={`w-full flex items-center ${sidebarOpen ? 'px-4' : 'justify-center px-2'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        activeTab === item.id
          ? 'bg-blue-600/15 text-blue-400 border-r-2 border-blue-400'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
      title={!sidebarOpen ? item.label : undefined}
    >
      {getIcon(item.icon)}
      {sidebarOpen && <span className="ml-3">{item.label}</span>}
    </button>
  );

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#0a0f1a]">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[70] w-64 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:z-auto md:translate-x-0 md:w-auto md:transform-none md:transition-[width] md:duration-300 ${sidebarOpen ? 'md:w-64' : 'md:w-20'} bg-[#0c1222] border-r border-white/5 flex flex-col h-screen overflow-hidden`}>
        {/* Sidebar Header - Logo */}
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">Routico</h1>
                <p className="text-gray-500 text-xs">Driver Portal</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 overflow-y-auto">
          {/* GENERAL Section */}
          {sidebarOpen && (
            <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-4 mb-2 mt-6">
              General
            </p>
          )}
          <div className="space-y-1">
            {generalItems.map(renderMenuItem)}
          </div>

          {/* TOOLS Section */}
          {toolsItems.length > 0 && (
            <>
              {sidebarOpen && (
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-4 mb-2 mt-6">
                  Tools
                </p>
              )}
              <div className="space-y-1">
                {toolsItems.map(renderMenuItem)}
              </div>
            </>
          )}

          {/* ACCOUNT Section */}
          {sidebarOpen && (
            <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-4 mb-2 mt-6">
              Account
            </p>
          )}
          <div className="space-y-1">
            {accountItems.map(renderMenuItem)}
          </div>
        </nav>

        {/* Location Tracking Indicator */}
        {sidebarOpen && (
          <div className="px-4 py-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                <span className="text-xs text-gray-400">
                  {isTracking ? 'Location sharing active' : locationError || 'Location off'}
                </span>
              </div>
              <button
                onClick={() => {
                  const next = !locationEnabled;
                  setLocationEnabled(next);
                  localStorage.setItem('locationSharingEnabled', String(next));
                }}
                className={`text-[10px] px-2 py-0.5 rounded-full ${locationEnabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}
              >
                {locationEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}

        {/* User Info */}
        {sidebarOpen && (
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-600/20">
                <span className="text-white text-sm font-semibold">
                  {driverProfile ? `${driverProfile.first_name?.charAt(0)}${driverProfile.last_name?.charAt(0)}` : 'D'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {driverProfile ? `${driverProfile.first_name} ${driverProfile.last_name}` : 'Driver'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                {driverProfile?.company_name && (
                  <p className="text-xs text-blue-400/80 truncate">{driverProfile.company_name}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#0a0f1a] min-w-0 overflow-x-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center h-14 px-4 border-b border-white/5 bg-[#0c1222]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-white font-semibold">Routico</span>
        </div>
        <Header />
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {/* Page Title */}
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white">{tabInfo.title}</h2>
              <p className="text-gray-500 mt-1">{tabInfo.subtitle}</p>
            </div>

            {/* Tab Content */}
            {activeTab === 'orders' && <DriverOrders />}
            {activeTab === 'issues' && <DriverIssues />}
            {activeTab === 'analytics' && <BusinessOwnerCharts stats={{}} loading={false} error={null} />}
            {activeTab === 'settings' && <DriverSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;
