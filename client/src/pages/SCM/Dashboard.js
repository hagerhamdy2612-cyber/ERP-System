import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import {
  Truck,
  CheckCircle,
  Users,
  Mail,
  Phone
} from 'lucide-react';

const SCMDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [recentSuppliers, setRecentSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const suppliersRes = await axios.get('/api/scm/suppliers');
      const suppliers = suppliersRes.data.data || [];

      // Calculate KPIs
      const totalSuppliers = suppliers.length;
      const activeSuppliers = suppliers.filter(s => s.isActive !== false).length;

      // Get recent suppliers
      const sortedSuppliers = suppliers
        .sort((a, b) => new Date(b.createdAt || b._id) - new Date(a.createdAt || a._id))
        .slice(0, 5);

      setRecentSuppliers(sortedSuppliers);

      setKpis({
        totalSuppliers,
        activeSuppliers
      });
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('scm.dashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('scm.dashboard.description')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-100 dark:bg-blue-500/20 rounded-full p-3">
                  <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('scm.dashboard.totalSuppliers')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.totalSuppliers || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-green-100 dark:bg-green-500/20 rounded-full p-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('scm.dashboard.activeSuppliers')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.activeSuppliers || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-purple-100 dark:bg-purple-500/20 rounded-full p-3">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('scm.dashboard.supplierContactRate')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.totalSuppliers > 0 
                      ? Math.round((kpis.activeSuppliers / kpis.totalSuppliers) * 100) 
                      : 0}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Suppliers */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
            {t('scm.dashboard.recentSuppliers')}
          </h3>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
          {recentSuppliers.length === 0 ? (
            <li className="px-4 py-5 sm:px-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('scm.dashboard.noSuppliers')}
              </p>
            </li>
          ) : (
            recentSuppliers.map((supplier) => (
              <li key={supplier._id} className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {supplier.name}
                      </p>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        {supplier.contactPerson && (
                          <>
                            <span>{supplier.contactPerson}</span>
                            <span className="mx-2">•</span>
                          </>
                        )}
                        {supplier.email && (
                          <>
                            <Mail className="h-4 w-4 mr-1" />
                            <span>{supplier.email}</span>
                            <span className="mx-2">•</span>
                          </>
                        )}
                        <Phone className="h-4 w-4 mr-1" />
                        <span>{supplier.phone || t('scm.dashboard.noPhone')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${supplier.isActive !== false ? 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300'}`}>
                      {supplier.isActive !== false ? t('crm.dashboard.active') : t('crm.dashboard.inactive')}
                    </span>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
};

export default SCMDashboard;

