import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';

const RestrictedBillingAccess = () => {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [nextPaymentData, setNextPaymentData] = useState(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();

      // Fetch current subscription
      const subscriptionResponse = await fetch('/api/auth/subscription/current', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        setCurrentSubscription(subscriptionData);
      }

      // Fetch billing history
      const billingResponse = await fetch('/api/auth/billing', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (billingResponse.ok) {
        const billingData = await billingResponse.json();
        setBillingHistory(billingData);
      }

      // Fetch next payment due date
      const nextPaymentResponse = await fetch('/api/auth/subscription/next-payment-due', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (nextPaymentResponse.ok) {
        const nextPaymentData = await nextPaymentResponse.json();
        setNextPaymentData(nextPaymentData);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setError('Failed to load billing information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.type !== 'application/pdf' && file.type !== 'image/jpeg' && file.type !== 'image/png') {
      toast.warning('Please upload a PDF, JPEG, or PNG file.');
      setSelectedFile(null);
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.warning('File size must be less than 5MB.');
      setSelectedFile(null);
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmitPayment = async () => {
    if (!selectedFile) {
      toast.warning('Please select a file first.');
      return;
    }

    setUploading(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('paymentProof', selectedFile);
      formData.append('amount', '2000'); // Monthly subscription fee

      const response = await fetch('/api/auth/subscription/payment-proof', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success('Payment proof uploaded successfully! Our team will review it shortly.');
        setSelectedFile(null);
        await fetchBillingData(); // Refresh data
      } else {
        const errorData = await response.json();
        toast.error(`Error uploading payment proof: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      toast.error('Error uploading payment proof. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, color, icon }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center mr-4 flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-400 truncate">{title}</h3>
          <p className="text-2xl font-bold text-white truncate">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await user.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Centered Header */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Account Suspended</h1>
            <p className="text-gray-300 text-lg">
              Your account has been temporarily suspended. You can only access billing information.
            </p>
            <button
              onClick={handleSignOut}
              className="mt-4 bg-gray-700 text-gray-300 px-6 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Sign Out
            </button>
          </div>

          <div className="space-y-8">
        {/* Warning Banner */}
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-200">Account Suspended</h3>
              <div className="mt-2 text-sm text-red-300">
                <p>
                  Your account has been suspended due to payment issues or violation of terms. 
                  Please submit payment proof to reactivate your account.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
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

        {/* Billing Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Current Status"
            value={currentSubscription?.approval_status === 'approved' ? 'Paid' : 'Pending'}
            subtitle="Payment Status"
            color={currentSubscription?.approval_status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Monthly Fee"
            value="₱2,000"
            subtitle="Base subscription"
            color="bg-blue-500"
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Payment Due"
            value={currentSubscription?.approval_status === 'approved' ? '₱0' : '₱2,000'}
            subtitle="Outstanding amount"
            color={currentSubscription?.approval_status === 'approved' ? 'bg-green-500' : 'bg-red-500'}
            icon={
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Payment Details Card */}
        {nextPaymentData && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Payment Details</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-400">Payment Date</p>
                <p className="text-sm font-medium text-white">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Billing Period</p>
                <p className="text-sm font-medium text-white">
                  {new Date(nextPaymentData.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-400">Total Amount to be Paid</p>
                <p className="text-lg font-semibold text-white">
                  ₱2,000.00
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Amount Paid</p>
                <p className="text-lg font-semibold text-green-400">
                  ₱2,000.00
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-400">Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-900 text-yellow-200">
                Pending Review
              </span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="text-sm text-gray-400 text-center space-y-1">
                <p className="font-medium text-white">Payment Breakdown:</p>
                <p>Base fee: ₱2,000.00</p>
                <p>Orders (0): ₱0.00</p>
              </div>
            </div>
            
            {nextPaymentData.daysUntilDue > 0 && (
              <div className="mt-4 p-3 bg-blue-900 bg-opacity-50 rounded-lg border border-blue-700">
                <p className="text-sm text-blue-200 text-center">
                  <strong>Advance Payment:</strong> This payment covers the billing period starting {new Date(nextPaymentData.dueDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Payment Upload Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Submit Payment Proof</h2>
          <p className="text-gray-300 mb-6">
            Upload your payment receipt or proof of payment to reactivate your account.
          </p>
          
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="space-y-4">
              <div>
                <label htmlFor="payment-proof" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-white">
                    Click to upload payment proof
                  </span>
                  <span className="mt-1 block text-sm text-gray-400">
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
              
              {/* Selected File Display */}
              {selectedFile && (
                <div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                        <p className="text-xs text-gray-400">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-white flex-shrink-0 ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              {selectedFile && (
                <div className="mt-4">
                  <button
                    onClick={handleSubmitPayment}
                    disabled={uploading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </div>
                    ) : (
                      'Submit Payment Proof'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">Billing History</h2>
          {billingHistory.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-sm font-medium text-white">No billing history</h3>
              <p className="text-sm text-gray-400 mt-1">No billing records available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {billingHistory.map((bill, index) => (
                    <tr key={index} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(bill.billing_period).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right font-medium">
                        ₱{parseFloat(bill.total_due).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bill.status === 'paid' || bill.status === 'free' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                        }`}>
                          {bill.status === 'paid' ? 'Paid' : bill.status === 'free' ? 'Free' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@routico.com" className="text-blue-400 hover:text-blue-300">
              support@routico.com
            </a>
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestrictedBillingAccess;
