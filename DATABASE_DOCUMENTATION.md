# ERP System — Database Documentation

This document describes every MongoDB collection (Mongoose model) used in the ERP project, including purpose, fields, relationships, business logic, indexes, validation, and how each collection is used across the system.

**Database engine:** MongoDB (via Mongoose ODM)
**Total collections:** 19

### Conventions used in this document

- **`timestamps: true`** — Mongoose automatically adds `createdAt` and `updatedAt` (`Date`) to the collection. These are listed only once here to avoid repetition; assume every collection that uses this option has both fields.
- **Soft delete** — Several business collections include `isDeleted`, `deletedAt`, and `deletedBy` plus a `pre(/^find/)` hook that automatically hides soft-deleted documents from normal queries (unless `{ includeDeleted: true }` is passed). These collections are: `User`, `Product`, `ProductionOrder`, `Customer`, `SalesOrder`, `PurchaseOrder`, `Complaint`.
- **ObjectId ref** — A field of type `ObjectId` with a `ref` is a foreign-key style reference to another collection, resolvable via Mongoose `.populate()`.

### Modules at a glance

| Module | Collections |
| ------ | ----------- |
| Authentication / System | `User`, `ActivityLog`, `Archive` |
| Human Resources (HR) | `Employee`, `Attendance`, `PayrollRecord` |
| Inventory | `Product`, `InventoryTransaction` |
| Manufacturing | `ProductionOrder` |
| Supply Chain / Purchasing | `Supplier`, `PurchaseOrder`, `PurchaseInvoice` |
| Sales | `SalesOrder`, `Invoice` |
| CRM | `Customer`, `Complaint` |
| Finance | `BankAccount`, `Transaction`, `Expense` |

---

# User

## Purpose

- Stores every login account in the system (admins, managers, and employees).
- Solves authentication (who can log in) and authorization (what they can access) by holding the hashed password, the system **role**, and the **department**.
- Used primarily by the **Authentication** module, but every other module depends on it indirectly for access control and audit trails.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| name | String | Yes | — | Full name (trimmed, max 50 chars). |
| email | String | Yes | — | Login email; unique, lowercased, validated by regex. |
| password | String | Yes | — | Hashed password (min 6 chars before hashing). Hashed with bcrypt on save. |
| role | String (enum) | No | `employee` | One of `admin`, `manager`, `employee`. |
| department | String (enum) | Yes | — | One of `HR`, `Manufacturing`, `SCM`, `CRM`, `Sales`, `Inventory`, `Purchasing`, `Finance`. |
| isActive | Boolean | No | `true` | Whether the account is enabled. |
| lastLogin | Date | No | — | Timestamp of the most recent login. |
| isDeleted | Boolean | No | `false` | Soft-delete flag. |
| deletedAt | Date | No | — | When the user was soft-deleted. |
| deletedBy | ObjectId → User | No | — | Who soft-deleted the user. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-One** with `Employee`: an `Employee` document holds `user` (ObjectId → User). Admins typically have a `User` without an `Employee` profile.
- **Self reference**: `deletedBy` → `User`.
- Referenced as `deletedBy` by all soft-deletable collections and as `user` by `ActivityLog`, `Archive` (`deletedBy`/`restoredBy`).

## Business Logic

- **Created**: during seeding, by an admin creating accounts, or when onboarding an employee (the HR flow creates a `User` then an `Employee`).
- **Updated**: on profile edits, role/department changes, on each successful login (`lastLogin`), and on activation/deactivation.
- **Deleted**: soft-deleted (sets `isDeleted`); admin accounts are intentionally preserved by data-clearing scripts.
- **APIs/services**: `routes/auth.js` (register/login/profile), `routes/hr.js`, `routes/dashboard.js`, `services/reportSender.js`, `services/archiveService.js`.
- **Hooks/triggers**:
  - `pre('save')` hashes the password with bcrypt (cost 12) when modified.
  - `pre(/^find/)` excludes soft-deleted users by default.
  - `comparePassword()` instance method validates a candidate password at login.

## Example Document

```json
{
  "_id": "6a2c1f0b7ed9c93023640001",
  "name": "Sara Hassan",
  "email": "sara.hassan@erp.com",
  "password": "$2a$12$X9...hashed...",
  "role": "manager",
  "department": "Sales",
  "isActive": true,
  "lastLogin": "2026-06-13T08:15:00.000Z",
  "isDeleted": false,
  "createdAt": "2026-05-01T09:00:00.000Z",
  "updatedAt": "2026-06-13T08:15:00.000Z"
}
```

## Indexes

- `email` — **unique** (declared via `unique: true`). Guarantees one account per email and speeds up login lookups.
- `_id` — default primary key.

## Validation Rules

- **Required**: `name`, `email`, `password`, `department`.
- **Enums**: `role`, `department`.
- **Unique**: `email`.
- **min/max**: `name` ≤ 50 chars; `password` ≥ 6 chars.
- **Custom validators**: email regex `^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$`.

## Used By

`routes/auth.js`, `routes/hr.js`, `routes/dashboard.js`, `services/reportSender.js`, `services/archiveService.js`, and the `auth` middleware (token verification). Referenced as `deletedBy` by all soft-deletable collections.

---

# Employee

## Purpose

- Represents the HR profile of a person who works at the company, separate from their login account.
- Solves the need to track employment data (position, department, salary, hire date, manager hierarchy) that does not belong on the authentication record.
- Used by the **HR** module and referenced by Sales, Manufacturing, Purchasing, CRM (as the acting staff member).

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| employeeId | String | Yes | — | Human-readable unique employee code. |
| user | ObjectId → User | Yes | — | The linked login account. |
| position | String | Yes | — | Job title. |
| department | String (enum) | Yes | — | Same enum as `User.department`. |
| hireDate | Date | Yes | — | Employment start date. |
| salary | Number | No | `0` | Monthly base salary. |
| holidays | Number | No | `0` | Approved leave/holiday days balance (min 0). |
| manager | ObjectId → Employee | No | — | Reporting manager (self reference). |
| isActive | Boolean | No | `true` | Whether currently employed. |
| personalInfo.phone | String | No | — | Contact phone. |
| personalInfo.address | String | No | — | Home address. |
| personalInfo.emergencyContact.name | String | No | — | Emergency contact name. |
| personalInfo.emergencyContact.phone | String | No | — | Emergency contact phone. |
| personalInfo.emergencyContact.relationship | String | No | — | Relationship to employee. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-One** with `User` (`user`).
- **Self reference (One-to-Many)**: `manager` → `Employee` (one manager has many reports).
- **One-to-Many**: an `Employee` is referenced by many `Attendance`, `PayrollRecord`, and as `salesRep`/`purchaser`/`assignedTo`/`performedBy`/`assignedEmployees` across Sales, Purchasing, CRM, Manufacturing, and Inventory.
- **Embedded document**: `personalInfo` (with nested `emergencyContact`).

## Business Logic

- **Created**: in the HR onboarding flow (after the `User` account is created).
- **Updated**: on profile edits, salary changes, leave balance adjustments, department transfers.
- **Deleted**: deactivated (`isActive: false`) or removed via HR; headcount KPIs count `isActive: true` employees.
- **APIs/services**: `routes/hr.js`, `services/payrollService.js`, `routes/dashboard.js`, plus reads in Sales/Manufacturing/Purchasing/CRM.

## Example Document

```json
{
  "_id": "6a2c2a117ed9c93023641001",
  "employeeId": "EMP-005",
  "user": "6a2c1f0b7ed9c93023640001",
  "position": "Sales Representative",
  "department": "Sales",
  "hireDate": "2025-09-15T00:00:00.000Z",
  "salary": 9000,
  "holidays": 4,
  "manager": "6a2c2a117ed9c93023641000",
  "isActive": true,
  "personalInfo": {
    "phone": "+20 100 000 0000",
    "address": "12 Nile St, Cairo",
    "emergencyContact": { "name": "Mona", "phone": "+20 111 222 3333", "relationship": "Spouse" }
  },
  "createdAt": "2025-09-15T09:00:00.000Z",
  "updatedAt": "2026-06-01T09:00:00.000Z"
}
```

## Indexes

- `employeeId` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `employeeId`, `user`, `position`, `department`, `hireDate`.
- **Enums**: `department`.
- **min/max**: `holidays` ≥ 0.
- **Unique**: `employeeId`.

## Used By

`routes/hr.js`, `services/payrollService.js`, `routes/dashboard.js`, `routes/sales.js`, `routes/manufacturing.js`, `routes/purchasing.js`, `routes/crm.js`, `services/reportService.js`.

---

# Attendance

## Purpose

