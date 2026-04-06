// Role-based permissions configuration
export const PERMISSIONS = {
  // Module access permissions
  MODULES: {
    DASHBOARD: 'dashboard',
    HR: 'hr',
    SALES: 'sales',
    PURCHASING: 'purchasing',
    INVENTORY: 'inventory',
    MANUFACTURING: 'manufacturing',
    CRM: 'crm',
    SCM: 'scm',
    FINANCE: 'finance',
  },

  // Department-based module mapping
  DEPARTMENT_MODULES: {
    'HR': ['hr', 'attendance'],
    'Sales': ['sales', 'attendance'],
    'Purchasing': ['purchasing', 'attendance'],
    'Inventory': ['inventory', 'attendance'],
    'Manufacturing': ['manufacturing', 'attendance'],
    'CRM': ['crm', 'attendance'],
    'SCM': ['scm', 'attendance'],
    'Finance': ['finance', 'attendance'],
    'Admin': ['dashboard', 'hr', 'sales', 'purchasing', 'inventory', 'manufacturing', 'crm', 'scm', 'finance', 'attendance']
  },

  // Module dashboard access permissions
  MODULE_DASHBOARD_ACCESS: {
    'hr': ['admin', 'HR-manager'],
    'sales': ['admin', 'Sales-manager'],
    'purchasing': ['admin', 'Purchasing-manager'],
    'inventory': ['admin', 'Inventory-manager'],
    'manufacturing': ['admin', 'Manufacturing-manager'],
    'crm': ['admin', 'CRM-manager'],
    'scm': ['admin', 'SCM-manager'],
    'finance': ['admin', 'Finance-manager'],
  },

  // Special permissions for attendance
  ATTENDANCE_PERMISSIONS: {
    canCheckInOut: ['admin', 'manager', 'employee'], // All roles can check in/out
    canViewAllRecords: ['admin', 'HR'], // Only admin and HR can view all records
    canManageEmployees: ['admin', 'HR'] // Only admin and HR can manage employees
  },

  // Purchasing permissions
  PURCHASING_PERMISSIONS: {
    canCreateOrder: ['admin', 'employee'], // Admin and employees can create orders
    canEditOrder: ['admin', 'manager'], // Admin and managers can edit orders
    canAcceptOrder: ['admin', 'manager'], // Only admin and managers can accept/approve orders
    canReceiveOrder: ['admin', 'employee'], // Admin and employees can receive orders
    canViewAllOrders: ['admin', 'manager', 'employee'], // All roles can view orders
    canDeleteOrder: ['admin', 'manager'] // Only admin and managers can delete orders
  },

  // Employee management permissions
  EMPLOYEE_MANAGEMENT_PERMISSIONS: {
    canAddEmployee: ['admin', 'manager', 'employee'], // Admin, managers, and employees can add employees (except HR employees)
    canEditEmployee: ['admin', 'manager', 'employee'], // Admin, managers, and employees can edit employees (except HR employees)
    canDeleteEmployee: ['admin', 'manager', 'employee'] // Admin, managers, and employees can delete employees (except HR employees)
  },

  // Role-based permissions
  ROLE_PERMISSIONS: {
    'admin': {
      canAccessAllModules: true,
      canManageUsers: true,
      canViewReports: true,
      canExportData: true,
      canSendEmails: true
    },
    'manager': {
      canAccessAllModules: false,
      canManageUsers: false,
      canViewReports: true,
      canExportData: true,
      canSendEmails: true,
      allowedModules: [] // Will be set based on department
    },
    'employee': {
      canAccessAllModules: false,
      canManageUsers: true, // Employees can manage users (except HR employees)
      canViewReports: true, // Employees can view reports
      canExportData: true, // Employees can export data
      canSendEmails: true, // Employees can send emails
      allowedModules: [] // Will be set based on department
    }
  }
};

// Helper function to get user's allowed modules
export const getUserAllowedModules = (user) => {
  if (!user) return [];

  // Admin has access to all modules (but attendance only in HR context)
  if (user.role === 'admin') {
    return ['dashboard', 'hr', 'sales', 'purchasing', 'inventory', 'manufacturing', 'crm', 'scm', 'finance'];
  }

  // Managers have access to their department module + attendance (NO main dashboard access)
  if (user.role === 'manager') {
    // Handle case-insensitive department matching
    const departmentKey = Object.keys(PERMISSIONS.DEPARTMENT_MODULES).find(
      key => key.toLowerCase() === (user.department || '').toLowerCase()
    ) || user.department;
    
    const departmentModules = PERMISSIONS.DEPARTMENT_MODULES[departmentKey] || [];
    
    // Fallback: if department is Finance but modules not found, return finance modules
    if ((user.department === 'Finance' || user.department?.toLowerCase() === 'finance') && departmentModules.length === 0) {
      return ['finance', 'attendance'];
    }
    
    return departmentModules;
  }

  // Employees have access to their department module + attendance (NO dashboard access)
  const departmentModules = PERMISSIONS.DEPARTMENT_MODULES[user.department] || [];
  return departmentModules;
};

// Helper function to check if user can access a module
export const canAccessModule = (user, module) => {
  if (!user) return false;
  
  // Admin can access everything including main dashboard
  if (user.role === 'admin') return true;
  
  // Only admin can access main dashboard
  if (module === 'dashboard') return false;
  
  // Check if module is in user's allowed modules
  const allowedModules = getUserAllowedModules(user);
  return allowedModules.includes(module);
};

