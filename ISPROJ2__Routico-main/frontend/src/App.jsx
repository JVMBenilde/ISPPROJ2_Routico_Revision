import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ToastProvider } from './components/Toast'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RoleBasedDashboard from './components/RoleBasedDashboard'
import Header from './components/Header'
import Footer from './components/Footer'
import './App.css'

// Custom Dashboard Wrapper to handle different layouts
const DashboardWrapper = () => {
  const { userRole, userStatus } = useAuth();
  
  // For suspended business owners, render without header/footer
  if (userRole === 'business_owner' && userStatus?.active_status === 'inactive') {
    return <RoleBasedDashboard />;
  }
  
  // For all other cases, render with header/footer
  return <RoleBasedDashboard />;
};

// Protected Route component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userRole } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

// Public Route component (redirect to dashboard if already logged in)
const PublicRoute = ({ children, allowAuthenticated = false }) => {
  const { user } = useAuth();
  
  if (user && !allowAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Catch-all redirect: logged in → dashboard, logged out → home
const CatchAllRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user ? "/dashboard" : "/"} replace />;
};

// Main App Layout
const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

// Auth Layout (no header/footer for login/register pages)
const AuthLayout = ({ children }) => {
  return <>{children}</>;
};

// Suspended Layout (no header/footer for suspended accounts)
const SuspendedLayout = ({ children }) => {
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/" 
              element={
                <AppLayout>
                  <HomePage />
                </AppLayout>
              } 
            />
            
            {/* Auth Routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <AuthLayout>
                    <LoginPage />
                  </AuthLayout>
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/register" 
              element={
                <PublicRoute allowAuthenticated={true}>
                  <AuthLayout>
                    <RegisterPage />
                  </AuthLayout>
                </PublicRoute>
              } 
            />
            
            {/* Protected Routes - Role-based Dashboard */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['business_owner', 'administrator', 'driver']}>
                  <DashboardWrapper />
                </ProtectedRoute>
              } 
            />
            
            {/* Unauthorized Route */}
            <Route 
              path="/unauthorized" 
              element={
                <AuthLayout>
                  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-white mb-4">Unauthorized Access</h1>
                      <p className="text-gray-300 mb-8">You don't have permission to access this page.</p>
                      <a href="/dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700">
                        Go to Dashboard
                      </a>
                    </div>
                  </div>
                </AuthLayout>
              } 
            />
            
            {/* Catch all route - redirect to dashboard if logged in, home if not */}
            <Route path="*" element={<CatchAllRedirect />} />
          </Routes>
        </div>
      </Router>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App