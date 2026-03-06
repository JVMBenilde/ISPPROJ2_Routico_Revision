import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const BusinessOwnerBilling = () => {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (user) {
      fetchStatements();
    }
  }, [user]);

  // Auto-select current month when statements load
  useEffect(() => {
    if (statements.length > 0 && !selectedPeriod) {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const currentStatement = statements.find(s => s.statement_period === currentMonth);
      
      if (currentStatement) {
        setSelectedPeriod(currentMonth);
        setSelectedStatement(currentStatement);
        setPaymentAmount(currentStatement.total_due.toString());
      } else {
        // Default to most recent statement
        setSelectedPeriod(statements[0].statement_period);
        setSelectedStatement(statements[0]);
        setPaymentAmount(statements[0].total_due.toString());
      }
    }
  }, [statements]);

  const fetchStatements = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const response = await fetch('http://localhost:3001/api/auth/billing-statements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const statementsData = await response.json();
        setStatements(statementsData);
      } else {
        setError('Failed to fetch billing statements');
      }
    } catch (error) {
      console.error('Error fetching statements:', error);
      setError('Error loading billing data');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period) => {
    const statement = statements.find(s => s.statement_period === period);
    setSelectedPeriod(period);
    setSelectedStatement(statement);
    setPaymentAmount(statement?.total_due.toString() || '');
    setSelectedFile(null);
    setSuccessMessage(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadPayment = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.warning('Please select a payment proof file');
      return;
    }

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.warning('Please enter a valid payment amount');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('paymentProof', selectedFile);
      formData.append('amount', paymentAmount);

      const response = await fetch(
        `http://localhost:3001/api/auth/billing-statements/${selectedStatement.statement_id}/payment-proof`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage(result.message || 'Payment proof uploaded successfully! Waiting for administrator approval.');
        setSelectedFile(null);
        setPaymentAmount('');
        
        // Refresh statements
        await fetchStatements();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload payment proof');
      }
    } catch (error) {
      console.error('Error uploading payment:', error);
      setError('Error uploading payment proof. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadCSV = async (period) => {
    try {
      const token = getToken();
      const response = await fetch(
        `http://localhost:3001/api/billing/statement/${period}/download/csv`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `billing-statement-${period}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSV download error:', errorData);
        toast.error(`Failed to download CSV: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      toast.error(`Error downloading CSV: ${error.message}`);
    }
  };

  const downloadPDF = async (period) => {
    try {
      const token = getToken();
      const response = await fetch(
        `http://localhost:3001/api/billing/statement/${period}/download/pdf`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `billing-statement-${period}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('PDF download error:', errorData);
        toast.error(`Failed to download PDF: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error(`Error downloading PDF: ${error.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending Payment';
      case 'overdue': return 'Overdue';
      case 'suspended': return 'Suspended';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatMonthYear = (period) => {
    const date = new Date(period + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Billing & Payments</h2>
        
        <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-12">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-400">No billing statements available yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalOrders = selectedStatement?.delivery_count || 0;
  const totalDeliveryFees = parseFloat(selectedStatement?.total_delivery_fees || 0);
  const commission = parseFloat(selectedStatement?.commission || 0);
  const baseFee = parseFloat(selectedStatement?.base_fee || 0);
  const totalDue = parseFloat(selectedStatement?.total_due || 0);
  const isPaid = selectedStatement?.status === 'paid';
  const isPending = selectedStatement?.status === 'pending';
  const isOverdue = selectedStatement?.status === 'overdue';

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-2xl font-bold text-white">Billing & Payments</h2>

      {/* Error/Success Messages */}
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

      {/* Month Selector */}
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-medium text-white mb-4">Select Billing Period</h3>
        <div className="flex flex-wrap gap-3">
          {statements.map((statement) => (
            <button
              key={statement.statement_period}
              onClick={() => handlePeriodChange(statement.statement_period)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedPeriod === statement.statement_period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {formatMonthYear(statement.statement_period)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-500 rounded-md p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Total Orders</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">{totalOrders}</div>
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
                <div className="bg-green-500 rounded-md p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Delivery Fees Earned</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">₱{totalDeliveryFees.toFixed(2)}</div>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Commission</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">₱{commission.toFixed(2)}</div>
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
                <div className={`${isPaid ? 'bg-green-500' : isOverdue ? 'bg-red-500' : 'bg-orange-500'} rounded-md p-3`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Total Due</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-white">₱{totalDue.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Statement Card */}
      {selectedStatement && (
        <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div className="px-6 py-5 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-medium text-white">
                {formatMonthYear(selectedStatement.statement_period)} Statement
              </h3>
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedStatement.status)}`}>
                {getStatusText(selectedStatement.status)}
              </span>
            </div>
          </div>

          <div className="px-6 py-5">
            {/* Statement Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-400">Statement Date</p>
                <p className="text-lg font-medium text-white">{formatDate(selectedStatement.statement_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Due Date</p>
                <p className="text-lg font-medium text-white">{formatDate(selectedStatement.due_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Grace Period Ends</p>
                <p className="text-lg font-medium text-white">{formatDate(selectedStatement.grace_period_end)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Payment Status</p>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedStatement.status)}`}>
                  {getStatusText(selectedStatement.status)}
                </span>
              </div>
            </div>

            {/* Billing Breakdown */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h4 className="text-lg font-medium text-white mb-4">Billing Breakdown</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Subscription Base Fee</span>
                  <span className="text-white font-medium">₱{baseFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Routico Commission ({totalOrders} deliveries × ₱10.00)</span>
                  <span className="text-white font-medium">₱{commission.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-600 pt-3 mt-3 flex justify-between">
                  <span className="text-white font-semibold text-lg">Total Due to Routico</span>
                  <span className="text-white font-semibold text-lg">₱{totalDue.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-600 pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Your Revenue (Delivery Fees Earned)</span>
                    <span className="text-green-400 font-medium">₱{totalDeliveryFees.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => downloadCSV(selectedStatement.statement_period)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download CSV
              </button>
              <button
                onClick={() => downloadPDF(selectedStatement.statement_period)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Download PDF
              </button>
            </div>

            {/* Warning Messages */}
            {isOverdue && (
              <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-200">
                  <strong>⚠ Overdue Payment:</strong> This payment is past due. Please submit your payment immediately to avoid service suspension.
                </p>
              </div>
            )}

            {isPending && new Date(selectedStatement.due_date) - new Date() < 7 * 24 * 60 * 60 * 1000 && (
              <div className="bg-yellow-900 bg-opacity-50 border border-yellow-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-200">
                  <strong>⏰ Payment Due Soon:</strong> Payment is due on {formatDate(selectedStatement.due_date)}. Please submit payment before the due date.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Proof Upload Section */}
      {selectedStatement && (selectedStatement.status === 'pending' || selectedStatement.status === 'overdue') && (
        <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div className="px-6 py-5 border-b border-gray-700">
            <h3 className="text-lg font-medium text-white">Upload Proof of Payment</h3>
            <p className="mt-1 text-sm text-gray-400">
              Upload your payment receipt for {formatMonthYear(selectedStatement.statement_period)}
            </p>
          </div>

          <div className="px-6 py-5">
            <form onSubmit={handleUploadPayment} className="space-y-6">
              {/* Amount Input */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Amount (₱)
                </label>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full md:w-1/2 px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white"
                  placeholder="Enter payment amount"
                  required
                />
                <p className="mt-1 text-sm text-gray-400">
                  Total due for this period: ₱{totalDue.toFixed(2)}
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label htmlFor="payment-proof" className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Proof (Receipt/Screenshot)
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6">
                  {!selectedFile ? (
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div className="space-y-2">
                        <label htmlFor="payment-proof" className="cursor-pointer">
                          <span className="block text-sm font-medium text-white">
                            Click to upload payment proof
                          </span>
                          <span className="block text-sm text-gray-400">
                            PDF, PNG, JPG up to 5MB
                          </span>
                        </label>
                        <input
                          id="payment-proof"
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileSelect}
                          disabled={uploading}
                          className="hidden"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-8 h-8 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                            <p className="text-xs text-gray-400">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !paymentAmount}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Submit Payment Proof
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Billing History */}
      <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
        <div className="px-6 py-5 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">Billing History</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Base Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Total Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {statements.map((statement) => (
                <tr key={statement.statement_id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {formatMonthYear(statement.statement_period)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {statement.delivery_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ₱{parseFloat(statement.base_fee).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ₱{(statement.delivery_count * 10).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    ₱{parseFloat(statement.total_due).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(statement.status)}`}>
                      {getStatusText(statement.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePeriodChange(statement.statement_period)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadCSV(statement.statement_period)}
                        className="text-green-400 hover:text-green-300"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => downloadPDF(statement.statement_period)}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BusinessOwnerBilling;