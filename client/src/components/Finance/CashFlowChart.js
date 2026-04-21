import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CashFlowChart = () => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const netCashFlowLabel = t('finance.charts.netCashFlow');
  const incomeLabel = t('finance.charts.income');
  const expensesLabel = t('finance.charts.expenses');

  useEffect(() => {
    fetchCashFlowData();
  }, [period]);

  const fetchCashFlowData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/finance/cash-flow?period=${period}`);
      setData(response.data.data);
    } catch (error) {
      console.error('Error fetching cash flow data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format data for chart
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    [netCashFlowLabel]: parseFloat(item.netFlow.toFixed(2)),
    [incomeLabel]: parseFloat(item.totalIn.toFixed(2)),
    [expensesLabel]: parseFloat(item.totalOut.toFixed(2))
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">{t('finance.charts.loadingChart')}</div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">{t('common.noData')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">{t('finance.charts.cashFlowTrend')}</h2>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7">{t('common.last7Days')}</option>
          <option value="30">{t('common.last30Days')}</option>
          <option value="90">{t('common.last90Days')}</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            stroke="#666"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#666"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value.toLocaleString()} EGP`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px'
            }}
            formatter={(value, name) => [
              `${parseFloat(value).toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} EGP`,
              name
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={netCashFlowLabel}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey={incomeLabel}
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={expensesLabel}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CashFlowChart;

