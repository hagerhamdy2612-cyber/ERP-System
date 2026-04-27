import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FileText, Filter, Calendar, User, Building, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AttendanceReport = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments] = useState([
    'HR', 'Manufacturing', 'SCM', 'CRM', 'Sales', 'Inventory', 'Purchasing'
  ]);

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    employeeId: '',
    departmentId: ''
  });

  // Set default date range (current month)
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setFilters(prev => ({
      ...prev,
      dateFrom: firstDay.toISOString().split('T')[0],
      dateTo: lastDay.toISOString().split('T')[0]
    }));
  }, []);

  // Fetch employees for dropdown
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/api/hr/employees');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Fetch employees error:', error);
    }
  };

  // Fetch attendance report
  const fetchReport = async () => {
    if (!filters.dateFrom || !filters.dateTo) {
      toast.error(t('hr.attendanceReport.selectDateRange'));
      return;
    }

    try {
      setLoading(true);
      const params = {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo
      };

      if (filters.employeeId) {
        // The employeeId filter already contains the user._id (which is what GET /api/hr/employees returns as _id)
        // Backend will handle finding the Employee record by user._id
        params.employeeId = filters.employeeId;
      }

      if (filters.departmentId) {
        params.departmentId = filters.departmentId;
      }

      const response = await axios.get('/api/hr/attendance/report', { params });
      setReportData(response.data.data || []);
      toast.success(t('hr.attendanceReport.loadedRecords', { count: response.data.count || 0 }));
    } catch (error) {
      console.error('Fetch report error:', error);
      toast.error(error.response?.data?.message || t('hr.attendanceReport.fetchFailed'));
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch report when filters change
  useEffect(() => {
    if (filters.dateFrom && filters.dateTo) {
      // Small delay to avoid too many requests
      const timer = setTimeout(() => {
        fetchReport();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filters.dateFrom, filters.dateTo, filters.employeeId, filters.departmentId]);

  // Handle employee filter change
  const handleEmployeeChange = (e) => {
    const value = e.target.value;
    setFilters(prev => ({
      ...prev,
      employeeId: value
    }));
  };

  // Format time helper
  const formatTime = (time) => {
    if (!time || time === 'N/A') return 'N/A';
    return time;
  };

  const toOvertimeMinutes = (row) => {
    const minutesFromField = Number(row?.overtimeMinutes);
    if (Number.isFinite(minutesFromField) && minutesFromField >= 0) {
      return Math.round(minutesFromField);
    }

    const hoursFromField = Number(row?.overtimeHours);
    if (Number.isFinite(hoursFromField) && hoursFromField >= 0) {
      return Math.round(hoursFromField * 60);
    }

    if (typeof row?.overtime === 'string' && row.overtime.includes(':')) {
      const [h, m] = row.overtime.split(':').map((part) => Number(part));
      if (Number.isFinite(h) && Number.isFinite(m) && h >= 0 && m >= 0) {
        return (h * 60) + m;
      }
    }

    return 0;
  };

  const formatOvertimeDisplay = (row) => {
    const totalMinutes = toOvertimeMinutes(row);
    if (totalMinutes <= 0) return '0 min';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m (${totalMinutes} min)`;
  };

  // Export to CSV
  const exportToCSV = () => {
    if (reportData.length === 0) {
      toast.error(t('hr.attendanceReport.noDataToExport'));
      return;
    }

    const headers = [
      t('hr.attendanceReport.employeeName'),
      t('common.date'),
      t('hr.attendanceReport.checkIn'),
      t('hr.attendanceReport.checkOut'),
      t('hr.attendanceReport.status'),
      t('hr.attendanceReport.totalWorkingHours'),
      t('hr.attendanceReport.minutesLate'),
      t('hr.attendanceReport.minutesEarly'),
      'Overtime',
      t('hr.attendanceReport.totalAbsentDays'),
      t('hr.attendanceReport.absencePercent')
    ];

    const csvRows = [
      headers.join(','),
      ...reportData.map(row => [
        `"${row.employeeName || ''}"`,
        row.date || '',
        row.checkIn || 'N/A',
        row.checkOut || 'N/A',
        row.status || '',
        row.totalWorkingHours || 0,
        row.minutesLate || 0,
        row.minutesEarly || 0,
        formatOvertimeDisplay(row),
        row.totalAbsentDays || 0,
        row.absencePercentage || 0
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance-report-${filters.dateFrom}-to-${filters.dateTo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t('hr.attendanceReport.exportSuccess'));
  };

  if (loading && reportData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('hr.attendanceReport.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('hr.attendanceReport.description')}
          </p>
        </div>
        {reportData.length > 0 && (
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('hr.attendanceReport.exportCsv')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900">{t('hr.attendanceReport.filters')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="h-4 w-4 inline mr-1" />
              {t('hr.attendanceReport.dateFrom')}
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="h-4 w-4 inline mr-1" />
              {t('hr.attendanceReport.dateTo')}
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="h-4 w-4 inline mr-1" />
              {t('hr.attendanceReport.employee')}
            </label>
            <select
              value={filters.employeeId}
              onChange={handleEmployeeChange}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{t('hr.attendanceReport.allEmployees')}</option>
              {employees
                .filter(emp => emp.user)
                .map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.employeeId} - {employee.user.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building className="h-4 w-4 inline mr-1" />
              {t('hr.attendanceReport.department')}
            </label>
            <select
              value={filters.departmentId}
              onChange={(e) => setFilters(prev => ({ ...prev, departmentId: e.target.value }))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">{t('hr.attendanceReport.allDepartments')}</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading && reportData.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('hr.attendanceReport.noData')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('hr.attendanceReport.noDataHint')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                    {t('hr.attendanceReport.employeeName')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.checkIn')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.checkOut')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.workingHours')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.minutesLate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.minutesEarly')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overtime
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.totalAbsentDays')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('hr.attendanceReport.absencePercent')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row, index) => (
                  <tr key={`${row.employeeId}-${row.date}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                      {row.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(row.checkIn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(row.checkOut)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          row.status === 'Present'
                            ? 'bg-green-100 text-green-800'
                            : row.status === 'Absent'
                            ? 'bg-red-100 text-red-800'
                            : row.status === 'Late'
                            ? 'bg-yellow-100 text-yellow-800'
                            : row.status === 'Early Leave'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.totalWorkingHours || '00:00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.minutesLate > 0 ? (
                        <span className="text-red-600 font-semibold">{row.minutesLate} min</span>
                      ) : (
                        <span className="text-gray-500">0 min</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.minutesEarly > 0 ? (
                        <span className="text-orange-600 font-semibold">{row.minutesEarly} min</span>
                      ) : (
                        <span className="text-gray-500">0 min</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {toOvertimeMinutes(row) > 0 ? (
                        <span className="text-blue-600 font-semibold">{formatOvertimeDisplay(row)}</span>
                      ) : (
                        <span className="text-gray-500">0 min</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.totalAbsentDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`font-semibold ${
                          row.absencePercentage > 10
                            ? 'text-red-600'
                            : row.absencePercentage > 5
                            ? 'text-orange-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {row.absencePercentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Info */}
      {reportData.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{t('hr.attendanceReport.totalRecords')}:</strong> {reportData.length} | {t('hr.attendanceReport.selectedDateRangeSummary')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendanceReport;