- Records daily check-in / check-out events per employee.
- Solves time-and-attendance tracking that feeds payroll (present days, late minutes, overtime) and HR reporting.
- Used by the **HR** module and consumed by payroll generation.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| employee | ObjectId → Employee | Yes | — | The employee the record belongs to. |
| date | Date | Yes | — | The calendar day of the record. |
| checkIn | Date | No | — | Check-in timestamp. |
| checkOut | Date | No | — | Check-out timestamp. |
| workingHours | Number | No | `0` | Derived snapshot of hours worked (computed from check-in/out). |
| overtime | Number | No | `0` | Derived snapshot of overtime hours. |
| status | String (enum) | No | `present` | One of `present`, `absent`, `late`, `half-day`. |
| notes | String | No | — | Free-text note (e.g., correction reason). |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Employee` (`employee`): one employee has many attendance records.
- Indirectly drives `PayrollRecord` (payroll reads the month's attendance for an employee).

## Business Logic

- **Created**: when an employee checks in (and on bulk seeding via `insertMany`).
- **Updated**: on check-out, and via HR manual corrections (`PATCH /attendance/:id`), which also flags affected payrolls as `requiresRegeneration`.
- **Deleted**: rarely; corrections are preferred over deletion.
- **APIs/services**: `routes/hr.js` (check-in/out, status, report, corrections), `services/payrollService.js` (reads), `services/reportService.js`, `routes/dashboard.js`.
- **Hooks/triggers**:
  - `pre('save')` and `pre('insertMany')` recompute `workingHours` and `overtime` from `checkIn`/`checkOut` using `utils/attendanceMetrics`. Stored values are snapshots only — payroll logic always re-derives from the raw timestamps.

## Example Document

```json
{
  "_id": "6a2c3b227ed9c93023642001",
  "employee": "6a2c2a117ed9c93023641001",
  "date": "2026-05-04T00:00:00.000Z",
  "checkIn": "2026-05-04T06:05:00.000Z",
  "checkOut": "2026-05-04T14:10:00.000Z",
  "workingHours": 8.08,
  "overtime": 0.08,
  "status": "late",
  "notes": "",
  "createdAt": "2026-05-04T06:05:00.000Z",
  "updatedAt": "2026-05-04T14:10:00.000Z"
}
```

## Indexes

- `_id` — default primary key. (No additional schema-level indexes; queries filter by `employee` + `date` range.)

## Validation Rules

- **Required**: `employee`, `date`.
- **Enums**: `status`.

## Used By

`routes/hr.js`, `services/payrollService.js`, `services/reportService.js`, `routes/dashboard.js`.

---

# PayrollRecord

## Purpose

- Stores the computed monthly payroll for an employee (one record per employee per month).
- Solves salary calculation: combines base pay, attendance-driven deductions, late penalties, overtime, sales bonuses, and tracks approval/payment status and finance links.
- Used by the **HR** (generation/approval) and **Finance** (payment) modules.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| employee | ObjectId → Employee | Yes | — | The employee being paid. |
| periodYear | Number | Yes | — | Payroll year (2000–2100). |
| periodMonth | Number | Yes | — | Payroll month (1–12). |
| basePay | Number | Yes | — | Base pay for the period (min 0). |
| bonuses | Number | No | `0` | Generic bonuses. |
| deductions | Number | No | `0` | Generic deductions. |
| netPay | Number | Yes | — | Final net amount (min 0). |
| baseSalary | Number | No | `0` | Employee monthly salary snapshot. |
| workingDaysOfMonth | Number | No | `0` | Number of working days in the month. |
| dailySalary | Number | No | `0` | Salary per working day. |
| hourlyRate | Number | No | `0` | Salary per working hour. |
| presentDays | Number | No | `0` | Days actually present. |
| incompleteDays | Number | No | `0` | Days with missing check-in/out. |
| approvedLeaveDays | Number | No | `0` | Approved leave days in the period. |
| requiresAttendanceReview | Boolean | No | `false` | Set when incomplete attendance blocks a clean calculation. |
| requiresRegeneration | Boolean | No | `false` | Set when attendance changed after generation. |
| absentDays | Number | No | `0` | Days absent. |
| absenceDeduction | Number | No | `0` | Money deducted for absences. |
| totalLateMinutes | Number | No | `0` | Sum of late minutes. |
| lateHours | Number | No | `0` | Late time in hours. |
| lateDeduction | Number | No | `0` | Money deducted for lateness. |
| overtimeHours | Number | No | `0` | Overtime hours worked. |
| overtimePay | Number | No | `0` | Money added for overtime. |
| totalSales | Number | No | `0` | Sales attributed to the employee (for bonus). |
| bonus | Number | No | `0` | Sales-based bonus amount. |
| netSalary | Number | No | `0` | Alternate net figure used by the calculator. |
| totalDeductions | Number | No | `0` | Sum of all deductions. |
| status | String (enum) | No | `draft` | One of `draft`, `needs_review`, `approved`, `paid`. |
| paymentDate | Date | No | `null` | When it was paid. |
| notes | String | No | — | Notes (max 2000 chars). |
| financeExpense | ObjectId → Expense | No | `null` | Expense created when paid. |
| financeTransaction | ObjectId → Transaction | No | `null` | Bank transaction created when paid. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Employee` (`employee`).
- **One-to-One** with `Expense` (`financeExpense`) and `Transaction` (`financeTransaction`) once paid.
- Reads from `Attendance` and `SalesOrder` (for bonus) during generation.

## Business Logic

- **Created**: when payroll is generated for a month (`services/payrollService.js`). Status becomes `needs_review` if attendance is incomplete, otherwise `draft`.
- **Updated**: on recalculation (`PATCH /recalculate/:id`), approval (`approved`), and payment (`paid`, links `financeExpense`/`financeTransaction`).
- **Deleted**: generally retained as a financial record.
- **APIs/services**: `services/payrollService.js`, `services/salesPayrollBonusService.js`, `routes/hr.js`, `routes/finance.js`, `services/payrollFinanceService.js`.
- **Triggers**:
  - Approval is blocked if `requiresRegeneration` or live unresolved incomplete attendance is found.
  - Attendance corrections set `requiresRegeneration = true`.

## Example Document

```json
{
  "_id": "6a2c4c337ed9c93023643001",
  "employee": "6a2c2a117ed9c93023641001",
  "periodYear": 2026,
  "periodMonth": 5,
  "basePay": 9000,
  "baseSalary": 9000,
  "workingDaysOfMonth": 22,
  "dailySalary": 409.09,
  "presentDays": 21,
  "absentDays": 1,
  "absenceDeduction": 409.09,
  "totalLateMinutes": 35,
  "lateDeduction": 50,
  "overtimeHours": 3,
  "overtimePay": 170,
  "totalSales": 12000,
  "bonus": 240,
  "totalDeductions": 459.09,
  "netPay": 8950.91,
  "status": "paid",
  "paymentDate": "2026-06-01T10:00:00.000Z",
  "financeExpense": "6a2c5d447ed9c93023644001",
  "financeTransaction": "6a2c5d447ed9c93023644010",
  "createdAt": "2026-05-31T23:00:00.000Z",
  "updatedAt": "2026-06-01T10:00:00.000Z"
}
```

## Indexes

- `{ employee: 1, periodYear: 1, periodMonth: 1 }` — **unique compound**. Guarantees exactly one payroll per employee per month and prevents duplicate runs.
- `_id` — default primary key.

## Validation Rules

- **Required**: `employee`, `periodYear`, `periodMonth`, `basePay`, `netPay`.
- **Enums**: `status`.
- **min/max**: `periodYear` 2000–2100, `periodMonth` 1–12, all money fields ≥ 0, `notes` ≤ 2000 chars.
- **Unique**: compound `employee + periodYear + periodMonth`.

## Used By

`services/payrollService.js`, `services/salesPayrollBonusService.js`, `routes/hr.js`, `routes/finance.js`, `services/payrollFinanceService.js`.

---

# Product

## Purpose

