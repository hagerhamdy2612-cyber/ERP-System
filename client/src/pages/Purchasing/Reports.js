import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { 
  DollarSign, 
  ShoppingBag, 
  Truck, 
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Mail
} from 'lucide-react';

const PurchasingReports = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState({
    spending: null,
    orders: null,
    suppliers: null,
    products: null,
    trends: null,
    lowStock: null
  });
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    fetchAllReports();
  }, [dateRange]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const [spendingRes, ordersRes, suppliersRes, productsRes, lowStockRes] = await Promise.all([
        axios.get(`/api/purchasing/spending?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/purchasing/orders-report?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/purchasing/suppliers-report?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get(`/api/purchasing/products-report?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        axios.get('/api/purchasing/low-stock-alerts')
      ]);

      setReports({
        spending: spendingRes.data.data,
        orders: ordersRes.data.data,
        suppliers: suppliersRes.data.data,
        products: productsRes.data.data,
        trends: null,
        lowStock: lowStockRes.data.data
      });
    } catch (error) {
      toast.error(t('purchasing.reports.errors.fetchFailed'));
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
      const response = await axios.get(`/api/reports/export/purchasing?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purchasing-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('purchasing.reports.messages.exportSuccess'));
    } catch (error) {
      toast.error(t('purchasing.reports.errors.exportFailed'));
    }
  };

  const sendReport = async () => {
    setSendLoading(true);
    try {
      // Fetch purchase orders data (same as export endpoint logic)
      const ordersResponse = await axios.get('/api/purchasing/orders');
      const allOrders = ordersResponse.data.data || [];

      // Filter by date range and status (same as export endpoint - only 'received' status)
      const startDate = new Date(dateRange.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      const filteredOrders = allOrders.filter(order => {
        // Filter by status (only 'received' orders)
        if (order.status !== 'received') {
          return false;
        }

        // Filter by receivedDate if available, otherwise use orderDate
        const orderDate = order.receivedDate ? new Date(order.receivedDate) : (order.orderDate ? new Date(order.orderDate) : null);
        if (orderDate) {
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
          'Supplier': order.supplier?.name || 'N/A',
          'Total': order.total || 0,
          'Status': order.status || '',
          'Order Date': order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
          'Received Date': order.receivedDate ? new Date(order.receivedDate).toISOString().split('T')[0] : 'N/A',
          'Items': items
        };
      });

      if (reportData.length === 0) {
        toast.error(t('purchasing.reports.errors.noOrdersInDateRange'));
        setSendLoading(false);
        return;
      }

      // Send report via email
      const response = await axios.post('/api/reports/send', {
        module: 'purchasing',
        reportData: reportData
      });

      if (response.data.success) {
        toast.success(response.data.message || t('purchasing.reports.messages.sendSuccess'));
      } else {
        toast.error(response.data.message || t('purchasing.reports.errors.sendFailed'));
      }
    } catch (error) {
      console.error('Send report error:', error);
      const errorMessage = error.response?.data?.message || error.message || t('purchasing.reports.errors.sendFailed');
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
            <div className={`p-3 rounded-md ${color.includes('red') ? 'bg-red-100 dark:bg-red-500/20' : color.includes('blue') ? 'bg-blue-100 dark:bg-blue-500/20' : color.includes('purple') ? 'bg-purple-100 dark:bg-purple-500/20' : 'bg-orange-100 dark:bg-orange-500/20'}`}>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('purchasing.reports.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('purchasing.reports.description')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchAllReports()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('purchasing.reports.refresh')}
          </button>
          <button
            onClick={sendReport}
            disabled={sendLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendLoading ? t('purchasing.reports.sending') : t('purchasing.reports.sendReport')}
          </button>
          <button
            onClick={exportReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('purchasing.reports.exportReport')}
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.reports.startDate')}</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.reports.endDate')}</label>
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
          title={t('purchasing.reports.totalSpent')}
          value={`$${reports.spending?.totalSpent?.toLocaleString() || '0'}`}
          icon={DollarSign}
          color="text-red-600"
          subtitle={t('purchasing.reports.ordersCount', { count: reports.spending?.orderCount || 0 })}
        />
        <StatCard
          title={t('purchasing.reports.averageOrderValue')}
          value={`$${reports.spending?.averageOrderValue?.toFixed(2) || '0'}`}
          icon={ShoppingBag}
          color="text-blue-600"
          subtitle={t('purchasing.reports.perOrder')}
        />
        <StatCard
          title={t('purchasing.reports.activeSuppliers')}
          value={reports.suppliers?.activeSuppliers || '0'}
          icon={Truck}
          color="text-purple-600"
          subtitle={t('purchasing.reports.inPeriod')}
        />
        <StatCard
          title={t('purchasing.reports.lowStockItems')}
          value={reports.lowStock?.length || '0'}
          icon={AlertTriangle}
          color="text-orange-600"
          subtitle={t('purchasing.reports.needReorder')}
        />
      </div>

      {/* Low Stock Alerts */}
      {reports.lowStock && reports.lowStock.length > 0 && (
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-400 dark:text-orange-500 mr-2" />
            <h3 className="text-lg font-medium text-orange-800 dark:text-orange-300">{t('purchasing.reports.lowStockAlerts')}</h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.lowStock.map((item, index) => (
              <div key={index} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('inventory.dashboard.sku')}: {item.product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      {item.product.currentStock} / {item.product.minStockLevel}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('purchasing.reports.currentMin')}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('purchasing.reports.suggestedQty')}: {item.suggestedQuantity}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Suppliers */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('purchasing.reports.topSuppliers')}
          </h3>
        </div>
        {reports.suppliers?.topSuppliers && (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.supplier')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.orders')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.totalSpent')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.averageOrderValue')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.lastOrder')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.suppliers.topSuppliers.map((supplier, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {supplier.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {supplier.orderCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${supplier.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${supplier.averageOrderValue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(supplier.lastOrderDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top Purchased Products */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('purchasing.reports.mostPurchasedProducts')}
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
                    {t('purchasing.reports.quantityPurchased')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.totalCost')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.averageUnitCost')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {t('purchasing.reports.supplier')}
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
                      {product.quantityPurchased}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${product.totalCost.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${product.averageUnitCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.supplier}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PurchasingReports;
