const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
require('../models/User');
const { generatePayroll } = require('../services/payrollService');
const {
  PAYROLL_SLOT_COUNT,
  getPayrollSlotDates
} = require('../utils/payrollPeriodSlots');

/** Minutes from midnight — local wall clock on slot calendar day (matches UI + payroll). */
const MIN_NORMAL_IN = 8 * 60 + 45; // 08:45
const MAX_NORMAL_IN = 9 * 60 + 5; // 09:05
const MAX_NORMAL_IN_ON_TIME = 9 * 60 + 0; // 09:00 — no lateness
const MIN_NORMAL_OUT = 16 * 60 + 55; // 16:55
const MAX_NORMAL_OUT = 17 * 60 + 10; // 17:10
const MIN_LATE_IN = 9 * 60 + 5; // 09:05
const MAX_LATE_IN = 9 * 60 + 45; // 09:45 (below 10:00 → Late, not Absent)
const MIN_OT_OUT = 17 * 60 + 30; // 17:30
const MAX_OT_OUT = 20 * 60; // 20:00

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicInt(min, max, key) {
  const range = max - min + 1;
  return min + (hashString(String(key)) % range);
}

function deterministicSortByKey(items, keyBuilder) {
  return [...items].sort((a, b) => {
    const ka = hashString(keyBuilder(a));
    const kb = hashString(keyBuilder(b));
    if (ka === kb) return 0;
    return ka < kb ? -1 : 1;
  });
}

/**
 * Clock time on the payroll slot's calendar day in the **server local** timezone
 * (so 17:10 displays as ~5:10 PM, not ~7 PM in UTC+2 when using UTC 17:10).
 */
function localClockOnSlotCalendarDay(slotUtcMidnight, minutesFromMidnight) {
  const y = slotUtcMidnight.getUTCFullYear();
  const mo = slotUtcMidnight.getUTCMonth();
  const d = slotUtcMidnight.getUTCDate();
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return new Date(y, mo, d, h, m, 0, 0);
}

function typeListFromCounts(countsByType, seedKey) {
  const flat = [];
  for (const [type, n] of Object.entries(countsByType)) {
    for (let k = 0; k < n; k += 1) {
      flat.push(type);
    }
  }
  if (flat.length !== PAYROLL_SLOT_COUNT) {
    throw new Error(`typeListFromCounts: expected ${PAYROLL_SLOT_COUNT} types, got ${flat.length}`);
  }
  return deterministicSortByKey(
    flat.map((type, idx) => ({ type, idx })),
    (x) => `${seedKey}:perm:${x.idx}:${x.type}`
  ).map((x) => x.type);
}

function permuteSlots(slotDates, seedKey) {
  return deterministicSortByKey(
    slotDates.map((slot, idx) => ({ slot, idx })),
    (p) => `${seedKey}:slot:${p.idx}`
  );
}

function assertTwentySixSlotsPerEmployee(docs, employeeIds) {
  for (const empId of employeeIds) {
    const id = String(empId);
    const count = docs.filter((d) => String(d.employee) === id).length;
    if (count !== PAYROLL_SLOT_COUNT) {
      throw new Error(
        `Attendance generation: employee ${id} expected ${PAYROLL_SLOT_COUNT} records for period, got ${count}`
      );
    }
  }
}

/**
 * Late window is 09:05–09:45 only. If a generated value were after 10:00, policy is Absent
 * (not used here — MAX_LATE_IN keeps check-ins before 10:00).
 */
function buildDocForSlot(employeeId, slot, kind, key) {
  if (kind === 'absent') {
    return {
      employee: employeeId,
      date: slot,
      status: 'absent'
    };
  }

  if (kind === 'late') {
    const inMin = deterministicInt(MIN_LATE_IN, MAX_LATE_IN, `${key}:late-in`);
    if (inMin >= 10 * 60) {
      throw new Error(`Late check-in would be >= 10:00 for key ${key}`);
    }
    const outMin = deterministicInt(MIN_NORMAL_OUT, MAX_NORMAL_OUT, `${key}:late-out`);
    return {
      employee: employeeId,
      date: slot,
      checkIn: localClockOnSlotCalendarDay(slot, inMin),
      checkOut: localClockOnSlotCalendarDay(slot, outMin),
      status: 'late'
    };
  }

  if (kind === 'overtime') {
    const inMin = deterministicInt(MIN_NORMAL_IN, MAX_NORMAL_IN, `${key}:ot-in`);
    const outMin = deterministicInt(MIN_OT_OUT, MAX_OT_OUT, `${key}:ot-out`);
    return {
      employee: employeeId,
      date: slot,
      checkIn: localClockOnSlotCalendarDay(slot, inMin),
      checkOut: localClockOnSlotCalendarDay(slot, outMin),
      status: 'present'
    };
  }

  if (kind === 'normal_on_time') {
    const inMin = deterministicInt(MIN_NORMAL_IN, MAX_NORMAL_IN_ON_TIME, `${key}:noin`);
    const outMin = deterministicInt(MIN_NORMAL_OUT, MAX_NORMAL_OUT, `${key}:noout`);
    return {
      employee: employeeId,
      date: slot,
      checkIn: localClockOnSlotCalendarDay(slot, inMin),
      checkOut: localClockOnSlotCalendarDay(slot, outMin),
      status: 'present'
    };
  }

  if (kind === 'normal') {
    const inMin = deterministicInt(MIN_NORMAL_IN, MAX_NORMAL_IN, `${key}:n-in`);
    const outMin = deterministicInt(MIN_NORMAL_OUT, MAX_NORMAL_OUT, `${key}:n-out`);
    return {
      employee: employeeId,
      date: slot,
      checkIn: localClockOnSlotCalendarDay(slot, inMin),
      checkOut: localClockOnSlotCalendarDay(slot, outMin),
      status: 'present'
    };
  }

  throw new Error(`Unknown attendance kind: ${kind}`);
}

