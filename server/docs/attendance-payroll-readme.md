# Attendance, Attendance Report, and Payroll Flow

This document explains how the current HR attendance, attendance report, and payroll processes work in the ERP backend.

## Main Files

- `server/routes/hr.js`
  - Attendance status, check-in, check-out, attendance list, and attendance report endpoints.
- `server/models/Attendance.js`
  - Attendance MongoDB schema.
  - Recalculates `workingHours` and `overtime` before saving records.
- `server/utils/attendanceMetrics.js`
  - Shared calculation logic for working time, lateness, early leave, and overtime.
- `server/services/payrollService.js`
  - Payroll generation, listing, approval, and delete/reset logic.
- `server/models/PayrollRecord.js`
  - Payroll MongoDB schema and unique employee/month constraint.
- `server/utils/payrollPeriodSlots.js`
  - Defines payroll periods as the first 26 calendar days of the month.
- `server/routes/payroll.js`
  - Payroll API routes.
- `server/controllers/payrollController.js`
  - Thin controller layer calling `payrollService`.
- `server/services/financeService.js`
  - Creates pending finance expenses when payroll is approved.
- `server/routes/finance.js`
  - Finance-side payment of approved payroll.

## Attendance Process

### 1. Get Current Attendance Status

Endpoint:

```http
GET /api/hr/attendance/status
```

Flow:

1. Finds the `Employee` record linked to the logged-in `User`.
2. Finds today's `Attendance` record using today's local start/end range.
3. Returns one of:
   - `not_checked_in`
   - `checked_in`
   - `checked_out`

### 2. Check In

Endpoint:

```http
POST /api/hr/attendance/checkin
```

Flow:

1. Gets today's date and sets it to local midnight.
2. Finds the employee linked to the current user.
3. If no employee exists, it auto-creates an `Employee` record with salary `0`.
4. Searches for an existing attendance record for today.
5. If there is already a `checkIn`, returns `400`.
6. Otherwise, creates or updates today's attendance record:

```js
attendance.checkIn = new Date();
await attendance.save();
```

The `Attendance` model recalculates:

- `workingHours`
- `overtime`

### 3. Check Out

Endpoint:

```http
POST /api/hr/attendance/checkout
```

Flow:

1. Finds employee linked to current user.
2. Finds today's attendance record.
3. Requires an existing `checkIn`.
4. Rejects if already checked out.
5. Saves:

```js
attendance.checkOut = new Date();
await attendance.save();
```

### 4. Attendance List

Endpoint:

```http
GET /api/hr/attendance
```

Query parameters:

- `employee`
- `startDate`
- `endDate`

Permissions:

- `admin` and `HR` users can view all records.
- Other users only see their own records.

This endpoint returns only real stored `Attendance` records from MongoDB.

## Attendance Metrics

File:

```text
server/utils/attendanceMetrics.js
```

Default shift:

- Start: `09:00`
- End: `17:00`
- Standard daily hours: `8`

Calculated values:

- `workingMinutes = checkOut - checkIn`
- `workingHoursDecimal = workingMinutes / 60`
- `workingHoursDisplay = HH:mm`
- `lateMinutes = checkIn - expectedStart`
- `earlyMinutes = expectedEnd - checkOut`
- `overtimeMinutes = max(0, workingMinutes - 480)`

Invalid range:

- If `checkOut <= checkIn`, metrics return `isValid: false`.

## Attendance Report Process

Endpoint:

```http
GET /api/hr/attendance/report
```

Required query:

- `dateFrom`
- `dateTo`

Optional query:

- `employeeId`
- `departmentId`

Flow:

1. Parses `dateFrom` and `dateTo`.
2. Loads attendance records in that range.
3. Groups records by employee and date.
4. Loads employees for absence calculations.
5. Uses a fixed working calendar:
   - Days `1..26` are working days.
   - Days `27+` are `OFF_DAY`.
6. For each employee who has at least one real attendance record in the range, it builds one report row per day in the selected range.

Important current behavior:

