import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getUserAllowedModules, MODULE_NAMES, canShowAttendanceInModule, canAccessDashboardRoute, canManageFinanceBankAccounts } from '../config/permissions';
import LanguageSwitcher from './LanguageSwitcher';
import { translateNavigationItem } from '../utils/translateNavigation';
import {
  Home,
  Users,
  Factory,
  Truck,
  UserCheck,
  ShoppingCart,
  Package,
  ShoppingBag,
  Menu,
  X,
  LogOut,
  User,
  Sun,
  Moon,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  Wallet,
  ClipboardList,
  Archive
} from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Get user's allowed modules
  const allowedModules = useMemo(() => {
    return getUserAllowedModules(user);
  }, [user]);

  // Define all possible navigation items
  const allNavigation = [
    ...(user?.role === 'admin' ? [
      {
        name: 'Main Dashboard',
        href: '/app/dashboard',
        icon: Home,
        module: 'dashboard'
      },
      {
        name: 'Activity Log',
        href: '/app/admin/activity-log',
        icon: ClipboardList,
        module: 'dashboard'
      },
      {
        name: 'Archive',
        href: '/app/admin/archive',
        icon: Archive,
        module: 'archive'
      }
    ] : []),
    { 
      name: 'HR', 
      href: '/app/hr/dashboard', 
      icon: Users, 
      module: 'hr',
      children: [
        { name: 'Dashboard', href: '/app/hr/dashboard' },
        { name: 'Employees', href: '/app/hr/employees' },
        { name: 'Attendance', href: '/app/hr/attendance' },
        { name: 'Attendance Report', href: '/app/hr/attendance-report' },
        { name: 'Reports', href: '/app/hr/reports' }
      ]
    },
    { 
      name: 'Manufacturing', 
      href: '/app/manufacturing/dashboard', 
      icon: Factory, 
      module: 'manufacturing',
      children: [
        { name: 'Dashboard', href: '/app/manufacturing/dashboard' },
        { name: 'Orders', href: '/app/manufacturing/orders' },
        { name: 'Reports', href: '/app/manufacturing/reports' },
        { name: 'Attendance', href: '/app/manufacturing/attendance' }
      ]
    },
    { 
      name: 'SCM', 
      href: '/app/scm/dashboard', 
      icon: Truck, 
      module: 'scm',
      children: [
        { name: 'Dashboard', href: '/app/scm/dashboard' },
        { name: 'Suppliers', href: '/app/scm/suppliers' },
        { name: 'Reports', href: '/app/scm/reports' },
        { name: 'Attendance', href: '/app/scm/attendance' }
      ]
    },
    { 
      name: 'CRM', 
      href: '/app/crm/dashboard', 
      icon: UserCheck, 
      module: 'crm',
      children: [
        { name: 'Dashboard', href: '/app/crm/dashboard' },
        { name: 'Customers', href: '/app/crm/customers' },
        { name: 'Complaints', href: '/app/crm/complaints' },
        { name: 'Reports', href: '/app/crm/reports' },
        { name: 'Attendance', href: '/app/crm/attendance' }
      ]
    },
    { 
      name: 'Sales', 
      href: '/app/sales/dashboard', 
      icon: ShoppingCart, 
      module: 'sales',
      children: [
        { name: 'Dashboard', href: '/app/sales/dashboard' },
        { name: 'Orders', href: '/app/sales/orders' },
        { name: 'Reports', href: '/app/sales/reports' },
        { name: 'Attendance', href: '/app/sales/attendance' }
      ]
    },
    { 
      name: 'Inventory', 
      href: '/app/inventory/dashboard', 
      icon: Package, 
      module: 'inventory',
      children: [
        { name: 'Dashboard', href: '/app/inventory/dashboard' },
        { name: 'All Products', href: '/app/inventory/products' },
        { name: 'Raw Materials', href: '/app/inventory/raw-materials' },
        { name: 'Final Products', href: '/app/inventory/finished-products' },
        { name: 'Others', href: '/app/inventory/others' },
        { name: 'Reports', href: '/app/inventory/reports' },
        { name: 'Attendance', href: '/app/inventory/attendance' }
      ]
    },
    { 
      name: 'Purchasing', 
      href: '/app/purchasing/dashboard', 
      icon: ShoppingBag, 
      module: 'purchasing',
      children: [
        { name: 'Dashboard', href: '/app/purchasing/dashboard' },
        { name: 'Orders', href: '/app/purchasing/orders' },
        { name: 'Reports', href: '/app/purchasing/reports' },
        { name: 'Attendance', href: '/app/purchasing/attendance' }
      ]
    },
    {
      name: 'Finance',
      href: '/app/finance/dashboard',
      icon: Wallet,
      module: 'finance',
      children: [
        { name: 'Dashboard', href: '/app/finance/dashboard' },
        { name: 'Transactions', href: '/app/finance/transactions' },
        { name: 'Bank', href: '/app/finance/bank', financeBankAccess: true },
        { name: 'Expenses', href: '/app/finance/expenses' },
        { name: 'Attendance', href: '/app/finance/attendance' },
        { name: 'Manage Accounts', href: '/app/finance/bank-accounts', financeBankAccess: true }
      ]
    }
  ];

  // Filter navigation based on user permissions
  const navigation = useMemo(() => {
    return allNavigation.map(item => {
      // Filter children based on attendance and dashboard permissions
      const filteredChildren = item.children?.filter(child => {
        if (child.name === 'Attendance') {
          return canShowAttendanceInModule(user, item.module);
        }
        // Hide Dashboard links for employees (only show for managers and admins)
        if (child.name === 'Dashboard') {
          return canAccessDashboardRoute(user, item.module);
        }
        // Hide admin-only items for non-admin users
        if (child.adminOnly && user?.role !== 'admin') {
          return false;
        }
        if (child.financeBankAccess && !canManageFinanceBankAccounts(user)) {
          return false;
        }
        return true;
      });
      
      // Update main href if Dashboard is not accessible
      let mainHref = item.href;
      const hasDashboardAccess = canAccessDashboardRoute(user, item.module);
      if (!hasDashboardAccess && filteredChildren && filteredChildren.length > 0) {
        // Use the first non-dashboard child as the main href
        const nonDashboardChild = filteredChildren.find(c => c.name !== 'Dashboard');
        if (nonDashboardChild) {
          mainHref = nonDashboardChild.href;
        }
      }
      
      return {
        ...item,
        href: mainHref,
        children: filteredChildren
      };
    }).filter(item => {
      // Archive: admin only
      if (item.module === 'archive') {
        return user?.role === 'admin';
      }
      // Filter by allowed modules
      if (!allowedModules.includes(item.module)) {
        return false;
      }
      // Keep item if it has children or if it's a valid module (even with no children, it might be a parent link)
      return true;
    });
  }, [allowedModules, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (href) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Top bar - Fixed at the very top */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-16 bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-700 transition-colors duration-300">
        <button
          type="button"
          className="px-4 border-r border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden transition-colors duration-300"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1 px-6 flex justify-between items-center">
          <div className="flex items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">MTI-ERP</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Enterprise Resource Planning</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <LanguageSwitcher />
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 hover:scale-105"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            {/* User Profile */}
            <div className="flex items-center space-x-3 bg-gray-50 dark:bg-slate-800 rounded-lg px-4 py-2 transition-colors duration-300">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</span>
              </div>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex flex-col max-w-xs w-full h-full bg-white dark:bg-slate-900 shadow-xl transition-colors duration-300">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent navigation={navigation} isActive={isActive} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0 lg:fixed lg:left-0 lg:top-16 lg:bottom-0 lg:w-64 lg:h-[calc(100vh-4rem)] lg:z-30">
        <div className="flex flex-col w-full h-full">
          <SidebarContent navigation={navigation} isActive={isActive} />
        </div>
      </div>

      {/* Main content - with top padding to account for fixed header */}
      <div className="lg:pl-64 flex flex-col flex-1 pt-16">
        {/* Page content */}
        <main className="flex-1">
          <div className="py-2">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ navigation, isActive }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState(() => {
    // Initialize expanded state based on current location
    const expanded = {};
    navigation.forEach(item => {
      if (item.children) {
        // Check if any child is active
        const hasActiveChild = item.children.some(child => isActive(child.href));
        expanded[item.name] = hasActiveChild;
      }
    });
    return expanded;
  });

  // Update expanded state when location changes to auto-expand active parents
  useEffect(() => {
    setExpandedItems(prev => {
      const updatedExpanded = { ...prev };
      navigation.forEach(item => {
        if (item.children) {
          const hasActiveChild = item.children.some(child => {
            const childPath = child.href;
            return location.pathname === childPath || location.pathname.startsWith(childPath + '/');
          });
          if (hasActiveChild) {
            updatedExpanded[item.name] = true;
          }
        }
      });
      return updatedExpanded;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleExpand = (itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const handleParentClick = (item) => {
    if (item.children && item.children.length > 0) {
      // Toggle expand/collapse instead of navigating
      toggleExpand(item.name);
    } else {
      // If no children, navigate directly
      navigate(item.href);
    }
  };

  const handleChildClick = (childHref) => {
    navigate(childHref);
    // Expand parent if not already expanded
    const parentItem = navigation.find(item => 
      item.children?.some(c => c.href === childHref)
    );
    if (parentItem && !expandedItems[parentItem.name]) {
      setExpandedItems(prev => ({
        ...prev,
        [parentItem.name]: true
      }));
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-full transition-colors duration-300">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isExpanded = expandedItems[item.name];
            const hasActiveChild = item.children?.some(child => isActive(child.href));
            const isParentActive = hasActiveChild || (item.children && item.children.length > 0 && isExpanded);
            const isParentItemActive = isActive(item.href);

            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => handleParentClick(item)}
                  className={`${
                    hasActiveChild || isParentItemActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20 border-l-4 border-primary-400'
                      : isParentActive && !hasActiveChild
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-l-4 border-gray-300 dark:border-gray-600'
                      : 'text-gray-700 dark:text-gray-300 border-l-4 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm hover:border-l-4 hover:border-primary-300 dark:hover:border-primary-600'
                  } group flex items-center px-4 py-3 text-sm font-medium rounded-r-lg w-full text-left transition-all duration-200 hover:scale-[1.01]`}
                >
                  <item.icon
                    className={`${
                      hasActiveChild || isParentItemActive
                        ? 'text-white' 
                        : 'text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                    } mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200`}
                  />
                  <span className="flex-1">{translateNavigationItem(item.name, t)}</span>
                  {item.children && item.children.length > 0 && (
                    <span className="ml-2 flex items-center">
                      {isExpanded ? (
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${hasActiveChild || isParentItemActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                      ) : (
                        <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${hasActiveChild || isParentItemActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                      )}
                    </span>
                  )}
                </button>
                {item.children && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-slate-700 pl-2">
                    {item.children.map((child) => (
                      <button
                        key={child.name}
                        onClick={() => handleChildClick(child.href)}
                        className={`${
                          isActive(child.href)
                            ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border-l-2 border-primary-600 font-medium shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 border-l-2 border-transparent hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:border-l-2 hover:border-primary-300 dark:hover:border-primary-600'
                        } flex items-center px-4 py-2.5 text-sm rounded-r-md w-full text-left transition-all duration-200 hover:translate-x-1 hover:shadow-sm`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-3 transition-colors duration-200 ${
                          isActive(child.href) 
                            ? 'bg-primary-600' 
                            : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-primary-400'
                        }`}></span>
                        {translateNavigationItem(child.name, t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
