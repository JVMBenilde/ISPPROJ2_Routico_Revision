import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import notificationService from '../services/notificationService';

const Header = () => {
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [logo, setLogo] = useState(null);
  const [companyName, setCompanyName] = useState('Routico');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(() => notificationService.loadFromStorage());

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

    window.addEventListener('logoUpdated', handleLogoUpdate);
    return () => window.removeEventListener('logoUpdated', handleLogoUpdate);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-header-dropdown]')) {
        setShowNotifications(false);
        setShowSettings(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Initialize notifications and request FCM permission
  useEffect(() => {
    if (!user) return;

    let unsubscribe = () => {};

    const initializeNotifications = async () => {
      try {
        console.log('📱 Initializing notifications...');

        // Request permission and register for push notifications
        const token = await notificationService.requestPermission();
        if (token) {
          console.log('✅ Push notifications enabled');
        } else {
          console.log('⚠️ Notifications not enabled');
        }

        // Listen for foreground messages
        unsubscribe = notificationService.onNotification((payload) => {
          console.log('📬 New notification:', payload);
          const notification = {
            title: payload.notification?.title || 'Routico Notification',
            message: payload.notification?.body || 'You have a new message',
            time: new Date().toLocaleTimeString(),
            type: payload.data?.type || 'info',
            data: payload.data
          };
          notificationService.saveToStorage(notification);
          setNotifications(notificationService.loadFromStorage());
        });

        // Listen for messages relayed from the service worker (background FCM)
        const swMessageHandler = (event) => {
          console.log('📨 SW message received:', event.data);
          if (event.data?.type === 'FCM_BACKGROUND_MESSAGE') {
            const payload = event.data.payload;
            const notification = {
              title: payload.notification?.title || 'Routico Notification',
              message: payload.notification?.body || 'You have a new message',
              time: new Date().toLocaleTimeString(),
              type: payload.data?.type || 'info',
              data: payload.data
            };
            notificationService.saveToStorage(notification);
            setNotifications(notificationService.loadFromStorage());
          }
        };
        navigator.serviceWorker?.addEventListener('message', swMessageHandler);
        const removeSWListener = () => navigator.serviceWorker?.removeEventListener('message', swMessageHandler);
        const origUnsub = unsubscribe;
        unsubscribe = () => { origUnsub(); removeSWListener(); };
      } catch (error) {
        console.error('📱 Error initializing notifications:', error);
      }
    };

    initializeNotifications();

    return () => unsubscribe();
  }, [user]);


  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };


  const getRoleLabel = () => {
    switch (userRole) {
      case 'business_owner': return 'Business Owner';
      case 'administrator': return 'System Admin';
      case 'driver': return 'Driver';
      default: return 'User';
    }
  };

  // Public header (not logged in)
  if (!user) {
    return (
      <header className="bg-gray-900 shadow-lg border-b border-gray-800 w-full sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                {logo ? (
                  <div className="flex items-center">
                    <img src={logo} alt={companyName} className="h-8 mr-3 object-contain" />
                    <span className="text-sm text-gray-400">{companyName}</span>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-white">
                      <span className="text-blue-400">Rout</span>ico
                    </h1>
                    <span className="ml-2 text-sm text-gray-400">Trucking Management</span>
                  </>
                )}
              </Link>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-gray-300 hover:text-white transition-colors">Home</Link>
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
              <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
              <a href="#contact" className="text-gray-300 hover:text-white transition-colors">Contact</a>
            </nav>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-300 hover:text-white px-3 py-2 transition-colors">Login</Link>
              <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">Get Started</Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Dashboard header (logged in) - new design matching screenshot
  return (
    <header className="bg-[#0f1520] border-b border-gray-800/60 w-full sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Dashboard title */}
          <div className="flex items-center min-w-0">
            <Link to="/dashboard" className="text-lg font-semibold text-white truncate hover:text-blue-400 transition-colors">
              {userRole === 'administrator' ? 'Admin Dashboard' :
               userRole === 'driver' ? 'Driver Portal' : 'Dashboard'}
            </Link>
          </div>

          {/* Center: Search Bar */}
          <div className="hidden sm:block flex-1 max-w-md mx-2 sm:mx-4 md:mx-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full bg-[#1a2235] border border-gray-700/50 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Right: Notifications + User */}
          <div className="flex items-center space-x-4 relative">
            {/* Notification Bell */}
            <div className="relative" data-header-dropdown>
              <button
                onClick={() => {
                  const opening = !showNotifications;
                  setShowNotifications(opening);
                  if (opening) {
                    const updated = notificationService.markAllAsRead();
                    setNotifications(updated);
                  }
                }}
                className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-[#1a2235] border border-gray-700/50 rounded-lg shadow-xl z-50">
                  <div className="p-4 border-b border-gray-700/50">
                    <h3 className="text-white font-semibold">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        <p>No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notif, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setShowNotifications(false);
                            if (notif.data?.action) navigate(notif.data.action);
                          }}
                          className={`p-4 border-b border-gray-700/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${!notif.read ? 'border-l-2 border-l-blue-500' : ''}`}
                        >
                          {notif.title && <p className="text-sm font-semibold text-white">{notif.title}</p>}
                          <p className="text-sm text-gray-300">{notif.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Gear */}
            <div className="relative" data-header-dropdown>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1a2235] border border-gray-700/50 rounded-lg shadow-xl z-50">
                  <div className="p-4 border-b border-gray-700/50">
                    <h3 className="text-white font-semibold">Settings</h3>
                  </div>
                  <div>
                    <button className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800/30 transition-colors border-b border-gray-700/50">
                      Profile Settings
                    </button>
                    <button className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800/30 transition-colors border-b border-gray-700/50">
                      Preferences
                    </button>
                    <button className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800/30 transition-colors">
                      Help & Support
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-700/50"></div>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ring-2 ring-blue-500/20">
                <span className="text-sm font-semibold text-white">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white leading-tight">{user?.email?.split('@')[0]}</p>
                <p className="text-xs text-gray-500">{getRoleLabel()}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="ml-2 p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
