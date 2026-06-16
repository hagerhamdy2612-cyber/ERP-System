/**
 * Single source of truth for attendance + payroll business rules.
 *
 * Both the Attendance Report (server/routes/hr.js) and Payroll
 * (server/services/payrollService.js) MUST use these helpers so the same
 * employee/day is always interpreted identically across modules.
 *
 * Design decisions:
 * - One business timezone strategy. A "business day" is a calendar day in the
 *   configured business timezone, represented canonically as the UTC-midnight
 *   Date of that day key (so Attendance.date, report ranges, and payroll ranges
 *   all line up). Configure the offset with BUSINESS_UTC_OFFSET_MINUTES.
 * - Weekends are derived dynamically (no fixed "first 26 days" rule).
 * - One attendance state machine used everywhere.
 */

const { calculateAttendanceMetrics } = require('./attendanceMetrics');

// Minutes to add to a UTC instant to get business-local wall clock.
// Default 0 keeps everything in UTC (matches the existing report/list endpoints
// which already parse dates with a trailing 'Z'). Set e.g. 180 for UTC+3.
const BUSINESS_UTC_OFFSET_MINUTES =
  Number.parseInt(process.env.BUSINESS_UTC_OFFSET_MINUTES, 10) || 0;

// Weekend by day index (0=Sun, 1=Mon, ... 5=Fri, 6=Sat). Default: Fri + Sat off.
const WEEKEND_DAYS = (() => {
  const raw = process.env.BUSINESS_WEEKEND_DAYS;
  if (raw && raw.trim()) {
    const parsed = raw
      .split(',')
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
    if (parsed.length) return parsed;
  }
  return [5, 6];
})();

const WORKING_HOURS_PER_DAY = 8;
const OVERTIME_RATE = 1.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ATTENDANCE_STATE = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  INCOMPLETE: 'Incomplete',
  OFF_DAY: 'OFF_DAY'
};

function toDate(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Canonical start of the business day that contains `instant`, returned as the
 * UTC-midnight Date of that business-day key.
 */
function getBusinessDayStart(instant) {
  const dt = toDate(instant) || new Date();
  const shifted = new Date(dt.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60000);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0, 0)
  );
}

/** Inclusive end (……T23:59:59.999) of the business day containing `instant`. */
function getBusinessDayEnd(instant) {
  return new Date(getBusinessDayStart(instant).getTime() + MS_PER_DAY - 1);
}

/** 'YYYY-MM-DD' key for the business day containing `instant`. */
function getBusinessDayKey(instant) {
  return getBusinessDayStart(instant).toISOString().slice(0, 10);
}

/** Start/end for "today" in business time (use for check-in/out/status lookups). */
function getTodayBusinessRange() {
  const now = new Date();
  return { start: getBusinessDayStart(now), end: getBusinessDayEnd(now) };
}

/** Parse a 'YYYY-MM-DD' (or Date) into the business day start. */
function parseRangeStart(value) {
  return getBusinessDayStart(toDate(value) || toDate(`${value}T00:00:00.000Z`));
}

/** Parse a 'YYYY-MM-DD' (or Date) into the business day end. */
function parseRangeEnd(value) {
  return getBusinessDayEnd(toDate(value) || toDate(`${value}T00:00:00.000Z`));
}

function isWeekend(dayDate) {
  const d = getBusinessDayStart(dayDate);
  return WEEKEND_DAYS.includes(d.getUTCDay());
}

function isWorkingDay(dayDate) {
  return !isWeekend(dayDate);
}

/** Count working (non-weekend) days in an inclusive [start, end] range. */
function countWorkingDays(start, end) {
  const last = getBusinessDayStart(end);
  let cursor = getBusinessDayStart(start);
  let count = 0;
  while (cursor <= last) {
    if (isWorkingDay(cursor)) count += 1;
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return count;
}

/** First/last instant of a calendar month (UTC), 1-based month. */
function getMonthRange(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  };
}

