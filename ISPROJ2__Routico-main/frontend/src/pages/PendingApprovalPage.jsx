import React from 'react';
import { useAuth } from '../auth/AuthContext';

const PendingApprovalPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
          {/* Title */}
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Account Pending Approval
          </h2>
          
          {/* Description */}
          <p className="mt-2 text-sm text-gray-300">
            Your business owner account is currently under review by our administrators.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
              <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-white mb-2">
              Awaiting Administrator Review
            </h3>
            
            <p className="text-sm text-gray-400 mb-6">
              We have received your registration and company documents. Our administrators are reviewing your application to ensure compliance with our business requirements.
            </p>

            {/* Status Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    What happens next?
                  </h4>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Administrators will review your company documents</li>
                      <li>Account verification typically takes 1-2 business days</li>
                      <li>You'll receive an email notification once approved</li>
                      <li>Upon approval, you'll gain full access to your dashboard</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* User Information */}
            <div className="bg-gray-700 rounded-md p-4 mb-6">
              <h4 className="text-sm font-medium text-white mb-2">Account Information</h4>
              <div className="text-sm text-gray-300">
                <p><span className="font-medium">Email:</span> {user?.email}</p>
                <p><span className="font-medium">Status:</span> <span className="text-yellow-600 font-medium">Pending Approval</span></p>
                <p><span className="font-medium">Role:</span> Business Owner</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Check Status
              </button>
              
              <button
                onClick={() => {
                  // You can implement logout functionality here
                  window.location.href = '/';
                }}
                className="w-full flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@routico.com" className="text-blue-600 hover:text-blue-500">
              support@routico.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
