import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessDashboardRoute } from '../config/permissions';

const ProtectedDashboardRoute = ({ children, module, fallbackPath = '/app/login' }) => {
  const { user, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user can access this module dashboard
  if (!canAccessDashboardRoute(user, module)) {
    // Redirect to appropriate page based on user role
    if (user.role === 'admin') {
      return <Navigate to="/app/dashboard" replace />;
    }
    
    // Redirect employees to their department's main page
    const departmentMap = {
      'HR': '/app/hr/employees',
      'Sales': '/app/sales/orders',
      'Purchasing': '/app/purchasing/orders',
      'Inventory': '/app/inventory/raw-materials',
      'Manufacturing': '/app/manufacturing/orders',
      'CRM': '/app/crm/customers',
      'SCM': '/app/scm/suppliers',
      'Finance': '/app/finance/transactions'
    };
    
    const redirectPath = departmentMap[user?.department] || fallbackPath;
    return <Navigate to={redirectPath} replace />;
  }

  // User has permission, render the component
  return children;
};

export default ProtectedDashboardRoute;