- Master catalog of items: both **raw materials** and **final products**.
- Solves inventory tracking (stock levels, costs, reorder thresholds) and manufacturing (bill of materials for final products).
- Used by the **Inventory**, **Manufacturing**, **Sales**, **Purchasing**, and **SCM** modules.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| name | String | Yes | — | Product name. |
| sku | String | Yes | — | Stock-keeping unit; unique. |
| description | String | No | — | Optional description. |
| category | String (enum) | Yes | — | `raw-material` or `final-product`. |
| unit | String | Yes | — | Unit of measure (e.g., kg, piece). |
| currentStock | Number | No | `0` | On-hand quantity (min 0). |
| minStockLevel | Number | No | `0` | Reorder threshold. |
| maxStockLevel | Number | No | `1000` | Target maximum / reorder-up-to level. |
| unitCost | Number | Yes | — | Cost per unit (for final products, derived from BOM). |
| sellingPrice | Number | No | — | Sales price (final products). |
| supplier | ObjectId → Supplier | No | — | Default supplier (raw materials). |
| isActive | Boolean | No | `true` | Whether the product is active. |
| requiredMaterials | Array | No | `[]` | Bill of materials (final-product only). |
| requiredMaterials[].product | ObjectId → Product | — | — | A raw material used. |
| requiredMaterials[].quantity | Number | Yes | — | Quantity of that material per unit. |
| isDeleted | Boolean | No | `false` | Soft-delete flag. |
| deletedAt | Date | No | — | Soft-delete time. |
| deletedBy | ObjectId → User | No | — | Who soft-deleted it. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Supplier` (`supplier`).
- **Self reference (Many-to-Many via BOM)**: a final product's `requiredMaterials[].product` references other `Product` documents (raw materials).
- Referenced by `InventoryTransaction`, `SalesOrder.items`, `PurchaseOrder.items`, `ProductionOrder` (`product` + `materials`), `Invoice`/`PurchaseInvoice` items.

## Business Logic

- **Created**: when adding catalog items in Inventory. Final-product `unitCost` is computed from the BOM (sum of material quantity × unit cost).
- **Updated**: stock changes on every purchase receipt, sale, and production; price/BOM edits; reorder levels.
- **Deleted**: soft-deleted (hidden via `pre(/^find/)` hook).
- **APIs/services**: `routes/inventory.js`, `routes/manufacturing.js`, `routes/sales.js`, `routes/purchasing.js`, `routes/scm.js`, `services/schedulerService.js` (auto-reorder), `routes/dashboard.js`.
- **Triggers**: low-stock products drive automatic purchase order generation (see `Supplier`/`PurchaseOrder`).

## Example Document

```json
{
  "_id": "6a2c6e557ed9c93023645001",
  "name": "Cola 330ml",
  "sku": "FP-COLA-330",
  "category": "final-product",
  "unit": "can",
  "currentStock": 120,
  "minStockLevel": 20,
  "maxStockLevel": 500,
  "unitCost": 3.2,
  "sellingPrice": 7.5,
  "isActive": true,
  "requiredMaterials": [
    { "product": "6a2c6e557ed9c93023645010", "quantity": 1 },
    { "product": "6a2c6e557ed9c93023645011", "quantity": 0.2 }
  ],
  "isDeleted": false,
  "createdAt": "2026-05-02T09:00:00.000Z",
  "updatedAt": "2026-06-13T01:50:00.000Z"
}
```

## Indexes

- `sku` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `name`, `sku`, `category`, `unit`, `unitCost`, `requiredMaterials[].quantity` (when a material row exists).
- **Enums**: `category`.
- **min/max**: `currentStock` ≥ 0.
- **Unique**: `sku`.

## Used By

`routes/inventory.js`, `routes/manufacturing.js`, `routes/sales.js`, `routes/purchasing.js`, `routes/scm.js`, `routes/dashboard.js`, `services/schedulerService.js`, `services/reportService.js`, `services/archiveService.js`.

---

# InventoryTransaction

## Purpose

- An immutable ledger of every stock movement (in / out / adjustment).
- Solves stock auditability and valuation: every change to `Product.currentStock` is backed by a transaction with quantity, cost, and a reference to its cause.
- Used by the **Inventory** module and read by reporting/dashboards.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| product | ObjectId → Product | Yes | — | The product moved. |
| type | String (enum) | Yes | — | `in`, `out`, or `adjustment`. |
| quantity | Number | Yes | — | Quantity moved. |
| unitCost | Number | Yes | — | Cost per unit at the time. |
| totalCost | Number | Yes | — | quantity × unitCost. |
| reference | String | Yes | — | Cause label: `purchase`, `sale`, `production`, `adjustment`. |
| referenceId | ObjectId | No | — | The source document id (PO, SO, production order, etc.). |
| notes | String | No | — | Optional note. |
| performedBy | ObjectId → Employee | No | — | Who performed the movement. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Product` (`product`).
- **Many-to-One** with `Employee` (`performedBy`).
- **Polymorphic reference**: `referenceId` points to a `PurchaseOrder`, `SalesOrder`, or `ProductionOrder` depending on `reference`.

## Business Logic

- **Created**: whenever stock changes — receiving a PO (`in`), fulfilling a sale (`out`), consuming materials / producing goods (`production`), or manual adjustments.
- **Updated/Deleted**: never (append-only ledger by design).
- **APIs/services**: `routes/inventory.js`, `routes/purchasing.js`, `routes/sales.js`, `routes/manufacturing.js`, `services/reportService.js`, `routes/dashboard.js`.

## Example Document

```json
{
  "_id": "6a2c7f667ed9c93023646001",
  "product": "6a2c6e557ed9c93023645010",
  "type": "in",
  "quantity": 100,
  "unitCost": 11,
  "totalCost": 1100,
  "reference": "purchase",
  "referenceId": "6a2c89fc7ed9c930236489b5",
  "performedBy": "6a2c2a117ed9c93023641002",
  "createdAt": "2026-06-13T01:50:07.000Z",
  "updatedAt": "2026-06-13T01:50:07.000Z"
}
```

## Indexes

- `_id` — default primary key. (Queries typically filter by `product` and date range.)

## Validation Rules

- **Required**: `product`, `type`, `quantity`, `unitCost`, `totalCost`, `reference`.
- **Enums**: `type`.

## Used By

`routes/inventory.js`, `routes/purchasing.js`, `routes/sales.js`, `routes/manufacturing.js`, `routes/dashboard.js`, `services/reportService.js`.

---

# ProductionOrder

## Purpose

