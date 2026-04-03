import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const API_BASE = 'http://localhost:3001/api';

const VEHICLE_TYPES = ['Truck', 'Van', 'Motorcycle', 'Sedan', 'SUV', 'Pickup', 'Trailer', 'Refrigerated Truck'];
const FUEL_TYPES = ['Diesel', 'Gasoline', 'Electric', 'Hybrid', 'LPG'];
const VEHICLE_STATUSES = ['active', 'inactive', 'maintenance', 'retired'];
const MAINTENANCE_TYPES = ['Oil Change', 'Tire Replacement', 'Brake Service', 'Engine Repair', 'Transmission', 'Battery Replacement', 'AC Service', 'General Inspection', 'Body Repair', 'Electrical', 'Other'];

const BusinessOwnerFleet = () => {
  const { getToken } = useAuth();
  const { toast, confirm } = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('vehicles'); // vehicles | maintenance
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mechanics, setMechanics] = useState([]);
  const [partnerShops, setPartnerShops] = useState([]);
  const [showMechanicsModal, setShowMechanicsModal] = useState(false);
  const [showShopsModal, setShowShopsModal] = useState(false);
  const [newMechanicName, setNewMechanicName] = useState('');
  const [newMechanicPhone, setNewMechanicPhone] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [performedByType, setPerformedByType] = useState('');

  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    plate_number: '', model: '', capacity: '', status: 'active',
    vehicle_type: 'Truck', fuel_type: 'Diesel', year: '',
    mileage: '', insurance_expiry: '', registration_expiry: '',
    assigned_driver_id: '', notes: ''
  });

  // Maintenance form state
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: 'Oil Change', description: '', cost: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    next_due_date: '', mileage_at_service: '', performed_by: '', status: 'scheduled'
  });

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  }), [getToken]);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vehicles`, { headers: headers() });
      if (res.ok) setVehicles(await res.json());
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      setError('Failed to load vehicles');
    }
  }, [headers]);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/drivers`, { headers: headers() });
      if (res.ok) setDrivers(await res.json());
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  }, [headers]);

  const fetchMechanics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vehicles/mechanics`, { headers: headers() });
      if (res.ok) setMechanics(await res.json());
    } catch (err) {
      console.error('Error fetching mechanics:', err);
    }
  }, [headers]);

  const fetchPartnerShops = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/vehicles/partner-shops`, { headers: headers() });
      if (res.ok) setPartnerShops(await res.json());
    } catch (err) {
      console.error('Error fetching partner shops:', err);
    }
  }, [headers]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchVehicles(), fetchDrivers(), fetchMechanics(), fetchPartnerShops()]);
      setLoading(false);
    };
    loadData();
  }, [fetchVehicles, fetchDrivers, fetchMechanics, fetchPartnerShops]);

  const openAddModal = () => {
    setModalMode('add');
    setVehicleForm({
      plate_number: '', model: '', capacity: '', status: 'active',
      vehicle_type: 'Truck', fuel_type: 'Diesel', year: '',
      mileage: '', insurance_expiry: '', registration_expiry: '',
      assigned_driver_id: '', notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (vehicle) => {
    setModalMode('edit');
    setSelectedVehicle(vehicle);
    setVehicleForm({
      plate_number: vehicle.plate_number || '',
      model: vehicle.model || '',
      capacity: vehicle.capacity || '',
      status: vehicle.status || 'active',
      vehicle_type: vehicle.vehicle_type || 'Truck',
      fuel_type: vehicle.fuel_type || 'Diesel',
      year: vehicle.year || '',
      mileage: vehicle.mileage || '',
      insurance_expiry: vehicle.insurance_expiry ? vehicle.insurance_expiry.split('T')[0] : '',
      registration_expiry: vehicle.registration_expiry ? vehicle.registration_expiry.split('T')[0] : '',
      assigned_driver_id: vehicle.assigned_driver_id || '',
      notes: vehicle.notes || ''
    });
    setShowModal(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    try {
      const url = modalMode === 'add' ? `${API_BASE}/vehicles` : `${API_BASE}/vehicles/${selectedVehicle.truck_id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(vehicleForm) });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save vehicle');
        return;
      }
      setShowModal(false);
      fetchVehicles();
      toast.success(modalMode === 'add' ? 'Vehicle added successfully' : 'Vehicle updated successfully');
    } catch (err) {
      toast.error('Failed to save vehicle');
    }
  };

  const handleDeleteVehicle = async (truckId) => {
    if (!(await confirm('Are you sure you want to delete this vehicle?'))) return;
    try {
      const res = await fetch(`${API_BASE}/vehicles/${truckId}`, { method: 'DELETE', headers: headers() });
      if (res.ok) {
        fetchVehicles();
        toast.success('Vehicle deleted successfully');
      }
    } catch (err) {
      toast.error('Failed to delete vehicle');
    }
  };

  const openAssignModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowAssignModal(true);
  };

  const handleAssignDriver = async (driverId) => {
    try {
      const res = await fetch(`${API_BASE}/vehicles/${selectedVehicle.truck_id}/assign-driver`, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ driver_id: driverId || null })
      });
      if (res.ok) {
        setShowAssignModal(false);
        fetchVehicles();
        toast.success('Driver assignment updated');
      }
    } catch (err) {
      toast.error('Failed to assign driver');
    }
  };

  const handleAddMechanic = async () => {
    if (!newMechanicName.trim()) { toast.warning('Please enter a mechanic name'); return; }
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(newMechanicName.trim())) { toast.warning('Mechanic name must contain only letters'); return; }
    if (!newMechanicPhone.trim()) { toast.warning('Please enter a phone number'); return; }
    if (!/^\+63\d{10}$/.test(newMechanicPhone.trim())) { toast.warning('Please enter a valid Philippine phone number (e.g., +639171234567)'); return; }
    try {
      const res = await fetch(`${API_BASE}/vehicles/mechanics`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ name: newMechanicName.trim(), phone: newMechanicPhone.trim() || null })
      });
      if (res.ok) {
        await fetchMechanics();
        setNewMechanicName('');
        setNewMechanicPhone('');
        toast.success('Mechanic added');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add mechanic');
      }
    } catch (err) { toast.error('Failed to add mechanic'); }
  };

  const handleDeleteMechanic = async (mechanicId) => {
    if (!(await confirm('Remove this mechanic?'))) return;
    try {
      const res = await fetch(`${API_BASE}/vehicles/mechanics/${mechanicId}`, { method: 'DELETE', headers: headers() });
      if (res.ok) {
        await fetchMechanics();
        toast.success('Mechanic removed');
      }
    } catch (err) { toast.error('Failed to remove mechanic'); }
  };

  const handleAddShop = async () => {
    if (!newShopName.trim()) { toast.warning('Please enter a shop name'); return; }
    const shopNameRegex = /^[a-zA-Z0-9\s'.\-&]+$/;
    if (!shopNameRegex.test(newShopName.trim())) { toast.warning('Shop name contains invalid characters'); return; }
    if (!newShopAddress.trim()) { toast.warning('Please enter a shop address'); return; }
    if (!newShopPhone.trim()) { toast.warning('Please enter a phone number'); return; }
    if (!/^\+63\d{10}$/.test(newShopPhone.trim())) { toast.warning('Please enter a valid Philippine phone number (e.g., +639171234567)'); return; }
    try {
      const res = await fetch(`${API_BASE}/vehicles/partner-shops`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ name: newShopName.trim(), address: newShopAddress.trim() || null, phone: newShopPhone.trim() || null })
      });
      if (res.ok) {
        await fetchPartnerShops();
        setNewShopName(''); setNewShopAddress(''); setNewShopPhone('');
        toast.success('Partner shop added');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add shop');
      }
    } catch (err) { toast.error('Failed to add partner shop'); }
  };

  const handleDeleteShop = async (shopId) => {
    if (!(await confirm('Remove this partner shop?'))) return;
    try {
      const res = await fetch(`${API_BASE}/vehicles/partner-shops/${shopId}`, { method: 'DELETE', headers: headers() });
      if (res.ok) {
        await fetchPartnerShops();
        toast.success('Partner shop removed');
      }
    } catch (err) { toast.error('Failed to remove partner shop'); }
  };

  const openMaintenanceModal = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setPerformedByType('');
    setMaintenanceForm({
      maintenance_type: 'Oil Change', description: '', cost: '',
      maintenance_date: new Date().toISOString().split('T')[0],
      next_due_date: '', mileage_at_service: vehicle.mileage || '', performed_by: '', status: 'scheduled'
    });
    try {
      const res = await fetch(`${API_BASE}/vehicles/${vehicle.truck_id}/maintenance`, { headers: headers() });
      if (res.ok) setMaintenanceRecords(await res.json());
    } catch (err) {
      console.error('Error fetching maintenance:', err);
    }
    setShowMaintenanceModal(true);
  };

  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/vehicles/${selectedVehicle.truck_id}/maintenance`, {
        method: 'POST', headers: headers(), body: JSON.stringify(maintenanceForm)
      });
      if (res.ok) {
        const updatedRes = await fetch(`${API_BASE}/vehicles/${selectedVehicle.truck_id}/maintenance`, { headers: headers() });
        if (updatedRes.ok) setMaintenanceRecords(await updatedRes.json());
        setMaintenanceForm({
          maintenance_type: 'Oil Change', description: '', cost: '',
          maintenance_date: new Date().toISOString().split('T')[0],
          next_due_date: '', mileage_at_service: '', performed_by: '', status: 'scheduled'
        });
        setPerformedByType('');
        fetchVehicles();
        toast.success('Maintenance record added');
      }
    } catch (err) {
      toast.error('Failed to save maintenance record');
    }
  };

  const handleUpdateMaintenanceStatus = async (maintenanceId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/vehicles/maintenance/${maintenanceId}`, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setMaintenanceRecords(prev => prev.map(r => r.maintenance_id === maintenanceId ? { ...r, status: newStatus } : r));
        fetchVehicles();
        toast.success(`Status updated to ${newStatus}`);
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteMaintenance = async (maintenanceId) => {
    if (!(await confirm('Delete this maintenance record?'))) return;
    try {
      const res = await fetch(`${API_BASE}/vehicles/maintenance/${maintenanceId}`, { method: 'DELETE', headers: headers() });
      if (res.ok) {
        setMaintenanceRecords(prev => prev.filter(r => r.maintenance_id !== maintenanceId));
        toast.success('Maintenance record deleted');
      }
    } catch (err) {
      toast.error('Failed to delete maintenance record');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'maintenance': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'retired': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getMaintenanceStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'scheduled': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  // Compute maintenance alert level for a vehicle
  const getMaintenanceAlert = (vehicle) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (vehicle.next_maintenance_date) {
      const nextDate = new Date(vehicle.next_maintenance_date);
      nextDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        return { level: 'overdue', label: `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''}`, color: 'red', icon: 'exclamation' };
      }
      if (daysUntil === 0) {
        return { level: 'due_today', label: 'Maintenance due today', color: 'red', icon: 'exclamation' };
      }
      if (daysUntil <= 7) {
        return { level: 'due_soon', label: `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`, color: 'yellow', icon: 'clock' };
      }
      if (daysUntil <= 30) {
        return { level: 'upcoming', label: `Due in ${daysUntil} days`, color: 'blue', icon: 'calendar' };
      }
      return { level: 'ok', label: `Next: ${nextDate.toLocaleDateString()}`, color: 'green', icon: 'check' };
    }

    if (vehicle.last_maintenance_date) {
      const lastDate = new Date(vehicle.last_maintenance_date);
      const daysSince = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) {
        return { level: 'no_schedule', label: `Last service ${daysSince} days ago`, color: 'yellow', icon: 'clock' };
      }
      return { level: 'ok', label: `Last: ${lastDate.toLocaleDateString()}`, color: 'gray', icon: 'check' };
    }

    return { level: 'none', label: 'No maintenance records', color: 'gray', icon: 'none' };
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = !searchQuery ||
      v.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicle_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${v.driver_first_name || ''} ${v.driver_last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const needsAttention = vehicles.filter(v => {
    const alert = getMaintenanceAlert(v);
    return alert.level === 'overdue' || alert.level === 'due_today' || alert.level === 'due_soon';
  }).length;
  const assignedVehicles = vehicles.filter(v => v.assigned_driver_id).length;

  const inputClass = "w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white text-sm focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading fleet data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Vehicles</p>
              <p className="text-2xl font-bold text-white">{totalVehicles}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-2xl font-bold text-white">{activeVehicles}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${needsAttention > 0 ? 'bg-red-500/15' : 'bg-yellow-500/15'}`}>
              {needsAttention > 0 ? (
                <svg className="w-6 h-6 text-red-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Needs Attention</p>
              <p className={`text-2xl font-bold ${needsAttention > 0 ? 'text-red-400' : 'text-white'}`}>{needsAttention}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-5">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Assigned</p>
              <p className="text-2xl font-bold text-white">{assignedVehicles}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
            >
              <option value="all">All Status</option>
              {VEHICLE_STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowShopsModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors border border-gray-600"
          >
            Partner Shops
          </button>
          <button
            onClick={() => setShowMechanicsModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors border border-gray-600"
          >
            Mechanics
          </button>
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Vehicle
          </button>
        </div>
      </div>

      {/* Vehicle Cards */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800/60 rounded-2xl p-12 text-center">
          <svg className="mx-auto w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-gray-300">No vehicles found</h3>
          <p className="mt-1 text-xs text-gray-500">Add your first vehicle to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVehicles.map(vehicle => (
            <div key={vehicle.truck_id} className="bg-[#111827] border border-gray-800/60 rounded-2xl overflow-hidden hover:border-gray-700/80 transition-colors">
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-gray-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{vehicle.plate_number}</h4>
                      <p className="text-xs text-gray-500">{vehicle.model || 'No model'}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Type</span>
                    <p className="text-gray-300 font-medium">{vehicle.vehicle_type || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Fuel</span>
                    <p className="text-gray-300 font-medium">{vehicle.fuel_type || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Capacity</span>
                    <p className="text-gray-300 font-medium">{vehicle.capacity ? `${vehicle.capacity} kg` : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Mileage</span>
                    <p className="text-gray-300 font-medium">{vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} km` : 'N/A'}</p>
                  </div>
                </div>

                {/* Driver Assignment */}
                <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs text-gray-400">
                      {vehicle.assigned_driver_id
                        ? `${vehicle.driver_first_name} ${vehicle.driver_last_name}`
                        : 'Unassigned'}
                    </span>
                  </div>
                  <button
                    onClick={() => openAssignModal(vehicle)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {vehicle.assigned_driver_id ? 'Reassign' : 'Assign'}
                  </button>
                </div>

                {/* Maintenance Alert */}
                {(() => {
                  const alert = getMaintenanceAlert(vehicle);
                  const colorMap = {
                    red: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', icon: 'text-red-400' },
                    yellow: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', icon: 'text-yellow-400' },
                    blue: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', icon: 'text-blue-400' },
                    green: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', icon: 'text-green-400' },
                    gray: { bg: 'bg-gray-800/30 border-gray-700/30', text: 'text-gray-500', icon: 'text-gray-500' },
                  };
                  const colors = colorMap[alert.color];
                  return (
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${colors.bg}`}>
                      {alert.icon === 'exclamation' && (
                        <svg className={`w-4 h-4 flex-shrink-0 ${colors.icon} ${alert.level === 'overdue' || alert.level === 'due_today' ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      {alert.icon === 'clock' && (
                        <svg className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {alert.icon === 'calendar' && (
                        <svg className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                      {alert.icon === 'check' && (
                        <svg className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {alert.icon === 'none' && (
                        <svg className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      <span className={`text-xs font-medium ${colors.text}`}>{alert.label}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Card Actions */}
              <div className="px-5 py-3 bg-gray-800/20 border-t border-gray-800/40 flex items-center gap-2">
                <button onClick={() => openEditModal(vehicle)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit
                </button>
                <button onClick={() => openMaintenanceModal(vehicle)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Maintenance
                </button>
                <button onClick={() => handleDeleteVehicle(vehicle.truck_id)} className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== ADD/EDIT VEHICLE MODAL ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#111827] border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-[#111827] z-10">
              <h3 className="text-lg font-semibold text-white">{modalMode === 'add' ? 'Add Vehicle' : 'Edit Vehicle'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSaveVehicle} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Plate Number *</label>
                  <input type="text" required value={vehicleForm.plate_number} onChange={e => setVehicleForm(f => ({...f, plate_number: e.target.value}))} className={inputClass} placeholder="ABC 1234" />
                </div>
                <div>
                  <label className={labelClass}>Model</label>
                  <input type="text" value={vehicleForm.model} onChange={e => setVehicleForm(f => ({...f, model: e.target.value}))} className={inputClass} placeholder="e.g. Isuzu NLR" />
                </div>
                <div>
                  <label className={labelClass}>Vehicle Type</label>
                  <select value={vehicleForm.vehicle_type} onChange={e => setVehicleForm(f => ({...f, vehicle_type: e.target.value}))} className={inputClass}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Fuel Type</label>
                  <select value={vehicleForm.fuel_type} onChange={e => setVehicleForm(f => ({...f, fuel_type: e.target.value}))} className={inputClass}>
                    {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Year</label>
                  <input type="number" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({...f, year: e.target.value}))} className={inputClass} placeholder="2024" min="1990" max="2030" />
                </div>
                <div>
                  <label className={labelClass}>Capacity (kg)</label>
                  <input type="number" value={vehicleForm.capacity} onChange={e => setVehicleForm(f => ({...f, capacity: e.target.value}))} className={inputClass} placeholder="5000" />
                </div>
                <div>
                  <label className={labelClass}>Mileage (km)</label>
                  <input type="number" value={vehicleForm.mileage} onChange={e => setVehicleForm(f => ({...f, mileage: e.target.value}))} className={inputClass} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={vehicleForm.status} onChange={e => setVehicleForm(f => ({...f, status: e.target.value}))} className={inputClass}>
                    {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Insurance Expiry</label>
                  <input type="date" value={vehicleForm.insurance_expiry} onChange={e => setVehicleForm(f => ({...f, insurance_expiry: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Registration Expiry</label>
                  <input type="date" value={vehicleForm.registration_expiry} onChange={e => setVehicleForm(f => ({...f, registration_expiry: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Assign Driver</label>
                  <select value={vehicleForm.assigned_driver_id} onChange={e => setVehicleForm(f => ({...f, assigned_driver_id: e.target.value}))} className={inputClass}>
                    <option value="">No driver assigned</option>
                    {drivers.filter(d => d.status === 'active').map(d => (
                      <option key={d.driver_id} value={d.driver_id}>{d.first_name} {d.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={vehicleForm.notes} onChange={e => setVehicleForm(f => ({...f, notes: e.target.value}))} className={`${inputClass} h-20 resize-none`} placeholder="Additional notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">{modalMode === 'add' ? 'Add Vehicle' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ASSIGN DRIVER MODAL ==================== */}
      {showAssignModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-[#111827] border border-gray-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Assign Driver to {selectedVehicle.plate_number}</h3>
            </div>
            <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
              <button onClick={() => handleAssignDriver(null)} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <span className="text-sm text-gray-400">Unassign driver</span>
              </button>
              {drivers.filter(d => d.status === 'active').map(driver => (
                <button
                  key={driver.driver_id}
                  onClick={() => handleAssignDriver(driver.driver_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    selectedVehicle.assigned_driver_id === driver.driver_id
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-blue-400">{driver.first_name?.charAt(0)}{driver.last_name?.charAt(0)}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{driver.first_name} {driver.last_name}</p>
                    <p className="text-xs text-gray-500">{driver.email}</p>
                  </div>
                  {selectedVehicle.assigned_driver_id === driver.driver_id && (
                    <span className="ml-auto text-xs text-blue-400">Current</span>
                  )}
                </button>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-700">
              <button onClick={() => setShowAssignModal(false)} className="w-full px-4 py-2 text-sm font-medium text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MAINTENANCE MODAL ==================== */}
      {showMaintenanceModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowMaintenanceModal(false)}>
          <div className="bg-[#111827] border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-[#111827] z-10">
              <div>
                <h3 className="text-lg font-semibold text-white">Maintenance - {selectedVehicle.plate_number}</h3>
                <p className="text-xs text-gray-500">{selectedVehicle.model}</p>
              </div>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add Maintenance Form */}
              <div className="bg-gray-800/30 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Add Maintenance Record</h4>
                <form onSubmit={handleSaveMaintenance} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Type *</label>
                      <select value={maintenanceForm.maintenance_type} onChange={e => setMaintenanceForm(f => ({...f, maintenance_type: e.target.value}))} className={inputClass}>
                        {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <select value={maintenanceForm.status} onChange={e => setMaintenanceForm(f => ({...f, status: e.target.value}))} className={inputClass}>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Date *</label>
                      <input type="date" required value={maintenanceForm.maintenance_date} onChange={e => setMaintenanceForm(f => ({...f, maintenance_date: e.target.value}))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Next Due Date</label>
                      <input type="date" value={maintenanceForm.next_due_date} onChange={e => setMaintenanceForm(f => ({...f, next_due_date: e.target.value}))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Cost</label>
                      <input type="number" step="0.01" value={maintenanceForm.cost} onChange={e => setMaintenanceForm(f => ({...f, cost: e.target.value}))} className={inputClass} placeholder="0.00" />
                    </div>
                    <div>
                      <label className={labelClass}>Mileage at Service</label>
                      <input type="number" value={maintenanceForm.mileage_at_service} onChange={e => setMaintenanceForm(f => ({...f, mileage_at_service: e.target.value}))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Performed By — Type</label>
                      <select value={performedByType} onChange={e => { setPerformedByType(e.target.value); setMaintenanceForm(f => ({...f, performed_by: ''})); }} className={inputClass}>
                        <option value="">Select type...</option>
                        <option value="partner_shop">Partner Shop</option>
                        <option value="in_house">In-house Mechanic</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Performed By — Name</label>
                      {performedByType === 'partner_shop' ? (
                        <select value={maintenanceForm.performed_by} onChange={e => setMaintenanceForm(f => ({...f, performed_by: e.target.value}))} className={inputClass}>
                          <option value="">Select a shop...</option>
                          {partnerShops.filter(s => s.status === 'active').map(s => <option key={s.shop_id} value={s.name}>{s.name}</option>)}
                        </select>
                      ) : performedByType === 'in_house' ? (
                        <select value={maintenanceForm.performed_by} onChange={e => setMaintenanceForm(f => ({...f, performed_by: e.target.value}))} className={inputClass}>
                          <option value="">Select a mechanic...</option>
                          {mechanics.filter(m => m.status === 'active').map(m => <option key={m.mechanic_id} value={m.name}>{m.name}</option>)}
                        </select>
                      ) : (
                        <select disabled className={inputClass}><option>Select a type first...</option></select>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea value={maintenanceForm.description} onChange={e => setMaintenanceForm(f => ({...f, description: e.target.value}))} className={`${inputClass} h-16 resize-none`} placeholder="Details about the maintenance..." />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors">Add Record</button>
                  </div>
                </form>
              </div>

              {/* Maintenance History */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Maintenance History</h4>
                {maintenanceRecords.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">No maintenance records yet.</p>
                ) : (
                  <div className="space-y-2">
                    {maintenanceRecords.map(record => (
                      <div key={record.maintenance_id} className="bg-gray-800/30 rounded-lg px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{record.maintenance_type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={record.status}
                              onChange={e => handleUpdateMaintenanceStatus(record.maintenance_id, e.target.value)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-600 bg-gray-700 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="scheduled" className="bg-gray-800 text-yellow-400">Scheduled</option>
                              <option value="in_progress" className="bg-gray-800 text-blue-400">In Progress</option>
                              <option value="completed" className="bg-gray-800 text-green-400">Completed</option>
                              <option value="cancelled" className="bg-gray-800 text-red-400">Cancelled</option>
                            </select>
                            <button onClick={() => handleDeleteMaintenance(record.maintenance_id)} className="text-red-400 hover:text-red-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{new Date(record.maintenance_date).toLocaleDateString()}</span>
                          {record.cost > 0 && <span>₱{Number(record.cost).toLocaleString()}</span>}
                          {record.mileage_at_service > 0 && <span>{Number(record.mileage_at_service).toLocaleString()} km</span>}
                        </div>
                        {record.performed_by && (
                          <div className="mt-1 text-xs text-blue-400">
                            Performed by: {record.performed_by}
                          </div>
                        )}
                        {record.description && <p className="text-xs text-gray-400 mt-1">{record.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Manage Partner Shops Modal */}
      {showShopsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">Manage Partner Shops</h3>
              <button onClick={() => setShowShopsModal(false)} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Add new shop */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={newShopName}
                  onChange={e => setNewShopName(e.target.value)}
                  placeholder="Shop name"
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newShopAddress}
                    onChange={e => setNewShopAddress(e.target.value)}
                    placeholder="Address"
                    className="flex-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    value={newShopPhone}
                    onChange={e => setNewShopPhone(e.target.value)}
                    placeholder="Phone (+639XXXXXXXXX)"
                    className="w-36 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button onClick={handleAddShop} className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Add Shop</button>
              </div>
              {/* Shops list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {partnerShops.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No partner shops added yet.</p>
                ) : partnerShops.map(s => (
                  <div key={s.shop_id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      {s.address && <p className="text-xs text-gray-400">{s.address}</p>}
                      {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                    </div>
                    <button onClick={() => handleDeleteShop(s.shop_id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Mechanics Modal */}
      {showMechanicsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">Manage In-house Mechanics</h3>
              <button onClick={() => setShowMechanicsModal(false)} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Add new mechanic */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMechanicName}
                  onChange={e => setNewMechanicName(e.target.value)}
                  placeholder="Mechanic name"
                  className="flex-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  value={newMechanicPhone}
                  onChange={e => setNewMechanicPhone(e.target.value)}
                  placeholder="Phone (+639XXXXXXXXX)"
                  className="w-36 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handleAddMechanic} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Add</button>
              </div>
              {/* Mechanics list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {mechanics.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No mechanics added yet.</p>
                ) : mechanics.map(m => (
                  <div key={m.mechanic_id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                    </div>
                    <button onClick={() => handleDeleteMechanic(m.mechanic_id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerFleet;
