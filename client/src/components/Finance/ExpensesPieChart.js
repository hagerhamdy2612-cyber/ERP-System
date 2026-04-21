import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../Card';

const ExpensesPieChart = () => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  // Color palette for categories
  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316'  // orange
  ];

  useEffect(() => {
    fetchExpensesBreakdown();
  }, []);

  const fetchExpensesBreakdown = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/finance/expenses-breakdown');
      setData(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching expenses breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">{t('finance.charts.loadingChart')}</div>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <PieChartIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">{t('finance.charts.noExpensesThisMonth')}</p>
          </div>
        </div>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.map((item, index) => ({
    name: item.category,
    value: parseFloat(item.total.toFixed(2)),
    percentage: parseFloat(item.percentage.toFixed(1)),
    count: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white">{data.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('finance.charts.amount')}: {data.value.toLocaleString(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} EGP
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('finance.charts.percentage')}: {data.payload.percentage}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('finance.charts.expenseCount', { count: data.payload.count })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <div className="flex items-center mb-6">
        <PieChartIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('finance.charts.expensesByCategory')}</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col justify-center">
          <div className="space-y-3">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {item.value.toLocaleString(locale, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}{' '}
                    EGP
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.total')}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {total.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{' '}
                EGP
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ExpensesPieChart;

