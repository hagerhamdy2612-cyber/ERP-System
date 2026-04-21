import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { 
  BarChart3, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Download,
  Filter,
  RefreshCw,
  Mail
} from 'lucide-react';

const SalesReports = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState({
    revenue: null,
    orders: null,
    customers: null,
    products: null,
    trends: null
  });
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    fetchAllReports();
  }, [dateRange]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const [revenueRes, ordersRes, customersRes, productsRes, trendsRes] = await Promise.all([
        axios.get(`/api/sales/revenue?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/sales/orders?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/sales/customers-report?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/sales/products-report?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/sales/trends?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
      ]);

      setReports({
        revenue: revenueRes.data.data,
        orders: ordersRes.data.data,
        customers: customersRes.data.data,
        products: productsRes.data.data,
        trends: trendsRes.data.data
      });
    } catch (error) {
      toast.error(t('sales.reports.errors.fetchFailed'));
      console.error('Reports fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const exportReport = async () => {
    try {
      const response = await axios.get(`/api/reports/export/sales?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('sales.reports.messages.exportSuccess'));
    } catch (error) {
      toast.error(t('sales.reports.errors.exportFailed'));
    }
  };

  const sendReport = async () => {
    setSendLoading(true);
    try {
      // Fetch orders data (same as export endpoint logic)
      const ordersResponse = await axios.get('/api/sales/orders');
      const allOrders = ordersResponse.data.data || [];

      // Filter by date range and status (same as export endpoint)
      const startDate = new Date(dateRange.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      const filteredOrders = allOrders.filter(order => {
        // Filter by status (confirmed, shipped, delivered)
        if (!['confirmed', 'shipped', 'delivered'].includes(order.status)) {
          return false;
        }

        // Filter by date range
        if (order.orderDate) {
          const orderDate = new Date(order.orderDate);
          return orderDate >= startDate && orderDate <= endDate;
        }

        return false;
      });

      // Format orders to match export structure
      const reportData = filteredOrders.map(order => {
        const items = order.items?.map(item => 
          `${item.product?.name || 'N/A'} (${item.quantity || 0})`
        ).join('; ') || 'N/A';
        
        return {
          'Order Number': order.orderNumber || '',
          'Customer': order.customer?.name || 'N/A',
          'Total': order.total || 0,
          'Status': order.status || '',
          'Order Date': order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
          'Items': items
        };
      });

      if (reportData.length === 0) {
        toast.error(t('sales.reports.errors.noOrdersInDateRange'));
        setSendLoading(false);
        return;
      }

      // Send report via email
      const response = await axios.post('/api/reports/send', {
        module: 'sales',
        reportData: reportData
      });

      if (response.data.success) {
        toast.success(response.data.message || t('sales.reports.messages.sendSuccess'));
      } else {
        toast.error(response.data.message || t('sales.reports.errors.sendFailed'));
      }
    } catch (error) {
      console.error('Send report error:', error);
      const errorMessage = error.response?.data?.message || error.message || t('sales.reports.errors.sendFailed');
      toast.error(errorMessage);
    } finally {
      setSendLoading(false);
    }
  };


  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${color.includes('green') ? 'bg-green-100 dark:bg-green-500/20' : color.includes('blue') ? 'bg-blue-100 dark:bg-blue-500/20' : color.includes('purple') ? 'bg-purple-100 dark:bg-purple-500/20' : 'bg-orange-100 dark:bg-orange-500/20'}`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900 dark:text-white">{value}</dd>
              {subtitle && <dd className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</dd>}
            </dl>
          </div>
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sales.reports.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('sales.reports.description')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchAllReports()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('sales.reports.refresh')}
          </button>
          <button
            onClick={sendReport}
            disabled={sendLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendLoading ? t('sales.reports.sending') : t('sales.reports.sendReport')}
          </button>
          <button
            onClick={exportReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('sales.reports.exportReport')}
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sales.reports.startDate')}</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sales.reports.endDate')}</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('sales.reports.totalRevenue')}
          value={`$${reports.revenue?.totalRevenue?.toLocaleString() || '0'}`}
          icon={DollarSign}
          color="text-green-600"
          subtitle={t('sales.reports.ordersCount', { count: reports.revenue?.orderCount || 0 })}
        />
        <StatCard
          title={t('sales.reports.averageOrderValue')}
          value={`$${reports.revenue?.averageOrderValue?.toFixed(2) || '0'}`}
          icon={ShoppingCart}
          color="text-blue-600"
          subtitle={t('sales.reports.perOrder')}
        />
        <StatCard
          title={t('sales.reports.activeCustomers')}
          value={reports.customers?.activeCustomers || '0'}
          icon={Users}
          color="text-purple-600"
          subtitle={t('sales.reports.inPeriod')}
        />
        <StatCard
          title={t('sales.reports.topProduct')}
          value={reports.products?.topProduct?.name || t('common.unknown')}
          icon={BarChart3}
          color="text-orange-600"
          subtitle={t('sales.reports.soldCount', { count: reports.products?.topProduct?.quantitySold || 0 })}
        />
      </div>

      {/* Revenue Trends */}
      <Card>
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
          {t('sales.reports.revenueTrends')}
        </h3>
        {reports.trends?.monthlyRevenue && (
          <div className="space-y-4">
            {reports.trends.monthlyRevenue.map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{month.month}</span>
                <div className="flex items-center space-x-4">
                  <div className="w-32 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-primary-600 dark:bg-primary-500 h-2 rounded-full" 
                      style={{ width: `${(month.revenue / Math.max(...reports.trends.monthlyRevenue.map(m => m.revenue))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-20 text-right">
                    ${month.revenue.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top Customers */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('sales.reports.topCustomers')}
          </h3>
        </div>
        {reports.customers?.topCustomers && (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.customer')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.orders')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.totalSpent')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.lastOrder')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.customers.topCustomers.map((customer, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {customer.orderCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${customer.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(customer.lastOrderDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top Products */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('sales.reports.topSellingProducts')}
          </h3>
        </div>
        {reports.products?.topProducts && (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('common.products')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.quantitySold')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.revenue')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('sales.reports.averagePrice')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.products.topProducts.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.quantitySold}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${product.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${product.averagePrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Order Status Distribution */}
      <Card>
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
          {t('sales.reports.orderStatusDistribution')}
        </h3>
        {reports.orders?.statusDistribution && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(reports.orders.statusDistribution).map(([status, count]) => (
              <div key={status} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'delivered' ? 'bg-green-500' :
                      status === 'shipped' ? 'bg-blue-500' :
                      status === 'confirmed' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {t(`sales.reports.status.${status}`, { defaultValue: status })}
                    </p>
                    <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">{count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SalesReports;
