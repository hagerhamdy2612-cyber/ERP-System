# ERP System — Technical Documentation

A comprehensive technical reference for the **erp-grad** MERN stack ERP application. All file names, routes, and field names are taken from the actual codebase.

---

## 1. Project Overview

### Purpose

This is a full **Enterprise Resource Planning (ERP)** web application for managing day-to-day business operations across departments: HR, Manufacturing, Supply Chain, CRM, Sales, Inventory, Purchasing, and Finance. It connects operational workflows (orders, production, stock) with financial tracking (invoices, expenses, bank accounts, payroll).

### Modules & Main Features

| Module | Key Features |
| ------ | ------------ |
| **Admin / System** | Main dashboard KPIs, activity log, archive (soft-delete recovery), role-based navigation |
| **HR** | Employees, attendance (check-in/out, corrections), attendance reports, payroll generation/approval/payment |
| **Manufacturing** | Production orders, material consumption, manufacturing cost → Finance expense |
| **SCM** | Supplier master data, supplier–product mapping, supplier performance |
| **CRM** | Customers (with address), complaints/tickets, customer sales history |
| **Sales** | Sales orders (`pending` → `confirmed` → `delivered`), auto production orders, sales invoices, revenue charts |
| **Inventory** | Raw materials & final products, BOM, stock adjustments, low-stock alerts, inventory transaction ledger |
| **Purchasing** | Purchase orders (`pending` → `ordered` → `received`), auto-PO from low stock, purchase invoices (created on PO accept) |
| **Finance** | Bank accounts, transactions, expenses (manual/payroll/manufacturing), invoice payment, cash-flow charts |

### Tech Stack

#### Core MERN

| Layer | Technology | Version (package.json) |
| ----- | ---------- | ---------------------- |
| **M**ongoDB | MongoDB via Mongoose ODM | mongoose `^8.0.3` |
| **E**xpress | Express.js REST API | express `^4.18.2` |
| **R**eact | React SPA | react `^18.2.0` |
| **N**ode.js | Node runtime | (server `index.js`) |

#### Backend Libraries

| Library | Purpose |
| ------- | ------- |
| `jsonwebtoken` | JWT auth tokens |
| `bcryptjs` | Password hashing (`User` pre-save hook) |
| `express-validator` | Request body/query validation |
| `cors` | Cross-origin requests |
| `dotenv` | `config.env` environment variables |
| `node-cron` | Hourly auto-purchase scheduler |
| `nodemailer` + `handlebars` | Report email delivery |
| `exceljs` | Excel report export |
| `multer` | File uploads (`/uploads` static) |
| `moment` | Date handling in reports |

#### Frontend Libraries

| Library | Purpose |
| ------- | ------- |
| `axios` | HTTP client (proxy → `http://localhost:5000`) |
| `react-router-dom` v6 | Client routing (`/app/...`) |
| `tailwindcss` | Utility CSS styling |
| `recharts` | Dashboard line/bar/pie charts |
| `lucide-react` | Icons |
| `react-hot-toast` | Toast notifications |
| `react-i18next` + `i18next` | English/Arabic i18n (`en.json`, `ar.json`) |
| `clsx` | Conditional CSS classes |

**Not used:** Redux, Zustand, or global fetch — state is **React Context + `useState`**.

---

## 2. System Architecture

### Pattern

The system follows a **layered REST API architecture** (MVC-inspired):

```
React Client (pages/components)
        │  Axios HTTP (JSON)
        ▼
Express Routes (routes/*.js)
        │  middleware: protect, authorize, express-validator
        ▼
Controllers / Services (controllers/, services/, utils/)
        │  business logic
        ▼
Mongoose Models (models/*.js)
        │
        ▼
MongoDB (collections)
```

- **Routes** handle HTTP, validation, and response formatting.
- **Services** hold complex business logic (payroll, reports, archive, scheduler, finance).
- **Models** define schemas, indexes, and Mongoose hooks.
- **No separate Repository layer** — routes/services call Mongoose directly.

### Client–Server Communication

- **Protocol:** REST over HTTP/JSON.
- **Client HTTP library:** **Axios** (`client/package.json` proxy: `http://localhost:5000`).
- **Base paths:** All APIs under `/api/<module>` (e.g. `/api/sales/orders`).
- **Auth header:** `Authorization: Bearer <JWT>` set globally in `AuthContext.js` after login.

### Authentication

- **Method:** **JWT (JSON Web Token)** — stateless, no server sessions.
- **Flow:** `POST /api/auth/login` → returns `{ token, user }` → stored in `localStorage` → attached to every Axios request.
- **Verification:** `middleware/auth.js` → `protect` reads Bearer token, verifies with `JWT_SECRET`, loads `User` into `req.user`.
- **Password storage:** bcrypt hash in `User` model `pre('save')` hook.

---

## 3. Folder Structure

### Root

