import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, X, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canManageFinanceBankAccounts } from '../../config/permissions';

const FinanceBankAccounts = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    balance: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (canManageFinanceBankAccounts(user)) {
      fetchBankAccounts();
    }
  }, [user]);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/finance/bank-accounts');
      setBankAccounts(response.data.data);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      toast.error(t('finance.bankAccounts.errors.loadData'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        balance: account.balance.toString()
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        balance: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      balance: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error(t('messages.required'));
      return;
    }

    setSubmitting(true);
    try {
      if (editingAccount) {
        // Update
        await axios.put(`/api/finance/bank-accounts/${editingAccount._id}`, formData);
        toast.success(t('messages.updateSuccess'));
      } else {
        // Create
        await axios.post('/api/finance/bank-accounts', formData);
        toast.success(t('messages.createSuccess'));
      }
      handleCloseModal();
      fetchBankAccounts();
    } catch (error) {
      toast.error(error.response?.data?.message || t('messages.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (accountId) => {
    if (!window.confirm(t('finance.bankAccounts.deleteConfirm'))) {
      return;
    }

    setDeletingId(accountId);
    try {
      await axios.delete(`/api/finance/bank-accounts/${accountId}`);
      toast.success(t('finance.bankAccounts.messages.deletedSuccess'));
      fetchBankAccounts();
    } catch (error) {
      toast.error(error.response?.data?.message || t('finance.bankAccounts.errors.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!canManageFinanceBankAccounts(user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('finance.bankAccounts.accessDenied')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('finance.bankAccounts.accessDeniedDesc')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">{t('finance.bankAccounts.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('finance.bankAccounts.title')}</h1>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('finance.bankAccounts.addAccount')}
        </button>
      </div>

      {/* Bank Accounts Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('common.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('common.balance')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('common.created')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('common.updated')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {bankAccounts.length > 0 ? (
                bankAccounts.map((account) => (
                  <tr key={account._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="bg-blue-100 dark:bg-blue-500/20 rounded-full p-2 mr-3">
                          <Wallet className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{account.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {account.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}
                      EGP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(account.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(account)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-slate-600 text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(account._id)}
                          disabled={deletingId === account._id}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {deletingId === account._id ? t('common.deleting') : t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                    {t('finance.bankAccounts.noAccounts')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingAccount ? t('finance.bankAccounts.editAccount') : t('finance.bankAccounts.addAccount')}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('finance.bankAccounts.accountName')}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('finance.bankAccounts.accountNamePlaceholder')}
                  required
                />
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('finance.bankAccounts.initialBalance')}
                  </label>
                <input
                  type="number"
                  name="balance"
                  value={formData.balance}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  {editingAccount
                      ? t('finance.bankAccounts.balanceNote')
                    : t('finance.bankAccounts.initialBalanceNote')}
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? editingAccount
                      ? t('finance.bankAccounts.updating')
                      : t('finance.bankAccounts.creating')
                    : editingAccount
                    ? t('finance.bankAccounts.updateAccount')
                    : t('finance.bankAccounts.createAccount')}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600"
                >
                    {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceBankAccounts;

