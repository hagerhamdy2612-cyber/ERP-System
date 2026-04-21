// Utility function to translate navigation items
export const translateNavigationItem = (name, t) => {
  const translationMap = {
    'Main Dashboard': t('navigation.mainDashboard'),
    'Activity Log': t('navigation.activityLog'),
    'Archive': t('navigation.archive'),
    'Dashboard': t('navigation.dashboard'),
    'Employees': t('navigation.employees'),
    'Orders': t('navigation.orders'),
    'Reports': t('navigation.reports'),
    'Attendance': t('navigation.attendance'),
    'Attendance Report': t('navigation.attendanceReport'),
    'Customers': t('navigation.customers'),
    'Complaints': t('navigation.complaints'),
    'Suppliers': t('navigation.suppliers'),
    'Raw Materials': t('navigation.rawMaterials'),
    'Final Products': t('navigation.finalProducts'),
    'HR': t('navigation.hr'),
    'Sales': t('navigation.sales'),
    'Purchasing': t('navigation.purchasing'),
    'Inventory': t('navigation.inventory'),
    'Manufacturing': t('navigation.manufacturing'),
    'CRM': t('navigation.crm'),
    'SCM': t('navigation.scm'),
    'Finance': t('navigation.finance'),
    'Manage Accounts': t('navigation.manageAccounts'),
    'Transactions': t('common.transactions'),
    'Bank': t('common.bank'),
    'Expenses': t('common.expenses'),
    'Payroll': t('navigation.payroll')
  };
  
  return translationMap[name] || name;
};

