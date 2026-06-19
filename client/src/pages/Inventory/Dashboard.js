import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import {
  Package,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  DollarSign,
  BarChart3,
  Warehouse,
  AlertCircle
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';

const categorySlugToLabelKey = (slug) => {
  const map = {
    'raw-material': 'inventory.dashboard.categoryRawMaterial',
    'final-product': 'inventory.dashboard.categoryFinalProduct',
    'finished-good': 'inventory.dashboard.categoryFinalProduct',
    'others': 'inventory.dashboard.categoryOthers'
  };
  return map[slug] || null;
};

const InventoryDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';
  const [kpis, setKpis] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const productsRes = await axios.get('/api/inventory/products');
      const products = productsRes.data.data || [];

      // Stock status rules:
      //   Out of stock = currentStock === 0
      //   Low stock    = currentStock > 0 AND currentStock <= minStockLevel
      const outOfStockItems = products.filter((p) => (p.currentStock || 0) === 0);
      const lowStockItems = products.filter((p) => {
        const stock = p.currentStock || 0;
        const min = p.minStockLevel || 0;
        return stock > 0 && stock <= min;
      });

      // Calculate KPIs
      const totalProducts = products.length;
      const lowStockCount = lowStockItems.length;
      const outOfStockCount = outOfStockItems.length;

      // Calculate total stock value
      const stockValue = products.reduce((sum, p) =>
        sum + (p.currentStock * (p.unitCost || 0)), 0
      );

      // Group by category
      const byCategory = products.reduce((acc, prod) => {
        const category = prod.category || t('common.unknown');
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      // Alerts panel: items needing replenishment (out of stock first, then low stock).
      const alertItems = [...outOfStockItems, ...lowStockItems];
      setLowStockProducts(alertItems.slice(0, 5));

      setKpis({
        totalProducts,
        lowStockCount,
        outOfStockCount,
        stockValue,
        byCategory
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

  const getStatusColor = (current, min) => {
    if (current === 0) return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
    if (current <= min) return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
    return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
  };

  const getStatusText = (current, min) => {
    if (current === 0) return t('inventory.status.outOfStock');
    if (current <= min) return t('inventory.status.lowStock');
    return t('inventory.status.inStock');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inventory.dashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('inventory.dashboard.description')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-100 dark:bg-blue-500/20 rounded-full p-3">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('inventory.dashboard.totalProducts')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.totalProducts || 0}
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
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('inventory.dashboard.stockValue')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    ${(kpis?.stockValue || 0).toLocaleString(locale)}
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
                <div className="bg-yellow-100 dark:bg-yellow-500/20 rounded-full p-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('inventory.dashboard.lowStock')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.lowStockCount || 0}
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
                <div className="bg-red-100 dark:bg-red-500/20 rounded-full p-3">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('inventory.dashboard.outOfStock')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.outOfStockCount || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mr-2" />
            {t('inventory.dashboard.lowStockAlerts')}
          </h3>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
          {lowStockProducts.length === 0 ? (
            <li className="px-4 py-5 sm:px-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('inventory.dashboard.noLowStockAlerts')}
              </p>
            </li>
          ) : (
            lowStockProducts.map((product) => (
              <li key={product._id} className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </p>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>{t('inventory.dashboard.sku')}: {product.sku}</span>
                        <span className="mx-2">•</span>
                        <span>{t('inventory.dashboard.stock')}: {product.currentStock}</span>
                        <span className="mx-2">•</span>
                        <span>{t('inventory.dashboard.min')}: {product.minStockLevel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.currentStock, product.minStockLevel)}`}>
                      {getStatusText(product.currentStock, product.minStockLevel)}
                    </span>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>

      {/* Category Distribution */}
      {kpis?.byCategory && Object.keys(kpis.byCategory).length > 0 && (() => {
        const categoryColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        const chartData = Object.entries(kpis.byCategory).map(([category, count], index) => {
          const labelKey = categorySlugToLabelKey(category);
          const name = labelKey ? t(labelKey) : category;
          return {
            name,
            value: count,
            color: categoryColors[index % categoryColors.length]
          };
        });

        return (
          <Card padding={false} className="overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                {t('inventory.dashboard.productsByCategory')}
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [value, name]}
                    contentStyle={{
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : 'rgba(255, 255, 255, 0.95)',
                      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb'}`,
                      borderRadius: '6px',
                      color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                    }}
                  />
                  <Legend 
                    formatter={(value, entry) => `${entry.payload.name}: ${entry.payload.value}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })()}
    </div>
  );
};

export default InventoryDashboard;

