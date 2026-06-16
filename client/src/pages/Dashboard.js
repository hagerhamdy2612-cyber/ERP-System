import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { translateNavigationItem } from '../utils/translateNavigation';
import Card from '../components/Card';
import {
  Users,
  ShoppingCart,
  ShoppingBag,
  Package,
  TrendingUp,
  Clock,
  Factory,
  Truck,
  UserCheck,
  AlertTriangle,
  DollarSign,
  Star
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';

  const departmentNavLabel = (dept) => {
    if (!dept || typeof dept !== 'string') return '';
    const key = dept.toLowerCase();
    const map = {
      sales: 'Sales',
      purchasing: 'Purchasing',
      hr: 'HR',
      inventory: 'Inventory',
      manufacturing: 'Manufacturing',
      finance: 'Finance',
      crm: 'CRM',
      scm: 'SCM'
    };
    return translateNavigationItem(map[key] || dept, t);
  };

  const translateActivityDescription = (desc) => {
    if (!desc || typeof desc !== 'string') return desc;
    const fromMatch = desc.match(/^Order (.+?) from (.+)$/);
    if (fromMatch) {
      return t('mainDashboard.activityDescriptions.orderFromParty', {
        orderNumber: fromMatch[1],
        name: fromMatch[2]
      });
    }
    const forMatch = desc.match(/^Order (.+?) for (.+)$/);
    if (forMatch) {
      return t('mainDashboard.activityDescriptions.orderForProduct', {
        orderNumber: forMatch[1],
        product: forMatch[2]
      });
    }
    return desc;
  };

  const translateActivityStatus = (type, status) => {
    if (!status) return '';
    if (type === 'sales') return t(`sales.reports.status.${status}`, { defaultValue: status });
    if (type === 'purchasing') return t(`purchasing.reports.status.${status}`, { defaultValue: status });
    if (type === 'production') return t(`manufacturing.reports.status.${status}`, { defaultValue: status });
    return status;
  };
  const [kpis, setKpis] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [departmentChart, setDepartmentChart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const isAdmin = user?.role === 'admin';
      const dept = user?.department;
      const kpisUrl = isAdmin ? '/api/dashboard/kpis' : `/api/dashboard/kpis?department=${dept}`;
      const activitiesUrl = isAdmin
        ? '/api/dashboard/recent-activities'
        : `/api/dashboard/recent-activities?department=${dept}`;
      const chartUrl = isAdmin
        ? '/api/dashboard/sales-chart?period=year'
        : `/api/dashboard/department-chart?department=${dept}&period=month`;

      // Use allSettled so one failing endpoint can't blank the entire dashboard.
      const [kpisRes, activitiesRes, chartRes] = await Promise.allSettled([
        axios.get(kpisUrl),
        axios.get(activitiesUrl),
        axios.get(chartUrl)
      ]);

      if (kpisRes.status === 'fulfilled') {
        setKpis(kpisRes.value.data.data);
      } else {
        console.error('KPIs fetch error:', kpisRes.reason);
      }
      if (activitiesRes.status === 'fulfilled') {
        setRecentActivities(activitiesRes.value.data.data);
      } else {
        console.error('Recent activities fetch error:', activitiesRes.reason);
      }
      if (chartRes.status === 'fulfilled') {
        setDepartmentChart(chartRes.value.data.data);
      } else {
        console.error('Chart fetch error:', chartRes.reason);
      }
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Department-specific KPI cards
  const getDepartmentKPIs = () => {
    // Admin gets comprehensive overview of all departments
    if (user?.role === 'admin') {
      return [
        {
          title: t('mainDashboard.kpis.totalEmployees'),
          value: kpis?.employees?.total || 0,
          icon: Users,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        },
        {
          title: t('mainDashboard.kpis.salesRevenue'),
          value: `$${((kpis?.sales?.totalRevenue || 0)).toLocaleString(locale)}`,
          icon: DollarSign,
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        },
        {
          title: t('mainDashboard.kpis.totalProducts'),
          value: kpis?.inventory?.totalProducts || 0,
          icon: Package,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100'
        },
        {
          title: t('mainDashboard.kpis.lowStockAlerts'),
          value: kpis?.inventory?.lowStockAlerts || 0,
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        },
        {
          title: t('mainDashboard.kpis.pendingOrders'),
          value: (kpis?.production?.pending || 0) + (kpis?.purchasing?.pending || 0),
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100'
        },
        {
          title: t('mainDashboard.kpis.totalCustomers'),
          value: kpis?.customers?.total || 0,
          icon: UserCheck,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-100'
        },
        {
          title: t('mainDashboard.kpis.activeSuppliers'),
          value: kpis?.suppliers?.total || 0,
          icon: Truck,
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        },
        {
          title: t('mainDashboard.kpis.topProduct'),
          value: kpis?.topProduct?.name || t('common.notApplicable'),
          subtitle: kpis?.topProduct ? `${kpis.topProduct.totalQuantity} ${t('mainDashboard.kpis.sold')}` : t('mainDashboard.kpis.noSalesData'),
          icon: Star,
          color: 'text-pink-600',
          bgColor: 'bg-pink-100'
        }
      ];
    }

    // Managers get department-specific data
    const department = user?.department?.toLowerCase();
    
    switch (department) {
      case 'sales':
        return [
          {
            title: t('mainDashboard.kpis.totalRevenue'),
            value: `$${((kpis?.sales?.monthlyRevenue || 0)).toLocaleString(locale)}`,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: t('mainDashboard.kpis.ordersThisMonth'),
            value: kpis?.sales?.monthlyOrders || 0,
            icon: ShoppingCart,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: t('mainDashboard.kpis.activeCustomers'),
            value: kpis?.customers?.total || 0,
            icon: UserCheck,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100'
          },
          {
            title: t('mainDashboard.kpis.topProduct'),
            value: kpis?.topProduct?.name || t('common.notApplicable'),
            subtitle: kpis?.topProduct ? `${kpis.topProduct.totalQuantity} ${t('mainDashboard.kpis.sold')}` : t('mainDashboard.kpis.noSalesData'),
            icon: Star,
            color: 'text-orange-600',
            bgColor: 'bg-orange-100'
          }
        ];
      
      case 'purchasing':
        return [
          {
            title: t('mainDashboard.kpis.totalSpending'),
            value: `$${((kpis?.purchasing?.monthlySpending || 0)).toLocaleString(locale)}`,
            icon: DollarSign,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          },
          {
            title: t('mainDashboard.kpis.purchaseOrders'),
            value: kpis?.purchasing?.totalOrders || 0,
            icon: ShoppingBag,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: t('mainDashboard.kpis.activeSuppliers'),
            value: kpis?.suppliers?.total || 0,
            icon: Truck,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100'
          },
          {
            title: t('mainDashboard.kpis.pendingOrders'),
            value: kpis?.purchasing?.pending || 0,
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
          }
        ];
      
      case 'hr':
        return [
          {
            title: t('mainDashboard.kpis.totalEmployees'),
            value: kpis?.employees?.total || 0,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: t('mainDashboard.kpis.presentToday'),
            value: kpis?.employees?.presentToday || 0,
            icon: UserCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: t('mainDashboard.kpis.absentToday'),
            value: kpis?.employees?.absentToday || 0,
            icon: AlertTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            title: t('mainDashboard.kpis.newHiresThisMonth'),
            value: kpis?.employees?.newThisMonth || 0,
            icon: TrendingUp,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          }
        ];
      
      case 'inventory':
        return [
          {
            title: t('mainDashboard.kpis.totalProducts'),
            value: kpis?.inventory?.totalProducts || 0,
            icon: Package,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: t('mainDashboard.kpis.lowStockItems'),
            value: kpis?.inventory?.lowStockAlerts || 0,
            icon: AlertTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            title: t('mainDashboard.kpis.totalValue'),
            value: `$${((kpis?.inventory?.totalValue || 0)).toLocaleString(locale)}`,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: t('mainDashboard.kpis.recentMovements'),
            value: kpis?.inventory?.recentMovements || 0,
            icon: TrendingUp,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          }
        ];
      
      case 'manufacturing':
        return [
          {
            title: t('mainDashboard.kpis.productionOrders'),
            value: kpis?.production?.totalOrders || 0,
            icon: Factory,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: t('mainDashboard.kpis.completedToday'),
            value: kpis?.production?.completedToday || 0,
            icon: UserCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: t('mainDashboard.kpis.inProgress'),
            value: kpis?.production?.inProgress || 0,
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
          },
          {
            title: t('mainDashboard.kpis.efficiencyRate'),
            value: `${kpis?.production?.efficiency || 0}%`,
            icon: TrendingUp,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          }
        ];
      
      default:
        return [
          {
            title: t('mainDashboard.kpis.departmentOverview'),
            value: t('mainDashboard.kpis.noDataAvailable'),
            icon: Package,
            color: 'text-gray-600',
            bgColor: 'bg-gray-100'
          }
        ];
    }
  };

  const kpiCards = getDepartmentKPIs();

  const getActivityIcon = (type) => {
    switch (type) {
      case 'sales': return ShoppingCart;
      case 'production': return Factory;
      case 'purchasing': return Truck;
      default: return Clock;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'sales': return 'text-green-600';
      case 'production': return 'text-blue-600';
      case 'purchasing': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'confirmed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('mainDashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('mainDashboard.description')}
        </p>
      </div>


      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpiCards.map((card, index) => (
          <Card key={index} className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${card.bgColor}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {card.title}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {card.value}
                    </dd>
                    {card.subtitle && (
                      <dd className="text-sm text-gray-500 dark:text-gray-400">
                        {card.subtitle}
                      </dd>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>


      {/* Charts and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {user?.role === 'admin'
                ? t('mainDashboard.charts.salesRevenueChart')
                : `${departmentNavLabel(user?.department)} ${t('mainDashboard.charts.performanceTrend')}`}
            </h3>
            <div className="flex items-center text-sm text-green-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              {departmentChart.length > 0
                ? t('mainDashboard.chartTotalLine', {
                    amount: `$${departmentChart
                      .reduce(
                        (sum, item) =>
                          sum +
                          (user?.role === 'admin' ? item.revenue || 0 : item.value || 0),
                        0
                      )
                      .toLocaleString(locale)}`
                  })
                : t('common.noData')}
            </div>
          </div>
          <div className="h-64">
            {departmentChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={departmentChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="_id" 
                    stroke="#666"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      typeof value === 'string' && value.length === 7
                        ? new Date(`${value}-01`).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
                        : new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
                    }
                  />
                  <YAxis 
                    stroke="#666"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => [`$${value.toLocaleString(locale)}`, t('sales.reports.revenue')]}
                    contentStyle={{
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                    }}
                    labelFormatter={(value) =>
                      typeof value === 'string' && value.length === 7
                        ? new Date(`${value}-01`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
                        : new Date(value).toLocaleDateString(locale)
                    }
                  />
                  <Line 
                    type="monotone" 
                    dataKey={user?.role === 'admin' ? 'revenue' : 'value'} 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>{t('mainDashboard.charts.noSalesDataAvailable')}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activities */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('mainDashboard.charts.recentActivities')}</h3>
          <div className="space-y-4">
            {recentActivities.slice(0, 5).map((activity, index) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {translateActivityDescription(activity.description)}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {translateActivityStatus(activity.type, activity.status)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(activity.timestamp).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Attendance */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('mainDashboard.charts.employeeAttendance')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.presentToday')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.employees?.presentToday || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.totalEmployees')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.employees?.total || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.attendanceRate')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.employees?.attendanceRate || 0}%
              </span>
            </div>
          </div>
        </Card>

        {/* Production Status */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('mainDashboard.charts.productionStatus')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.pendingOrders')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.production?.pending || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.inProgress')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.production?.inProgress || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.totalOrders')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.production?.totalOrders || 0}
              </span>
            </div>
          </div>
        </Card>

        {/* Inventory Value */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('mainDashboard.charts.inventoryValue')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.totalValue')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ${(kpis?.inventory?.totalValue || 0).toLocaleString(locale)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('mainDashboard.charts.lowStockItems')}</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {kpis?.inventory?.lowStockAlerts || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('inventory.dashboard.totalProducts')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {kpis?.inventory?.totalProducts || 0}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