- Represents a manufacturing job that turns raw materials into a final product.
- Solves production planning and costing: tracks quantity, assigned staff, consumed materials, and the manufacturing (labor/overhead) cost.
- Used by the **Manufacturing** module; integrates with Inventory (stock) and Finance (cost expense).

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| orderNumber | String | Yes | — | Unique production order number. |
| product | ObjectId → Product | Yes | — | The final product being produced. |
| quantity | Number | Yes | — | Units to produce. |
| status | String (enum) | No | `pending` | `pending`, `in-progress`, `completed`, `cancelled`. |
| startDate | Date | No | — | Production start. |
| endDate | Date | No | — | Production end. |
| assignedEmployees | Array | No | `[]` | Workers assigned to the job. |
| assignedEmployees[].employee | ObjectId → Employee | — | — | Assigned worker. |
| assignedEmployees[].role | String | — | — | Their role on the job. |
| assignedEmployees[].startTime / endTime | Date | — | — | Shift times. |
| materials | Array | No | `[]` | Raw materials consumed. |
| materials[].product | ObjectId → Product | — | — | Material used. |
| materials[].quantity | Number | — | — | Quantity used. |
| materials[].unitCost | Number | — | — | Cost per unit. |
| salesOrder | ObjectId → SalesOrder | No | — | The sales order that triggered production (if any). |
| notes | String | No | — | Notes. |
| manufacturingCost | Number | No | `0` | Labor/overhead cost recorded as a Finance expense on completion. |
| isDeleted | Boolean | No | `false` | Soft-delete flag. |
| deletedAt | Date | No | — | Soft-delete time. |
| deletedBy | ObjectId → User | No | — | Who soft-deleted it. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Product` (`product`) and `SalesOrder` (`salesOrder`).
- **One-to-Many (embedded)**: `assignedEmployees[]` (→ Employee) and `materials[]` (→ Product).
- **One-to-One** with an `Expense` (`referenceProductionId`) when completed.

## Business Logic

- **Created**: manually in Manufacturing, or automatically when a sales order requires production.
- **Updated**: status transitions (`pending` → `in-progress` → `completed`); assigning staff; consuming materials.
- **On completion**: materials are deducted from stock (InventoryTransaction), finished goods are added, and `manufacturingCost` is recorded as a Finance `Expense` (`source: 'Manufacturing'`).
- **Deleted**: soft-deleted.
- **APIs/services**: `routes/manufacturing.js`, `services/manufacturingFinanceService.js`, `routes/sales.js`, `routes/inventory.js`.

## Example Document

```json
{
  "_id": "6a2c90777ed9c93023647001",
  "orderNumber": "PRD0007",
  "product": "6a2c6e557ed9c93023645001",
  "quantity": 5,
  "status": "completed",
  "startDate": "2026-06-13T08:00:00.000Z",
  "endDate": "2026-06-13T12:00:00.000Z",
  "materials": [
    { "product": "6a2c6e557ed9c93023645010", "quantity": 5, "unitCost": 11 }
  ],
  "manufacturingCost": 100,
  "isDeleted": false,
  "createdAt": "2026-06-13T07:30:00.000Z",
  "updatedAt": "2026-06-13T12:00:00.000Z"
}
```

## Indexes

- `orderNumber` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `orderNumber`, `product`, `quantity`.
- **Enums**: `status`.
- **Unique**: `orderNumber`.

## Used By

`routes/manufacturing.js`, `services/manufacturingFinanceService.js`, `routes/sales.js`, `routes/inventory.js`, `routes/dashboard.js`, `services/reportService.js`, `services/archiveService.js`.

---

# Supplier

## Purpose

- Master record of vendors who supply raw materials.
- Solves vendor management: contact details, payment terms, rating, and which products they provide.
- Used by the **SCM** and **Purchasing** modules.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| name | String | Yes | — | Supplier name. |
| contactPerson | String | Yes | — | Primary contact. |
| email | String | Yes | — | Contact email. |
| phone | String | Yes | — | Contact phone. |
| address.street/city/state/zipCode/country | String | No | — | Embedded address. |
| rating | Number | No | `3` | Supplier rating 1–5. |
| paymentTerms | String | No | `Net 30` | Default payment terms. |
| isActive | Boolean | No | `true` | Whether active. |
| products | Array<ObjectId → Product> | No | `[]` | Products this supplier provides. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-Many** with `Product` (`products[]`, and `Product.supplier` points back).
- **One-to-Many** with `PurchaseOrder` and `PurchaseInvoice` (`supplier`).
- **Embedded document**: `address`.

## Business Logic

- **Created/Updated**: in SCM supplier management.
- **Deleted**: deactivated (`isActive: false`).
- **APIs/services**: `routes/scm.js`, `routes/purchasing.js`, `routes/dashboard.js`, `services/reportService.js`.
- **Triggers**: a product must have a supplier for auto-purchase to create a PO.

## Example Document

```json
{
  "_id": "6a2c8aff7ed9c93023648001",
  "name": "artficial-taste supplier",
  "contactPerson": "Ahmed Ali",
  "email": "sales@taste-supplier.com",
  "phone": "+20 102 345 6789",
  "address": { "city": "Giza", "country": "Egypt" },
  "rating": 4,
  "paymentTerms": "Net 30",
  "isActive": true,
  "products": ["6a2c6e557ed9c93023645011"],
  "createdAt": "2026-05-03T09:00:00.000Z",
  "updatedAt": "2026-05-03T09:00:00.000Z"
}
```

## Indexes

- `_id` — default primary key.

## Validation Rules

- **Required**: `name`, `contactPerson`, `email`, `phone`.
- **min/max**: `rating` 1–5.

## Used By

`routes/scm.js`, `routes/purchasing.js`, `routes/dashboard.js`, `services/reportService.js`.

---

# PurchaseOrder

## Purpose

- Represents an order placed with a supplier to buy raw materials.
- Solves procurement: tracks items, totals, status lifecycle, and whether it was auto-generated from low stock.
- Used by the **Purchasing** module; integrates with Inventory (on receipt) and Finance (invoice/payment).

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| orderNumber | String | Yes | — | Unique PO number. |
| supplier | ObjectId → Supplier | Yes | — | The vendor. |
| items | Array | Yes | — | Ordered line items. |
| items[].product | ObjectId → Product | Yes | — | Ordered product. |
| items[].quantity | Number | Yes | — | Quantity ordered. |
| items[].unitPrice | Number | Yes | — | Price per unit. |
| items[].total | Number | Yes | — | Line total. |
| subtotal | Number | Yes | — | Sum of line totals. |
| tax | Number | No | `0` | Tax amount. |
| total | Number | Yes | — | Grand total. |
| status | String (enum) | No | `pending` | `pending`, `ordered`, `received`, `cancelled`. |
| orderDate | Date | No | `Date.now` | When created. |
| expectedDelivery | Date | No | — | Expected delivery date. |
| receivedDate | Date | No | — | When received. |
| purchaser | ObjectId → Employee | No | — | Who placed the order. |
| notes | String | No | — | Notes. |
| autoGenerated | Boolean | No | `false` | True if created by the low-stock auto-purchase. |
| source | String (enum) | No | `manual` | `manual` or `inventory`. |
| isDeleted/deletedAt/deletedBy | — | No | — | Soft delete. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Supplier` (`supplier`) and `Employee` (`purchaser`).
- **One-to-Many (embedded)**: `items[]` → `Product`.
- **One-to-One** with `PurchaseInvoice` (`PurchaseInvoice.purchaseOrder`, unique).
- Referenced by `InventoryTransaction.referenceId` on receipt.

## Business Logic

- **Created**: manually, or automatically by `services/schedulerService.js` / `POST /auto-generate` when raw materials hit reorder levels. Auto-purchase skips a product if it already has an **open** PO (`pending` or `ordered`) to avoid duplicates.
- **Accepted**: `PUT /orders/:id/order` moves `pending` → `ordered` and **creates the PurchaseInvoice** at this point (invoices do not appear in Finance while a PO is still pending).
- **Received**: `PUT /orders/:id/receive` moves `ordered` → `received`, increases stock, and writes an InventoryTransaction.
- **Deleted**: soft-deleted / archived.
- **APIs/services**: `routes/purchasing.js`, `services/schedulerService.js`, `routes/inventory.js`, `routes/dashboard.js`, `services/reportService.js`.

## Example Document

```json
{
  "_id": "6a2c89fc7ed9c930236489b5",
  "orderNumber": "PO0002",
  "supplier": "6a2c8aff7ed9c93023648001",
  "items": [
    { "product": "6a2c6e557ed9c93023645011", "quantity": 100, "unitPrice": 10, "total": 1000 }
  ],
  "subtotal": 1000,
  "tax": 100,
  "total": 1100,
  "status": "received",
  "orderDate": "2026-06-12T22:36:44.724Z",
  "receivedDate": "2026-06-13T01:50:07.000Z",
  "autoGenerated": true,
  "source": "inventory",
  "isDeleted": false
}
```

## Indexes

- `orderNumber` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `orderNumber`, `supplier`, `items[]` fields, `subtotal`, `total`.
- **Enums**: `status`, `source`.
- **Unique**: `orderNumber`.

## Used By

`routes/purchasing.js`, `services/schedulerService.js`, `routes/inventory.js`, `routes/dashboard.js`, `services/reportService.js`, `services/archiveService.js`.

---

# PurchaseInvoice

## Purpose

- The payable invoice generated for a purchase order.
- Solves accounts-payable tracking: amount owed to a supplier and its payment status, feeding Finance.
- Used by the **Purchasing** and **Finance** modules.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| invoiceNumber | String | Yes | — | Unique invoice number (e.g., PINV0001). |
| purchaseOrder | ObjectId → PurchaseOrder | Yes | — | Source PO; **unique** (one invoice per PO). |
| supplier | ObjectId → Supplier | Yes | — | The vendor. |
| items | Array | — | — | Snapshot of invoiced line items. |
| items[].product | ObjectId → Product | Yes | — | Product. |
| items[].productName | String | Yes | — | Product name snapshot. |
| items[].quantity / unitPrice / total | Number | Yes | — | Line details. |
| subtotal | Number | Yes | — | Sum of lines. |
| tax | Number | No | `0` | Tax. |
| total | Number | Yes | — | Grand total. |
| invoiceDate | Date | No | `Date.now` | Issue date. |
| dueDate | Date | No | — | Payment due date. |
| status | String (enum) | No | `draft` | `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled`. |
| paymentTerms | String | No | `Net 30` | Terms. |
| notes | String | No | — | Notes. |
| relatedTransaction | ObjectId → Transaction | No | — | Payment transaction once paid. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-One** with `PurchaseOrder` (`purchaseOrder`, unique).
- **Many-to-One** with `Supplier`.
- **One-to-One** with `Transaction` (`relatedTransaction`) once paid.
- **Embedded**: `items[]`.

## Business Logic

- **Created**: when a PO is **accepted** (`PUT /orders/:id/order`), with status `sent`. Creation is idempotent (checks existing invoice per PO).
- **Updated**: set to `paid` when paid via Finance, linking `relatedTransaction`.
- **Deleted**: rarely; retained for accounting.
- **APIs/services**: `routes/purchasing.js`, `services/schedulerService.js` (helper), `routes/finance.js` (payment).

## Example Document

```json
{
  "_id": "6a2c8e007ed9c9302364a001",
  "invoiceNumber": "PINV0002",
  "purchaseOrder": "6a2c89fc7ed9c930236489b5",
  "supplier": "6a2c8aff7ed9c93023648001",
  "items": [
    { "product": "6a2c6e557ed9c93023645011", "productName": "artficial-taste", "quantity": 100, "unitPrice": 10, "total": 1000 }
  ],
  "subtotal": 1000,
  "tax": 100,
  "total": 1100,
  "status": "paid",
  "dueDate": "2026-07-12T00:00:00.000Z",
  "relatedTransaction": "6a2c8f007ed9c9302364b001"
}
```

## Indexes

- `invoiceNumber` — **unique**.
- `purchaseOrder` — **unique** (one invoice per PO).
- `_id` — default primary key.