```
erp-grad/
├── package.json              # Root scripts: concurrently runs client + server
├── README.md
├── DATABASE_DOCUMENTATION.md # Per-collection schema reference
├── PROJECT_TECHNICAL_DOCUMENTATION.md  # This file
├── client/                   # React frontend
└── server/                   # Express backend
```

### Server (`server/`)

```
server/
├── index.js                  # App entry: middleware, route mounting, MongoDB connect, scheduler
├── config.env                # MONGODB_URI, JWT_SECRET, PORT, TIMEZONE
├── package.json
│
├── middleware/
│   └── auth.js               # JWT protect + role/department authorize helpers
│
├── models/                   # 19 Mongoose schemas
│   ├── User.js
│   ├── Employee.js
│   ├── Attendance.js
│   ├── PayrollRecord.js
│   ├── Product.js
│   ├── InventoryTransaction.js
│   ├── ProductionOrder.js
│   ├── Supplier.js
│   ├── PurchaseOrder.js
│   ├── PurchaseInvoice.js
│   ├── SalesOrder.js
│   ├── Invoice.js
│   ├── Customer.js
│   ├── Complaint.js
│   ├── BankAccount.js
│   ├── Transaction.js
│   ├── Expense.js
│   ├── ActivityLog.js
│   └── Archive.js
│
├── routes/                   # Express routers (one per module)
│   ├── auth.js
│   ├── hr.js
│   ├── payroll.js
│   ├── manufacturing.js
│   ├── scm.js
│   ├── crm.js
│   ├── sales.js
│   ├── inventory.js
│   ├── purchasing.js
│   ├── dashboard.js
│   ├── reports.js
│   ├── finance.js
│   ├── activityLogs.js
│   └── archive.js
│
├── controllers/
│   └── payrollController.js  # Thin controller → payrollService
│
├── services/
│   ├── payrollService.js
│   ├── payrollFinanceService.js
│   ├── manufacturingFinanceService.js
│   ├── financeService.js
│   ├── reportService.js
│   ├── reportSender.js
│   ├── schedulerService.js
│   ├── archiveService.js
│   ├── emailService.js
│   └── salesPayrollBonusService.js
│
├── utils/
│   ├── attendancePolicy.js   # Working days, overtime rules
│   ├── attendanceMetrics.js  # Derive hours from check-in/out
│   ├── autoPurchaseLowStock.js
│   ├── logActivity.js
│   ├── payrollPeriodSlots.js
│   └── phoneValidation.js
│
├── scripts/                  # Seed, clear data, auto-purchase CLI
├── docs/
│   └── attendance-payroll-readme.md
└── uploads/                  # Static file serving
```

### Client (`client/src/`)

```
client/src/
├── index.js                  # ReactDOM render
├── App.js                    # Router + all route definitions
├── index.css                 # Tailwind imports
│
├── contexts/
│   ├── AuthContext.js        # JWT user state, login/logout
│   └── ThemeContext.js       # Dark mode toggle
│
├── config/
│   └── permissions.js        # Frontend RBAC helpers
│
├── components/
│   ├── Layout.js             # Sidebar navigation shell
│   ├── Card.js
│   ├── LanguageSwitcher.js
│   ├── ProtectedRoute.js
│   ├── ProtectedModuleRoute.js
│   ├── ProtectedDashboardRoute.js
│   ├── ProtectedPayrollRoute.js
│   └── Finance/
│       ├── CashFlowChart.js
│       └── ExpensesPieChart.js
│
├── pages/
│   ├── Login.js
│   ├── Dashboard.js          # Admin main dashboard
│   ├── Admin/
│   │   ├── ActivityLog.js
│   │   └── Archive.js
│   ├── HR/                   # Dashboard, Employees, Attendance, Reports, Payroll/*
│   ├── Manufacturing/
│   ├── SCM/
│   ├── CRM/
│   ├── Sales/
│   ├── Inventory/
│   ├── Purchasing/
│   └── Finance/
│
├── services/
│   └── archiveService.js     # Frontend archive API wrapper
│
├── utils/
│   ├── darkModeHelpers.js
│   ├── phoneValidation.js
│   ├── translateNavigation.js
│   └── uploadUrl.js
│
└── i18n/
    ├── config.js
    └── locales/
        ├── en.json
        └── ar.json
```

---

## 4. Backend Deep Dive

### 4.1 Route Mounting (`server/index.js`)

| Mount Path | Route File |
| ---------- | ---------- |
| `/api/auth` | `routes/auth.js` |
| `/api/hr` | `routes/hr.js` |
| `/api/hr/payroll` & `/api/payroll` | `routes/payroll.js` (same router, two mounts) |
| `/api/manufacturing` | `routes/manufacturing.js` |
| `/api/scm` | `routes/scm.js` |
| `/api/crm` | `routes/crm.js` |
| `/api/sales` | `routes/sales.js` |
| `/api/inventory` | `routes/inventory.js` |
| `/api/purchasing` | `routes/purchasing.js` |
| `/api/dashboard` | `routes/dashboard.js` |
| `/api/reports` | `routes/reports.js` |
| `/api/finance` | `routes/finance.js` |
| `/api/activity-logs` | `routes/activityLogs.js` |
| `/api/archive` | `routes/archive.js` |
| `GET /api/health` | Inline health check |

