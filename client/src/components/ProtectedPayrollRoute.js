import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessModule, canAccessPayroll } from '../config/permissions';

const ProtectedPayrollRoute = ({ children, fallbackPath = '/app/hr/employees' }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessModule(user, 'hr')) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (!canAccessPayroll(user)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

export default ProtectedPayrollRoute;
