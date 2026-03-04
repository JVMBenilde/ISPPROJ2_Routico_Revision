import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const Header = () => {
  const { user, userRole, logout } = useAuth();
  const [logo, setLogo] = useState(null);
  const [companyName, setCompanyName] = useState('Routico');

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

    window.addEventListener('logoUpdated', handleLogoUpdate);
    return () => window.removeEventListener('logoUpdated', handleLogoUpdate);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

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
          
          {!user ? (
            <>
              <nav className="hidden md:flex space-x-8">
                <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-gray-300 hover:text-white transition-colors">Home</Link>
                <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
                <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
                <a href="#contact" className="text-gray-300 hover:text-white transition-colors">Contact</a>
              </nav>
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-white px-3 py-2 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </>
          ) : (
            <>
              <nav className="hidden md:flex space-x-8">
                <Link to="/dashboard" className="text-gray-300 hover:text-white transition-colors">Dashboard</Link>
              </nav>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-300">
                  Welcome, {user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