### 4.2 All API Endpoints

#### Auth — `routes/auth.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/auth/register` | Register user (validated email/password) |
| POST | `/api/auth/login` | Login → JWT + user object |
| GET | `/api/auth/me` | Current user (`protect`) |
| GET | `/api/auth/users` | List active users (`protect`) |

#### HR — `routes/hr.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/hr/employees` | List employees + linked users |
| GET | `/api/hr/employees/test` | Test endpoint |
| POST | `/api/hr/employees/test` | Test create |
| POST | `/api/hr/employees` | Create employee + user |
| PUT | `/api/hr/employees/:id` | Update employee |
| DELETE | `/api/hr/employees/:id` | Archive user (soft delete via `archiveService`) |
| GET | `/api/hr/attendance/status` | Today's attendance status for logged-in employee |
| GET | `/api/hr/attendance` | List attendance (filters: employee, date range) |
| POST | `/api/hr/attendance/checkin` | Check in |
| POST | `/api/hr/attendance/checkout` | Check out |
| PATCH | `/api/hr/attendance/:id` | HR manual correction; flags payroll `requiresRegeneration` |
| GET | `/api/hr/attendance/report` | Attendance report by period |
| GET | `/api/hr/managers/:department` | Manager for department |
| GET | `/api/hr/managers` | All managers |
| GET | `/api/hr/managers/public` | Public manager list |

#### Payroll — `routes/payroll.js` → `controllers/payrollController.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/payroll/` | List payroll records (filters) |
| DELETE | `/api/payroll/` | Delete all payroll (testing) |
| POST | `/api/payroll/generate` | Generate monthly payroll |
| PATCH | `/api/payroll/approve/:id` | Approve payroll |
| PATCH | `/api/payroll/recalculate/:id` | Recalculate single record |
| PATCH | `/api/payroll/:id/recalculate` | Alias for recalculate |
| GET | `/api/payroll/:id` | Get one payroll record |

#### Manufacturing — `routes/manufacturing.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/manufacturing/production-orders` | List production orders |
| POST | `/api/manufacturing/production-orders` | Create production order |
| PUT | `/api/manufacturing/production-orders/:id` | Update order |
| PUT | `/api/manufacturing/production-orders/:id/start` | Start production |
| PUT | `/api/manufacturing/production-orders/:id/complete` | Complete → stock in/out + manufacturing expense |
| PUT | `/api/manufacturing/production-orders/:id/assign` | Assign employees |
| DELETE | `/api/manufacturing/production-orders/:id` | Archive production order |

#### SCM — `routes/scm.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/scm/suppliers` | List suppliers (optional `isActive` filter) |
| POST | `/api/scm/suppliers` | Create supplier |
| PUT | `/api/scm/suppliers/:id` | Update supplier |
| GET | `/api/scm/suppliers/:id/products` | Products linked to supplier |
| POST | `/api/scm/suppliers/:id/products` | Add product to `supplier.products` + set `Product.supplier` |
| GET | `/api/scm/suppliers/:id/performance` | Supplier KPIs |
| DELETE | `/api/scm/suppliers/:id` | Delete supplier (blocked if products exist) |

#### CRM — `routes/crm.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/crm/customers` | List customers |
| POST | `/api/crm/customers` | Create customer |
| PUT | `/api/crm/customers/:id` | Update customer |
| GET | `/api/crm/customers/:id/orders` | Customer sales orders |
| GET | `/api/crm/customers/:id/history` | Customer interaction history |
| GET | `/api/crm/leads` | Leads placeholder |
| GET | `/api/crm/support-tickets` | Support tickets placeholder |
| DELETE | `/api/crm/customers/:id` | Archive customer |
| GET | `/api/crm/complaints` | List complaints |
| GET | `/api/crm/complaints/:id` | Get complaint |
| POST | `/api/crm/complaints` | Create complaint |
| PUT | `/api/crm/complaints/:id` | Update complaint |
| POST | `/api/crm/complaints/:id/notes` | Add note to complaint |
| DELETE | `/api/crm/complaints/:id` | Archive complaint |

#### Sales — `routes/sales.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/sales/orders` | List sales orders |
| POST | `/api/sales/orders` | Create sales order |
| PUT | `/api/sales/orders/:id` | Update sales order |
| PUT | `/api/sales/orders/:id/confirm` | Confirm order (may auto-create production order) |
| PUT | `/api/sales/orders/:id/deliver` | Mark delivered |
| GET | `/api/sales/revenue` | Revenue aggregation |
| GET | `/api/sales/customers-report` | Customer sales report |
| GET | `/api/sales/products-report` | Product sales report |
| GET | `/api/sales/trends` | Sales trends |
| GET | `/api/sales/export/:type` | Export report |
| DELETE | `/api/sales/orders/:id` | Archive sales order |
| GET | `/api/sales/invoices` | List sales invoices |
| GET | `/api/sales/invoices/:orderId` | Invoice by sales order |
| PUT | `/api/sales/invoices/:id/mark-paid` | Mark invoice paid |

