import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const AdministratorPaymentReview = () => {
  const { user, getToken } = useAuth();
  const { toast, confirm: confirmDialog } = useToast();
  const [activeTab, setActiveTab] = useState('all-accounts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Data states
  const [businessOwners, setBusinessOwners] = useState([]);
  const [pendingStatements, setPendingStatements] = useState([]);
  const [overdueAccounts, setOverdueAccounts] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerStatements, setOwnerStatements] = useState([]);
  const [selectedStatements, setSelectedStatements] = useState([]);

  useEffect(() => {
    fetchData();

    const handleBillingUpdate = () => fetchData();
    window.addEventListener('billingUpdated', handleBillingUpdate);
    return () => window.removeEventListener('billingUpdated', handleBillingUpdate);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      
      const [ownersRes, pendingRes, overdueRes] = await Promise.all([
        fetch('/api/auth/admin/business-owners/billing', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/auth/admin/billing-statements/pending', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/auth/admin/billing-statements/overdue-accounts', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (ownersRes.ok) {
        const ownersData = await ownersRes.json();
        console.log('Business Owners:', ownersData);
        setBusinessOwners(ownersData);
      } else {
        console.error('Failed to fetch owners:', await ownersRes.text());
      }

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        console.log('Pending Statements:', pendingData);
        console.log('Pending Statements length:', pendingData.length);
        setPendingStatements(pendingData || []);
      } else {
        console.error('Failed to fetch pending:', pendingRes.status, await pendingRes.text());
        setPendingStatements([]);
      }

      if (overdueRes.ok) {
        const overdueData = await overdueRes.json();
        console.log('Overdue Accounts:', overdueData);
        console.log('Overdue Accounts length:', overdueData.length);
        setOverdueAccounts(overdueData || []);
      } else {
        console.error('Failed to fetch overdue:', overdueRes.status, await overdueRes.text());
        setOverdueAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load payment review data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnerStatements = async (ownerId) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/auth/admin/business-owners/${ownerId}/statements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOwnerStatements(data);
      }
    } catch (error) {
      console.error('Error fetching owner statements:', error);
    }
  };

  const handleViewOwner = async (owner) => {
    setSelectedOwner(owner);
    await fetchOwnerStatements(owner.owner_id);
  };

  const handleApprovePayment = async (statementId) => {
    if (!await confirmDialog('Are you sure you want to approve this payment?')) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/auth/admin/billing-statements/${statementId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setSuccessMessage('Payment approved successfully! Account reactivated.');
        await fetchData();
        if (selectedOwner) {
          await fetchOwnerStatements(selectedOwner.owner_id);
        }
        window.dispatchEvent(new Event('billingUpdated'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to approve payment');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      setError('Failed to approve payment');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRejectPayment = async (statementId) => {
    if (!await confirmDialog('Are you sure you want to reject this payment? The account will remain overdue.')) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/auth/admin/billing-statements/${statementId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setSuccessMessage('Payment rejected');
        await fetchData();
        if (selectedOwner) {
          await fetchOwnerStatements(selectedOwner.owner_id);
        }
        window.dispatchEvent(new Event('billingUpdated'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to reject payment');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      setError('Failed to reject payment');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleViewPaymentProof = async (statementId) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/auth/admin/billing-statements/${statementId}/payment-proof`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'No payment proof found' }));
        toast.error(errorData.error || 'No payment proof uploaded');
      }
    } catch (error) {
      console.error('Error viewing payment proof:', error);
      toast.error('Error loading payment proof');
    }
  };

  const handleBulkSuspend = async () => {
    if (selectedStatements.length === 0) {
      toast.warning('Please select accounts to suspend');
      return;
    }

    if (!await confirmDialog(`Are you sure you want to suspend ${selectedStatements.length} account(s)? This will prevent them from accessing the system.`)) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch('/api/auth/admin/billing-statements/bulk-suspend', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds: selectedStatements })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage(result.message);
        setSelectedStatements([]);
        await fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to suspend accounts');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      console.error('Error suspending accounts:', error);
      setError('Failed to suspend accounts');
      setTimeout(() => setError(null), 3000);
    }
  };

  const toggleStatementSelection = (statementId) => {
    setSelectedStatements(prev =>
      prev.includes(statementId)
        ? prev.filter(id => id !== statementId)
        : [...prev, statementId]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActiveStatusColor = (status) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatMonthYear = (period) => {
    const date = new Date(period + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
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
      <h2 className="text-2xl font-bold text-white">Billing & Payment Management</h2>

      {/* Messages */}
      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-md p-4">
          <div className="flex">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            <div className="ml-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900 bg-opacity-50 border border-green-700 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-green-200">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-500 rounded-md p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Total Accounts</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">{businessOwners.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-yellow-500 rounded-md p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Pending Review</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">{pendingStatements.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-red-500 rounded-md p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Overdue</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">{overdueAccounts.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-purple-500 rounded-md p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Total Due</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">
                      ₱{businessOwners.reduce((sum, owner) => sum + parseFloat(owner.total_due || 0), 0).toFixed(2)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all-accounts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'all-accounts'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            All Accounts ({businessOwners.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'pending'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            Pending Payments ({pendingStatements.length})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'overdue'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            Overdue Accounts ({overdueAccounts.length})
          </button>
        </nav>
      </div>

      {/* Tab Content: All Accounts */}
      {activeTab === 'all-accounts' && (
        <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div className="px-6 py-5 border-b border-gray-700">
            <h3 className="text-lg font-medium text-white">All Business Owner Accounts</h3>
            <p className="mt-1 text-sm text-gray-400">Monthly billing: ₱2,000 base fee + ₱10 per delivery (First month free)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Company / Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Statements</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Unpaid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {businessOwners.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                      No business accounts found
                    </td>
                  </tr>
                ) : (
                  businessOwners.map((owner) => (
                    <tr key={owner.owner_id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-white">{owner.company_name}</div>
                          <div className="text-sm text-gray-400">{owner.full_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-300">{owner.email}</div>
                          <div className="text-sm text-gray-400">{owner.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {owner.total_statements}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {owner.unpaid_statements}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        ₱{parseFloat(owner.total_due || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActiveStatusColor(owner.active_status)}`}>
                          {owner.active_status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewOwner(owner)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Pending Payments */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingStatements.length === 0 ? (
            <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-gray-400">No pending payments to review</p>
            </div>
          ) : (
            pendingStatements.map((statement) => (
              <div key={statement.statement_id} className={`bg-gray-800 shadow rounded-lg p-4 sm:p-6 ${statement.has_payment_proof ? 'border-2 border-blue-600' : 'border border-gray-700'}`}>
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-medium text-white">{statement.company_name || statement.full_name}</h3>
                        <p className="text-sm text-gray-400">{statement.full_name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {statement.has_payment_proof ? (
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Proof Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            No Proof Submitted
                          </span>
                        )}
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(statement.status)}`}>
                          {statement.status === 'pending' ? 'Awaiting Payment' : 'Overdue'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{statement.email}</p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Period</p>
                        <p className="text-sm font-medium text-white">{formatMonthYear(statement.statement_period)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Deliveries</p>
                        <p className="text-sm font-medium text-white">{statement.delivery_count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Commission</p>
                        <p className="text-sm font-medium text-white">₱{(statement.delivery_count * 10).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Due</p>
                        <p className="text-sm font-medium text-white">₱{parseFloat(statement.total_due || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
                    {statement.has_payment_proof && (
                      <button
                        onClick={() => handleViewPaymentProof(statement.statement_id)}
                        className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Proof
                      </button>
                    )}
                    <button
                      onClick={() => handleApprovePayment(statement.statement_id)}
                      disabled={!statement.has_payment_proof}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectPayment(statement.statement_id)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>
            </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Overdue Accounts */}
      {activeTab === 'overdue' && (
        <div className="space-y-4">
          {overdueAccounts.length > 0 && (
            <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">
                    {selectedStatements.length} account(s) selected
                  </p>
                </div>
                <button
                  onClick={handleBulkSuspend}
                  disabled={selectedStatements.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Suspend Selected Accounts
                </button>
              </div>
            </div>
          )}

          {overdueAccounts.length === 0 ? (
            <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-gray-400">No overdue accounts - all payments are up to date!</p>
            </div>
          ) : (
            overdueAccounts.map((account) => (
              <div key={account.statement_id} className="bg-gray-800 shadow rounded-lg border border-red-700 p-4 sm:p-6">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    checked={selectedStatements.includes(account.statement_id)}
                    onChange={() => toggleStatementSelection(account.statement_id)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
                  />
                  <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-medium text-white truncate">{account.company_name}</h3>
                        <p className="text-sm text-gray-400 truncate">{account.full_name} • {account.email}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {account.payment_proof_path ? (
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Proof Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            No Proof
                          </span>
                        )}
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(account.status)}`}>
                          {account.status.toUpperCase()}
                        </span>
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getActiveStatusColor(account.active_status)}`}>
                          {account.active_status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Period</p>
                        <p className="text-sm font-medium text-white">{formatMonthYear(account.statement_period)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Days Overdue</p>
                        <p className="text-sm font-medium text-red-400">{account.days_overdue} days</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Due Date</p>
                        <p className="text-sm font-medium text-white">{formatDate(account.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Grace Period Ends</p>
                        <p className="text-sm font-medium text-white">{formatDate(account.grace_period_end)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Amount Due</p>
                        <p className="text-sm font-medium text-white">₱{parseFloat(account.total_due).toFixed(2)}</p>
                      </div>
                    </div>
                    {account.payment_proof_path && (
                      <div className="mt-4">
                        <button
                          onClick={() => handleViewPaymentProof(account.statement_id)}
                          className="inline-flex items-center px-3 py-1 border border-gray-600 text-xs font-medium rounded text-gray-300 bg-gray-700 hover:bg-gray-600"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Payment Proof
                        </button>
                      </div>
                    )}
                  </div>
                </div>
            </div>
            ))
          )}
        </div>
      )}

      {/* Owner Detail Modal */}
      {selectedOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
              <h3 className="text-xl font-bold text-white">{selectedOwner.company_name} - Billing History</h3>
              <button
                onClick={() => {
                  setSelectedOwner(null);
                  setOwnerStatements([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {/* Owner Info */}
              <div className="mb-6 bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Contact Person</p>
                    <p className="text-sm font-medium text-white">{selectedOwner.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="text-sm font-medium text-white">{selectedOwner.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Statements</p>
                    <p className="text-sm font-medium text-white">{selectedOwner.total_statements}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Account Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActiveStatusColor(selectedOwner.active_status)}`}>
                      {selectedOwner.active_status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Unpaid Statements</p>
                    <p className="text-sm font-medium text-white">{selectedOwner.unpaid_statements}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Outstanding</p>
                    <p className="text-sm font-medium text-red-400">₱{parseFloat(selectedOwner.total_due || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Billing History */}
              <h4 className="text-lg font-medium text-white mb-4">Monthly Statements</h4>
              <div className="space-y-3">
                {ownerStatements.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No billing statements found</p>
                ) : (
                  ownerStatements.map((statement) => (
                    <div key={statement.statement_id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-md font-medium text-white">{formatMonthYear(statement.statement_period)}</h5>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(statement.status)}`}>
                          {statement.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Deliveries</p>
                          <p className="text-white">{statement.delivery_count}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Base Fee</p>
                          <p className="text-white">₱{parseFloat(statement.base_fee).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Commission</p>
                          <p className="text-white">₱{(statement.delivery_count * 10).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total Due</p>
                          <p className="text-white font-medium">₱{parseFloat(statement.total_due).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministratorPaymentReview;
