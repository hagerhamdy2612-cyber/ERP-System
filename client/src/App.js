import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedModuleRoute from './components/ProtectedModuleRoute';
import ProtectedPayrollRoute from './components/ProtectedPayrollRoute';
import ProtectedDashboardRoute from './components/ProtectedDashboardRoute';
import { canShowAttendanceInModule } from './config/permissions';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HRDashboard from './pages/HR/Dashboard';
import HREmployees from './pages/HR/Employees';
import HRAttendance from './pages/HR/Attendance';
import HRAttendanceReport from './pages/HR/AttendanceReport';
import HRReports from './pages/HR/Reports';
import HRPayrollList from './pages/HR/Payroll/PayrollList';
import HRPayrollRecordPage from './pages/HR/Payroll/PayrollRecordPage';
import ManufacturingDashboard from './pages/Manufacturing/Dashboard';
import ManufacturingOrders from './pages/Manufacturing/Orders';
import ManufacturingReports from './pages/Manufacturing/Reports';
import SCMDashboard from './pages/SCM/Dashboard';
import SCMSuppliers from './pages/SCM/Suppliers';
import SCMReports from './pages/SCM/Reports';
import CRMDashboard from './pages/CRM/Dashboard';
import CRMCustomers from './pages/CRM/Customers';
import CRMComplaints from './pages/CRM/Complaints';
import CRMReports from './pages/CRM/Reports';
import SalesDashboard from './pages/Sales/Dashboard';
import SalesOrders from './pages/Sales/Orders';
import SalesReports from './pages/Sales/Reports';
import InventoryDashboard from './pages/Inventory/Dashboard';
import RawMaterials from './pages/Inventory/RawMaterials';
import FinishedProducts from './pages/Inventory/FinishedProducts';
import InventoryReports from './pages/Inventory/Reports';
import Others from './pages/Inventory/Others';
import PurchasingDashboard from './pages/Purchasing/Dashboard';
import PurchasingOrders from './pages/Purchasing/Orders';
import PurchasingReports from './pages/Purchasing/Reports';
import FinanceDashboard from './pages/Finance/Dashboard';
import FinanceTransactions from './pages/Finance/Transactions';
import FinanceBank from './pages/Finance/Bank';
import FinanceExpenses from './pages/Finance/Expenses';
import FinanceBankAccounts from './pages/Finance/BankAccounts';
import ActivityLog from './pages/Admin/ActivityLog';
import ArchivePage from './pages/Admin/Archive';

// Conditional Attendance Route Component
const ConditionalAttendanceRoute = ({ module, children }) => {
  const { user } = useAuth();
  
  // If user can't show attendance in this module, redirect to their appropriate dashboard
  if (!canShowAttendanceInModule(user, module)) {
    if (user?.role === 'admin') {
      return <Navigate to="/app/dashboard" replace />;
    }
    
    // Managers get redirected to their module dashboard
    if (user?.role === 'manager') {
      const managerDepartmentMap = {
        'HR': '/app/hr/dashboard',
        'Sales': '/app/sales/dashboard',
        'Purchasing': '/app/purchasing/dashboard',
        'Inventory': '/app/inventory/dashboard',
        'Manufacturing': '/app/manufacturing/dashboard',
        'CRM': '/app/crm/dashboard',
        'SCM': '/app/scm/dashboard'
      };
      const redirectPath = managerDepartmentMap[user?.department] || '/app/login';
      return <Navigate to={redirectPath} replace />;
    }
    
    // Employees get redirected to their module pages, not dashboards
    const employeeDepartmentMap = {
      'HR': '/app/hr/employees',
      'Sales': '/app/sales/orders',
      'Purchasing': '/app/purchasing/orders',
      'Inventory': '/app/inventory/raw-materials',
      'Manufacturing': '/app/manufacturing/orders',
      'CRM': '/app/crm/customers',
      'SCM': '/app/scm/suppliers',
    };
    const redirectPath = employeeDepartmentMap[user?.department] || '/app/login';
    return <Navigate to={redirectPath} replace />;
  }
  
  return children;
};

