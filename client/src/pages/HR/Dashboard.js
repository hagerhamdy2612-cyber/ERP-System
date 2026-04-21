import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import {
  Users,
  Clock,
  Calendar
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

const HRDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [departmentChartData, setDepartmentChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Colors for pie chart
  const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16'  // Lime
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [employeesRes, attendanceRes] = await Promise.all([
        axios.get('/api/hr/employees'),
        axios.get('/api/hr/attendance')
      ]);

      const employees = employeesRes.data.data || [];
      const attendance = attendanceRes.data.data || [];
      
      // Calculate KPIs
      const totalEmployees = employees.length;
      const todayAttendance = attendance.filter(a => {
        const today = new Date();
        const attDate = new Date(a.date);
        return attDate.toDateString() === today.toDateString();
      }).length;
      
      // Group by department
      const byDepartment = employees.reduce((acc, emp) => {
        const dept = emp.department || 'Unknown';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {});

      // Transform department data for pie chart
      const chartData = Object.entries(byDepartment).map(([name, value]) => ({
        name,
        value
      }));

      setDepartmentChartData(chartData);
      setKpis({
        totalEmployees,
        todayAttendance,
        byDepartment
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.dashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('hr.dashboard.description')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-100 dark:bg-blue-500/20 rounded-full p-3">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('hr.dashboard.totalEmployees')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.totalEmployees || 0}
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
                  <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('hr.dashboard.todayAttendance')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.todayAttendance || 0}
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
                <div className="bg-orange-100 dark:bg-orange-500/20 rounded-full p-3">
                  <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t('hr.dashboard.attendanceRate')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {kpis?.totalEmployees > 0 
                      ? Math.round((kpis.todayAttendance / kpis.totalEmployees) * 100) 
                      : 0}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Department Distribution */}
      {departmentChartData.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
              {t('hr.dashboard.departmentDistribution')}
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {departmentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [t('hr.dashboard.tooltipEmployees', { count: value }), t('hr.dashboard.tooltipCount')]}
                    contentStyle={{
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => (
                      <span style={{ color: entry.color }}>
                        {value}: {departmentChartData.find(d => d.name === value)?.value || 0}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default HRDashboard;

