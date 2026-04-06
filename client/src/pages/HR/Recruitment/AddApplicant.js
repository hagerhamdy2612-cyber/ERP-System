import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import { ArrowLeft } from 'lucide-react';
import { isValidPhone } from '../../../utils/phoneValidation';

const SOURCE_OPTIONS = ['WhatsApp', 'Facebook', 'Referral', 'Walk-in', 'Other'];

const AddApplicant = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    jobTitle: '',
    source: '',
    notes: ''
  });
  const [cvFile, setCvFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('messages.required'));
      return;
    }
    if (!form.phone.trim()) {
      toast.error(t('messages.required'));
      return;
    }
    if (!isValidPhone(form.phone)) {
      toast.error(t('validation.phoneInvalid'));
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error(t('messages.invalidEmail'));
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('phone', form.phone.trim());
      if (form.email.trim()) fd.append('email', form.email.trim());
      if (form.jobTitle.trim()) fd.append('jobTitle', form.jobTitle.trim());
      if (form.source) fd.append('source', form.source);
      if (form.notes.trim()) fd.append('notes', form.notes.trim());
      if (cvFile) fd.append('cv', cvFile);

      await axios.post('/api/applicants', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(t('messages.createSuccess'));
      navigate('/app/hr/recruitment/applicants');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        t('messages.error');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          to="/app/hr/recruitment/applicants"
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hr.recruitment.backToList')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('hr.recruitment.addApplicantTitle')}
        </h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.name')} *
            </label>
            <input
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.phone')} *
            </label>
            <input
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.email')}
            </label>
            <input
              type="email"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.recruitment.job')}
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={t('hr.recruitment.jobTitlePlaceholder')}
              value={form.jobTitle}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.recruitment.source')}
            </label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            >
              <option value="">{t('hr.recruitment.selectSource')}</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hr.recruitment.cv')}
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="w-full text-sm text-gray-600 dark:text-gray-400"
              onChange={(e) => setCvFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-gray-500 mt-1">{t('hr.recruitment.cvHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.notes')}
            </label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('hr.recruitment.submitApplicant')}
            </button>
            <Link
              to="/app/hr/recruitment/applicants"
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

export default AddApplicant;
