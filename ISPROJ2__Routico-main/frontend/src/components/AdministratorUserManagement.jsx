import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const AdministratorUserManagement = () => {
  const { user, getToken, isAdmin } = useAuth();
  const { toast, confirm: confirmDialog } = useToast();
  const [activeView, setActiveView] = useState('pending');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [suspendedUsers, setSuspendedUsers] = useState([]);
  const [userPaymentStatus, setUserPaymentStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [allDrivers, setAllDrivers] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null); // { type: 'driver'|'user', id, name, email }
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUserData();
    fetchAllDrivers();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();

      // Fetch pending users
      const pendingResponse = await fetch('http://localhost:3001/api/auth/pending-users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        setPendingUsers(pendingData);
      }

      // Fetch active users
      const activeResponse = await fetch('http://localhost:3001/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (activeResponse.ok) {
        const activeData = await activeResponse.json();

        // Separate users into different categories
        const businessOwners = activeData.filter(user => user.role === 'business_owner' && user.account_status === 'approved');
        const activeUsersList = businessOwners.filter(user => user.active_status === 'active');
        const suspendedUsersList = businessOwners.filter(user => user.active_status === 'inactive');

        setActiveUsers(activeUsersList);
        setSuspendedUsers(suspendedUsersList);

        // Fetch payment status for all business owners
        const paymentStatusPromises = businessOwners.map(async (businessUser) => {
          const paymentStatus = await getPaymentStatus(businessUser.user_id);
          return { userId: businessUser.user_id, ...paymentStatus };
        });

        const paymentStatuses = await Promise.all(paymentStatusPromises);
        const paymentStatusMap = {};
        paymentStatuses.forEach(status => {
          paymentStatusMap[status.userId] = status;
        });
        setUserPaymentStatus(paymentStatusMap);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to fetch user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDrivers = async () => {
    try {
      const token = getToken();
      const res = await fetch('http://localhost:3001/api/auth/all-drivers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAllDrivers(await res.json());
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const getDriversForOwner = (ownerId) => {
    return allDrivers.filter(d => d.owner_id === ownerId);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      const token = getToken();
      const url = resetPasswordTarget.type === 'driver'
        ? `http://localhost:3001/api/auth/driver/${resetPasswordTarget.id}/reset-password`
        : `http://localhost:3001/api/auth/user/${resetPasswordTarget.id}/reset-password`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        toast.success(`Password reset for ${resetPasswordTarget.name}`);
        setShowResetPasswordModal(false);
        setResetPasswordTarget(null);
        setNewPassword('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const handleToggleDriverStatus = async (driver) => {
    const newStatus = driver.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'deactivate' : 'activate';
    if (!await confirmDialog(`Are you sure you want to ${action} ${driver.first_name} ${driver.last_name}'s account?`)) {
      return;
    }
    try {
      const token = getToken();
      const res = await fetch(`http://localhost:3001/api/auth/driver/${driver.driver_id}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success(`Driver ${action}d successfully`);
        fetchAllDrivers();
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to ${action} driver`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} driver`);
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
        setPendingUsers(prev => prev.filter(user => user.user_id !== userId));
        await fetchUserData();
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
    if (!await confirmDialog('Are you sure you want to reject this user? This action cannot be undone.')) {
      return;
    }

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
        setPendingUsers(prev => prev.filter(user => user.user_id !== userId));
        await fetchUserData();
        toast.success('User rejected successfully!');
      } else {
        const errorData = await response.json();
        toast.error(`Error rejecting user: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Error rejecting user. Please try again.');
    }
  };

  const handleSuspendUser = async (userId, reason) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/user/${userId}/suspend`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: reason
        })
      });

      if (response.ok) {
        await fetchUserData();
        toast.success('User account suspended successfully!');
        setShowSuspendModal(false);
        setSuspendReason('');
        setSelectedUser(null);
      } else {
        const errorData = await response.json();
        toast.error(`Error suspending user: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      toast.error('Error suspending user. Please try again.');
    }
  };

  const handleReactivateUser = async (userId) => {
    if (!await confirmDialog('Are you sure you want to reactivate this user account?')) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/user/${userId}/reactivate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchUserData();
        toast.success('User account reactivated successfully!');
      } else {
        const errorData = await response.json();
        toast.error(`Error reactivating user: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error reactivating user:', error);
      toast.error('Error reactivating user. Please try again.');
    }
  };

  const handleViewDocument = async (userId, userName) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/document/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        const errorData = await response.json();
        toast.error(`Error loading document: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      toast.error('Error loading document. Please try again.');
    }
  };

  const getPaymentStatus = async (userId) => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:3001/api/auth/user/${userId}/payment-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return { status: 'unknown', amount: 0 };
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return { status: 'unknown', amount: 0 };
    }
  };

  const UserCard = ({ user, isPending = false }) => {
    const paymentStatus = userPaymentStatus[user.user_id];
    const isExpanded = expandedUser === user.user_id;
    const ownerDrivers = user.owner_id ? getDriversForOwner(user.owner_id) : [];

    return (
      <div className="rounded-lg overflow-hidden">
        <div
          className={`bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 hover:border-gray-600 transition-colors ${!isPending ? 'cursor-pointer' : ''} ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
          onClick={() => {
            if (!isPending) {
              setExpandedUser(isExpanded ? null : user.user_id);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user.full_name.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {user.full_name}
                  </h3>
                  {!isPending && ownerDrivers.length > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 flex-shrink-0">
                      {ownerDrivers.length} driver{ownerDrivers.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {!isPending && (
                    <svg className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-400 truncate hidden sm:inline">{user.email}</span>
                <span className="text-xs text-gray-500 hidden md:inline">{user.phone}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.account_status === 'approved' ? 'bg-green-900 text-green-200' :
                    user.account_status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
                    'bg-red-900 text-red-200'
                  }`}>
                    {user.account_status}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.active_status === 'active' ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-300'
                  }`}>
                    {user.active_status}
                  </span>
                </div>
                <span className="text-xs text-gray-500 hidden lg:inline flex-shrink-0">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Payment Status & Actions */}
            <div className="flex items-center gap-2 ml-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {isPending ? (
                <>
                  <button
                    onClick={() => handleApproveUser(user.user_id)}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectUser(user.user_id)}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                </>
              ) : (
                <>
                  <div className="text-right mr-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      paymentStatus?.status === 'paid' ? 'bg-green-900 text-green-200' :
                      paymentStatus?.status === 'unpaid' ? 'bg-red-900 text-red-200' :
                      'bg-yellow-900 text-yellow-200'
                    }`}>
                      {paymentStatus?.status === 'paid' ? 'Paid' :
                       paymentStatus?.status === 'unpaid' ? 'Unpaid' :
                       paymentStatus?.status === 'pending' ? 'Pending' :
                       'Unknown'}
                    </span>
                    {paymentStatus?.amount > 0 && (
                      <div className="text-xs text-gray-400">
                        ₱{paymentStatus.amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {user.active_status === 'active' ? (
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowSuspendModal(true);
                      }}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivateUser(user.user_id)}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 transition-colors"
                    >
                      Reactivate
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setResetPasswordTarget({ type: 'user', id: user.user_id, name: user.full_name, email: user.email });
                      setNewPassword('');
                      setShowResetPasswordModal(true);
                    }}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 transition-colors"
                    title="Reset Password"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Reset
                  </button>
                </>
              )}
              <button
                onClick={() => handleViewDocument(user.user_id, user.full_name)}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Document
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Drivers Section */}
        {isExpanded && (
          <div className="bg-gray-800/50 border border-gray-700 border-t-0 rounded-b-lg px-4 pb-3 pt-1">
            <div className="border-t border-gray-700 pt-3">
              <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Drivers ({ownerDrivers.length})
              </h4>
              {ownerDrivers.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No drivers registered for this business owner.</p>
              ) : (
                <div className="space-y-1">
                  {ownerDrivers.map(driver => (
                    <div key={driver.driver_id} className="bg-gray-700/50 rounded px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 bg-purple-900/50 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-purple-300">
                              {driver.first_name?.charAt(0)}{driver.last_name?.charAt(0)}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-white">{driver.first_name} {driver.last_name}</span>
                          <span className="text-xs text-gray-400">{driver.email}</span>
                          {driver.phone && <span className="text-xs text-gray-500">| {driver.phone}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                            driver.status === 'active' ? 'bg-green-900 text-green-200' :
                            driver.status === 'inactive' ? 'bg-gray-600 text-gray-300' :
                            'bg-yellow-900 text-yellow-200'
                          }`}>
                            {driver.status || 'active'}
                          </span>
                          {driver.rides_completed > 0 && (
                            <span className="text-xs text-gray-400">{driver.rides_completed} rides</span>
                          )}
                          <button
                            onClick={() => {
                              setResetPasswordTarget({ type: 'driver', id: driver.driver_id, name: `${driver.first_name} ${driver.last_name}`, email: driver.email });
                              setNewPassword('');
                              setShowResetPasswordModal(true);
                            }}
                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 transition-colors"
                            title="Reset Password"
                          >
                            Reset
                          </button>
                          {(driver.status === 'active' || !driver.status) ? (
                            <button
                              onClick={() => handleToggleDriverStatus(driver)}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded text-red-300 bg-red-900/30 hover:bg-red-900/50 transition-colors"
                              title="Deactivate"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleDriverStatus(driver)}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded text-green-300 bg-green-900/30 hover:bg-green-900/50 transition-colors"
                              title="Activate"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-2xl font-bold text-white">User Management</h2>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveView('pending')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeView === 'pending'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Pending Approvals ({pendingUsers.length})
        </button>
        <button
          onClick={() => setActiveView('active')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeView === 'active'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Active Accounts ({activeUsers.length})
        </button>
        <button
          onClick={() => setActiveView('suspended')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeView === 'suspended'
              ? 'bg-red-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Suspended ({suspendedUsers.length})
        </button>
      </div>

      {/* Content */}
      {activeView === 'pending' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Pending Business Owner Approvals</h3>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-white">No pending approvals</h3>
              <p className="mt-1 text-sm text-gray-400">All business owner applications have been reviewed.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingUsers.map((pendingUser) => (
                <UserCard key={pendingUser.user_id} user={pendingUser} isPending={true} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'active' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Active Business Accounts</h3>
          <p className="text-sm text-gray-400">Click on a business owner to view their drivers.</p>
          {activeUsers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-white">No active business accounts</h3>
              <p className="mt-1 text-sm text-gray-400">No business owners have been approved yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeUsers.map((activeUser) => (
                <UserCard key={activeUser.user_id} user={activeUser} isPending={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'suspended' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Suspended Business Accounts</h3>
          <p className="text-sm text-gray-400">Click on a business owner to view their drivers.</p>
          {suspendedUsers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-white">No suspended accounts</h3>
              <p className="mt-1 text-sm text-gray-400">All business accounts are currently active.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suspendedUsers.map((suspendedUser) => (
                <UserCard key={suspendedUser.user_id} user={suspendedUser} isPending={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suspension Modal */}
      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-2 px-7 py-3">
                <h3 className="text-lg font-medium text-white text-center">
                  Suspend Account
                </h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-300 text-center">
                    Are you sure you want to suspend <strong>{selectedUser.full_name}</strong>'s account?
                  </p>
                  <p className="text-sm text-gray-400 text-center mt-2">
                    This will restrict their dashboard access and they will see an inactive account message.
                  </p>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reason for suspension:
                  </label>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Enter reason for suspension (e.g., Late payment, Violation of terms, etc.)"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows={3}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-center space-x-4 px-4 py-3">
                <button
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSuspendReason('');
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSuspendUser(selectedUser.user_id, suspendReason)}
                  disabled={!suspendReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suspend Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordTarget && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-900/50 rounded-full">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="mt-2 px-7 py-3">
                <h3 className="text-lg font-medium text-white text-center">
                  Reset Driver Password
                </h3>
                <p className="text-sm text-gray-300 text-center mt-2">
                  Set a new password for <strong>{resetPasswordTarget.name}</strong>
                </p>
                <p className="text-xs text-gray-400 text-center mt-1">
                  {resetPasswordTarget.email}
                </p>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-center space-x-4 px-4 py-3">
                <button
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordTarget(null);
                    setNewPassword('');
                  }}
                  className="px-4 py-2 bg-gray-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6}
                  className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministratorUserManagement;
