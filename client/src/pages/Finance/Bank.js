import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canManageFinanceBankAccounts } from '../../config/permissions';
import Card from '../../components/Card';
import { Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const FinanceBank = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/finance/bank');
      setBankAccounts(response.data.data);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      toast.error(t('messages.error'));
    } finally {
      setLoading(false);
    }
  };

  if (user && !canManageFinanceBankAccounts(user)) {
    return <Navigate to="/app/finance/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('finance.bank.title')}</h1>
      </div>

      {/* Bank Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {bankAccounts.map((account) => (
          <Card key={account._id}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-blue-100 dark:bg-blue-500/20 rounded-full p-3 mr-3">
                  <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('finance.bank.accountBalance')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {account.balance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  EGP
                </p>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('finance.bank.recentTransactions')}</h4>
              {account.recentTransactions && account.recentTransactions.length > 0 ? (
                <div className="space-y-2">
                  {account.recentTransactions.map((transaction, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-slate-700 last:border-0"
                    >
                      <div className="flex items-center">
                        {transaction.direction === 'in' ? (
                          <ArrowDownCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-red-500 dark:text-red-400 mr-2" />
                        )}
                        <span className="text-gray-600 dark:text-gray-400">
                          {transaction.notes || t('common.transaction')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span
                          className={`font-medium ${
                            transaction.direction === 'in'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {transaction.direction === 'in' ? '+' : '-'}
                          {transaction.amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">
                          {new Date(transaction.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('finance.bank.noTransactions')}</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {bankAccounts.length === 0 && (
        <Card className="text-center">
          <Wallet className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('finance.bank.noAccounts')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('finance.bank.noAccountsMessage')}
          </p>
        </Card>
      )}
    </div>
  );
};

export default FinanceBank;

