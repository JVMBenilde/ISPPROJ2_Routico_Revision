import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import BusinessOwnerDashboard from '../pages/BusinessOwnerDashboard';
import AdministratorDashboard from '../pages/AdministratorDashboard';
import DriverDashboard from '../pages/DriverDashboard';
import PendingApprovalPage from '../pages/PendingApprovalPage';
import InactiveAccountPage from '../pages/InactiveAccountPage';
import RestrictedBillingAccess from './RestrictedBillingAccess';
import Header from './Header';
import Footer from './Footer';

const RoleBasedDashboard = () => {
  const { userRole, userStatus, dashboardType } = useAuth();

  // Check if business owner account is pending approval
  if (userRole === 'business_owner' && userStatus?.account_status === 'pending') {
    return <PendingApprovalPage />;
  }

  // Check if business owner account is inactive
  if (userRole === 'business_owner' && userStatus?.active_status === 'inactive') {
    return <RestrictedBillingAccess />;
  }

  // Route based on dashboardType (supports custom roles)
  const effectiveDashboard = dashboardType ||
    (userRole === 'administrator' ? 'admin' :
     userRole === 'driver' ? 'driver' : 'business');

  if (effectiveDashboard === 'business') {
    if (!userStatus) {
      return <PendingApprovalPage />;
    }
    return <BusinessOwnerDashboard />;
  } else if (effectiveDashboard === 'admin') {
    return <AdministratorDashboard />;
  } else if (effectiveDashboard === 'driver') {
    return <DriverDashboard />;
  }

  // Fallback for unknown dashboard types
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
        <p className="text-gray-300">Your role is not recognized. Please contact support.</p>
      </div>
    </div>
  );
};

export default RoleBasedDashboard;