- Employees with zero attendance records in the selected range are skipped.
- Employees with at least one record still get generated rows for every day in the selected range.
- Missing working days become `Absent`.
- Days after the 26th become `OFF_DAY`.

Example:

- 6 employees with at least one attendance record each
- 30 selected days
- Report rows = `6 * 30 = 180`

This means the report is not a raw attendance-record list. It is a calculated calendar report.

## Payroll Process

Payroll route file:

```text
server/routes/payroll.js
```

Available endpoints:

```http
GET    /api/payroll
DELETE /api/payroll
POST   /api/payroll/generate
PATCH  /api/payroll/approve/:id
GET    /api/payroll/:id
```

All payroll routes require:

- authenticated user
- admin or HR authorization

## Payroll Generation

Endpoint:

```http
POST /api/payroll/generate
```

Expected body:

```json
{
  "periodYear": 2026,
  "periodMonth": 6,
  "employeeId": "optional"
}
```

Flow:

1. Validates `periodYear` and `periodMonth`.
2. Resolves employees:
   - all active employees if no `employeeId`
   - one employee if `employeeId` is provided
3. Rejects duplicate payroll generation for the same employee/month.
4. Gets attendance only for the first 26 days of the payroll month.
5. Builds attendance summary per employee.
6. Gets sales totals for the full calendar month.
7. Creates `PayrollRecord` rows with status `draft`.

## Payroll Period

File:

```text
server/utils/payrollPeriodSlots.js
```

Payroll uses exactly 26 date slots:

- from day 1
- through day 26
- same month

So payroll attendance is calculated only from:

```text
YYYY-MM-01 00:00:00.000 UTC
to
YYYY-MM-26 23:59:59.999 UTC
```

## Payroll Formula

Constants from `payrollService.js`:

```js
BONUS_RATE = 0.02
WORKING_DAYS_PER_MONTH = 26
WORKING_HOURS_PER_DAY = 8
OVERTIME_RATE = 1.5
```

For each employee:

```text
baseSalary = employee.salary
dailySalary = baseSalary / 26
hourlyRate = dailySalary / 8
presentDays = unique attendance dates with status "present" or "late"
approvedLeaveDays = request payload value, default 0
absentDays = max(0, 26 - presentDays - approvedLeaveDays)
absenceDeduction = absentDays * dailySalary
lateDeduction = totalLateMinutes * (hourlyRate / 60)
overtimePay = overtimeMinutes * (hourlyRate / 60) * 1.5
salesBonus = employeeSalesTotalForMonth * 0.02
totalDeductions = absenceDeduction + lateDeduction
netSalary = baseSalary - totalDeductions + salesBonus + overtimePay
```

Saved payroll fields:

- `basePay`
- `bonuses`
- `deductions`
- `netPay`
- `baseSalary`
- `workingDaysOfMonth`
- `dailySalary`
- `hourlyRate`
- `absentDays`
- `absenceDeduction`
- `totalLateMinutes`
- `lateHours`
- `lateDeduction`
- `overtimeHours`
- `overtimePay`
- `totalSales`
- `bonus`
- `totalDeductions`
- `netSalary`
- `status`

## Payroll Approval and Finance Flow

Endpoint:

```http
PATCH /api/payroll/approve/:id
```

Flow:

1. Loads payroll record.
2. Rejects if already approved.
3. Rejects if already paid.
4. Creates a pending `Expense` through `financeService.createPendingPayrollExpense`.
5. Sets payroll status to `approved`.
6. Links the payroll to the created finance expense.

Finance then pays approved payroll records from the finance module. Payment creates the actual finance transaction and marks payroll as paid.

## Reset and Test Scripts

Clear only attendance:

```powershell
cd C:\Users\Asus\Desktop\erp-grad\server
node scripts\clearAttendance.js
```

Reset payroll testing state:

```powershell
cd C:\Users\Asus\Desktop\erp-grad\server
node scripts\resetPayrollTestingState.js
```

Warning:

- `resetPayrollTestingState.js` deletes attendance and payroll.
- It also deletes expenses and expense transactions.
- It also keeps only one admin and six employees, deleting other users/employees.

## Bugs and Risks Seen in Current Code

