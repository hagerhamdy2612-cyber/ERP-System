const DEFAULT_SHIFT_START = { hour: 9, minute: 0 };
const DEFAULT_SHIFT_END = { hour: 17, minute: 0 };
const DEFAULT_DAILY_HOURS = 8;
const MINUTES_PER_HOUR = 60;

function toValidDate(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function diffMinutesInt(later, earlier) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60)));
}

function formatWorkingHoursHHMM(totalMinutes) {
  const safeMinutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const hoursPart = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const minutesPart = safeMinutes % MINUTES_PER_HOUR;
  return `${String(hoursPart).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`;
}

function buildExpectedOnLocalDay(baseDate, hour, minute) {
  const dt = toValidDate(baseDate);
  if (!dt) return null;
  const expected = new Date(dt);
  expected.setHours(hour, minute, 0, 0);
  return expected;
}

/**
 * Match payroll slot + seed data: use UTC Y/M/D from stored `date` (UTC midnight)
 * with local wall-clock hours (same as localClockOnSlotCalendarDay in scripts).
 */
function buildExpectedShiftBoundsFromSlotDate(attendanceDate) {
  const day = toValidDate(attendanceDate);
  if (!day) return { expectedStartTime: null, expectedEndTime: null };
  const y = day.getUTCFullYear();
  const mo = day.getUTCMonth();
  const d = day.getUTCDate();
  return {
    expectedStartTime: new Date(y, mo, d, DEFAULT_SHIFT_START.hour, DEFAULT_SHIFT_START.minute, 0, 0),
    expectedEndTime: new Date(y, mo, d, DEFAULT_SHIFT_END.hour, DEFAULT_SHIFT_END.minute, 0, 0)
  };
}

function expectedShiftStartUtc(checkIn) {
  const t = toValidDate(checkIn);
  if (!t) return null;
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 9, 0, 0, 0));
}

function expectedShiftEndUtc(checkOut) {
  const t = toValidDate(checkOut);
  if (!t) return null;
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 17, 0, 0, 0));
}

function calculateAttendanceMetrics({
  checkIn,
  checkOut,
  attendanceDate,
  expectedStart,
  expectedEnd,
  standardHours = DEFAULT_DAILY_HOURS
}) {
  const inTime = toValidDate(checkIn);
  const outTime = toValidDate(checkOut);
  const expectedStartTime =
    toValidDate(expectedStart) ||
    buildExpectedOnLocalDay(inTime || attendanceDate || outTime, DEFAULT_SHIFT_START.hour, DEFAULT_SHIFT_START.minute);
  const expectedEndTime =
    toValidDate(expectedEnd) ||
    buildExpectedOnLocalDay(outTime || attendanceDate || inTime, DEFAULT_SHIFT_END.hour, DEFAULT_SHIFT_END.minute);

  const hasCheckIn = Boolean(inTime);
  const hasCheckOut = Boolean(outTime);
  const isInvalidRange = hasCheckIn && hasCheckOut && outTime <= inTime;

  let workingMinutes = 0;
  if (hasCheckIn && hasCheckOut && !isInvalidRange) {
    workingMinutes = diffMinutesInt(outTime, inTime);
  }

  const lateMinutes = hasCheckIn && expectedStartTime ? diffMinutesInt(inTime, expectedStartTime) : 0;
  const earlyMinutes = hasCheckOut && expectedEndTime ? diffMinutesInt(expectedEndTime, outTime) : 0;

  const standardMinutes = Math.max(0, Math.floor((Number(standardHours) || DEFAULT_DAILY_HOURS) * MINUTES_PER_HOUR));
  const overtimeMinutes = workingMinutes > standardMinutes ? (workingMinutes - standardMinutes) : 0;
  const workingHoursDecimal = Number((workingMinutes / MINUTES_PER_HOUR).toFixed(2));
  const overtimeHoursDecimal = Number((overtimeMinutes / MINUTES_PER_HOUR).toFixed(2));

  return {
    isValid: !isInvalidRange,
    workingMinutes,
    workingHoursDecimal,
    workingHoursDisplay: formatWorkingHoursHHMM(workingMinutes),
    lateMinutes,
    earlyMinutes,
    overtimeMinutes,
    overtimeDisplay: formatWorkingHoursHHMM(overtimeMinutes),
    overtimeHoursDecimal,
    expectedStartTime,
    expectedEndTime
  };
}

function calculateWorkingHours(checkIn, checkOut) {
  return calculateAttendanceMetrics({ checkIn, checkOut }).workingHoursDecimal;
}

function calculateWorkingHoursDisplay(checkIn, checkOut) {
  return calculateAttendanceMetrics({ checkIn, checkOut }).workingHoursDisplay;
}

function minutesLateUtc(checkIn) {
  const expectedStart = expectedShiftStartUtc(checkIn);
  return calculateAttendanceMetrics({ checkIn, expectedStart }).lateMinutes;
}

function minutesLateLocal(checkIn) {
  return calculateAttendanceMetrics({ checkIn }).lateMinutes;
}

function minutesLateFromSlotDate(checkIn, attendanceDate) {
  return calculateAttendanceMetrics({ checkIn, attendanceDate }).lateMinutes;
}

function minutesEarlyFromSlotDate(checkOut, attendanceDate) {
  return calculateAttendanceMetrics({ checkOut, attendanceDate }).earlyMinutes;
}

function minutesEarlyDepartureUtc(checkOut) {
  const expectedEnd = expectedShiftEndUtc(checkOut);
  return calculateAttendanceMetrics({ checkOut, expectedEnd }).earlyMinutes;
}

function minutesEarlyDepartureLocal(checkOut) {
  return calculateAttendanceMetrics({ checkOut }).earlyMinutes;
}

module.exports = {
  calculateAttendanceMetrics,
  calculateWorkingHours,
  calculateWorkingHoursDisplay,
  formatWorkingHoursHHMM,
  minutesLateUtc,
  minutesLateLocal,
  minutesLateFromSlotDate,
  minutesEarlyFromSlotDate,
  minutesEarlyDepartureUtc,
  minutesEarlyDepartureLocal
};
