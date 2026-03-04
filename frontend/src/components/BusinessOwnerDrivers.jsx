import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const BusinessOwnerDrivers = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    licenseExpiry: '',
    ridesCompleted: ''
  });

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      // Load drivers from localStorage
      const savedDrivers = localStorage.getItem('routicoDrivers');
      if (savedDrivers) {
        setDrivers(JSON.parse(savedDrivers));
      } else {
        setDrivers([]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load drivers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveDrivers = (updatedDrivers) => {
    try {
      localStorage.setItem('routicoDrivers', JSON.stringify(updatedDrivers));
      // Dispatch event to notify other components of driver updates
      window.dispatchEvent(new CustomEvent('driversUpdated', { detail: { drivers: updatedDrivers } }));
      console.log('Drivers saved to localStorage');
    } catch (err) {
      console.error('Failed to save drivers:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddDriver = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingId) {
        // Update existing driver
        const updatedDrivers = drivers.map(driver =>
          driver.id === editingId
            ? { ...driver, ...formData }
            : driver
        );
        setDrivers(updatedDrivers);
        saveDrivers(updatedDrivers);
        console.log('Updated driver:', editingId);
      } else {
        // Create new driver object
        const newDriver = {
          id: drivers.length > 0 ? Math.max(...drivers.map(d => d.id)) + 1 : 1,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          licenseNumber: formData.licenseNumber,
          licenseExpiry: formData.licenseExpiry,
          status: 'Active',
          ridesCompleted: 0
        };

        // Add to local state
        const updatedDrivers = [...drivers, newDriver];
        setDrivers(updatedDrivers);
        saveDrivers(updatedDrivers);
        console.log('Added driver:', newDriver);
      }

      // Clear form and close
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        licenseNumber: '',
        licenseExpiry: ''
      });
      setShowAddDriver(false);
      setEditingId(null);
    } catch (err) {
      alert('Failed to save driver');
      console.error(err);
    }
  };

  const handleEditDriver = (driver) => {
    setFormData({
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: driver.licenseExpiry,
      ridesCompleted: driver.ridesCompleted
    });
    setEditingId(driver.id);
    setShowAddDriver(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      licenseNumber: '',
      licenseExpiry: '',
      ridesCompleted: ''
    });
    setEditingId(null);
    setShowAddDriver(false);
  }

  const handleDeactivateDriver = (id) => {
    if (window.confirm('Are you sure you want to remove this driver?')) {
      // Remove from local state
      const updatedDrivers = drivers.filter(driver => driver.id !== id);
      setDrivers(updatedDrivers);
      
      // Save to localStorage
      saveDrivers(updatedDrivers);
      
      console.log('Removed driver:', id);
    }
  };

  const statusOptions = ['Active', 'On Leave', 'Sick Leave', 'Inactive'];

  const statusColors = {
    'Active': 'bg-green-900 text-green-200',
    'On Leave': 'bg-yellow-900 text-yellow-200',
    'Sick Leave': 'bg-orange-900 text-orange-200',
    'Inactive': 'bg-gray-700 text-gray-300'
  };

  const handleStatusChange = (driverId, newStatus) => {
    const updatedDrivers = drivers.map(driver =>
      driver.id === driverId ? { ...driver, status: newStatus } : driver
    );
    setDrivers(updatedDrivers);
    saveDrivers(updatedDrivers);
    setStatusDropdownId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Drivers Management</h2>
          <p className="mt-1 text-gray-400">Manage your drivers and their information</p>
        </div>
        <button
          onClick={() => setShowAddDriver(!showAddDriver)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Driver
        </button>
      </div>

      {/* Add Driver Form */}
      {showAddDriver && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Driver' : 'Add New Driver'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Juan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dela Cruz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="juan@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="09XX-XXX-XXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">License Number</label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="DL-2024-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">License Expiry</label>
              <input
                type="date"
                name="licenseExpiry"
                value={formData.licenseExpiry}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rides Completed</label>
              <input
                type="number"
                name="ridesCompleted"
                value={formData.ridesCompleted}
                onChange={handleInputChange}
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddDriver}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors"
            >
              {editingId ? 'Update Driver' : 'Add Driver'}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-md p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Drivers List */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <p className="mt-4 text-gray-400">Loading drivers...</p>
          </div>
        ) : drivers.length > 0 ? (
          drivers.map((driver) => (
            <div key={driver.id} className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-blue-500/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-white">
                      {driver.firstName.charAt(0)}{driver.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {driver.firstName} {driver.lastName}
                    </h3>
                    <p className="text-gray-400">{driver.email}</p>
                    <p className="text-sm text-gray-500 mt-2">{driver.phone}</p>
                  </div>
                </div>
                <div className="relative flex items-center space-x-2">
                  <button
                    onClick={() => setStatusDropdownId(statusDropdownId === driver.id ? null : driver.id)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusColors[driver.status] || 'bg-gray-700 text-gray-300'}`}
                  >
                    {driver.status}
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {statusDropdownId === driver.id && (
                    <div className="absolute right-0 top-8 z-10 bg-gray-700 border border-gray-600 rounded-lg shadow-lg py-1 min-w-[140px]">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(driver.id, status)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-600 transition-colors ${
                            driver.status === status ? 'text-blue-400 font-medium' : 'text-gray-200'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Driver Details */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">License Number</p>
                  <p className="text-sm font-medium text-gray-200 mt-1">{driver.licenseNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">License Expiry</p>
                  <p className="text-sm font-medium text-gray-200 mt-1">{driver.licenseExpiry}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Rides Completed</p>
                  <p className="text-sm font-medium text-gray-200 mt-1">{driver.ridesCompleted}</p>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => handleEditDriver(driver)}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeactivateDriver(driver.id)}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded text-white transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-300">No drivers yet</h3>
            <p className="mt-1 text-gray-400">Start by adding your first driver</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessOwnerDrivers;