// Helper function to check if user can access a specific dashboard route
export const canAccessDashboardRoute = (user, module) => {
  if (!user) return false;
  
  // Admin can access all module dashboards
  if (user.role === 'admin') return true;
  
  // Only managers can access module dashboards
  if (user.role !== 'manager') return false;
  
  // Check if manager is from the module's department
  const departmentMap = {
    'hr': 'HR',
    'sales': 'Sales',
    'purchasing': 'Purchasing',
    'inventory': 'Inventory',
    'manufacturing': 'Manufacturing',
    'crm': 'CRM',
    'scm': 'SCM',
    'finance': 'Finance'
  };
  
  const requiredDepartment = departmentMap[module];
  return user.department === requiredDepartment;
};

/** Bank overview + CRUD bank accounts: admin or manager in Finance department */
export const canManageFinanceBankAccounts = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'manager' && user.department === 'Finance';
};

/** HR Recruitment (applicants): admin or HR department manager only */
export const canAccessRecruitment = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'manager' && user.department === 'HR';
};

// Helper function to check if user can perform an action
export const canPerformAction = (user, action) => {
  if (!user) return false;
  
  const rolePermissions = PERMISSIONS.ROLE_PERMISSIONS[user.role];
  if (!rolePermissions) return false;
  
  return rolePermissions[action] || false;
};

// Helper function to check attendance permissions
export const canCheckInOut = (user) => {
  if (!user) return false;
  return PERMISSIONS.ATTENDANCE_PERMISSIONS.canCheckInOut.includes(user.role);
};

export const canViewAllAttendanceRecords = (user) => {
  if (!user) return false;
  return user.role === 'admin' || user.department === 'HR';
};

export const canManageEmployees = (user) => {
  if (!user) return false;
  return user.role === 'admin' || user.department === 'HR';
};

// Purchasing permission helpers
export const canCreatePurchaseOrder = (user) => {
  if (!user) return false;
  // Admin can always create orders
  if (user.role === 'admin') return true;
  // Only employees in Purchasing department can create orders
  if (user.role === 'employee' && user.department === 'Purchasing') return true;
  return false;
};

export const canAcceptPurchaseOrder = (user) => {
  if (!user) return false;
  // Admin can always accept orders
  if (user.role === 'admin') return true;
  // Only managers in Purchasing department can accept orders
  if (user.role === 'manager' && user.department === 'Purchasing') return true;
  return false;
};

export const canReceivePurchaseOrder = (user) => {
  if (!user) return false;
  // Admin can always receive orders
  if (user.role === 'admin') return true;
  // Only employees in Purchasing department can receive orders
  if (user.role === 'employee' && user.department === 'Purchasing') return true;
  return false;
};

export const canEditPurchaseOrder = (user) => {
  if (!user) return false;
  return user.role === 'admin' || (user.role === 'manager' && user.department === 'Purchasing');
};

export const canDeletePurchaseOrder = (user) => {
  if (!user) return false;
  return user.role === 'admin' || (user.role === 'manager' && user.department === 'Purchasing');
};

// Employee management permission helpers
export const canAddEmployee = (user) => {
  if (!user) return false;
  // Admin and managers can add employees, employees can add employees except HR employees
  if (user.role === 'admin' || user.role === 'manager') return true;
  if (user.role === 'employee' && user.department !== 'HR') return true;
  return false;
};

export const canEditEmployee = (user) => {
  if (!user) return false;
  // Admin and managers can edit employees, employees can edit employees except HR employees
  if (user.role === 'admin' || user.role === 'manager') return true;
  if (user.role === 'employee' && user.department !== 'HR') return true;
  return false;
};

export const canDeleteEmployee = (user) => {
  if (!user) return false;
  // Admin and managers can delete employees, employees can delete employees except HR employees
  if (user.role === 'admin' || user.role === 'manager') return true;
  if (user.role === 'employee' && user.department !== 'HR') return true;
  return false;
};

// Check if attendance should be shown in a specific module context
export const canShowAttendanceInModule = (user, module) => {
  if (!user) return false;
  
  // For admin users, only show attendance in HR module
  if (user.role === 'admin') {
    return module === 'hr';
  }
  
  // For other users, show attendance in their department modules
  return user.department === 'HR' || PERMISSIONS.DEPARTMENT_MODULES[user.department]?.includes('attendance') || false;
};

// Helper function to check if user can access module dashboard
export const canAccessModuleDashboard = (user, module) => {
  if (!user) return false;
  
  // Admin can access all module dashboards
  if (user.role === 'admin') return true;
  
  // Only managers can access their department's dashboard
  if (user.role !== 'manager') return false;
  
  // Check if user is manager of the module's department
  const departmentMap = {
    'hr': 'HR',
    'sales': 'Sales',
    'purchasing': 'Purchasing',
    'inventory': 'Inventory',
    'manufacturing': 'Manufacturing',
    'crm': 'CRM',
    'scm': 'SCM',
    'finance': 'Finance',
  };
  
  const requiredDepartment = departmentMap[module];
  return user.department === requiredDepartment;
};

// Module display names
export const MODULE_NAMES = {
  dashboard: 'Dashboard',
  hr: 'Human Resources',
  sales: 'Sales',
  purchasing: 'Purchasing',
  inventory: 'Inventory',
  manufacturing: 'Manufacturing',
    crm: 'Customer Relations',
    scm: 'Supply Chain',
    finance: 'Finance',
    attendance: 'Attendance'
  };
