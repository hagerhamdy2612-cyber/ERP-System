import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { 
  Truck, 
  Star, 
  TrendingUp, 
  Download,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const SCMReports = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState({
    summary: null,
    supplierPerformance: null,
    topSuppliers: null,
    ratingDistribution: null
  });

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/reports/generate/scm?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      setReports(response.data.data);
    } catch (error) {
      toast.error(t('scm.reports.errors.fetchFailed'));
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
      const response = await axios.get(`/api/reports/export/scm?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scm-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('scm.reports.messages.exportSuccess'));
    } catch (error) {
      toast.error(t('scm.reports.errors.exportFailed'));
    }
  };


  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${color.includes('blue') ? 'bg-blue-100 dark:bg-blue-500/20' : color.includes('green') ? 'bg-green-100 dark:bg-green-500/20' : color.includes('purple') ? 'bg-purple-100 dark:bg-purple-500/20' : 'bg-orange-100 dark:bg-orange-500/20'}`}>
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

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'text-green-600 dark:text-green-400';
    if (rating >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('scm.reports.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('scm.reports.description')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('scm.reports.refresh')}
          </button>
          <button
            onClick={exportReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('scm.reports.exportReport')}
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('scm.reports.startDate')}</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('scm.reports.endDate')}</label>
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
          title={t('scm.reports.totalSuppliers')}
          value={reports.summary?.totalSuppliers || '0'}
          icon={Truck}
          color="text-blue-600"
          subtitle={t('scm.reports.allSuppliers')}
        />
        <StatCard
          title={t('scm.reports.activeSuppliers')}
          value={reports.summary?.activeSuppliers || '0'}
          icon={CheckCircle}
          color="text-green-600"
          subtitle={t('scm.reports.currentlyActive')}
        />
        <StatCard
          title={t('scm.reports.totalOrders')}
          value={reports.summary?.totalOrders || '0'}
          icon={TrendingUp}
          color="text-purple-600"
          subtitle={t('scm.reports.inPeriod')}
        />
        <StatCard
          title={t('scm.reports.inactiveSuppliers')}
          value={reports.summary?.inactiveSuppliers || '0'}
          icon={AlertCircle}
          color="text-orange-600"
          subtitle={t('scm.reports.notActive')}
        />
      </div>

      {/* Rating Distribution */}
      {reports.ratingDistribution && (
        <Card>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            {t('scm.reports.supplierRatingDistribution')}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(reports.ratingDistribution).map(([rating, count]) => (
              <div key={rating} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  {rating !== '0' && (
                    <Star className={`h-5 w-5 ${getRatingColor(parseInt(rating))}`} fill="currentColor" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{rating === '0' ? t('scm.reports.unrated') : t('scm.reports.stars', { count: rating })}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{count}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Suppliers */}
      {reports.topSuppliers && reports.topSuppliers.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              {t('scm.reports.topSuppliersBySpending')}
            </h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('scm.reports.supplier')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('scm.reports.contact')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('scm.reports.rating')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('scm.reports.orders')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('scm.reports.totalSpent')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('scm.reports.onTimeRate')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {reports.topSuppliers.map((supplier, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{supplier.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{supplier.contactPerson}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Star className={`h-4 w-4 ${getRatingColor(supplier.rating)}`} fill="currentColor" />
                        <span className="ml-1 text-sm text-gray-900 dark:text-white">{supplier.rating || t('common.unknown')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{supplier.orderCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${supplier.totalSpent.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {supplier.onTimeRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SCMReports;

