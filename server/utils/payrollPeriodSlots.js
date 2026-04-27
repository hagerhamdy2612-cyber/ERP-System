/**
 * Payroll uses a fixed bucket of 26 day-slots per period (periodYear + periodMonth).
 * Slots are the first 26 consecutive calendar days starting on the 1st of that month
 * (always within the same month). Attendance for payroll must fall in this range
 * so counts align with WORKING_DAYS_PER_MONTH.
 */

const PAYROLL_SLOT_COUNT = 26;

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {Date[]} Exactly 26 UTC midnight dates (slot boundaries for `date` field)
 */
function getPayrollSlotDates(year, month) {
  const dates = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  while (dates.length < PAYROLL_SLOT_COUNT) {
    dates.push(
      new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 0, 0, 0, 0)
      )
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (dates.length !== PAYROLL_SLOT_COUNT) {
    throw new Error(`payrollPeriodSlots: expected ${PAYROLL_SLOT_COUNT} slot dates`);
  }
  return dates;
}

/**
 * Mongo bounds for Attendance.date covering all payroll slots for the period.
 * @param {number} year
 * @param {number} month 1-12
 * @returns {{ start: Date, end: Date, slotDates: Date[] }}
 */
function getPayrollAttendanceQueryBounds(year, month) {
  const slotDates = getPayrollSlotDates(year, month);
  const first = slotDates[0];
  const last = slotDates[slotDates.length - 1];
  const start = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end, slotDates };
}

module.exports = {
  PAYROLL_SLOT_COUNT,
  getPayrollSlotDates,
  getPayrollAttendanceQueryBounds
};
