import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import { ArrowLeft } from 'lucide-react';
import { resolveUploadUrl } from '../../../utils/uploadUrl';

const STATUS_OPTIONS = ['pending', 'contacted', 'interview', 'accepted', 'rejected'];
const INTERVIEW_TYPES = ['online', 'offline'];

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

const ApplicantDetail = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const [applicant, setApplicant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('pending');
  const [savingStatus, setSavingStatus] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    date: '',
    time: '',
    type: '',
    notes: ''
  });
  const [savingInterview, setSavingInterview] = useState(false);

  const fetchApplicant = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/applicants/${id}`);
      const data = res.data.data;
      setApplicant(data);
      setNewStatus(data.status || 'pending');
      const inv = data.interview || {};
      setInterviewForm({
        date: inv.date ? String(inv.date).slice(0, 10) : '',
        time: inv.time || '',
        type: inv.type || '',
        notes: inv.notes || ''
      });
    } catch (err) {
      toast.error(err.response?.data?.message || t('hr.recruitment.errors.loadApplicant'));
      setApplicant(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchApplicant();
  }, [fetchApplicant]);

  const saveStatus = async () => {
    setSavingStatus(true);
    try {
      await axios.patch(`/api/applicants/${id}/status`, { status: newStatus });
      toast.success(t('messages.updateSuccess'));
      setStatusModal(false);
      fetchApplicant();
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    } finally {
      setSavingStatus(false);
    }
  };

  const saveInterview = async (e) => {
    e.preventDefault();
    setSavingInterview(true);
    try {
      await axios.patch(`/api/applicants/${id}/interview`, {
        date: interviewForm.date || undefined,
        time: interviewForm.time,
        type: interviewForm.type || undefined,
        notes: interviewForm.notes
      });
      toast.success(t('messages.updateSuccess'));
      fetchApplicant();
    } catch (err) {
      toast.error(err.response?.data?.message || t('messages.error'));
    } finally {
      setSavingInterview(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
    );
  }

  if (!applicant) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/hr/recruitment/applicants"
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hr.recruitment.backToList')}
        </Link>
        <p className="text-gray-600 dark:text-gray-400">{t('hr.recruitment.notFound')}</p>
      </div>
    );
  }

  const cvHref = resolveUploadUrl(applicant.cv);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          to="/app/hr/recruitment/applicants"
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hr.recruitment.backToList')}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{applicant.name}</h1>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${statusBadgeClass(
                applicant.status
              )}`}
            >
              {t(`hr.recruitment.status.${applicant.status}`)}
            </span>
            <button
              type="button"
              onClick={() => setStatusModal(true)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('hr.recruitment.changeStatus')}
            </button>
          </div>
        </div>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('hr.recruitment.sectionDetails')}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('common.phone')}</dt>
            <dd className="text-gray-900 dark:text-white font-medium">{applicant.phone}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('common.email')}</dt>
            <dd className="text-gray-900 dark:text-white font-medium">{applicant.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('hr.recruitment.job')}</dt>
            <dd className="text-gray-900 dark:text-white font-medium">
              {applicant.jobTitle || applicant.jobId?.title || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('hr.recruitment.source')}</dt>
            <dd className="text-gray-900 dark:text-white font-medium">{applicant.source || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500 dark:text-gray-400">{t('hr.recruitment.cv')}</dt>
            <dd className="text-gray-900 dark:text-white font-medium">
              {applicant.cv ? (
                <a
                  href={cvHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('hr.recruitment.openCv')}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500 dark:text-gray-400">{t('common.notes')}</dt>
            <dd className="text-gray-900 dark:text-white whitespace-pre-wrap">{applicant.notes || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t('hr.recruitment.createdAt')}</dt>
            <dd className="text-gray-900 dark:text-white">
              {applicant.createdAt
                ? new Date(applicant.createdAt).toLocaleString()
                : '—'}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('hr.recruitment.sectionInterview')}
        </h2>
        {applicant.interview?.date && (
          <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/80 text-sm">
            <p>
              <span className="text-gray-500">{t('common.date')}: </span>
              {new Date(applicant.interview.date).toLocaleDateString()}
            </p>
            {applicant.interview.time && (
              <p>
                <span className="text-gray-500">{t('hr.recruitment.interviewTime')}: </span>
                {applicant.interview.time}
              </p>
            )}
            {applicant.interview.type && (
              <p>
                <span className="text-gray-500">{t('common.type')}: </span>
                {applicant.interview.type}
              </p>
            )}
            {applicant.interview.notes && (
              <p className="mt-2 whitespace-pre-wrap">{applicant.interview.notes}</p>
            )}
          </div>
        )}
        <form onSubmit={saveInterview} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.date')}
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={interviewForm.date}
              onChange={(e) => setInterviewForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.recruitment.interviewTime')}
            </label>
            <input
              type="text"
              placeholder="10:00"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={interviewForm.time}
              onChange={(e) => setInterviewForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.recruitment.interviewType')}
            </label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={interviewForm.type}
              onChange={(e) => setInterviewForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">{t('hr.recruitment.selectInterviewType')}</option>
              {INTERVIEW_TYPES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.notes')}
            </label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={interviewForm.notes}
              onChange={(e) => setInterviewForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={savingInterview}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {savingInterview ? t('common.loading') : t('hr.recruitment.saveInterview')}
          </button>
        </form>
      </Card>

      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('hr.recruitment.changeStatusTitle')}
            </h3>
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
                onClick={() => setStatusModal(false)}
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
                {savingStatus ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantDetail;
