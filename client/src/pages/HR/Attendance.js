import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Clock, CheckCircle, XCircle, AlertCircle, Users, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canCheckInOut, canViewAllAttendanceRecords, canManageEmployees } from '../../config/permissions';

const isHRUser = (user) => {
  return user?.role === 'admin' || user?.department === 'HR';
};

const Attendance = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false); // Start as false, will be set true when fetching data
  const [canCheckIn, setCanCheckIn] = useState(true); // Default to true - user can check in if no record exists
  const [canCheckOut, setCanCheckOut] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [corrections, setCorrections] = useState({});

  const queryParams = new URLSearchParams(location.search);
  const reviewMode = queryParams.get('attendanceReview') === '1';
  const reviewEmployee = queryParams.get('employee') || '';
  const reviewPayrollId = queryParams.get('payrollId') || '';
  const reviewYear = Number(queryParams.get('periodYear'));
  const reviewMonth = Number(queryParams.get('periodMonth'));
  const reviewStartDate = reviewYear && reviewMonth
    ? `${reviewYear}-${String(reviewMonth).padStart(2, '0')}-01`
    : '';
  const reviewEndDate = reviewYear && reviewMonth
    ? new Date(reviewYear, reviewMonth, 0).toISOString().slice(0, 10)
    : '';

  // Helper to get user ID (handles both 'id' and '_id' properties)
  const getUserId = () => {
    return user?.id || user?._id;
  };

  const fetchAttendance = async (dateFilter = '') => {
    try {
      setLoading(true); // Set loading when starting to fetch
      const params = {};
      if (reviewMode) {
        if (reviewEmployee) params.employee = reviewEmployee;
        if (reviewStartDate && reviewEndDate) {
          params.startDate = reviewStartDate;
          params.endDate = reviewEndDate;
        }
      } else if (dateFilter) {
        params.startDate = dateFilter;
        params.endDate = dateFilter;
      }
      
      const response = await axios.get('/api/hr/attendance', { params });
      setAttendance(response.data.data);
    } catch (error) {
      console.error('Fetch attendance error:', error);
      // Clear attendance data on error
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const toDatetimeLocalValue = (record, hour = 17, minute = 0) => {
    const base = record?.checkOut || record?.checkIn || record?.date;
    const dt = base ? new Date(base) : new Date();
    if (!record?.checkOut) {
      dt.setHours(hour, minute, 0, 0);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const getCorrectionValue = (record) => (
    corrections[record._id]?.checkOut || toDatetimeLocalValue(record)
  );

  const setCorrectionValue = (recordId, checkOut) => {
    setCorrections((prev) => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        checkOut
      }
    }));
  };

  const updateAttendanceRecord = async (record, payload, successMessage) => {
    try {
      await axios.patch(`/api/hr/attendance/${record._id}`, payload);
      toast.success(successMessage);
      fetchAttendance(filterDate);
    } catch (error) {
      toast.error(error.response?.data?.message || t('messages.error'));
    }
  };

  const saveCheckoutCorrection = (record) => {
    const value = getCorrectionValue(record);
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) {
      toast.error('Invalid checkout time');
      return;
    }
    updateAttendanceRecord(
      record,
      { checkOut: dt.toISOString(), status: record.status === 'late' ? 'late' : 'present' },
      'Attendance corrected'
    );
  };

  const markAttendanceAbsent = (record) => {
    updateAttendanceRecord(
      record,
      { checkIn: null, checkOut: null, status: 'absent' },
      'Attendance marked absent'
    );
  };

  // Load from localStorage on mount as backup
  const loadCachedAttendance = useCallback(() => {
    const userId = getUserId();
    if (!user || !userId) return null;
    
    try {
      const cacheKey = `attendance_${userId}_${new Date().toISOString().split('T')[0]}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is for today
        const cacheDate = new Date(parsed.date);
        const today = new Date();
        const isToday = cacheDate.getFullYear() === today.getFullYear() &&
                       cacheDate.getMonth() === today.getMonth() &&
                       cacheDate.getDate() === today.getDate();
        
        if (isToday && parsed.checkIn && !parsed.checkOut) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading cached attendance:', error);
    }
    return null;
  }, [user]);

  // Save to localStorage as backup
  const saveCachedAttendance = useCallback((attendanceData) => {
    const userId = getUserId();
    if (!user || !userId || !attendanceData) return;
    
    try {
      const cacheKey = `attendance_${userId}_${new Date().toISOString().split('T')[0]}`;
      localStorage.setItem(cacheKey, JSON.stringify(attendanceData));
    } catch (error) {
      console.error('Error saving cached attendance:', error);
    }
  }, [user]);

  // Clear localStorage cache
  const clearCachedAttendance = useCallback(() => {
    const userId = getUserId();
    if (!user || !userId) return;
    
    try {
      const cacheKey = `attendance_${userId}_${new Date().toISOString().split('T')[0]}`;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing cached attendance:', error);
    }
  }, [user]);

  const checkTodayAttendance = useCallback(async () => {
    const userId = getUserId();
    if (!user || !userId) {
      // Silently skip if user is not available yet
      return;
    }

    try {
      // First try to get status from dedicated endpoint
      const response = await axios.get('/api/hr/attendance/status');
      
      console.log('Attendance status response:', response.data);
      
      if (response.data.success) {
        const { status, data: attendanceData } = response.data;
        
        if (status === 'checked_in' && attendanceData) {
          // User is checked in, show checkout button
          setTodayAttendance(attendanceData);
          setCanCheckIn(false);
          setCanCheckOut(true);
          saveCachedAttendance(attendanceData);
        } else if (status === 'checked_out' && attendanceData) {
          // User is checked out, show neither button (or show completed status)
          setTodayAttendance(attendanceData);
          setCanCheckIn(false);
          setCanCheckOut(false);
          saveCachedAttendance(attendanceData);
        } else {
          // Not checked in today
          setTodayAttendance(null);
          setCanCheckIn(true);
          setCanCheckOut(false);
          clearCachedAttendance();
        }
      } else {
        throw new Error('Failed to get attendance status');
      }
    } catch (error) {
      console.error('Check today attendance error:', error);
      console.error('Error details:', error.response?.data);
      
      // Fallback to cached data if API fails
      const cached = loadCachedAttendance();
      if (cached) {
        console.log('Using cached attendance data as fallback');
        setTodayAttendance(cached);
        setCanCheckIn(false);
        setCanCheckOut(true);
      } else {
        // On error, allow check-in as default
        setCanCheckIn(true);
        setCanCheckOut(false);
        setTodayAttendance(null);
      }
    }
  }, [user, saveCachedAttendance, clearCachedAttendance, loadCachedAttendance]);

  // Track if component has been initialized and previous pathname
  const isInitializedRef = useRef(false);
  const prevPathnameRef = useRef(null);
  
  // Initialize attendance status on mount and when user changes
  useEffect(() => {
    const userId = getUserId();
    // Only initialize when user is fully loaded with id and auth is not loading
    if (!authLoading && user && userId) {
      // Try cached data first for instant UI update
      const cached = loadCachedAttendance();
      if (cached) {
        setTodayAttendance(cached);
        setCanCheckIn(false);
        setCanCheckOut(true);
      }
      
      // Then fetch from backend for accurate status
      fetchAttendance();
      checkTodayAttendance();
      isInitializedRef.current = true;
      prevPathnameRef.current = location.pathname;
    } else if (!authLoading && user === null) {
      // User is explicitly null (not loading), reset state
      isInitializedRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Refresh attendance status when navigating to any attendance page
  useEffect(() => {
    if (!user || !isInitializedRef.current) {
      return; // Skip if not initialized yet
    }
    
    const isOnAttendancePage = location.pathname.includes('/attendance');
    const pathnameChanged = prevPathnameRef.current !== location.pathname;
    const userId = getUserId();
    
    // Always refresh when pathname changes AND we're on an attendance page
    // This covers: navigating between attendance pages AND navigating back to attendance page
    if (isOnAttendancePage && pathnameChanged && user && userId) {
      console.log('Refreshing attendance status - navigating to attendance page', {
        currentPath: location.pathname,
        prevPath: prevPathnameRef.current
      });
      // Force refresh from backend to get latest status
      checkTodayAttendance();
      fetchAttendance(filterDate);
    }
    
    // Always update ref to track pathname changes
    prevPathnameRef.current = location.pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Only depend on pathname - user dependency handled in init effect

  // Also refresh when page becomes visible (user switches back to tab)
  useEffect(() => {
    if (!user || !isInitializedRef.current) return;
    
    const handleVisibilityChange = () => {
      const userId = getUserId();
      // Only refresh if user exists and we're on attendance page
      if (user && userId && document.visibilityState === 'visible' && location.pathname.includes('/attendance')) {
        console.log('Page became visible, refreshing attendance status');
        checkTodayAttendance();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname]);

  const handleCheckIn = async () => {
    // Double check user exists before making API call
    // User object has 'id' property (not '_id') from auth API
    if (!user || (!user.id && !user._id)) {
      console.error('User object:', user);
      toast.error(t('hr.attendance.userLoading'));
      return;
    }
    
    if (!canCheckInOut(user)) {
      toast.error(t('hr.attendance.noPermission'));
      return;
    }
    
    try {
      const response = await axios.post('/api/hr/attendance/checkin');
      toast.success(t('hr.attendance.checkedInSuccess'));
      
      // Set today's attendance with the response data immediately
      if (response.data && response.data.data) {
        const attendanceData = response.data.data;
        setTodayAttendance(attendanceData);
        setCanCheckIn(false);
        setCanCheckOut(true);
        // Save to localStorage as backup
        saveCachedAttendance(attendanceData);
      } else {
        // Fallback: update states even if response format is unexpected
        setCanCheckIn(false);
        setCanCheckOut(true);
      }
      
      // Refresh the attendance list
      fetchAttendance(filterDate);
      // Also refresh status after a short delay to ensure consistency
      const userId = getUserId();
      if (user && userId) {
        setTimeout(() => {
          checkTodayAttendance();
        }, 500);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          t('hr.attendance.checkInFailed');
      
      // If already checked in (400), refresh status instead of showing error
      const userId = getUserId();
      if (error.response?.status === 400 && (errorMessage.includes('Already checked in') || errorMessage.includes('already checked in'))) {
        // User is already checked in, refresh to show correct state
        if (user && userId) {
          checkTodayAttendance();
        }
        // Don't show error toast for this case - it's just a state sync issue
        return; // Exit early to prevent showing error
      } else {
        toast.error(errorMessage);
        // Refresh today's attendance to get latest state
        if (user && userId) {
          checkTodayAttendance();
        }
      }
    }
  };

  const handleCheckOut = async () => {
    // Double check user exists before making API call
    // User object has 'id' property (not '_id') from auth API
    if (!user || (!user.id && !user._id)) {
      console.error('User object:', user);
      toast.error(t('hr.attendance.userLoading'));
      return;
    }
    
    if (!canCheckInOut(user)) {
      toast.error(t('hr.attendance.noPermission'));
      return;
    }
    
    try {
      const response = await axios.post('/api/hr/attendance/checkout');
      toast.success(t('hr.attendance.checkedOutSuccess'));
      
      // Update states immediately
      setCanCheckIn(false);
      setCanCheckOut(false);
      
      // Set the updated attendance record with checkout time
      if (response.data && response.data.data) {
        const attendanceData = response.data.data;
        setTodayAttendance(attendanceData);
        // Save to localStorage as backup
        saveCachedAttendance(attendanceData);
      }
      
      // Refresh both attendance list and today's attendance
      fetchAttendance(filterDate);
      // Wait a bit before checking today's attendance to ensure DB is updated
      const userId = getUserId();
      if (user && userId) {
        setTimeout(() => {
          checkTodayAttendance();
        }, 500);
      }
    } catch (error) {
      console.error('Check-out error:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          t('hr.attendance.checkOutFailed');
      toast.error(errorMessage);
      
      // Refresh today's attendance to get latest state
      const userId = getUserId();
      if (user && userId) {
        checkTodayAttendance();
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />;
      case 'absent': return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />;
      case 'late': return <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
      default: return <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      case 'absent': return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
      case 'late': return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300';
    }
  };

  // Show loading spinner only if auth is loading or component is fetching data
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If user is not available after auth loading is done, show error (shouldn't happen due to ProtectedRoute)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">{t('hr.attendance.loginToView')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.attendance.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {canViewAllAttendanceRecords(user) 
            ? t('hr.attendance.trackAll')
            : t('hr.attendance.trackYour')
          }
        </p>
      </div>

      {reviewMode && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-amber-800 dark:text-amber-300">
                Review incomplete attendance before payroll approval
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Showing attendance for payroll period {reviewMonth}/{reviewYear}. Add the missing checkout time or mark the record absent, then go back and recalculate payroll.
              </p>
            </div>
            {reviewPayrollId && (
              <Link
                to={`/app/hr/payroll/${reviewPayrollId}`}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Back to payroll
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Check In/Out Controls - Available to all users */}
      {canCheckInOut(user) && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('hr.attendance.todaysAttendance')}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {todayAttendance && todayAttendance.checkIn ? (
                <div className="flex items-center space-x-2">
                  {todayAttendance.checkOut ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {t('hr.attendance.checkedInAt')} {new Date(todayAttendance.checkIn).toLocaleTimeString()}
                        {' • '}
                        {t('hr.attendance.checkedOutAt')} {new Date(todayAttendance.checkOut).toLocaleTimeString()}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {t('hr.attendance.checkedInAt')} {new Date(todayAttendance.checkIn).toLocaleTimeString()}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{t('hr.attendance.notCheckedInToday')}</span>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              {canCheckIn && (
                <button
                  onClick={handleCheckIn}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('hr.attendance.checkIn')}
                </button>
              )}
              
              {canCheckOut && (
                <button
                  onClick={handleCheckOut}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('hr.attendance.checkOut')}
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Filter Controls - Only for HR users */}
      {canViewAllAttendanceRecords(user) && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('hr.attendance.filterRecords')}</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    fetchAttendance(e.target.value);
                  }}
                  className="border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <button
                onClick={() => {
                  setFilterDate('');
                  fetchAttendance('');
                }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {t('hr.attendance.clearFilter')}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Attendance Records */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            {canViewAllAttendanceRecords(user) ? t('hr.attendance.allRecords') : t('hr.attendance.yourRecords')}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {canViewAllAttendanceRecords(user) 
              ? t('hr.attendance.allHistory')
              : t('hr.attendance.yourHistory')
            }
          </p>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
          {attendance.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              {t('hr.attendance.noRecords')}
            </li>
          ) : (
            attendance
              .filter(record => record.employee && record.employee.user) // Only show records with valid employee data
              .map((record) => (
              <li key={record._id} className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getStatusIcon(record.status)}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {record.employee?.user?.name || t('hr.attendance.unknownEmployee')}
                        </p>
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400">
                          {record.employee?.employeeId || t('common.unknown')}
                        </span>
                        {canViewAllAttendanceRecords(user) && record.employee?.department && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300">
                            {record.employee.department}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>{new Date(record.date).toLocaleDateString()}</span>
                        {record.checkIn && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{t('hr.attendance.in')}: {new Date(record.checkIn).toLocaleTimeString()}</span>
                          </>
                        )}
                        {record.checkOut && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{t('hr.attendance.out')}: {new Date(record.checkOut).toLocaleTimeString()}</span>
                          </>
                        )}
                        {record.workingHours > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{t('hr.attendance.workedHours', { count: record.workingHours })}</span>
                          </>
                        )}
                        {record.overtime > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-yellow-600 dark:text-yellow-400">{t('hr.attendance.overtimeHours', { count: record.overtime })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                      {t(`hr.reports.${record.status}`, { defaultValue: record.status })}
                    </span>
                    {canViewAllAttendanceRecords(user) && record.checkIn && !record.checkOut && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="datetime-local"
                          value={getCorrectionValue(record)}
                          onChange={(e) => setCorrectionValue(record._id, e.target.value)}
                          className="border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => saveCheckoutCorrection(record)}
                          className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                        >
                          Save checkout
                        </button>
                        <button
                          type="button"
                          onClick={() => markAttendanceAbsent(record)}
                          className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                        >
                          Mark absent
                        </button>
                      </div>
                    )}
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

export default Attendance;