function scenarioTypeCounts(scenario) {
  switch (scenario) {
    case 'perfect':
      return { normal_on_time: 26 };
    case 'absence_focus':
      return { normal: 22, absent: 4 };
    case 'late_focus':
      return { normal: 20, late: 6 };
    case 'mixed':
      return { normal: 18, late: 4, absent: 2, overtime: 2 };
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

async function createAttendanceForMonth(employees, period) {
  const slotDates = getPayrollSlotDates(period.year, period.month);
  if (slotDates.length !== PAYROLL_SLOT_COUNT) {
    throw new Error(`Expected ${PAYROLL_SLOT_COUNT} payroll slot dates for ${period.year}-${period.month}`);
  }

  const counts = scenarioTypeCounts(period.scenario);
  const docs = [];

  for (const employee of employees) {
    const employeeSeed = `${employee._id}:${period.year}-${String(period.month).padStart(2, '0')}:${period.scenario}`;
    const types = typeListFromCounts(counts, employeeSeed);
    const slotsPerm = permuteSlots(slotDates, employeeSeed);

    for (let i = 0; i < PAYROLL_SLOT_COUNT; i += 1) {
      const slot = slotsPerm[i].slot;
      const kind = types[i];
      const key = `${employeeSeed}:${slot.toISOString().slice(0, 10)}:${i}`;
      docs.push(buildDocForSlot(employee._id, slot, kind, key));
    }
  }

  assertTwentySixSlotsPerEmployee(docs, employees.map((e) => e._id));

  if (docs.length > 0) {
    await Attendance.insertMany(docs, { ordered: false });
  }

  return docs.length;
}

function getLastFourMonths() {
  const now = new Date();
  const months = [];
  for (let i = 3; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const employees = await Employee.find({ isActive: true })
      .populate({ path: 'user', select: 'role isActive isDeleted', options: { includeDeleted: true } })
      .select('_id employeeId user')
      .lean();
    const testEmployees = employees
      .filter((emp) => emp.user && emp.user.role !== 'admin' && emp.user.isActive && !emp.user.isDeleted)
      .slice(0, 6);
    if (!testEmployees.length) {
      console.log('No eligible non-admin active employees found. Nothing to generate.');
      process.exit(0);
    }
    if (testEmployees.length < 6) {
      console.log(`Warning: expected 6 test employees, found ${testEmployees.length}. Continuing.`);
    }

    const rawMonths = getLastFourMonths();
    const months = [
      { ...rawMonths[0], scenario: 'perfect', label: 'Month 1 — Perfect (26 present, on time)' },
      { ...rawMonths[1], scenario: 'absence_focus', label: 'Month 2 — Absence (22 present, 4 absent)' },
      { ...rawMonths[2], scenario: 'late_focus', label: 'Month 3 — Late (20 present, 6 late)' },
      { ...rawMonths[3], scenario: 'mixed', label: 'Month 4 — Mixed (18 / 4 late / 2 absent / 2 OT)' }
    ];

    await Attendance.deleteMany({});
    console.log('Cleared existing attendance records');

    let totalAttendanceRecords = 0;
    for (const period of months) {
      const count = await createAttendanceForMonth(testEmployees, period);
      totalAttendanceRecords += count;
      console.log(
        `Generated attendance for ${period.year}-${String(period.month).padStart(2, '0')} (${period.label}): ${count} records`
      );
    }

    for (const period of months) {
      try {
        const generated = await generatePayroll({
          periodYear: period.year,
          periodMonth: period.month
        });
        console.log(`Generated payroll for ${period.year}-${String(period.month).padStart(2, '0')}: ${generated.length} records`);
      } catch (error) {
        console.log(`Skipped payroll for ${period.year}-${String(period.month).padStart(2, '0')}: ${error.message}`);
      }
    }

    console.log(`Done. Total attendance records generated: ${totalAttendanceRecords}`);
    process.exit(0);
  } catch (error) {
    console.error('Attendance test data generation failed:', error);
    process.exit(1);
  }
}

run();