### 1. Attendance report can still generate many rows from few real records

Even after the fresh-DB fix, if an employee has one real attendance record in the selected range, the report generates one row for every day in the date range for that employee.

Example:

```text
6 employees * 30 days = 180 rows
```

This is intentional calendar-report behavior, but confusing if the user expects only raw records.

Suggested fix:

- Add report mode:
  - `calendar` = current behavior
  - `recordsOnly` = only stored attendance documents

### 2. Attendance report calculates absence for employees before filtering out zero-record employees

The code calculates `absentDaysMap` for every employee first, then skips zero-record employees later. This is harmless but inefficient.

Suggested fix:

- Skip employees with no attendance earlier in the absence calculation if the report should only show employees with records.

### 3. Date handling mixes local time and UTC

Check-in/check-out endpoints use local-day logic:

```js
today.setHours(0, 0, 0, 0)
```

Attendance report parses dates as UTC:

```js
new Date(dateFrom + 'T00:00:00.000Z')
```

Payroll period slots also use UTC.

Risk:

- In time zones like UTC+3, a record can appear under a different day depending on which feature reads it.

Suggested fix:

- Standardize all attendance day keys using one strategy:
  - either UTC midnight everywhere
  - or configured business timezone everywhere

### 4. Employee auto-creation during check-in can create salary `0`

If a user has no employee record, check-in creates an employee automatically with salary `0`.

Risk:

- Payroll for that user becomes zero unless HR later updates the salary.

Suggested fix:

- Do not auto-create employees during attendance.
- Return a clear error: "Employee profile is missing; HR must create it first."

### 5. Payroll counts present days by attendance status only

Payroll counts present days only when status is:

- `present`
- `late`

It does not count based on actual `checkIn/checkOut` if the status is wrong.

Risk:

- Bad or stale status can cause incorrect salary deductions.

Suggested fix:

- Count present day when `checkIn` exists, or when both `checkIn` and `checkOut` exist, depending on business rule.

### 6. Incomplete attendance creates full absence deduction

In payroll, a day with `present` or `late` status is counted as present even if checkout is missing. But in the attendance report, a missing checkout is treated as absent.

Risk:

- Payroll and report can disagree.

Suggested fix:

- Define one rule for incomplete records:
  - absent
  - half-day
  - present but no working hours
  - pending/incomplete

### 7. Hardcoded 26 working days

Both report and payroll assume the first 26 days of each month are working days.

Risk:

- Weekends, holidays, and company calendars are ignored.

Suggested fix:

- Add a work calendar/holiday table.
- Calculate scheduled work days from that calendar.

### 8. Overtime is based on total worked time, not approved overtime

Any work duration above 8 hours becomes overtime.

Risk:

- Payroll pays overtime automatically without manager approval.

Suggested fix:

- Store overtime approval or cap overtime by policy.

### 9. Payroll generation blocks if any employee already has payroll for period

If generating for all employees and one employee already has payroll, the service rejects the whole run.

Suggested fix:

- Add an option:
  - skip existing
  - regenerate selected
  - fail current behavior

### 10. Sales bonus is based on sales order total for full month

Sales bonus uses all sales orders where the employee is `salesRep` in the calendar month, at 2%.

Risk:

- It includes orders regardless of payment status unless filtered elsewhere.

Suggested fix:

- Confirm business rule:
  - bonus on created order
  - confirmed order
  - delivered order
  - paid invoice

## Recommended Test From Scratch

1. Clear attendance:

```powershell
cd C:\Users\Asus\Desktop\erp-grad\server
node scripts\clearAttendance.js
```

2. Restart backend:

```powershell
npm run dev
```

3. Open Attendance Report:

- It should be empty if there are no stored records and the updated route is loaded.

4. Log in as an employee.

5. Check in.

6. Refresh Attendance list:

- One record should appear.

7. Check out.

8. Refresh Attendance Report:

- The employee should appear.
- The selected date range determines how many generated report rows appear.

9. Generate payroll for that month.

10. Review payroll:

- present days
- absent days
- late deduction
- overtime pay
- sales bonus
- net salary

