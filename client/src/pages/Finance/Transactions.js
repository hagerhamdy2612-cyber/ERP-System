import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { DollarSign, CheckCircle, X } from 'lucide-react';

const FinanceTransactions = () => {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, bankRes] = await Promise.all([
        axios.get('/api/finance/invoices'),
        axios.get('/api/finance/bank')
      ]);
      setInvoices(invoicesRes.data.data);
      setBankAccounts(bankRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('finance.transactions.errors.loadData'));
    } finally {
      setLoading(false);
    }
  };

  const handlePayClick = (invoice) => {
    setSelectedInvoice(invoice);
    setSelectedBankAccount('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handlePayInvoice = async () => {
    if (!selectedBankAccount) {
      toast.error(t('finance.transactions.errors.selectBankAccount'));
      return;
    }

    setProcessing(true);
    try {
      await axios.post('/api/finance/pay-invoice', {
        invoiceId: selectedInvoice._id,
        invoiceModel: selectedInvoice.model,
        bankAccountId: selectedBankAccount,
        notes: paymentNotes
      });

      toast.success(t('finance.transactions.messages.paidSuccess'));
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      fetchData(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.message || t('finance.transactions.errors.payFailed'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">{t('finance.transactions.loadingInvoices')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('finance.transactions.title')}</h1>
      </div>

      {/* Invoices Table */}
      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-100 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('finance.transactions.invoiceNumber')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('finance.transactions.customer')}/{t('finance.transactions.supplier')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('finance.transactions.dueDate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.amount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {invoices.length > 0 ? (
                invoices.map((invoice) => {
                  const isPaid = invoice.status === 'paid';
                  return (
                    <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.type === 'sales'
                              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400'
                              : 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-400'
                          }`}
                        >
                          {invoice.type === 'sales' ? t('finance.transactions.sales') : t('finance.transactions.purchase')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {invoice.type === 'sales' ? invoice.customer : invoice.supplier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString()
                          : t('common.unknown')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}{' '}
                        EGP
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            isPaid
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400'
                          }`}
                        >
                          {invoice.status === 'paid' ? t('finance.transactions.paid') : t('finance.transactions.unpaid')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {!isPaid ? (
                          <button
                            onClick={() => handlePayClick(invoice)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                          >
                            <DollarSign className="h-3 w-3 mr-1" />
                            {t('finance.transactions.pay')}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{t('finance.transactions.paid')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('finance.transactions.noInvoices')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('finance.transactions.payInvoice')}</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoice(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('finance.transactions.invoiceNumber')}:</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedInvoice.invoiceNumber}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.type')}:</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {selectedInvoice.type}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.amount')}:</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedInvoice.totalAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  EGP
                </p>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('finance.transactions.selectBankAccount')}
                  </label>
                <select
                  value={selectedBankAccount}
                  onChange={(e) => setSelectedBankAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                >
                  <option value="">{t('common.selectAccount')}</option>
                  {bankAccounts.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.name} - {t('common.balance')}:{' '}
                      {account.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}
                      EGP
                    </option>
                  ))}
                </select>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('finance.transactions.paymentNotes')}
                  </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  placeholder={t('finance.transactions.paymentNotesPlaceholder')}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handlePayInvoice}
                  disabled={processing || !selectedBankAccount}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? (
                    t('finance.transactions.processing')
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('finance.transactions.confirmPayment')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceTransactions;

