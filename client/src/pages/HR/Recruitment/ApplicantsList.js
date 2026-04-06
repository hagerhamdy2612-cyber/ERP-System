import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import { Search, Eye, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_OPTIONS = ['pending', 'contacted', 'interview', 'accepted', 'rejected'];
const SOURCE_OPTIONS = ['WhatsApp', 'Facebook', 'Referral', 'Walk-in', 'Other'];

function statusBadgeClass(status) {
  const map = {
    pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    interview: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    accepted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  };
  return map[status] || map.pending;
}

const ApplicantsList = () => {
  const { t } = useTranslation();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    jobTitle: '',
    source: '',
    search: ''
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedJobTitle, setDebouncedJobTitle] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState('pending');
  const [savingStatus, setSavingStatus] = useState(false);

  const limit = 10;

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => clearTimeout(tmr);
  }, [filters.search]);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedJobTitle(filters.jobTitle.trim()), 350);
    return () => clearTimeout(tmr);
  }, [filters.jobTitle]);

  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.status) params.status = filters.status;
      if (debouncedJobTitle) params.jobTitle = debouncedJobTitle;
      if (filters.source) params.source = filters.source;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await axios.get('/api/applicants', { params });
      setApplicants(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || t('hr.recruitment.errors.loadApplicants'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters.status, filters.source, debouncedSearch, debouncedJobTitle, t]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  useEffect(() => {
    setPage(1);
  }, [filters.status, filters.source, debouncedSearch, debouncedJobTitle]);

  const openStatusModal = (applicant) => {
    setStatusModal(applicant);
    setNewStatus(applicant.status || 'pending');
  };

  const saveStatus = async () => {
    if (!statusModal) return;
    setSavingStatus(true);
    try {
      await axios.patch(`/api/applicants/${statusModal._id}/status`, { status: newStatus });
      toast.success(t('messages.updateSuccess'));
      setStatusModal(null);
      fetchApplicants();
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('hr.recruitment.applicantsTitle')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('hr.recruitment.applicantsSubtitle')}
          </p>
        </div>
        <Link
          to="/app/hr/recruitment/applicants/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          {t('hr.recruitment.addApplicant')}
        </Link>
      </div>

      <Card>
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder={t('hr.recruitment.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">{t('hr.recruitment.filterStatus')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`hr.recruitment.status.${s}`)}
                </option>
              ))}
            </select>
            <input
              type="search"
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('hr.recruitment.filterJobPlaceholder')}
              value={filters.jobTitle}
              onChange={(e) => setFilters((f) => ({ ...f, jobTitle: e.target.value }))}
            />
            <select
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={filters.source}
              onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
            >
              <option value="">{t('hr.recruitment.filterSource')}</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                <th className="py-3 pr-4 font-medium">{t('hr.recruitment.colName')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.recruitment.colPhone')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.recruitment.colJob')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.recruitment.colStatus')}</th>
                <th className="py-3 pr-4 font-medium">{t('hr.recruitment.colSource')}</th>
                <th className="py-3 font-medium text-right">{t('hr.recruitment.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    {t('hr.recruitment.noApplicants')}
                  </td>
                </tr>
              ) : (
                applicants.map((a) => (
                  <tr
                    key={a._id}
                    className="border-b border-gray-100 dark:border-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 pr-4 text-gray-900 dark:text-white font-medium">{a.name}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{a.phone}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {a.jobTitle || a.jobId?.title || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(
                          a.status
                        )}`}
                      >
                        {t(`hr.recruitment.status.${a.status}`)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{a.source || '—'}</td>
                    <td className="py-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/app/hr/recruitment/applicants/${a._id}`}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('hr.recruitment.viewDetails')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openStatusModal(a)}
                        className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:underline text-xs font-medium ml-2"
                      >
                        {t('hr.recruitment.changeStatus')}
                      </button>
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
              {t('hr.recruitment.paginationSummary', {
                from:
                  applicants.length === 0
                    ? 0
                    : (pagination.page - 1) * pagination.limit + 1,
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

      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('hr.recruitment.changeStatusTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{statusModal.name}</p>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`hr.recruitment.status.${s}`)}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={savingStatus}
                onClick={saveStatus}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {savingStatus ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantsList;
