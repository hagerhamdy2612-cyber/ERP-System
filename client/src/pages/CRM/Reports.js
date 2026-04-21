import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Download,
  Filter,
  RefreshCw,
  Mail,
  AlertCircle,
  UserPlus
} from 'lucide-react';

const CRMReports = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState({
    summary: null,
    topCustomers: null,
    complaintStats: null,
    customerTypeDistribution: null
  });
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/reports/generate/crm?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setReports(response.data.data);
    } catch (error) {
      toast.error(t('crm.reports.errors.fetchFailed'));
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
      const response = await axios.get(`/api/reports/export/crm?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('crm.reports.messages.exportSuccess'));
    } catch (error) {
      toast.error(t('crm.reports.errors.exportFailed'));
    }
  };

  const sendReport = async () => {
    setSendLoading(true);
    try {
      const reportData = [
        {
          'Total Customers': reports.summary?.totalCustomers || 0,
          'Active Customers': reports.summary?.activeCustomers || 0,
          'Total Complaints': reports.summary?.totalComplaints || 0,
          'Period': `${dateRange.startDate} to ${dateRange.endDate}`
        }
      ];

      const response = await axios.post('/api/reports/send', {
        module: 'crm',
        reportData: reportData
      });

      if (response.data.success) {
        toast.success(response.data.message || t('crm.reports.messages.sendSuccess'));
      } else {
        toast.error(response.data.message || t('crm.reports.errors.sendFailed'));
      }
    } catch (error) {
      console.error('Send report error:', error);
      toast.error(t('crm.reports.errors.sendFailed'));
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('crm.reports.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('crm.reports.description')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('crm.reports.refresh')}
          </button>
          <button
            onClick={sendReport}
            disabled={sendLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendLoading ? t('crm.reports.sending') : t('crm.reports.sendReport')}
          </button>
          <button
            onClick={exportReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('crm.reports.exportReport')}
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('crm.reports.startDate')}</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('crm.reports.endDate')}</label>
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
          title={t('crm.reports.totalCustomers')}
          value={reports.summary?.totalCustomers || '0'}
          icon={Users}
          color="text-blue-600"
          subtitle={t('crm.reports.inPeriod')}
        />
        <StatCard
          title={t('crm.reports.activeCustomers')}
          value={reports.summary?.activeCustomers || '0'}
          icon={UserPlus}
          color="text-green-600"
          subtitle={t('crm.reports.withOrders')}
        />
        <StatCard
          title={t('crm.reports.totalComplaints')}
          value={reports.summary?.totalComplaints || '0'}
          icon={AlertCircle}
          color="text-orange-600"
          subtitle={t('crm.reports.inPeriod')}
        />
        <StatCard
          title={t('crm.reports.resolvedComplaints')}
          value={reports.complaintStats?.resolved || '0'}
          icon={MessageSquare}
          color="text-purple-600"
          subtitle={t('crm.reports.successfullyResolved')}
        />
      </div>

      {/* Complaint Statistics */}
      {reports.complaintStats && (
        <Card>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('crm.reports.complaintStatistics')}
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Status Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('crm.reports.byStatus')}</h4>
              <div className="space-y-2">
                {Object.entries({
                  open: reports.complaintStats.open,
                  'in-progress': reports.complaintStats['in-progress'],
                  resolved: reports.complaintStats.resolved,
                  closed: reports.complaintStats.closed
                }).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {t(`crm.complaints.status.${status}`, { defaultValue: status })}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Priority Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('crm.reports.byPriority')}</h4>
              <div className="space-y-2">
                {Object.entries(reports.complaintStats.byPriority || {}).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {t(`crm.complaints.priority.${priority}`, { defaultValue: priority })}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top Customers */}
      {reports.topCustomers && reports.topCustomers.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              {t('crm.reports.topCustomersBySpending')}
            </h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('crm.reports.customer')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('common.email')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('crm.reports.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('crm.reports.orders')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('crm.reports.totalSpent')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('crm.reports.lastOrder')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.topCustomers.map((customer, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{customer.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{customer.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">{customer.customerType || t('common.unknown')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{customer.orderCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${customer.totalSpent.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(customer.lastOrderDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Customer Type Distribution */}
      {reports.customerTypeDistribution && reports.customerTypeDistribution.length > 0 && (
        <Card>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('crm.reports.customerTypeDistribution')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {reports.customerTypeDistribution.map((item, index) => (
              <div key={index} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">{item.type}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{item.count}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default CRMReports;

