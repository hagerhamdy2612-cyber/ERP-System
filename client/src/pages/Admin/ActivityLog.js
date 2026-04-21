import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';

const MODULES = ['SALES', 'HR', 'INVENTORY', 'FINANCE', 'PURCHASING', 'CRM', 'AUTH', 'ARCHIVE'];

const ActivityLog = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [filters, setFilters] = useState({
    user: '',
    module: '',
    startDate: '',
    endDate: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({
    user: '',
    module: '',
    startDate: '',
    endDate: ''
  });
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    try {
      const params = { page, limit };
      if (appliedFilters.user) params.user = appliedFilters.user;
      if (appliedFilters.module) params.module = appliedFilters.module;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;
      const res = await axios.get('/api/activity-logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total ?? 0);
      setPages(res.data.pages ?? 0);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(t('activityLog.accessDenied'));
      } else {
        toast.error(err.response?.data?.message || t('activityLog.loadFailed'));
      }
      setLogs([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  }, [user?.role, page, appliedFilters.user, appliedFilters.module, appliedFilters.startDate, appliedFilters.endDate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user?.role, fetchUsers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const exportReportCsv = async () => {
    setExporting(true);
    try {
      const params = {};
      if (appliedFilters.user) params.user = appliedFilters.user;
      if (appliedFilters.module) params.module = appliedFilters.module;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;
      const res = await axios.get('/api/activity-logs/export', {
        params,
        responseType: 'blob'
      });
      const { startDate, endDate } = appliedFilters;
      const filename =
        startDate && endDate
          ? `activity-log-${startDate}-to-${endDate}.xlsx`
          : `activity-log-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('activityLog.exported'));
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(t('activityLog.accessDenied'));
      } else {
        toast.error(err.response?.data?.message || t('activityLog.exportFailed'));
      }
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('activityLog.accessDeniedTitle')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('activityLog.accessDeniedMessage')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary-600 dark:text-primary-400" />
          {t('activityLog.title')}
        </h1>
      </div>

      {/* Reports section */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('activityLog.reports')}</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('activityLog.exportHint')}
        </p>
        <button
          type="button"
          onClick={exportReportCsv}
          disabled={exporting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          {exporting ? t('activityLog.exporting') : t('activityLog.exportReport')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('activityLog.user')}
            </label>
            <select
              name="user"
              value={filters.user}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('activityLog.allUsers')}</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('activityLog.module')}
            </label>
            <select
              name="module"
              value={filters.module}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('activityLog.allModules')}</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('activityLog.startDate')}
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('activityLog.endDate')}
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end lg:justify-start">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors"
            >
              {t('activityLog.applyFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500 dark:text-gray-400">
              {t('activityLog.loading')}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('activityLog.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('activityLog.action')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('activityLog.module')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('activityLog.entityType')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('activityLog.date')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr
                      key={log._id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {log.user?.name ?? '—'}
                        {log.user?.email && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {log.user.email}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {log.module}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {log.entityType || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t('activityLog.noLogs')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('activityLog.pagination', { page, pages, total })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
