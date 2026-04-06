// Utility function to translate navigation items
export const translateNavigationItem = (name, t) => {
  const translationMap = {
    'Dashboard': t('navigation.dashboard'),
    'Employees': t('navigation.employees'),
    'Orders': t('navigation.orders'),
    'Products': t('navigation.products'),
    'Reports': t('navigation.reports'),
    'Attendance': t('navigation.attendance'),
    'Attendance Report': t('navigation.attendanceReport'),
    'Customers': t('navigation.customers'),
    'Complaints': t('navigation.complaints'),
    'Suppliers': t('navigation.suppliers'),
    'All Products': t('navigation.allProducts'),
    'Raw Materials': t('navigation.rawMaterials'),
    'Final Products': t('navigation.finalProducts'),
    'Others': t('navigation.others'),
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
    'Recruitment': t('navigation.recruitment')
  };
  
  return translationMap[name] || name;
};