#### Inventory — `routes/inventory.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/inventory/products` | List products (`category`, filters) |
| POST | `/api/inventory/products` | Create product |
| PUT | `/api/inventory/products/:id` | Update product |
| POST | `/api/inventory/products/:id/adjust` | Stock adjustment → `InventoryTransaction` |
| GET | `/api/inventory/transactions` | Inventory movement ledger |
| GET | `/api/inventory/low-stock` | Low/out-of-stock products |
| DELETE | `/api/inventory/products/:id` | Archive product |
| GET | `/api/inventory/stock-value` | Total stock valuation |

#### Purchasing — `routes/purchasing.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/purchasing/orders` | List purchase orders |
| POST | `/api/purchasing/orders` | Create PO (no invoice yet) |
| PUT | `/api/purchasing/orders/:id` | Update PO |
| PUT | `/api/purchasing/orders/:id/order` | Accept PO (`pending`→`ordered`) + create `PurchaseInvoice` |
| PUT | `/api/purchasing/orders/:id/receive` | Receive PO → stock in |
| POST | `/api/purchasing/auto-generate` | Manual trigger auto-PO from low stock |
| GET | `/api/purchasing/auto-requests` | Pending auto-generated POs |
| GET | `/api/purchasing/spending` | Spending metrics (received POs only) |
| GET | `/api/purchasing/suppliers-report` | Supplier spending report |
| GET | `/api/purchasing/products-report` | Product purchase report |
| GET | `/api/purchasing/trends` | Monthly spending trends |
| GET | `/api/purchasing/low-stock-alerts` | Low stock raw materials |
| GET | `/api/purchasing/export/:type` | Export |
| DELETE | `/api/purchasing/orders/:id` | Archive PO |
| GET | `/api/purchasing/invoices` | List purchase invoices |
| GET | `/api/purchasing/invoices/:orderId` | Invoice by PO |
| PUT | `/api/purchasing/invoices/:id/mark-paid` | Mark purchase invoice paid |

> **Note:** `purchasing.js` contains duplicate route definitions for some report endpoints (lines ~1000+). Express uses the **first** registered handler; later duplicates are dead code.

#### Dashboard — `routes/dashboard.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/dashboard/kpis` | Admin/manager KPIs (employees, revenue, stock, etc.) |
| GET | `/api/dashboard/recent-activities` | Recent sales/production/purchase events |
| GET | `/api/dashboard/sales-chart` | Sales revenue chart (`period=year` → monthly) |
| GET | `/api/dashboard/department-chart` | Department-specific chart data |

#### Reports — `routes/reports.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/reports/test` | Test endpoint |
| POST | `/api/reports/trigger-auto-pos` | Trigger auto purchase orders |
| GET | `/api/reports/status` | Report scheduler status |
| GET | `/api/reports/generate/:type` | Generate report data |
| GET | `/api/reports/export/:type` | Export report (Excel) |
| POST | `/api/reports/send` | Email report to users |

#### Finance — `routes/finance.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/finance/dashboard` | Finance KPIs |
| GET | `/api/finance/invoices` | All sales + purchase invoices |
| POST | `/api/finance/pay-invoice` | Pay invoice → `Transaction` + bank balance |
| GET | `/api/finance/payroll/unpaid` | Unpaid approved payrolls |
| POST | `/api/finance/payroll/:id/pay` | Pay payroll from bank account |
| GET | `/api/finance/transactions` | Transaction ledger |
| GET | `/api/finance/bank` | Bank overview |
| POST | `/api/finance/expenses` | Create expense |
| GET | `/api/finance/expenses` | List expenses |
| POST | `/api/finance/expenses/:id/pay` | Pay pending expense |
| GET | `/api/finance/bank-accounts` | List bank accounts (admin) |
| POST | `/api/finance/bank-accounts` | Create bank account |
| PUT | `/api/finance/bank-accounts/:id` | Update bank account |
| DELETE | `/api/finance/bank-accounts/:id` | Delete bank account |
| GET | `/api/finance/cash-flow` | Cash flow chart data |
| GET | `/api/finance/month-comparison` | Month-over-month comparison |
| GET | `/api/finance/expenses-breakdown` | Expense category breakdown |

#### Activity Logs — `routes/activityLogs.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/activity-logs/` | Paginated activity log (admin) |
| GET | `/api/activity-logs/export` | Export logs |

