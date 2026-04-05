import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Card from '../../components/Card';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Download,
  Filter,
  RefreshCw,
  Mail,
  DollarSign,
  Layers
} from 'lucide-react';

const InventoryReports = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState({
    summary: null,
    transactionStats: null,
    lowStockProducts: null,
    categoryBreakdown: null,
    topProductsByValue: null,
    allProducts: null
  });
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/reports/generate/inventory?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setReports(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch inventory report');
      console.error('Report fetch error:', error);
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
      const response = await axios.get(`/api/reports/export/inventory?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Inventory report exported successfully');
    } catch (error) {
      toast.error('Failed to export inventory report');
    }
  };

  const sendReport = async () => {
    setSendLoading(true);
    try {
      const reportData = [
        {
          'Total Products': reports.summary?.totalProducts || 0,
          'Total Inventory Value': `$${reports.summary?.totalInventoryValue?.toLocaleString() || 0}`,
          'Low Stock Items': reports.summary?.lowStockCount || 0,
          'Period': `${dateRange.startDate} to ${dateRange.endDate}`
        }
      ];

      const response = await axios.post('/api/reports/send', {
        module: 'inventory',
        reportData: reportData
      });

      if (response.data.success) {
        toast.success(response.data.message || 'Report sent successfully');
      } else {
        toast.error(response.data.message || 'Failed to send report');
      }
    } catch (error) {
      console.error('Send report error:', error);
      toast.error('Failed to send report');
    } finally {
      setSendLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${color.includes('blue') ? 'bg-blue-100 dark:bg-blue-500/20' : color.includes('green') ? 'bg-green-100 dark:bg-green-500/20' : color.includes('orange') ? 'bg-orange-100 dark:bg-orange-500/20' : 'bg-purple-100 dark:bg-purple-500/20'}`}>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Comprehensive inventory analytics and stock insights
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={sendReport}
            disabled={sendLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendLoading ? 'Sending...' : 'Send Report'}
          </button>
          <button
            onClick={exportReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
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
          title="Total Products"
          value={reports.summary?.totalProducts || '0'}
          icon={Package}
          color="text-blue-600"
          subtitle="Active products"
        />
        <StatCard
          title="Total Inventory Value"
          value={`$${reports.summary?.totalInventoryValue?.toLocaleString() || '0'}`}
          icon={DollarSign}
          color="text-green-600"
          subtitle="Current stock value"
        />
        <StatCard
          title="Low Stock Items"
          value={reports.summary?.lowStockCount || '0'}
          icon={AlertTriangle}
          color="text-orange-600"
          subtitle="Need reorder"
        />
        <StatCard
          title="Total Transactions"
          value={reports.transactionStats?.totalTransactions || '0'}
          icon={TrendingUp}
          color="text-purple-600"
          subtitle="In period"
        />
      </div>

      {/* Low Stock Alerts */}
      {reports.lowStockProducts && reports.lowStockProducts.length > 0 && (
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-400 dark:text-orange-500 mr-2" />
            <h3 className="text-lg font-medium text-orange-800 dark:text-orange-300">Low Stock Alerts</h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-orange-100 dark:bg-orange-900/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Min Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Category</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.lowStockProducts.map((item, index) => (
                  <tr key={index} className="hover:bg-orange-50/50 dark:hover:bg-orange-900/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400 font-medium">{item.currentStock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.minStockLevel}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.category || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      {reports.categoryBreakdown && reports.categoryBreakdown.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Category Breakdown
            </h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Value</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.categoryBreakdown.map((category, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{category.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{category.count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{category.totalStock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${category.totalValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Top Products by Value */}
      {reports.topProductsByValue && reports.topProductsByValue.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Top Products by Inventory Value
            </h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Unit Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Value</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.topProductsByValue.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{product.stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${product.unitCost?.toFixed(2) || '0.00'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${product.totalValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* All Products */}
      {reports.allProducts && reports.allProducts.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-500" />
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              All Products ({reports.allProducts.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Min</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Max</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Unit Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Selling Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Low Stock</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.allProducts.map((p, index) => (
                  <tr key={index} className={`hover:bg-gray-50 dark:hover:bg-slate-700/40 ${p.isLowStock ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.sku}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.unit}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.currentStock}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.minStockLevel}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.maxStockLevel}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${Number(p.unitCost)?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.sellingPrice !== '' && p.sellingPrice != null ? `$${Number(p.sellingPrice).toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${(p.stockValue || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{p.supplierName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.isLowStock ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Yes</span>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transaction Statistics */}
      {reports.transactionStats && (
        <Card>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Transaction Statistics
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{reports.transactionStats.totalTransactions}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">In Transactions</p>
              <p className="text-2xl font-semibold text-green-900 dark:text-green-400">{reports.transactionStats.inTransactions}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">${reports.transactionStats.totalInValue?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Out Transactions</p>
              <p className="text-2xl font-semibold text-red-900 dark:text-red-400">{reports.transactionStats.outTransactions}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">${reports.transactionStats.totalOutValue?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Adjustments</p>
              <p className="text-2xl font-semibold text-yellow-900 dark:text-yellow-400">{reports.transactionStats.adjustmentTransactions}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default InventoryReports;

