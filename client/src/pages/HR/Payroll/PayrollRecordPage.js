import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import { ArrowLeft } from 'lucide-react';

function money(v) {
  return Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const PayrollRecordPage = () => {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    employeeId: '',
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
    approvedLeaveDays: 0
  });

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get('/api/hr/employees');
      setEmployees(res.data.data || []);
    } catch {
      toast.error(t('hr.payroll.errors.loadEmployees'));
    }
  }, [t]);

  const loadRecord = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/hr/payroll/${id}`);
      setRecord(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('hr.payroll.errors.loadRecord'));
      navigate('/app/hr/payroll');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, t]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        periodYear: parseInt(form.periodYear, 10),
        periodMonth: parseInt(form.periodMonth, 10),
        approvedLeaveDays: Number(form.approvedLeaveDays) || 0
      };
      if (form.employeeId) payload.employeeId = form.employeeId;

      const res = await axios.post('/api/hr/payroll/generate', payload);
      toast.success(`Generated ${res.data.count || 0} payroll record(s)`);
      navigate('/app/hr/payroll');
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    setApproving(true);
    try {
      const res = await axios.patch(`/api/hr/payroll/approve/${id}`);
      setRecord(res.data.data);
      toast.success('Payroll approved and linked to Finance');
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          to="/app/hr/payroll"
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hr.payroll.backToList')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isNew ? 'Generate Payroll' : 'Payroll Details'}
        </h1>
      </div>

      {isNew ? (
        <Card>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Employee (optional, leave empty for all)
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.employeeId}
                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              >
                <option value="">All Employees</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.user?.name || e.employeeId} - {e.employeeId}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('hr.payroll.periodYear')}
                </label>
                <input
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={form.periodYear}
                  onChange={(e) => setForm((f) => ({ ...f, periodYear: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('hr.payroll.periodMonth')}
                </label>
                <select
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={form.periodMonth}
                  onChange={(e) => setForm((f) => ({ ...f, periodMonth: parseInt(e.target.value, 10) }))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Approved Leave Days
              </label>
              <input
                type="number"
                min={0}
                step="1"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.approvedLeaveDays}
                onChange={(e) => setForm((f) => ({ ...f, approvedLeaveDays: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? t('common.loading') : 'Generate Payroll'}
              </button>
              <Link
                to="/app/hr/payroll"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                {t('common.cancel')}
              </Link>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Employee:</span> <span className="font-medium">{record?.employee?.user?.name || record?.employee?.employeeId || '-'}</span></div>
            <div><span className="text-gray-500">Period:</span> <span className="font-medium">{record?.periodMonth}/{record?.periodYear}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="font-medium">{record?.status}</span></div>
            <div><span className="text-gray-500">Working Days:</span> <span className="font-medium">{record?.workingDaysOfMonth}</span></div>
            <div><span className="text-gray-500">Base Salary:</span> <span className="font-medium">{money(record?.baseSalary)}</span></div>
            <div><span className="text-gray-500">Daily Salary:</span> <span className="font-medium">{money(record?.dailySalary)}</span></div>
            <div><span className="text-gray-500">Hourly Rate:</span> <span className="font-medium">{money(record?.hourlyRate)}</span></div>
            <div><span className="text-gray-500">Absent Days:</span> <span className="font-medium">{record?.absentDays}</span></div>
            <div><span className="text-gray-500">Absence Deduction:</span> <span className="font-medium">{money(record?.absenceDeduction)}</span></div>
            <div><span className="text-gray-500">Late Minutes:</span> <span className="font-medium">{record?.totalLateMinutes || 0}</span></div>
            <div><span className="text-gray-500">Late Deduction:</span> <span className="font-medium">{money(record?.lateDeduction)}</span></div>
            <div><span className="text-gray-500">Overtime Hours:</span> <span className="font-medium">{record?.overtimeHours || 0}</span></div>
            <div><span className="text-gray-500">Overtime Pay:</span> <span className="font-medium">{money(record?.overtimePay)}</span></div>
            <div><span className="text-gray-500">Total Sales:</span> <span className="font-medium">{money(record?.totalSales)}</span></div>
            <div><span className="text-gray-500">Bonus:</span> <span className="font-medium">{money(record?.bonus)}</span></div>
            <div><span className="text-gray-500">Total Deductions:</span> <span className="font-medium">{money(record?.totalDeductions)}</span></div>
            <div><span className="text-gray-500">Net Salary:</span> <span className="font-semibold">{money(record?.netSalary ?? record?.netPay)}</span></div>
          </div>

          {record?.financeExpense && (
            <div className="mt-4 text-xs text-green-700 dark:text-green-300">
              Finance linked: {record.financeExpense.status || 'Pending Payment'}
            </div>
          )}

          <div className="flex gap-2 pt-6">
            {record?.status === 'draft' && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {approving ? t('common.loading') : 'Approve Payroll'}
              </button>
            )}
            <Link
              to="/app/hr/payroll"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
            >
              Back
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PayrollRecordPage;