## Validation Rules

- **Required**: `invoiceNumber`, `purchaseOrder`, `supplier`, item fields, `subtotal`, `total`.
- **Enums**: `status`.
- **Unique**: `invoiceNumber`, `purchaseOrder`.

## Used By

`routes/purchasing.js`, `services/schedulerService.js`, `routes/finance.js`.

---

# SalesOrder

## Purpose

- Represents a customer order for final products.
- Solves order management: items, totals, fulfillment status, and links to production and invoicing.
- Used by the **Sales** module; integrates with Manufacturing, Inventory, CRM, and Finance.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| orderNumber | String | Yes | — | Unique sales order number. |
| customer | ObjectId → Customer | Yes | — | The buyer. |
| items | Array | — | — | Ordered line items. |
| items[].product | ObjectId → Product | Yes | — | Product. |
| items[].quantity / unitPrice / total | Number | Yes | — | Line details. |
| subtotal | Number | Yes | — | Sum of lines. |
| tax | Number | No | `0` | Tax. |
| total | Number | Yes | — | Grand total. |
| status | String (enum) | No | `pending` | `pending`, `confirmed`, `in-production`, `delivered`, `cancelled`. |
| orderDate | Date | No | `Date.now` | When created. |
| deliveryDate | Date | No | — | Delivery date. |
| salesRep | ObjectId → Employee | No | — | Sales representative. |
| productionOrder | ObjectId → ProductionOrder | No | — | Linked production job (if produced to order). |
| notes | String | No | — | Notes. |
| isDeleted/deletedAt/deletedBy | — | No | — | Soft delete. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Customer` (`customer`) and `Employee` (`salesRep`).
- **One-to-One** with `ProductionOrder` (`productionOrder`) and `Invoice` (`Invoice.salesOrder`, unique).
- **One-to-Many (embedded)**: `items[]` → `Product`.
- Referenced by `Complaint.relatedOrder` and `InventoryTransaction.referenceId`.

## Business Logic

- **Created**: when a sales order is placed.
- **Confirmed**: `pending` → `confirmed`; may auto-create a `ProductionOrder` if stock is insufficient (confirmation blocked until production is handled).
- **Delivered**: `confirmed` → `delivered` (the workflow was simplified to a single `delivered` status, replacing the old `shipped`/`delivered` split). Revenue counts `confirmed` + `delivered`.
- **Deleted**: soft-deleted / archived.
- **APIs/services**: `routes/sales.js`, `routes/crm.js`, `routes/inventory.js`, `services/payrollService.js` (sales bonus), `services/reportService.js`, `routes/dashboard.js`.

## Example Document

```json
{
  "_id": "6a2c8e8c7ed9c93023648df4",
  "orderNumber": "SO0001",
  "customer": "6a2c8d007ed9c9302364c001",
  "items": [
    { "product": "6a2c6e557ed9c93023645001", "quantity": 30, "unitPrice": 7.5, "total": 225 }
  ],
  "subtotal": 225,
  "tax": 50,
  "total": 275,
  "status": "delivered",
  "orderDate": "2026-06-12T23:00:00.000Z",
  "salesRep": "6a2c2a117ed9c93023641001",
  "isDeleted": false
}
```

## Indexes

- `orderNumber` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `orderNumber`, `customer`, item fields, `subtotal`, `total`.
- **Enums**: `status`.
- **Unique**: `orderNumber`.

## Used By

`routes/sales.js`, `routes/crm.js`, `routes/inventory.js`, `routes/dashboard.js`, `services/payrollService.js`, `services/reportService.js`, `services/archiveService.js`.

---

# Invoice

## Purpose

- The receivable invoice generated for a sales order.
- Solves accounts-receivable tracking: amount owed by a customer and its payment status, feeding Finance income.
- Used by the **Sales** and **Finance** modules.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| invoiceNumber | String | Yes | — | Unique invoice number (e.g., INV0001). |
| salesOrder | ObjectId → SalesOrder | Yes | — | Source SO; **unique**. |
| customer | ObjectId → Customer | Yes | — | The buyer. |
| items | Array | — | — | Snapshot of invoiced line items. |
| items[].product | ObjectId → Product | Yes | — | Product. |
| items[].productName | String | Yes | — | Product name snapshot. |
| items[].quantity / unitPrice / total | Number | Yes | — | Line details. |
| subtotal | Number | Yes | — | Sum of lines. |
| tax | Number | No | `0` | Tax. |
| total | Number | Yes | — | Grand total. |
| invoiceDate | Date | No | `Date.now` | Issue date. |
| dueDate | Date | No | — | Payment due date. |
| status | String (enum) | No | `draft` | `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled`. |
| paymentTerms | String | No | `Net 30` | Terms. |
| notes | String | No | — | Notes. |
| relatedTransaction | ObjectId → Transaction | No | — | Payment transaction once paid. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-One** with `SalesOrder` (`salesOrder`, unique).
- **Many-to-One** with `Customer`.
- **One-to-One** with `Transaction` (`relatedTransaction`) once paid.
- **Embedded**: `items[]`.

## Business Logic

- **Created**: from a sales order in the sales/finance flow.
- **Updated**: set to `paid` when paid via Finance (creates an "in" `Transaction`, increases the bank balance).
- **Deleted**: retained for accounting.
- **APIs/services**: `routes/sales.js`, `routes/finance.js`.

## Example Document

```json
{
  "_id": "6a2c8f8c7ed9c9302364d001",
  "invoiceNumber": "INV0001",
  "salesOrder": "6a2c8e8c7ed9c93023648df4",
  "customer": "6a2c8d007ed9c9302364c001",
  "items": [
    { "product": "6a2c6e557ed9c93023645001", "productName": "Cola 330ml", "quantity": 30, "unitPrice": 7.5, "total": 225 }
  ],
  "subtotal": 225,
  "tax": 50,
  "total": 275,
  "status": "paid",
  "relatedTransaction": "6a2c8f907ed9c9302364d010"
}
```

## Indexes

- `invoiceNumber` — **unique**.
- `salesOrder` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `invoiceNumber`, `salesOrder`, `customer`, item fields, `subtotal`, `total`.
- **Enums**: `status`.
- **Unique**: `invoiceNumber`, `salesOrder`.

## Used By

`routes/sales.js`, `routes/finance.js`.

---

# Customer

## Purpose

- Master record of buyers (individuals or businesses).
- Solves CRM: contact info, credit limit, payment terms, and customer history.
- Used by the **CRM** and **Sales** modules.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| name | String | Yes | — | Customer name. |
| email | String | Yes | — | Email; unique. |
| phone | String | Yes | — | Phone. |
| company | String | No | — | Company name (for business customers). |
| address.street/city/state/zipCode/country | String | No | — | Embedded address. |
| customerType | String (enum) | No | `individual` | `individual` or `business`. |
| creditLimit | Number | No | `0` | Allowed credit. |
| paymentTerms | String | No | `Net 30` | Terms. |
| isActive | Boolean | No | `true` | Whether active. |
| notes | String | No | — | Notes. |
| isDeleted/deletedAt/deletedBy | — | No | — | Soft delete. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-Many** with `SalesOrder`, `Invoice`, and `Complaint` (`customer`).
- **Embedded**: `address`.

## Business Logic

- **Created/Updated**: in CRM customer management.
- **Deleted**: soft-deleted / archived.
- **APIs/services**: `routes/crm.js`, `routes/sales.js`, `routes/dashboard.js`, `services/reportService.js`.

## Example Document

```json
{
  "_id": "6a2c8d007ed9c9302364c001",
  "name": "Nile Beverages Co.",
  "email": "orders@nilebev.com",
  "phone": "+20 122 333 4444",
  "company": "Nile Beverages Co.",
  "customerType": "business",
  "creditLimit": 50000,
  "paymentTerms": "Net 30",
  "isActive": true,
  "isDeleted": false
}
```

## Indexes

- `email` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `name`, `email`, `phone`.
- **Enums**: `customerType`.
- **Unique**: `email`.

## Used By

`routes/crm.js`, `routes/sales.js`, `routes/dashboard.js`, `services/reportService.js`, `services/archiveService.js`.

---

# Complaint

## Purpose

- Tracks customer complaints / support tickets.
- Solves after-sales service: categorization, priority, assignment, resolution, and audit notes.
- Used by the **CRM** module.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| complaintNumber | String | Yes | — | Unique complaint number. |
| customer | ObjectId → Customer | Yes | — | The complainant. |
| subject | String | Yes | — | Short subject. |
| description | String | Yes | — | Full description. |
| category | String (enum) | No | `other` | `product-quality`, `delivery`, `billing`, `service`, `other`. |
| priority | String (enum) | No | `medium` | `low`, `medium`, `high`, `urgent`. |
| status | String (enum) | No | `open` | `open`, `in-progress`, `resolved`, `closed`, `cancelled`. |
| assignedTo | ObjectId → Employee | No | — | Handler. |
| relatedOrder | ObjectId → SalesOrder | No | — | Related sales order. |
| resolution | String | No | — | Resolution text. |
| resolvedAt | Date | No | — | When resolved. |
| resolvedBy | ObjectId → Employee | No | — | Who resolved it. |
| attachments | Array<{filename, url}> | No | `[]` | File attachments. |
| notes | Array | No | `[]` | Thread of notes. |
| notes[].note | String | — | — | Note text. |
| notes[].addedBy | ObjectId → Employee | — | — | Author. |
| notes[].addedAt | Date | — | `Date.now` | Timestamp. |
| isDeleted/deletedAt/deletedBy | — | No | — | Soft delete. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Customer` (`customer`), `Employee` (`assignedTo`, `resolvedBy`), `SalesOrder` (`relatedOrder`).
- **Embedded (One-to-Many)**: `attachments[]`, `notes[]`.

