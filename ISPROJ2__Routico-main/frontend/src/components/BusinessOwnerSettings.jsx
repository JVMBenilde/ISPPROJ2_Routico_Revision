import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const BusinessOwnerSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Initialize with simple defaults first
  const [settings, setSettings] = useState({
    companyName: 'Routico Transport Co.',
    companyEmail: 'company@routico.com',
    companyPhone: '+63 2 1234 5678',
    companyAddress: '123 Transport St, Manila, Philippines',
    companyLogo: null,
    primaryColor: '#3B82F6',
    accentColor: '#06B6D4',
    timezone: 'Asia/Manila',
    currency: 'PHP',
    notificationsEnabled: true,
    emailNotifications: true,
    smsNotifications: false,
    maintenanceReminders: true,
    invoicePrefix: 'INV',
    taxRate: 12
  });

  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('company');

  // Load saved settings from localStorage on component mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('routicoSettings');
      const savedLogo = localStorage.getItem('companyLogo');
      const savedName = localStorage.getItem('companyName');

      if (savedSettings) {
        setSettings(prev => ({
          ...JSON.parse(savedSettings),
          companyLogo: savedLogo || null,
          companyName: savedName || JSON.parse(savedSettings).companyName
        }));
      } else if (savedLogo || savedName) {
        // Load individual items if full settings not saved
        setSettings(prev => ({
          ...prev,
          companyLogo: savedLogo || null,
          companyName: savedName || prev.companyName
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log(`Input change: ${name} = ${value}`);
    setSettings(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      console.log('Updated settings:', updated);
      return updated;
    });
    setSaved(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.warning('Please upload an image file');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setSettings(prev => ({
        ...prev,
        companyLogo: event.target.result
      }));
      setSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setSettings(prev => ({
      ...prev,
      companyLogo: null
    }));
    setSaved(false);
  };

  const handleSaveSettings = () => {
    try {
      // Create a copy without the logo for JSON storage
      const settingsToSave = { ...settings };
      delete settingsToSave.companyLogo;
      
      // Save settings
      localStorage.setItem('routicoSettings', JSON.stringify(settingsToSave));
      
      // Save or remove logo
      if (settings.companyLogo) {
        localStorage.setItem('companyLogo', settings.companyLogo);
      } else {
        localStorage.removeItem('companyLogo');
      }
      
      // Save company name
      localStorage.setItem('companyName', settings.companyName);
      
      // Show success message
      setSaved(true);
      console.log('Settings saved successfully');
      
      // Dispatch custom events for real-time updates
      window.dispatchEvent(new CustomEvent('logoUpdated', { 
        detail: { logo: settings.companyLogo, companyName: settings.companyName } 
      }));
      
      window.dispatchEvent(new CustomEvent('settingsUpdated', { 
        detail: { settings } 
      }));
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const sections = [
    { id: 'company', label: 'Company Info', icon: 'building' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'billing', label: 'Billing Settings', icon: 'credit-card' }
  ];

  const getIcon = (iconType) => {
    switch (iconType) {
      case 'building':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4 0h1m-1-4h1m4 0h1m-1-4h1" />
          </svg>
        );
      case 'palette':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        );
      case 'bell':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      case 'credit-card':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-gray-400">Customize your Routico experience</p>
      </div>

      {/* Save Notification */}
      {saved && (
        <div className="bg-green-900 border border-green-700 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-200">Settings saved successfully!</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="flex-shrink-0">{getIcon(section.icon)}</span>
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            {/* Company Information Section */}
            {activeSection === 'company' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Company Information</h3>
                </div>

                {/* Company Logo Section */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-6">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-4">Company Logo</h4>
                    <p className="text-sm text-gray-400 mb-4">Upload your company logo to personalize the dashboard. Supported formats: PNG, JPG, SVG (max 5MB)</p>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    {/* Logo Preview */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-32 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center overflow-hidden">
                        {settings.companyLogo ? (
                          <img 
                            src={settings.companyLogo} 
                            alt="Company Logo" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-xs text-gray-400 mt-2">No logo</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload Controls */}
                    <div className="flex-1">
                      <label className="block">
                        <div className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 cursor-pointer transition-colors">
                          <div className="text-center">
                            <svg className="mx-auto h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="text-sm text-gray-300 mt-2">Click to upload logo</p>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {settings.companyLogo && (
                        <button
                          onClick={removeLogo}
                          className="mt-3 w-full px-3 py-2 text-sm border border-red-600 rounded-md text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                    <input
                      type="text"
                      name="companyName"
                      value={settings.companyName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Contact Email</label>
                    <input
                      type="email"
                      name="companyEmail"
                      value={settings.companyEmail}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                    <input
                      type="tel"
                      name="companyPhone"
                      value={settings.companyPhone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                    <select
                      name="timezone"
                      value={settings.timezone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Asia/Manila</option>
                      <option>Asia/Bangkok</option>
                      <option>Asia/Singapore</option>
                      <option>Asia/Hong_Kong</option>
                      <option>UTC</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Company Address</label>
                  <textarea
                    name="companyAddress"
                    value={settings.companyAddress}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Appearance Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        name="primaryColor"
                        value={settings.primaryColor}
                        onChange={handleInputChange}
                        className="w-12 h-12 rounded border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Accent Color</label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        name="accentColor"
                        value={settings.accentColor}
                        onChange={handleInputChange}
                        className="w-12 h-12 rounded border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.accentColor}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <p className="text-sm text-gray-400">
                    Color customization is currently in preview. Changes will take effect across all pages on next refresh.
                  </p>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Notification Preferences</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <div>
                      <p className="font-medium text-white">Enable Notifications</p>
                      <p className="text-sm text-gray-400">Receive alerts about orders and system updates</p>
                    </div>
                    <input
                      type="checkbox"
                      name="notificationsEnabled"
                      checked={settings.notificationsEnabled}
                      onChange={handleInputChange}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {settings.notificationsEnabled && (
                    <>
                      <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                        <div>
                          <p className="font-medium text-white">Email Notifications</p>
                          <p className="text-sm text-gray-400">Get notified via email for important events</p>
                        </div>
                        <input
                          type="checkbox"
                          name="emailNotifications"
                          checked={settings.emailNotifications}
                          onChange={handleInputChange}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                        <div>
                          <p className="font-medium text-white">SMS Notifications</p>
                          <p className="text-sm text-gray-400">Receive SMS alerts for time-sensitive updates</p>
                        </div>
                        <input
                          type="checkbox"
                          name="smsNotifications"
                          checked={settings.smsNotifications}
                          onChange={handleInputChange}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                        <div>
                          <p className="font-medium text-white">Maintenance Reminders</p>
                          <p className="text-sm text-gray-400">Get reminders for vehicle maintenance schedules</p>
                        </div>
                        <input
                          type="checkbox"
                          name="maintenanceReminders"
                          checked={settings.maintenanceReminders}
                          onChange={handleInputChange}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Billing Section */}
            {activeSection === 'billing' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Billing Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                    <select
                      name="currency"
                      value={settings.currency}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>PHP</option>
                      <option>USD</option>
                      <option>EUR</option>
                      <option>SGD</option>
                      <option>THB</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tax Rate (%)</label>
                    <input
                      type="number"
                      name="taxRate"
                      value={settings.taxRate}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Invoice Prefix</label>
                    <input
                      type="text"
                      name="invoicePrefix"
                      value={settings.invoicePrefix}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="INV"
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <p className="text-sm text-gray-400">
                    Billing settings will be reflected in your invoices and financial reports.
                  </p>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-700">
              <button
                className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 transition-colors"
                onClick={() => {
                  // Reset to original settings
                  setActiveSection('company');
                }}
              >
                Reset
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors font-medium"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessOwnerSettings;
