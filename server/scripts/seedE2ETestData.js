/**
 * End-to-end HR test data seeder.
 *
 * Simulates ONE full business month of realistic attendance + sales so that
 * Payroll generation, the Attendance Report, and all edge cases (late, absent,
 * incomplete, overtime, sales bonus) can be tested immediately.
 *
 * This script ONLY generates test data. It does not modify any ERP business
 * logic or payroll code.
 *
 * Behavior:
 *   1. Clears Attendance, Payroll (PayrollRecord) and Sales (SalesOrder) only.
 *      Users and Employees are NOT deleted.
 *   2. Ensures the 5 test personas exist (creates them if missing), each with
 *      baseSalary = 10000 in department HR. Created logins use
 *      <name>@erp.com / password123.
 *   3. Generates one month of attendance for working days only (Fri + Sat off),
 *      one record per employee per working day, using deterministic per-persona
 *      rules.
 *   4. Generates one monthly sales record per employee for bonus testing.
 *
 * Usage (run from the server folder so ./config.env loads):
 *   node scripts/seedE2ETestData.js
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const PayrollRecord = require('../models/PayrollRecord');
const SalesOrder = require('../models/SalesOrder');
const { isWorkingDay } = require('../utils/attendancePolicy');

// ---- Configuration -------------------------------------------------------
const TEST_YEAR = 2026;
const TEST_MONTH = 5; // 1-based: May 2026
const BASE_SALARY = 10000;
const DEPARTMENT = 'HR';

// Persona definitions drive the deterministic attendance generation.
const PERSONAS = [
  { name: 'Ahmed', type: 'perfect' },
  { name: 'Ali', type: 'late' },
  { name: 'Omar', type: 'absent' },
  { name: 'Sara', type: 'overtime' },
  { name: 'Mona', type: 'incomplete' }
];

// ---- Deterministic pseudo-random (same output every run) ------------------
function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Avalanche finalizer (murmur3-style) so sequential keys decorrelate and
  // thresholds (70/30, 80/20, ...) distribute evenly across days.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

function rand(key) {
  return hashStr(key) / 4294967296;
}

// ---- Date helpers --------------------------------------------------------
// Stored attendance `date` = UTC midnight of the business day (matches the
// attendance policy + report grouping). Check-in/out timestamps use local
// wall-clock hours (matches attendanceMetrics' local shift-bounds logic).
function businessDayUtc(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

function localTime(year, monthIndex, day, hour, minute) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0);
}

const norm = (s) => String(s || '').trim().toLowerCase();

async function computeNextEmployeeNumber() {
  const all = await Employee.find({}).select('employeeId').lean();
  let max = 0;
  for (const e of all) {
    const m = String(e.employeeId || '').match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

let nextEmpNumber = 1;
function formatEmployeeId(n) {
  return `EMP${String(n).padStart(4, '0')}`;
}

async function ensurePersonaEmployee(persona, employeesByName) {
  const existing = employeesByName.get(norm(persona.name));
  if (existing) {
    // Guarantee a meaningful base salary for payroll testing.
    if (existing.salary !== BASE_SALARY) {
      existing.salary = BASE_SALARY;
      await existing.save();
    }
    return { employee: existing, created: false };
  }

  const email = `${persona.name.toLowerCase()}@erp.com`;
  let user = await User.findOne({ email }).setOptions({ includeDeleted: true });
  if (!user) {
    user = await User.create({
      name: persona.name,
      email,
      password: 'password123',
      role: 'employee',
      department: DEPARTMENT,
      isActive: true
    });
  }

  const employee = await Employee.create({
    employeeId: formatEmployeeId(nextEmpNumber++),
    user: user._id,
    position: 'Employee',
    department: DEPARTMENT,
    hireDate: new Date(Date.UTC(TEST_YEAR, 0, 1)),
    salary: BASE_SALARY,
    isActive: true
  });
  employee.user = user;
  return { employee, created: true };
}

// ---- Attendance generation per persona -----------------------------------
// Returns an attendance doc, or null for an absent day (no record created).
function buildAttendanceForDay(persona, employee, year, monthIndex, day, dateKey) {
  const date = businessDayUtc(year, monthIndex, day);
  const r = rand(`${persona.name}:${dateKey}`);

  const present = (checkInH, checkInM, checkOutH, checkOutM, status) => ({
    employee: employee._id,
    date,
    checkIn: localTime(year, monthIndex, day, checkInH, checkInM),
    checkOut: localTime(year, monthIndex, day, checkOutH, checkOutM),
    status
  });

  switch (persona.type) {
    case 'perfect':
      // Always 09:00 - 17:00.
      return present(9, 0, 17, 0, 'present');

    case 'late':
      // 70% on-time 09:00-17:00, 30% late 10:30-17:00.
      return r < 0.7
        ? present(9, 0, 17, 0, 'present')
        : present(10, 30, 17, 0, 'late');

    case 'absent':
      // 80% present 09:00-17:00, 20% absent (NO record).
      return r < 0.8 ? present(9, 0, 17, 0, 'present') : null;

    case 'overtime': {
      // Always present; 30% of days have overtime (checkout 20:00).
      const ot = rand(`${persona.name}:ot:${dateKey}`) < 0.3;
      return present(9, 0, ot ? 20 : 17, 0, 'present');
    }

    case 'incomplete':
      // 70% present 09:00-17:00, 30% incomplete (checkIn only, no checkOut).
      if (r < 0.7) return present(9, 0, 17, 0, 'present');
      return {
        employee: employee._id,
        date,
        checkIn: localTime(year, monthIndex, day, 9, 0),
        checkOut: null,
        status: 'present'
      };

    default:
      return present(9, 0, 17, 0, 'present');
  }
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Run from the server folder so ./config.env loads.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${process.env.MONGODB_URI}`);

  // STEP 1 — clean only Attendance, Payroll, Sales.
  const [attDel, payDel, salesDel] = await Promise.all([
    Attendance.deleteMany({}),
    PayrollRecord.deleteMany({}),
    SalesOrder.deleteMany({})
  ]);
  console.log(
    `Cleared -> attendance: ${attDel.deletedCount || 0}, payroll: ${payDel.deletedCount || 0}, sales: ${salesDel.deletedCount || 0}`
  );

  // STEP 2 — create or reuse the 5 personas.
  nextEmpNumber = await computeNextEmployeeNumber();
  const existingEmployees = await Employee.find({}).populate('user', 'name email');
  const employeesByName = new Map();
  existingEmployees.forEach((e) => {
    if (e.user && e.user.name) employeesByName.set(norm(e.user.name), e);
  });

  const employees = [];
  let createdCount = 0;
  for (const persona of PERSONAS) {
    const { employee, created } = await ensurePersonaEmployee(persona, employeesByName);
    if (created) createdCount += 1;
    employees.push({ persona, employee });
  }

  // STEP 3 — generate one month of attendance (working days only).
  const monthIndex = TEST_MONTH - 1;
  const daysInMonth = new Date(TEST_YEAR, TEST_MONTH, 0).getDate();
  const attendanceDocs = [];
  let workingDayCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = businessDayUtc(TEST_YEAR, monthIndex, day);
    if (!isWorkingDay(dayDate)) continue; // skip Fri + Sat (weekend)
    workingDayCount += 1;
    const dateKey = dayDate.toISOString().slice(0, 10);

    for (const { persona, employee } of employees) {
      const doc = buildAttendanceForDay(persona, employee, TEST_YEAR, monthIndex, day, dateKey);
      if (doc) attendanceDocs.push(doc); // null => absent day, no record
    }
  }

  if (attendanceDocs.length) {
    await Attendance.insertMany(attendanceDocs);
  }

  // STEP 4 — generate one monthly sales record per employee (bonus testing).
  // SalesOrder is the ERP "Sales" collection; payroll bonus sums `total` by
  // `salesRep` for the month, so we set those fields. Status uses a valid enum
  // value (bonus aggregation ignores status).
  const salesDocs = employees.map(({ persona, employee }, idx) => {
    const amount = Math.floor(rand(`${persona.name}:sales`) * 100001); // 0..100000
    return {
      orderNumber: `E2E-SO-${TEST_YEAR}${String(TEST_MONTH).padStart(2, '0')}-${String(idx + 1).padStart(3, '0')}`,
      customer: new mongoose.Types.ObjectId(), // placeholder; not needed for bonus calc
      items: [],
      subtotal: amount,
      tax: 0,
      total: amount,
      status: 'delivered',
      orderDate: localTime(TEST_YEAR, monthIndex, 15, 12, 0),
      salesRep: employee._id,
      isDeleted: false
    };
  });

  await SalesOrder.insertMany(salesDocs);

  // STEP 6 — summary.
  console.log('=== SEED COMPLETED ===');
  console.log('Month:', `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')} (working days: ${workingDayCount})`);
  console.log('Employees:', employees.length, `(created: ${createdCount}, reused: ${employees.length - createdCount})`);
  console.log('Attendance inserted:', attendanceDocs.length);
  console.log('Sales inserted:', salesDocs.length);
  console.log('Personas:');
  employees.forEach(({ persona, employee }) => {
    const amount = Math.floor(rand(`${persona.name}:sales`) * 100001);
    console.log(
      `  - ${persona.name} (${persona.type}) | ${employee.employeeId} | salary ${employee.salary} | monthly sales ${amount}`
    );
  });

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('seedE2ETestData failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