#### Archive — `routes/archive.js`

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/archive/` | List archived documents (admin) |
| POST | `/api/archive/:id/restore` | Restore archived document |
| DELETE | `/api/archive/:id/permanent` | Permanent delete |

### 4.3 Mongoose Models (19 Collections)

Full field-level documentation is in `DATABASE_DOCUMENTATION.md`. Summary:

| Model | Collection | Key Fields |
| ----- | ---------- | ---------- |
| `User` | users | `name`, `email`, `password`, `role` (`admin`/`manager`/`employee`), `department`, `isActive`, `isDeleted` |
| `Employee` | employees | `employeeId`, `user`, `position`, `department`, `salary`, `hireDate`, `manager` |
| `Attendance` | attendances | `employee`, `date`, `checkIn`, `checkOut`, `workingHours`, `overtime`, `status` |
| `PayrollRecord` | payrollrecords | `employee`, `periodYear`, `periodMonth`, `netPay`, `status` (`draft`/`needs_review`/`approved`/`paid`), attendance breakdown fields |
| `Product` | products | `sku`, `name`, `category` (`raw-material`/`final-product`), `currentStock`, `minStockLevel`, `unitCost`, `requiredMaterials[]` (BOM) |
| `InventoryTransaction` | inventorytransactions | `product`, `type` (`in`/`out`/`adjustment`), `quantity`, `reference`, `referenceId` |
| `ProductionOrder` | productionorders | `orderNumber`, `product`, `quantity`, `status`, `materials[]`, `manufacturingCost`, `salesOrder` |
| `Supplier` | suppliers | `name`, `email`, `phone`, `rating`, `paymentTerms`, `products[]` |
| `PurchaseOrder` | purchaseorders | `orderNumber`, `supplier`, `items[]`, `status` (`pending`/`ordered`/`received`), `autoGenerated` |
| `PurchaseInvoice` | purchaseinvoices | `invoiceNumber`, `purchaseOrder` (unique), `supplier`, `total`, `status` |
| `SalesOrder` | salesorders | `orderNumber`, `customer`, `items[]`, `status` (`pending`/`confirmed`/`in-production`/`delivered`), `productionOrder` |
| `Invoice` | invoices | `invoiceNumber`, `salesOrder` (unique), `customer`, `total`, `status` |
| `Customer` | customers | `name`, `email`, `phone`, `address` (`street`, `city`, `zipCode`, `country`), `customerType`, `creditLimit` |
| `Complaint` | complaints | `complaintNumber`, `customer`, `subject`, `status`, `priority`, `notes[]` |
| `BankAccount` | bankaccounts | `name`, `balance` |
| `Transaction` | transactions | `direction` (`in`/`out`), `amount`, `bankAccount`, `sourceModel`, `sourceId` |
| `Expense` | expenses | `title`, `amount`, `source` (`Manual`/`Payroll`/`Manufacturing`), `status` (`Pending Payment`/`Paid`) |
| `ActivityLog` | activitylogs | `user`, `action`, `module`, `entityId`, `oldData`, `newData` |
| `Archive` | archives | `originalId`, `documentType`, `data` (snapshot), `deletedBy`, `isRestored` |

**Common patterns:**
- `timestamps: true` → `createdAt`, `updatedAt` on most models.
- Soft delete: `isDeleted`, `deletedAt`, `deletedBy` + `pre(/^find/)` hook on `User`, `Product`, `Customer`, `SalesOrder`, `PurchaseOrder`, `ProductionOrder`, `Complaint`.
- Unique compound index on `PayrollRecord`: `{ employee, periodYear, periodMonth }`.
- Partial unique indexes on `Expense.referencePayrollId` and `referenceProductionId`.

### 4.4 Middleware

**File:** `server/middleware/auth.js`

| Middleware | Purpose |
| ---------- | ------- |
| `protect` | Verify JWT, attach `req.user` |
| `authorize(...roles)` | Role must be in list (`admin`, `manager`, `employee`) |
| `authorizeAdminOrHR` | Admin or HR manager |
| `authorizeEmployeeManagement` | Admin, any manager, or non-HR employee |
| `authorizeDepartment(name)` | Admin or manager in named department |
| `authorizeCreatePurchaseOrder` | Admin or Purchasing employee |
| `authorizeEditPurchaseOrder` | Admin or Purchasing manager |
| `authorizeAcceptPurchaseOrder` | Admin or Purchasing manager |
| `authorizeReceivePurchaseOrder` | Admin or Purchasing employee |
| `authorizeCreateSalesOrder` | Admin or Sales staff |
| `authorizeSalesOrderWorkflow` | Confirm/deliver/delete sales orders |
| `authorizeManufacturingProduction` | Admin or Manufacturing staff |
| `authorizeManufacturingManagers` | Admin or Manufacturing manager |

**Global error handlers** (`server/index.js`):
- 500 error middleware (logs stack, hides details in production).
- 404 catch-all: `{ success: false, message: 'Route not found' }`.

### 4.5 Service Layer

| Service | Responsibility |
| ------- | -------------- |
| `payrollService.js` | Generate/approve/recalculate payroll from attendance + sales bonus; `needs_review` if incomplete attendance |
| `payrollFinanceService.js` | Link payroll payment to `Expense` + `Transaction` |
| `manufacturingFinanceService.js` | Record `manufacturingCost` as `Expense` on production complete |
| `financeService.js` | Finance helper utilities |
| `reportService.js` | Aggregated report data for all modules (Excel export) |
| `reportSender.js` | Email reports via `emailService` |
| `schedulerService.js` | Cron: hourly auto-purchase PO generation from low stock |
| `archiveService.js` | Soft delete: snapshot → `Archive`, set `isDeleted`; restore; permanent delete |
| `emailService.js` | Nodemailer email sending |
| `salesPayrollBonusService.js` | Sales-based payroll bonus calculation |

**Scheduler:** Runs on server start + every hour (`0 * * * *`). Skips products that already have an open PO (`pending` or `ordered`).

---

## 5. Frontend Deep Dive

### 5.1 Routing (`client/src/App.js`)

All authenticated routes live under `/app` inside `<Layout />`.

| Path | Page Component | Access |
| ---- | -------------- | ------ |
| `/login` | `Login.js` | Public |
| `/app/dashboard` | `Dashboard.js` | Admin only |
| `/app/admin/activity-log` | `ActivityLog.js` | Admin |
| `/app/admin/archive` | `ArchivePage.js` | Admin |
| `/app/hr/*` | HR pages | HR module + payroll routes |
| `/app/manufacturing/*` | Manufacturing pages | Manufacturing module |
| `/app/scm/*` | SCM pages | SCM module |
| `/app/crm/*` | CRM pages | CRM module |
| `/app/sales/*` | Sales pages | Sales module |
| `/app/inventory/*` | Inventory pages | Inventory module |
| `/app/purchasing/*` | Purchasing pages | Purchasing module |
| `/app/finance/*` | Finance pages | Finance module |

Non-admin users are redirected to their department homepage via `DashboardRedirect` and `ProtectedModuleRoute`.

### 5.2 Pages Summary

| Page | Renders |
| ---- | ------- |
| `Login.js` | Email/password form → `AuthContext.login()` |
| `Dashboard.js` | Admin KPI cards, sales revenue chart, recent activities |
| `HR/Dashboard.js` | HR module KPIs |
| `HR/Employees.js` | Employee list, add/edit modal |
| `HR/Attendance.js` | Check-in/out, HR correction mode |
| `HR/AttendanceReport.js` | Period attendance report table |
| `HR/Reports.js` | HR report generation/export |
| `HR/Payroll/PayrollList.js` | Payroll list, approve/recalculate |
| `HR/Payroll/PayrollRecordPage.js` | Single payroll detail / generate new |
| `Manufacturing/Dashboard.js` | Production KPIs |
| `Manufacturing/Orders.js` | Production order CRUD, start/complete |
| `Manufacturing/Reports.js` | Manufacturing reports |
| `SCM/Dashboard.js` | Supplier KPIs |
| `SCM/Suppliers.js` | Supplier CRUD |
| `SCM/Reports.js` | SCM reports |
| `CRM/Dashboard.js` | Customer/complaint overview |
| `CRM/Customers.js` | Customer cards, add/edit with address fields |
| `CRM/Complaints.js` | Complaint tickets |
| `CRM/Reports.js` | CRM reports |
| `Sales/Dashboard.js` | Sales revenue chart, order KPIs |
| `Sales/Orders.js` | Sales order workflow: create → confirm → deliver |
| `Sales/Reports.js` | Sales analytics |
| `Inventory/Dashboard.js` | Stock overview, low/out-of-stock counts |
| `Inventory/RawMaterials.js` | Raw material CRUD |
| `Inventory/FinishedProducts.js` | Final products + BOM |
| `Inventory/Reports.js` | Inventory reports |
| `Purchasing/Dashboard.js` | PO KPIs, spending chart |
| `Purchasing/Orders.js` | PO workflow: create → accept → receive → pay invoice |
| `Purchasing/Reports.js` | Purchasing reports |
| `Finance/Dashboard.js` | Finance KPIs, cash flow chart |
| `Finance/Transactions.js` | Unified invoice list + pay modal |
| `Finance/Bank.js` | Bank balance overview |
| `Finance/Expenses.js` | Expense list + pay manufacturing/pending expenses |
| `Finance/BankAccounts.js` | Bank account CRUD |
| `Admin/ActivityLog.js` | Audit log viewer |
| `Admin/Archive.js` | Archived documents, restore/permanent delete |

### 5.3 State Management

| Approach | Used For |
| -------- | -------- |
| **React Context** | `AuthContext` (user, login, logout), `ThemeContext` (dark mode) |
| **`useState` / `useEffect`** | All page-level data fetching and form state |
| **`useMemo`** | Chart data derivations (dashboards) |
| **No Redux** | Not present in dependencies |

### 5.4 API Calls from Frontend

```javascript
// AuthContext.js — global token setup
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Typical page pattern
const response = await axios.get('/api/crm/customers');
const response = await axios.post('/api/sales/orders', payload);
const response = await axios.put(`/api/purchasing/orders/${id}/receive`);
```

- Dev proxy in `client/package.json`: `"proxy": "http://localhost:5000"` — relative `/api/...` URLs work without hardcoding host.
- Errors surfaced via `react-hot-toast` (`toast.error`, `toast.success`).

### 5.5 Protected Routes

| Component | Checks |
| --------- | ------ |
| `ProtectedRoute.js` | User is logged in |
| `ProtectedModuleRoute.js` | User's department can access module (`permissions.js`) |
| `ProtectedDashboardRoute.js` | Manager or admin for module dashboard |
| `ProtectedPayrollRoute.js` | Admin or HR manager (`canAccessPayroll`) |

---

## 6. Design Patterns Used

| Pattern | Where | Why |
| ------- | ----- | --- |
| **MVC (loose)** | Routes → Controllers/Services → Models | Separates HTTP from business logic; payroll uses explicit controller |
| **Service Layer** | `services/*.js` | Complex logic (payroll, reports, archive) kept out of route handlers |
| **Repository-like (implicit)** | Mongoose models queried directly | Simplicity for graduation-scale project; no extra abstraction layer |
| **Soft Delete + Archive** | `archiveService.js` + `isDeleted` hook | Recoverable deletes; audit trail in `Archive` collection |
| **State Machine (workflow)** | PO: `pending`→`ordered`→`received`; SO: `pending`→`confirmed`→`delivered`; Payroll: `draft`→`approved`→`paid` | Clear business process stages |
| **Observer / Hook** | Mongoose `pre('save')`, `pre(/^find/)` | Auto hash passwords, hide deleted docs, compute attendance metrics |
| **Scheduler / Cron** | `schedulerService.js` | Automated low-stock purchase without manual intervention |
| **Polymorphic Reference** | `Transaction.sourceModel` + `refPath` | One transaction model for invoices and expenses |
| **React Context Provider** | `AuthContext`, `ThemeContext` | Global auth/theme without Redux |
| **HOC-like route guards** | `ProtectedRoute`, `ProtectedModuleRoute` | Reusable authorization wrappers |
| **Idempotent side effects** | `ensureInvoiceForPurchaseOrder` checks existing invoice | Prevents duplicate invoices per PO |
| **Partial Unique Index** | `Expense.referencePayrollId` | Uniqueness only when field is set; allows many manual expenses |

---

## 7. Data Flow

### 7.1 Login Flow

```
1. User enters email/password on Login.js
2. AuthContext.login() → POST /api/auth/login { email, password }
3. Server (auth.js):
   - User.findOne({ email }) with password field
   - Check user.isActive
   - comparePassword() via bcrypt
   - jwt.sign({ id }, JWT_SECRET)
4. Response: { token, user }
5. Client stores token in localStorage
6. axios.defaults.headers['Authorization'] = 'Bearer <token>'
7. GET /api/auth/me on next page load to restore session
8. ProtectedRoute allows access to /app/*
```

### 7.2 Sales Order → Production → Delivery

```
1. Sales user creates order on Sales/Orders.js
   → POST /api/sales/orders { customer, items[], ... }
   → SalesOrder created (status: pending)

2. User clicks Confirm
   → PUT /api/sales/orders/:id/confirm
   → If stock insufficient: auto-create ProductionOrder, link to SO
   → status: confirmed (or in-production)
   → Invoice created (Invoice model, linked to salesOrder)

3. Manufacturing completes production (if needed)
   → PUT /api/manufacturing/production-orders/:id/complete
   → Raw materials OUT, finished goods IN (InventoryTransaction)
   → Expense recorded (manufacturingCost, status: Pending Payment)

4. User clicks Deliver on sales order
   → PUT /api/sales/orders/:id/deliver
   → status: delivered
   → Stock deducted for sold items

5. Finance pays sales invoice
   → POST /api/finance/pay-invoice { invoiceId, invoiceModel: 'Invoice', bankAccountId }
   → Transaction (direction: in), bank balance increased
```

### 7.3 Purchase Order → Invoice → Payment

```
1. PO created manually or by scheduler (auto-purchase)
   → POST /api/purchasing/orders OR schedulerService.generateAutoPurchaseOrders()
   → PurchaseOrder (status: pending, autoGenerated: true/false)
   → NO invoice yet, NO finance transaction

2. Purchasing manager accepts PO
   → PUT /api/purchasing/orders/:id/order
   → status: ordered
   → ensureInvoiceForPurchaseOrder() → PurchaseInvoice (status: sent)

3. Purchasing employee receives goods
   → PUT /api/purchasing/orders/:id/receive
   → status: received, receivedDate set
   → Product.currentStock increased
   → InventoryTransaction (type: in, reference: purchase)

4. Finance pays invoice
   → POST /api/finance/pay-invoice { invoiceId, invoiceModel: 'PurchaseInvoice', bankAccountId }
   → Transaction (direction: out), bank balance decreased
```

### 7.4 Payroll Generation & Payment

```
1. HR manager generates payroll on PayrollRecordPage
   → POST /api/payroll/generate { periodYear, periodMonth }
   → payrollService reads Attendance + Employee.salary + SalesOrder (bonus)
   → PayrollRecord created (status: draft or needs_review if incomplete attendance)

2. HR approves (blocked if requiresRegeneration or incomplete attendance)
   → PATCH /api/payroll/approve/:id
   → status: approved

3. Finance pays from bank account
   → POST /api/finance/payroll/:id/pay { bankAccountId }
   → Expense (source: Payroll) + Transaction (out) + bank deducted
   → PayrollRecord.status: paid
```

---

## 8. Security

### Authentication

- Passwords hashed with **bcrypt** (cost 12) before save.
- JWT signed with `process.env.JWT_SECRET` from `config.env`.
- Inactive users (`isActive: false`) cannot login.
- Token sent on every request via `Authorization: Bearer` header.

### Authorization (RBAC)

**Roles:** `admin`, `manager`, `employee`

**Departments:** `HR`, `Manufacturing`, `SCM`, `CRM`, `Sales`, `Inventory`, `Purchasing`, `Finance`

| Layer | Mechanism |
| ----- | --------- |
| **Backend** | `protect` + `authorize*` middleware per route |
| **Frontend** | `permissions.js` helpers + route guard components |

**Examples:**
- Only **admin** sees main `/app/dashboard` and Activity Log.
- **HR manager** accesses payroll; other managers cannot (`canAccessPayroll`).
- **Purchasing employee** can create/receive POs; only **Purchasing manager** can accept.
- **Manufacturing staff** can start/complete production; only **Manufacturing manager** can assign/delete.
- **Finance bank account CRUD**: admin or Finance manager (`authorizeDepartment('Finance')`).

### Input Validation

- `express-validator` on POST/PUT bodies (email format, MongoId, phone regex via `phoneValidation.js`).
- Mongoose schema validators (required fields, enums, min/max).

### Data Protection

- Soft-deleted records hidden by default (`pre(/^find/)` on `isDeleted`).
- Archive stores full document snapshot before soft delete.
- Activity log records CREATE/UPDATE/DELETE/APPROVE with user and IP.

---

## 9. Key Technical Decisions

### Why MERN?

- **MongoDB** fits nested documents (order line items, BOM `requiredMaterials`, embedded addresses) without heavy joins.
- **Express** is lightweight and maps cleanly to REST modules matching ERP departments.
- **React** enables modular SPA pages per department with shared components (Layout, Card, charts).
- **Node.js** allows one language (JavaScript) across client and server — faster development for a graduation project.

### Why MongoDB over SQL?

- Order schemas vary (sales items, purchase items, production materials) — arrays embed naturally.
- Flexible schema evolution (e.g. adding `requiresRegeneration` to payroll without migrations).
- JSON-like documents align with React state and API responses.
- Trade-off accepted: fewer enforced relational constraints; uniqueness handled via Mongoose indexes.

### Why this folder structure?

- **One route file per module** mirrors ERP departments — easy to locate APIs.
- **Services** extracted only where logic is complex (payroll, reports, scheduler) — avoids over-engineering simple CRUD.
- **Frontend pages mirror backend modules** — `pages/Sales/`, `pages/HR/`, etc.
- **Shared HR Attendance page** reused across modules via `ConditionalAttendanceRoute` — DRY for check-in/out UI.

### Why JWT over sessions?

- Stateless API — no server-side session store needed.
- Works naturally with SPA + Axios interceptors.
- Scales to multiple API instances without shared session storage.

### Why Context instead of Redux?

- Moderate app size; most state is page-local (lists, forms, modals).
- Only auth and theme need global state — Context is sufficient and reduces boilerplate.

### Invoice timing for purchase orders

Purchase invoices are created when a PO is **accepted** (`PUT /orders/:id/order`), not at creation. This prevents pending/unapproved auto-POs from appearing in Finance before human review.

### Auto-purchase deduplication

Scheduler skips creating a new PO if the product already has an open PO (`status: pending` or `ordered`), preventing duplicate orders and invoices for the same low-stock material.

---

## Appendix: Environment Variables (`server/config.env`)

| Variable | Purpose |
| -------- | ------- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret |
| `PORT` | Server port (default 5000) |
| `TIMEZONE` | Cron scheduler timezone |
| Email vars | Used by `emailService.js` for report sending |

---

## Appendix: Running the Project

```bash
# Install all dependencies
npm run install-all

# Run client + server concurrently
npm run dev

# Server only
cd server && npm run dev

# Client only
cd client && npm start
```

- API: `http://localhost:5000`
- Client: `http://localhost:3000` (proxies `/api` to server)

---

*Generated from the erp-grad codebase. For per-collection schema details, see `DATABASE_DOCUMENTATION.md`.*