// Redirect non-admin users to their department homepage
const DashboardRedirect = () => {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <Navigate to="/app/dashboard" replace />;
  }
  
  // Managers get dashboard access, employees get module pages
  if (user?.role === 'manager') {
    const managerDepartmentMap = {
      'HR': '/app/hr/dashboard',
      'Sales': '/app/sales/dashboard',
      'Purchasing': '/app/purchasing/dashboard',
      'Inventory': '/app/inventory/dashboard',
      'Manufacturing': '/app/manufacturing/dashboard',
      'CRM': '/app/crm/dashboard',
      'SCM': '/app/scm/dashboard',
    };
    const redirectPath = managerDepartmentMap[user?.department] || '/app/login';
    return <Navigate to={redirectPath} replace />;
  }
  
  // Employees get redirected to their module pages, not dashboards
  const employeeDepartmentMap = {
    'HR': '/app/hr/employees',
    'Sales': '/app/sales/orders',
    'Purchasing': '/app/purchasing/orders',
    'Inventory': '/app/inventory/raw-materials',
    'Manufacturing': '/app/manufacturing/orders',
    'CRM': '/app/crm/customers',
    'SCM': '/app/scm/suppliers',
    'Finance': '/app/finance/transactions'
  };
  const redirectPath = employeeDepartmentMap[user?.department] || '/app/login';
  return <Navigate to={redirectPath} replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Toaster position="top-right" />
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/app" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardRedirect />} />
              
              {/* Dashboard - Available to admin only */}
              <Route path="dashboard" element={
                <ProtectedModuleRoute module="dashboard">
                  <Dashboard />
                </ProtectedModuleRoute>
              } />
              {/* Activity Log - Admin only */}
              <Route path="admin/activity-log" element={<ActivityLog />} />
              {/* Archive - Admin & Manager only */}
              <Route path="admin/archive" element={<ArchivePage />} />
              
              {/* HR Routes - Only for HR department and admins */}
              <Route path="hr/dashboard" element={
                <ProtectedDashboardRoute module="hr">
                  <HRDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="hr/employees" element={
                <ProtectedModuleRoute module="hr">
                  <HREmployees />
                </ProtectedModuleRoute>
              } />
              <Route path="hr/attendance" element={
                <ProtectedModuleRoute module="attendance">
                  <HRAttendance />
                </ProtectedModuleRoute>
              } />
              <Route path="hr/attendance-report" element={
                <ProtectedModuleRoute module="hr">
                  <HRAttendanceReport />
                </ProtectedModuleRoute>
              } />
              <Route path="hr/reports" element={
                <ProtectedModuleRoute module="hr">
                  <HRReports />
                </ProtectedModuleRoute>
              } />
              <Route path="hr/payroll/new" element={
                <ProtectedPayrollRoute>
                  <HRPayrollRecordPage />
                </ProtectedPayrollRoute>
              } />
              <Route path="hr/payroll/:id" element={
                <ProtectedPayrollRoute>
                  <HRPayrollRecordPage />
                </ProtectedPayrollRoute>
              } />
              <Route path="hr/payroll" element={
                <ProtectedPayrollRoute>
                  <HRPayrollList />
                </ProtectedPayrollRoute>
              } />
              
              {/* Manufacturing Routes - Only for Manufacturing department and admins */}
              <Route path="manufacturing/dashboard" element={
                <ProtectedDashboardRoute module="manufacturing">
                  <ManufacturingDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="manufacturing/orders" element={
                <ProtectedModuleRoute module="manufacturing">
                  <ManufacturingOrders />
                </ProtectedModuleRoute>
              } />
              <Route path="manufacturing/attendance" element={
                <ConditionalAttendanceRoute module="manufacturing">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              <Route path="manufacturing/reports" element={
                <ProtectedModuleRoute module="manufacturing">
                  <ManufacturingReports />
                </ProtectedModuleRoute>
              } />
              
              {/* SCM Routes - Only for Purchasing department and admins */}
              <Route path="scm/dashboard" element={
                <ProtectedDashboardRoute module="scm">
                  <SCMDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="scm/suppliers" element={
                <ProtectedModuleRoute module="scm">
                  <SCMSuppliers />
                </ProtectedModuleRoute>
              } />
              <Route path="scm/attendance" element={
                <ConditionalAttendanceRoute module="scm">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              <Route path="scm/reports" element={
                <ProtectedModuleRoute module="scm">
                  <SCMReports />
                </ProtectedModuleRoute>
              } />
              
              {/* CRM Routes - Only for Sales department and admins */}
              <Route path="crm/dashboard" element={
                <ProtectedDashboardRoute module="crm">
                  <CRMDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="crm/customers" element={
                <ProtectedModuleRoute module="crm">
                  <CRMCustomers />
                </ProtectedModuleRoute>
              } />
              <Route path="crm/complaints" element={
                <ProtectedModuleRoute module="crm">
                  <CRMComplaints />
                </ProtectedModuleRoute>
              } />
              <Route path="crm/attendance" element={
                <ConditionalAttendanceRoute module="crm">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              <Route path="crm/reports" element={
                <ProtectedModuleRoute module="crm">
                  <CRMReports />
                </ProtectedModuleRoute>
              } />
              
              {/* Sales Routes - Only for Sales department and admins */}
              <Route path="sales/dashboard" element={
                <ProtectedDashboardRoute module="sales">
                  <SalesDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="sales/orders" element={
                <ProtectedModuleRoute module="sales">
                  <SalesOrders />
                </ProtectedModuleRoute>
              } />
              <Route path="sales/reports" element={
                <ProtectedModuleRoute module="sales">
                  <SalesReports />
                </ProtectedModuleRoute>
              } />
              <Route path="sales/attendance" element={
                <ConditionalAttendanceRoute module="sales">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              
              {/* Inventory Routes - Only for Inventory/Manufacturing departments and admins */}
              <Route path="inventory/dashboard" element={
                <ProtectedDashboardRoute module="inventory">
                  <InventoryDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="inventory/products" element={<Navigate to="/app/inventory/raw-materials" replace />} />
              <Route path="inventory/others" element={
                <ProtectedModuleRoute module="inventory">
                  <Others />
                </ProtectedModuleRoute>
              } />
              <Route path="inventory/raw-materials" element={
                <ProtectedModuleRoute module="inventory">
                  <RawMaterials />
                </ProtectedModuleRoute>
              } />
              <Route path="inventory/finished-products" element={
                <ProtectedModuleRoute module="inventory">
                  <FinishedProducts />
                </ProtectedModuleRoute>
              } />
              <Route path="inventory/attendance" element={
                <ConditionalAttendanceRoute module="inventory">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              <Route path="inventory/reports" element={
                <ProtectedModuleRoute module="inventory">
                  <InventoryReports />
                </ProtectedModuleRoute>
              } />
              
              {/* Purchasing Routes - Only for Purchasing department and admins */}
              <Route path="purchasing/dashboard" element={
                <ProtectedDashboardRoute module="purchasing">
                  <PurchasingDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="purchasing/orders" element={
                <ProtectedModuleRoute module="purchasing">
                  <PurchasingOrders />
                </ProtectedModuleRoute>
              } />
              <Route path="purchasing/reports" element={
                <ProtectedModuleRoute module="purchasing">
                  <PurchasingReports />
                </ProtectedModuleRoute>
              } />
              <Route path="purchasing/attendance" element={
                <ConditionalAttendanceRoute module="purchasing">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              
              {/* Finance Routes */}
              <Route path="finance/dashboard" element={
                <ProtectedDashboardRoute module="finance">
                  <FinanceDashboard />
                </ProtectedDashboardRoute>
              } />
              <Route path="finance/transactions" element={
                <ProtectedModuleRoute module="finance">
                  <FinanceTransactions />
                </ProtectedModuleRoute>
              } />
              <Route path="finance/bank" element={
                <ProtectedModuleRoute module="finance">
                  <FinanceBank />
                </ProtectedModuleRoute>
              } />
              <Route path="finance/expenses" element={
                <ProtectedModuleRoute module="finance">
                  <FinanceExpenses />
                </ProtectedModuleRoute>
              } />
              <Route path="finance/attendance" element={
                <ConditionalAttendanceRoute module="finance">
                  <ProtectedModuleRoute module="attendance">
                    <HRAttendance />
                  </ProtectedModuleRoute>
                </ConditionalAttendanceRoute>
              } />
              <Route path="finance/bank-accounts" element={
                <ProtectedModuleRoute module="finance">
                  <FinanceBankAccounts />
                </ProtectedModuleRoute>
              } />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
