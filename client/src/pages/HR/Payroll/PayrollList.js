import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import { Plus, Eye, CheckCircle2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_OPTIONS = ['draft', 'approved', 'paid'];

function statusClass(s) {
  const map = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
  };
  return map[s] || map.draft;
}

const PayrollList = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({
    periodYear: new Date().getFullYear().toString(),
    periodMonth: '',
    status: '',
    employeeId: ''
  });

  const limit = 20;

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get('/api/hr/employees');
      setEmployees(res.data.data || []);
    } catch {
      toast.error(t('hr.payroll.errors.loadEmployees'));
    }
  }, [t]);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.periodYear) params.periodYear = filters.periodYear;
      if (filters.periodMonth) params.periodMonth = filters.periodMonth;
      if (filters.status) params.status = filters.status;
      if (filters.employeeId) params.employeeId = filters.employeeId;

      const res = await axios.get('/api/hr/payroll', { params });
      setRows(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || t('hr.payroll.errors.loadPayroll'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters.periodYear, filters.periodMonth, filters.status, filters.employeeId, t]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  useEffect(() => {
    setPage(1);
  }, [filters.periodYear, filters.periodMonth, filters.status, filters.employeeId]);

  const handleApprove = async (recId) => {
    try {
      await axios.patch(`/api/hr/payroll/approve/${recId}`);
      toast.success('Payroll approved');
      fetchPayroll();
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      'Delete payroll records using current filters? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const params = {};
      if (filters.periodYear) params.periodYear = filters.periodYear;
      if (filters.periodMonth) params.periodMonth = filters.periodMonth;
      if (filters.status) params.status = filters.status;
      if (filters.employeeId) params.employeeId = filters.employeeId;

      const res = await axios.delete('/api/hr/payroll', { params });
      toast.success(
        `Deleted ${res.data.deletedCount || 0} payroll, ${res.data.deletedExpenseCount || 0} finance expense, ${res.data.deletedTransactionCount || 0} transaction record(s)`
      );
      fetchPayroll();
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    }
  };

  const formatPeriod = (y, m) => {
    try {
      return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } catch {
      return `${m}/${y}`;
    }
  };

  const empName = (row) => row.employee?.user?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.payroll.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('hr.payroll.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteAll}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </button>
          <Link
            to="/app/hr/payroll/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Generate Payroll
          </Link>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <input
            type="number"
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder={t('hr.payroll.periodYear')}
            value={filters.periodYear}
            onChange={(e) => setFilters((f) => ({ ...f, periodYear: e.target.value }))}
          />
          <select
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={filters.periodMonth}
            onChange={(e) => setFilters((f) => ({ ...f, periodMonth: e.target.value }))}
          >
            <option value="">{t('hr.payroll.allMonths')}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">{t('hr.payroll.allStatuses')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`hr.payroll.statusLabels.${s}`)}
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={filters.employeeId}
            onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
          >
            <option value="">{t('hr.payroll.allEmployees')}</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.user?.name || e.employeeId}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colEmployee')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colPeriod')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colBase')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colBonuses')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colDeductions')}</th>
                <th className="py-3 pr-4 font-medium">Overtime</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colNet')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colStatus')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.payroll.colFinance')}</th>
                <th className="py-3 font-medium text-right">{t('hr.payroll.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500">
                    {t('hr.payroll.noRecords')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-gray-100 dark:border-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 pr-4 text-gray-900 dark:text-white font-medium">{empName(row)}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {formatPeriod(row.periodYear, row.periodMonth)}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {(row.baseSalary ?? row.basePay)?.toFixed?.(2) ?? (row.baseSalary ?? row.basePay)}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {row.bonus?.toFixed?.(2) ?? row.bonus ?? row.bonuses?.toFixed?.(2) ?? row.bonuses}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {row.totalDeductions?.toFixed?.(2) ?? row.totalDeductions ?? row.deductions?.toFixed?.(2) ?? row.deductions}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {row.overtimePay?.toFixed?.(2) ?? row.overtimePay ?? '0.00'}
                    </td>
                    <td className="py-3 pr-4 text-gray-900 dark:text-white font-medium">
                      {row.netSalary?.toFixed?.(2) ?? row.netSalary ?? row.netPay?.toFixed?.(2) ?? row.netPay}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusClass(row.status)}`}>
                        {t(`hr.payroll.statusLabels.${row.status}`)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 text-xs">
                      {row.financeExpense?.status ? (
                        <span title={row.financeExpense?.title}>{row.financeExpense.status}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/app/hr/payroll/${row._id}`}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                      {row.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleApprove(row._id)}
                          className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium hover:underline ml-2"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('hr.payroll.paginationSummary', {
                from: rows.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1,
                to: Math.min(pagination.page * pagination.limit, pagination.total),
                total: pagination.total
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PayrollList;
