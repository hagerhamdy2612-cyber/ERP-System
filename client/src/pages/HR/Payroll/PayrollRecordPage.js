import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import { ArrowLeft } from 'lucide-react';

const STATUS_OPTIONS = ['draft', 'approved'];

const PayrollRecordPage = () => {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [financeLinked, setFinanceLinked] = useState(false);
  const [financeBankName, setFinanceBankName] = useState('');
  const [form, setForm] = useState({
    userId: '',
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
    basePay: '',
    bonuses: '0',
    deductions: '0',
    status: 'draft',
    paymentDate: '',
    notes: ''
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
      const d = res.data.data;
      const uid = d.employee?.user?._id;
      setFinanceLinked(!!d.financeExpense);
      setFinanceBankName(d.financeExpense?.bankAccount?.name || '');
      setForm({
        userId: uid || '',
        periodYear: d.periodYear,
        periodMonth: d.periodMonth,
        basePay: String(d.basePay),
        bonuses: String(d.bonuses ?? 0),
        deductions: String(d.deductions ?? 0),
        status: d.status || 'draft',
        paymentDate: d.paymentDate ? String(d.paymentDate).slice(0, 10) : '',
        notes: d.notes || ''
      });
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

  const netPreview = () => {
    const base = parseFloat(form.basePay) || 0;
    const bon = parseFloat(form.bonuses) || 0;
    const ded = parseFloat(form.deductions) || 0;
    return Math.max(0, Math.round((base + bon - ded) * 100) / 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNew && !form.userId) {
      toast.error(t('hr.payroll.selectEmployee'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        periodYear: parseInt(form.periodYear, 10),
        periodMonth: parseInt(form.periodMonth, 10),
        basePay: parseFloat(form.basePay),
        bonuses: parseFloat(form.bonuses) || 0,
        deductions: parseFloat(form.deductions) || 0,
        status: form.status,
        paymentDate: form.paymentDate || null,
        notes: form.notes
      };
      if (isNew) {
        await axios.post('/api/hr/payroll', { ...payload, userId: form.userId });
        toast.success(t('messages.createSuccess'));
      } else {
        await axios.put(`/api/hr/payroll/${id}`, payload);
        toast.success(t('messages.updateSuccess'));
      }
      navigate('/app/hr/payroll');
    } catch (err) {
      const msg =
        err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || t('messages.error');
      toast.error(msg);
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          to="/app/hr/payroll"
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hr.payroll.backToList')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isNew ? t('hr.payroll.newTitle') : t('hr.payroll.editTitle')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('hr.payroll.financeHelp')}</p>
      </div>

      {financeLinked && (
        <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-900 dark:text-green-200">
          {t('hr.payroll.paidFromFinanceBanner', { bank: financeBankName || '—' })}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hr.payroll.employee')} *
              </label>
              <select
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              >
                <option value="">{t('hr.payroll.selectEmployee')}</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.user?.name || e.employeeId} — {e.employeeId}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hr.payroll.periodYear')} *
              </label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.periodYear}
                onChange={(e) => setForm((f) => ({ ...f, periodYear: e.target.value }))}
                disabled={!isNew}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hr.payroll.periodMonth')} *
              </label>
              <select
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.periodMonth}
                onChange={(e) => setForm((f) => ({ ...f, periodMonth: parseInt(e.target.value, 10) }))}
                disabled={!isNew}
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
              {t('hr.payroll.basePay')} *
            </label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.basePay}
              onChange={(e) => setForm((f) => ({ ...f, basePay: e.target.value }))}
              disabled={financeLinked}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hr.payroll.bonuses')}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.bonuses}
                onChange={(e) => setForm((f) => ({ ...f, bonuses: e.target.value }))}
                disabled={financeLinked}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('hr.payroll.deductions')}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={form.deductions}
                onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))}
                disabled={financeLinked}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">{t('hr.payroll.salesBonusHint')}</p>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('hr.payroll.netPay')}: <span className="font-semibold text-gray-900 dark:text-white">{netPreview().toFixed(2)}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.payroll.colStatus')}
            </label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              disabled={financeLinked}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`hr.payroll.statusLabels.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.payroll.paymentDate')}
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.paymentDate}
              onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.payroll.notes')}
            </label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? t('common.loading') : isNew ? t('hr.payroll.create') : t('hr.payroll.save')}
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
    </div>
  );
};

export default PayrollRecordPage;