## Business Logic

- **Created**: when a customer raises an issue.
- **Updated**: status transitions, assignment, adding notes, recording resolution.
- **Deleted**: soft-deleted / archived.
- **APIs/services**: `routes/crm.js`, `services/reportService.js`, `services/archiveService.js`.

## Example Document

```json
{
  "_id": "6a2c8c007ed9c9302364e001",
  "complaintNumber": "CMP0001",
  "customer": "6a2c8d007ed9c9302364c001",
  "subject": "Damaged cans on delivery",
  "description": "10 cans arrived dented.",
  "category": "delivery",
  "priority": "high",
  "status": "resolved",
  "assignedTo": "6a2c2a117ed9c93023641003",
  "relatedOrder": "6a2c8e8c7ed9c93023648df4",
  "resolution": "Replacement shipped",
  "resolvedAt": "2026-06-14T10:00:00.000Z",
  "notes": [{ "note": "Contacted customer", "addedBy": "6a2c2a117ed9c93023641003", "addedAt": "2026-06-13T11:00:00.000Z" }],
  "isDeleted": false
}
```

## Indexes

- `complaintNumber` — **unique**.
- `_id` — default primary key.

## Validation Rules

- **Required**: `complaintNumber`, `customer`, `subject`, `description`.
- **Enums**: `category`, `priority`, `status`.
- **Unique**: `complaintNumber`.

## Used By

`routes/crm.js`, `services/reportService.js`, `services/archiveService.js`.

---

# BankAccount

## Purpose

- Represents a cash or bank account holding a balance.
- Solves treasury management: tracks where money sits and is debited/credited by transactions.
- Used by the **Finance** module.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| name | String | Yes | — | Account name (e.g., "Cash", "Main Bank"). |
| balance | Number | Yes | `0` | Current balance (min 0). |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **One-to-Many** with `Transaction` (`Transaction.bankAccount`).
- Referenced by `Expense.bankAccount` and payroll/finance payment flows.

## Business Logic

- **Created/Updated**: in Finance; balance changes whenever a transaction is recorded (income increases, expense/payment decreases).
- **Deleted**: rarely.
- **APIs/services**: `routes/finance.js`, `services/payrollService.js`, `services/payrollFinanceService.js`.
- **Triggers**: payment endpoints validate sufficient balance before deducting.

## Example Document

```json
{
  "_id": "6a2c8b007ed9c9302364f001",
  "name": "Main Bank",
  "balance": 184250.5,
  "createdAt": "2026-05-01T09:00:00.000Z",
  "updatedAt": "2026-06-13T01:55:00.000Z"
}
```

## Indexes

- `name` — non-unique index (faster lookups by name).
- `_id` — default primary key.

## Validation Rules

- **Required**: `name`, `balance`.
- **min/max**: `balance` ≥ 0.

## Used By

`routes/finance.js`, `services/payrollService.js`, `services/payrollFinanceService.js`.

---

# Transaction

## Purpose

- Immutable ledger of all money movements (invoice payments and expense payments).
- Solves financial auditability and cash-flow reporting: every payment is one transaction tied to a bank account and a source document.
- Used by the **Finance** module.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| sourceType | String (enum) | Yes | — | `invoice` or `expense`. |
| sourceId | ObjectId (refPath) | No | — | The source document id; model resolved via `sourceModel`. |
| sourceModel | String (enum) | Yes | — | `Invoice`, `PurchaseInvoice`, or `Expense`. |
| direction | String (enum) | Yes | — | `in` (money received) or `out` (money paid). |
| amount | Number | Yes | — | Amount (min 0.01). |
| bankAccount | ObjectId → BankAccount | Yes | — | Affected account. |
| date | Date | Yes | `Date.now` | Transaction date. |
| notes | String | No | — | Notes. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `BankAccount` (`bankAccount`).
- **Polymorphic reference** (`refPath: 'sourceModel'`): `sourceId` → `Invoice`, `PurchaseInvoice`, or `Expense`.

## Business Logic

- **Created**: when an `Invoice` (in), `PurchaseInvoice` (out), or `Expense` (out) is paid; the bank balance is updated atomically with the transaction.
- **Updated/Deleted**: never (append-only ledger).
- **APIs/services**: `routes/finance.js`, `services/payrollService.js`, `services/payrollFinanceService.js`.

## Example Document

```json
{
  "_id": "6a2c8f007ed9c9302364b001",
  "sourceType": "invoice",
  "sourceId": "6a2c8e007ed9c9302364a001",
  "sourceModel": "PurchaseInvoice",
  "direction": "out",
  "amount": 1100,
  "bankAccount": "6a2c8b007ed9c9302364f001",
  "date": "2026-06-13T01:55:00.000Z",
  "notes": "Payment for PINV0002"
}
```

## Indexes

- `{ bankAccount: 1, date: -1 }` — account statement queries.
- `{ sourceType: 1, sourceId: 1 }` — find the transaction behind a document.
- `{ date: -1 }` — global chronological listing / cash-flow charts.
- `_id` — default primary key.

## Validation Rules

- **Required**: `sourceType`, `sourceModel`, `direction`, `amount`, `bankAccount`, `date`.
- **Enums**: `sourceType`, `sourceModel`, `direction`.
- **min/max**: `amount` ≥ 0.01.

## Used By

`routes/finance.js`, `services/payrollService.js`, `services/payrollFinanceService.js`.

---

# Expense

## Purpose

- Records business expenses, including manual entries, payroll payouts, and manufacturing costs.
- Solves cost tracking and accounts-payable for non-invoice spending, with a pay/approve workflow.
- Used by the **Finance** module; written to by Payroll and Manufacturing services.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| title | String | Yes | — | Expense title. |
| amount | Number | Yes | — | Amount (min 0.01). |
| category | String | Yes | — | Free-text category. |
| source | String (enum) | No | `Manual` | `Manual`, `Payroll`, `Manufacturing`. |
| employee | ObjectId → Employee | No | `null` | Related employee (payroll). |
| employeeId | String | No | — | Employee code snapshot. |
| type | String | No | `General` | Sub-type label. |
| status | String (enum) | No | `Paid` | `Pending Payment` or `Paid`. |
| referencePayrollId | ObjectId → PayrollRecord | No | — | Source payroll (when from payroll). |
| referenceProductionId | ObjectId → ProductionOrder | No | — | Source production order (manufacturing). |
| bankAccount | ObjectId → BankAccount | Conditional | — | Required unless `status = Pending Payment`. |
| transaction | ObjectId → Transaction | Conditional | — | Required unless `status = Pending Payment`. |
| date | Date | Yes | `Date.now` | Expense date. |
| notes | String | No | — | Notes. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `Employee`, `BankAccount`.
- **One-to-One** with `PayrollRecord` (`referencePayrollId`, unique partial) and `ProductionOrder` (`referenceProductionId`, unique partial).
- **One-to-One** with `Transaction` (`transaction`) once paid.

## Business Logic

- **Created**: manually in Finance; automatically when payroll is paid (`source: 'Payroll'`) or a production order completes (`source: 'Manufacturing'`, `status: 'Pending Payment'`).
- **Updated**: `Pending Payment` → `Paid` via `POST /expenses/:id/pay` (selects a bank account, creates an "out" `Transaction`, deducts balance).
- **Deleted**: retained for accounting.
- **APIs/services**: `routes/finance.js`, `services/financeService.js`, `services/payrollService.js`, `services/payrollFinanceService.js`, `services/manufacturingFinanceService.js`.

## Example Document

```json
{
  "_id": "6a2c5d447ed9c93023644001",
  "title": "Manufacturing cost - PRD0007",
  "amount": 100,
  "category": "Manufacturing",
  "source": "Manufacturing",
  "type": "Production",
  "status": "Pending Payment",
  "referenceProductionId": "6a2c90777ed9c93023647001",
  "date": "2026-06-13T12:00:00.000Z"
}
```