/** Working days in a calendar month (weekends excluded), 1-based month. */
function countWorkingDaysInMonth(year, month) {
  const { start, end } = getMonthRange(year, month);
  return countWorkingDays(start, end);
}

/**
 * Unified attendance state machine + metrics for a single employee/day.
 *
 * Returns one of: Present | Late | Absent | Incomplete | OFF_DAY plus the
 * derived metrics. `isWorked` (Present/Late) and `isIncomplete` let payroll and
 * the report agree without re-deriving rules.
 *
 * @param {Object} input
 * @param {Date|string|null} input.checkIn
 * @param {Date|string|null} input.checkOut
 * @param {Date|string} input.attendanceDate - the day this record belongs to
 * @param {boolean} [input.hasRecord] - whether a stored record exists for the day
 * @param {boolean} [input.workingDay] - override working-day detection
 */
function deriveAttendanceState({ checkIn, checkOut, attendanceDate, hasRecord, workingDay }) {
  const isWorkDay =
    typeof workingDay === 'boolean' ? workingDay : isWorkingDay(attendanceDate);

  const zeroMetrics = {
    workingMinutes: 0,
    workingHoursDecimal: 0,
    workingHoursDisplay: '00:00',
    lateMinutes: 0,
    earlyMinutes: 0,
    overtimeMinutes: 0,
    overtimeDisplay: '00:00',
    overtimeHoursDecimal: 0
  };

  if (!isWorkDay) {
    return {
      state: ATTENDANCE_STATE.OFF_DAY,
      isWorkingDay: false,
      isWorked: false,
      isIncomplete: false,
      isAbsent: false,
      metrics: zeroMetrics
    };
  }

  const inTime = toDate(checkIn);
  const outTime = toDate(checkOut);
  const recordExists = typeof hasRecord === 'boolean' ? hasRecord : Boolean(inTime || outTime);

  // No record at all on a working day → Absent.
  if (!recordExists && !inTime && !outTime) {
    return {
      state: ATTENDANCE_STATE.ABSENT,
      isWorkingDay: true,
      isWorked: false,
      isIncomplete: false,
      isAbsent: true,
      metrics: zeroMetrics
    };
  }

  // Only one side present (or a record with no usable timestamps) → Incomplete.
  if (!inTime || !outTime) {
    return {
      state: ATTENDANCE_STATE.INCOMPLETE,
      isWorkingDay: true,
      isWorked: false,
      isIncomplete: true,
      isAbsent: false,
      metrics: zeroMetrics
    };
  }

  const metrics = calculateAttendanceMetrics({
    checkIn: inTime,
    checkOut: outTime,
    attendanceDate,
    standardHours: WORKING_HOURS_PER_DAY
  });

  // checkOut <= checkIn etc. → treat as Incomplete (needs HR review).
  if (!metrics.isValid) {
    return {
      state: ATTENDANCE_STATE.INCOMPLETE,
      isWorkingDay: true,
      isWorked: false,
      isIncomplete: true,
      isAbsent: false,
      metrics: { ...zeroMetrics, lateMinutes: metrics.lateMinutes || 0 }
    };
  }

  const state = metrics.lateMinutes > 0 ? ATTENDANCE_STATE.LATE : ATTENDANCE_STATE.PRESENT;
  return {
    state,
    isWorkingDay: true,
    isWorked: true,
    isIncomplete: false,
    isAbsent: false,
    metrics
  };
}

module.exports = {
  BUSINESS_UTC_OFFSET_MINUTES,
  WEEKEND_DAYS,
  WORKING_HOURS_PER_DAY,
  OVERTIME_RATE,
  ATTENDANCE_STATE,
  getBusinessDayStart,
  getBusinessDayEnd,
  getBusinessDayKey,
  getTodayBusinessRange,
  parseRangeStart,
  parseRangeEnd,
  isWeekend,
  isWorkingDay,
  countWorkingDays,
  getMonthRange,
  countWorkingDaysInMonth,
  deriveAttendanceState
};