## Indexes

- `{ bankAccount: 1, date: -1 }` — account-based expense queries.
- `{ category: 1 }` — category breakdowns.
- `{ date: -1 }` — chronological listing.
- `referencePayrollId` — **unique partial** (only when value is a real ObjectId), preventing duplicate payroll expenses while allowing many expenses without one.
- `referenceProductionId` — **unique partial** (same rationale for production orders).
- `_id` — default primary key.

## Validation Rules

- **Required**: `title`, `amount`, `category`, `date`; `bankAccount` and `transaction` are required only when `status !== 'Pending Payment'`.
- **Enums**: `source`, `status`.
- **min/max**: `amount` ≥ 0.01.
- **Unique**: partial unique on `referencePayrollId` and `referenceProductionId`.
- **Custom validators**: conditional `required` functions on `bankAccount` and `transaction`.

## Used By

`routes/finance.js`, `services/financeService.js`, `services/payrollService.js`, `services/payrollFinanceService.js`, `services/manufacturingFinanceService.js`.

---

# ActivityLog

## Purpose

- Audit trail of important user actions across the system.
- Solves accountability and traceability: who did what, in which module, and with what before/after data.
- Used by the **Admin/System** layer; written from across all modules via a logging helper.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| user | ObjectId → User | Yes | — | Who performed the action. |
| action | String (enum) | Yes | — | `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `LOGIN`, `MANUAL_EDIT`, `MARK_PAID`, `RESTORE`, `PERMANENT_DELETE`. |
| module | String (enum) | Yes | — | `SALES`, `HR`, `INVENTORY`, `FINANCE`, `PURCHASING`, `CRM`, `AUTH`, `ARCHIVE`. |
| entityId | ObjectId | No | — | The affected document id. |
| entityType | String | No | — | The affected model name. |
| oldData | Mixed | No | — | Snapshot before the change. |
| newData | Mixed | No | — | Snapshot after the change. |
| ipAddress | String | No | `null` | Client IP. |
| createdAt | Date | No | `Date.now` | When logged (timestamps disabled; explicit field). |

## Relationships

- **Many-to-One** with `User` (`user`).
- **Polymorphic (loose)**: `entityId` + `entityType` reference any collection.

## Business Logic

- **Created**: by the `logActivity` helper whenever a tracked action occurs (create/update/delete/approve/login/etc.).
- **Updated/Deleted**: never (audit integrity).
- **APIs/services**: `routes/activityLogs.js` (read), and write calls throughout the modules.

## Example Document

```json
{
  "_id": "6a2c92007ed9c9302364g001",
  "user": "6a2c1f0b7ed9c93023640001",
  "action": "APPROVE",
  "module": "PURCHASING",
  "entityId": "6a2c89fc7ed9c930236489b5",
  "entityType": "PurchaseOrder",
  "ipAddress": "127.0.0.1",
  "createdAt": "2026-06-13T01:40:00.000Z"
}
```

## Indexes

- `{ user: 1 }`, `{ module: 1 }`, `{ createdAt: -1 }`, `{ user: 1, createdAt: -1 }`, `{ module: 1, createdAt: -1 }` — efficient filtering and chronological reads.
- `_id` — default primary key.

## Validation Rules

- **Required**: `user`, `action`, `module`.
- **Enums**: `action`, `module`.

## Used By

`routes/activityLogs.js` and the `logActivity` helper invoked across Sales, HR, Inventory, Finance, Purchasing, CRM, Auth, and Archive flows.

---

# Archive

## Purpose

- Stores soft-deleted documents so they can be reviewed, restored, or permanently deleted.
- Solves safe deletion and recovery: keeps a full snapshot of removed records with who/why/when.
- Used by the **Admin/Archive** module.

## Fields

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| originalId | ObjectId | Yes | — | The id the document had in its source collection. |
| module | String (enum) | Yes | — | `Sales`, `Purchasing`, `Inventory`, `HR`, `Production`, `CRM`. |
| documentType | String | Yes | — | The model/type that was archived. |
| documentNumber | String | No | — | Human-readable number (order/invoice/etc.). |
| data | Mixed | Yes | — | Full snapshot of the original document. |
| deletedBy | ObjectId → User | Yes | — | Who archived it. |
| deletedAt | Date | Yes | `Date.now` | When archived. |
| reason | String | No | — | Reason for deletion. |
| isRestored | Boolean | No | `false` | Whether it has been restored. |
| restoredAt | Date | No | — | When restored. |
| restoredBy | ObjectId → User | No | — | Who restored it. |
| createdAt / updatedAt | Date | auto | — | Managed by `timestamps`. |

## Relationships

- **Many-to-One** with `User` (`deletedBy`, `restoredBy`).
- **Loose reference**: `originalId` + `documentType` point back to the original collection.

## Business Logic

- **Created**: when a document is archived/deleted via `services/archiveService.js`.
- **Updated**: on restore (`isRestored`, `restoredAt`, `restoredBy`).
- **Deleted**: on permanent delete.
- **APIs/services**: `routes/archive.js`, `services/archiveService.js`.

## Example Document

```json
{
  "_id": "6a2c93007ed9c9302364h001",
  "originalId": "6a2c8e8c7ed9c93023648df4",
  "module": "Sales",
  "documentType": "SalesOrder",
  "documentNumber": "SO0001",
  "data": { "orderNumber": "SO0001", "total": 275, "status": "cancelled" },
  "deletedBy": "6a2c1f0b7ed9c93023640001",
  "deletedAt": "2026-06-14T09:00:00.000Z",
  "reason": "Customer cancelled",
  "isRestored": false
}
```

## Indexes

- `{ module: 1 }` — filter by module.
- `{ deletedAt: -1 }` — chronological listing.
- `{ documentNumber: 'text' }` — text search by document number.
- `{ isRestored: 1 }` — filter restored vs. archived.
- `_id` — default primary key.

## Validation Rules

- **Required**: `originalId`, `module`, `documentType`, `data`, `deletedBy`, `deletedAt`.
- **Enums**: `module`.

## Used By

`routes/archive.js`, `services/archiveService.js`.

---

# Database Relationship Diagram (Text)

```
User
├── Employee  (User 1—1 Employee)
│      ├── Attendance        (Employee 1—* Attendance)
│      ├── PayrollRecord     (Employee 1—* PayrollRecord)
│      │      ├── Expense        (PayrollRecord 1—1 Expense, when paid)
│      │      └── Transaction    (PayrollRecord 1—1 Transaction, when paid)
│      └── manager → Employee (self reference)
│
├── Customer
│      ├── SalesOrder        (Customer 1—* SalesOrder)
│      │      ├── Invoice         (SalesOrder 1—1 Invoice)
│      │      │      └── Transaction (Invoice 1—1, when paid, direction "in")
│      │      └── ProductionOrder (SalesOrder 1—1 ProductionOrder)
│      └── Complaint         (Customer 1—* Complaint, may link a SalesOrder)
│
├── Supplier
│      ├── Product           (Supplier 1—* Product)
│      └── PurchaseOrder     (Supplier 1—* PurchaseOrder)
│             └── PurchaseInvoice (PurchaseOrder 1—1 PurchaseInvoice)
│                    └── Transaction (PurchaseInvoice 1—1, when paid, direction "out")
│
├── Product
│      ├── requiredMaterials → Product   (BOM, self many—many)
│      ├── InventoryTransaction          (Product 1—* movements)
│      └── ProductionOrder               (Product 1—* production jobs)
│
├── BankAccount
│      ├── Transaction       (BankAccount 1—* Transaction)
│      └── Expense           (BankAccount 1—* Expense, when paid)
│
├── ActivityLog   (User 1—* ActivityLog; entityId → any collection)
└── Archive       (User 1—* Archive via deletedBy/restoredBy; originalId → any collection)
```

---

# Summary Table

| Collection | Module | Main Purpose | Related Collections |
| ---------- | ------ | ------------ | ------------------- |
| User | Auth/System | Login accounts, roles, departments | Employee, ActivityLog, Archive, (deletedBy everywhere) |
| Employee | HR | Employment profiles & hierarchy | User, Attendance, PayrollRecord, SalesOrder, PurchaseOrder, ProductionOrder, Complaint |
| Attendance | HR | Daily check-in/out tracking | Employee, PayrollRecord |
| PayrollRecord | HR / Finance | Monthly salary computation & payment | Employee, Attendance, SalesOrder, Expense, Transaction |
| Product | Inventory | Catalog of raw materials & final products | Supplier, InventoryTransaction, ProductionOrder, SalesOrder, PurchaseOrder, Invoice, PurchaseInvoice |
| InventoryTransaction | Inventory | Stock movement ledger | Product, Employee, (PO/SO/Production refs) |
| ProductionOrder | Manufacturing | Production jobs & costing | Product, Employee, SalesOrder, Expense |
| Supplier | SCM/Purchasing | Vendor master records | Product, PurchaseOrder, PurchaseInvoice |
| PurchaseOrder | Purchasing | Procurement orders | Supplier, Product, Employee, PurchaseInvoice, InventoryTransaction |
| PurchaseInvoice | Purchasing / Finance | Accounts payable per PO | PurchaseOrder, Supplier, Transaction |
| SalesOrder | Sales | Customer orders | Customer, Product, Employee, ProductionOrder, Invoice, Complaint |
| Invoice | Sales / Finance | Accounts receivable per SO | SalesOrder, Customer, Transaction |
| Customer | CRM/Sales | Buyer master records | SalesOrder, Invoice, Complaint |
| Complaint | CRM | Customer complaints/tickets | Customer, Employee, SalesOrder |
| BankAccount | Finance | Cash/bank balances | Transaction, Expense |
| Transaction | Finance | Money-movement ledger | BankAccount, Invoice, PurchaseInvoice, Expense |
| Expense | Finance | Business expenses & payouts | Employee, BankAccount, Transaction, PayrollRecord, ProductionOrder |
| ActivityLog | Admin/System | Audit trail of actions | User, (any entity) |
| Archive | Admin/System | Soft-delete recovery store | User, (any original document) |

---

# Viva Preparation Notes

### User
- **Why does it exist?** To authenticate people and authorize what they can do (role + department).
- **Why separated?** Authentication concerns (password, role) are distinct from HR data; admins exist without an employee profile.
- **Without it?** No login, no access control, no audit attribution.
- **Key fields:** `email`, `password` (hashed), `role`, `department`.
- **Interactions:** One-to-one with Employee; referenced by ActivityLog and as `deletedBy` across the system.

### Employee
- **Why?** To store employment data (position, salary, hire date, manager).
- **Why separated?** Keeps HR/payroll data off the login record; not every user is an employee and not every employee logs in the same way.
- **Without it?** No payroll, attendance, or org hierarchy.
- **Key fields:** `employeeId`, `user`, `salary`, `department`, `manager`.
- **Interactions:** Parent of Attendance and PayrollRecord; acts as salesRep/purchaser/handler elsewhere.

### Attendance
- **Why?** To record presence and time worked each day.
- **Why separated?** Time data is high-volume (one row per employee per day) and feeds payroll independently.
- **Without it?** Payroll could not compute present days, lateness, or overtime.
- **Key fields:** `employee`, `date`, `checkIn`, `checkOut`, `status`.
- **Interactions:** Source data for PayrollRecord; corrections flag payrolls for regeneration.

### PayrollRecord
- **Why?** To compute and store each employee's monthly pay.
- **Why separated?** Payroll is a periodic, auditable financial artifact distinct from raw attendance.
- **Without it?** No salary processing, approval workflow, or finance link.
- **Key fields:** `employee`, `periodYear/Month`, `netPay`, `status`, `financeExpense/Transaction`.
- **Interactions:** Reads Attendance + SalesOrder; on payment creates an Expense + Transaction.

### Product
- **Why?** Central catalog for everything bought, made, stored, and sold.
- **Why separated?** A single source of truth for items used by many modules; BOM modeled via self reference.
- **Without it?** No inventory, manufacturing, sales, or purchasing.
- **Key fields:** `sku`, `category`, `currentStock`, `unitCost`, `requiredMaterials` (BOM).
- **Interactions:** Linked to Supplier; referenced by inventory/sales/purchase/production documents.

### InventoryTransaction
- **Why?** To keep an auditable history of every stock change.
- **Why separated?** Append-only ledger; you should never lose the "why" behind a stock number.
- **Without it?** Stock levels would be untraceable and impossible to audit.
- **Key fields:** `product`, `type`, `quantity`, `reference`, `referenceId`.
- **Interactions:** Backs every change to `Product.currentStock`.

### ProductionOrder
- **Why?** To plan and cost manufacturing of final products.
- **Why separated?** Production has its own lifecycle, staffing, materials, and cost separate from inventory rows.
- **Without it?** No way to convert raw materials into finished goods or record manufacturing cost.
- **Key fields:** `orderNumber`, `product`, `quantity`, `status`, `manufacturingCost`.
- **Interactions:** Consumes/produces stock (InventoryTransaction); records cost as an Expense; may link a SalesOrder.

### Supplier
- **Why?** To manage vendors and their terms.
- **Why separated?** Vendors are reusable entities referenced by many products and POs.
- **Without it?** No procurement source, no auto-reorder targeting.
- **Key fields:** `name`, `email`, `paymentTerms`, `products`.
- **Interactions:** Parent of PurchaseOrder/PurchaseInvoice; linked from Product.

### PurchaseOrder
- **Why?** To formalize buying raw materials.
- **Why separated?** Procurement lifecycle (pending → ordered → received) and auto-generation logic warrant a dedicated collection.
- **Without it?** No structured purchasing or stock replenishment.
- **Key fields:** `orderNumber`, `supplier`, `items`, `status`, `autoGenerated`.
- **Interactions:** Creates a PurchaseInvoice on acceptance; adds stock on receipt.

### PurchaseInvoice
- **Why?** To track money owed to suppliers (accounts payable).
- **Why separated?** Billing is distinct from ordering; one invoice per PO with its own payment status.
- **Without it?** No payables tracking or supplier payment workflow.
- **Key fields:** `invoiceNumber`, `purchaseOrder` (unique), `total`, `status`.
- **Interactions:** Paid via Finance → creates an "out" Transaction.

### SalesOrder
- **Why?** To capture what customers buy.
- **Why separated?** Orders have their own fulfillment lifecycle and link to production/invoicing.
- **Without it?** No revenue capture or fulfillment.
- **Key fields:** `orderNumber`, `customer`, `items`, `status`.
- **Interactions:** May spawn a ProductionOrder; generates an Invoice; drives sales bonuses.

### Invoice
- **Why?** To track money owed by customers (accounts receivable).
- **Why separated?** Billing is distinct from the order; one invoice per SO with payment status.
- **Without it?** No receivables tracking or income recognition.
- **Key fields:** `invoiceNumber`, `salesOrder` (unique), `total`, `status`.
- **Interactions:** Paid via Finance → creates an "in" Transaction.

### Customer
- **Why?** To manage buyers and their terms.
- **Why separated?** Customers are reusable entities referenced by orders, invoices, complaints.
- **Without it?** No CRM or sales attribution.
- **Key fields:** `name`, `email`, `customerType`, `creditLimit`.
- **Interactions:** Parent of SalesOrder, Invoice, Complaint.

### Complaint
- **Why?** To handle after-sales issues.
- **Why separated?** Support tickets have their own lifecycle and assignment, unrelated to order processing.
- **Without it?** No structured customer service or quality feedback loop.
- **Key fields:** `complaintNumber`, `customer`, `status`, `priority`.
- **Interactions:** Links Customer, Employee (handler), and optionally a SalesOrder.

### BankAccount
- **Why?** To represent where company money is held.
- **Why separated?** Balances are shared across all payments; multiple accounts can exist.
- **Without it?** No place to debit/credit money during payments.
- **Key fields:** `name`, `balance`.
- **Interactions:** Debited/credited by every Transaction and paid Expense.

### Transaction
- **Why?** To record every money movement with a source and account.
- **Why separated?** A single, immutable financial ledger powers cash flow and audits.
- **Without it?** No financial history, reconciliation, or cash-flow charts.
- **Key fields:** `direction`, `amount`, `bankAccount`, `sourceModel`/`sourceId`.
- **Interactions:** Created when invoices/expenses are paid; updates BankAccount balance.

### Expense
- **Why?** To record spending not tied to supplier invoices (manual, payroll, manufacturing).
- **Why separated?** Expenses have a pay/approve workflow and varied sources distinct from invoices.
- **Without it?** Payroll payouts and manufacturing costs could not be recorded in Finance.
- **Key fields:** `amount`, `source`, `status`, `referencePayrollId`, `referenceProductionId`.
- **Interactions:** Becomes a Transaction when paid; linked from PayrollRecord and ProductionOrder.

### ActivityLog
- **Why?** To provide an audit trail of who did what.
- **Why separated?** Cross-cutting audit data should not pollute business collections.
- **Without it?** No accountability or forensic history.
- **Key fields:** `user`, `action`, `module`, `entityId`.
- **Interactions:** Written from every module via the logging helper.

### Archive
- **Why?** To allow safe deletion with recovery.
- **Why separated?** Keeps removed records out of active collections while preserving full snapshots.
- **Without it?** Deletions would be permanent and unrecoverable.
- **Key fields:** `originalId`, `documentType`, `data`, `deletedBy`, `isRestored`.
- **Interactions:** Created by the archive service when documents are deleted; supports restore.
