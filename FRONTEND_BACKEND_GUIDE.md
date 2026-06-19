# Frontend ↔ Backend Communication Guide

This document explains how the React frontend talks to the Express/MongoDB backend, with a full **login** walkthrough, and which libraries power **Excel export**, **Arabic language**, and **dashboard charts**.

---

## 1. Architecture Overview

```
┌─────────────────────┐         HTTP (JSON)          ┌─────────────────────┐
│  React Client       │  ─────────────────────────►  │  Express API        │
│  (port 3000)        │  ◄─────────────────────────  │  (port 5000)        │
│                     │                              │                     │
│  • axios            │                              │  • JWT auth         │
│  • React Router     │                              │  • MongoDB/Mongoose │
│  • AuthContext      │                              │  • Route handlers   │
└─────────────────────┘                              └─────────────────────┘
```

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | React 18, React Router, Axios | UI, routing, API calls |
| Backend | Node.js, Express | REST API, business logic |
| Database | MongoDB + Mongoose | Data storage |
| Auth | JWT (`jsonwebtoken`) | Stateless login sessions |
| Dev proxy | CRA `"proxy"` in `client/package.json` | Forwards `/api/*` to backend during development |

---

## 2. How the Frontend Talks to the Backend

### 2.1 Development proxy

In development, the React app runs on **port 3000** and the API on **port 5000**. The client does not hard-code the full backend URL. Instead, Create React App proxies API requests:

```json
// client/package.json
"proxy": "http://localhost:5000"
```

So a frontend call like:

```javascript
axios.post('/api/auth/login', { email, password })
```

is sent to `http://localhost:5000/api/auth/login` automatically.

### 2.2 HTTP client: Axios

Every page/component imports Axios and calls REST endpoints with relative paths:

```javascript
import axios from 'axios';

// GET example
const response = await axios.get('/api/inventory/products');

// POST example
await axios.post('/api/sales/orders', orderData);

// PUT / DELETE examples
await axios.put(`/api/hr/employees/${id}`, data);
await axios.delete(`/api/crm/complaints/${id}`);
```

**Pattern:**
- Frontend sends **JSON** in the request body (`Content-Type: application/json` — Axios default).
- Backend responds with JSON: `{ success: true, data: ... }` or `{ success: false, message: '...' }`.
- Protected routes require a JWT in the `Authorization` header.

### 2.3 Authentication header (JWT)

After login, the token is stored and attached to **all** future Axios requests:

```javascript
// client/src/contexts/AuthContext.js
localStorage.setItem('token', token);
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

On the backend, the `protect` middleware reads that header:

```javascript
// server/middleware/auth.js
token = req.headers.authorization.split(' ')[1];  // "Bearer <token>"
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = await User.findById(decoded.id);
```

If the token is missing or invalid → `401 Not authorized`.

### 2.4 Route protection on the frontend

| Component | Purpose |
|-----------|---------|
| `AuthContext` | Holds `user`, `login()`, `logout()`, restores session from `localStorage` |
| `ProtectedRoute` | Redirects to `/login` if not authenticated |
| `ProtectedModuleRoute` | Restricts pages by department/role |
| `config/permissions.js` | Shared rules for what each role can see |

### 2.5 Typical request lifecycle

1. User action in React (button click, form submit, page load).
2. Component calls `axios.get/post/put/delete('/api/...')`.
3. Express route runs middleware (`protect`, `authorize`, validators).
4. Route handler queries MongoDB and returns JSON.
5. React updates state and re-renders the UI (often with `react-hot-toast` for feedback).

---

## 3. Login Example (End-to-End)

### Step 1 — User submits the login form

**File:** `client/src/pages/Login.js`

```javascript
const result = await login(formData.email, formData.password);
if (result.success) {
  navigate('/app/dashboard'); // or department-specific route
}
```

### Step 2 — AuthContext sends credentials to the API

**File:** `client/src/contexts/AuthContext.js`

```javascript
const login = async (email, password) => {
  const response = await axios.post('/api/auth/login', { email, password });
  const { token, user } = response.data;

  localStorage.setItem('token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  setUser(user);

  return { success: true, user };
};
```

**HTTP request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

### Step 3 — Backend validates and returns a JWT

**File:** `server/routes/auth.js`

1. Validate email/password with `express-validator`.
2. Find user in MongoDB (`User.findOne({ email })`).
3. Check `isActive` and compare password (`user.comparePassword`).
4. Log activity (`logActivity`).
5. Sign JWT with `jsonwebtoken` using `JWT_SECRET`.
6. Respond:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "department": "HR"
  }
}
```

### Step 4 — Session restore on page refresh

When the app loads, `AuthContext` checks `localStorage`:

```javascript
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  const response = await axios.get('/api/auth/me');  // GET /api/auth/me (protected)
  setUser(response.data.user);
}
```

### Step 5 — Subsequent API calls

Example: loading employees after login:

```javascript
// client/src/pages/HR/Employees.js
const response = await axios.get('/api/hr/employees');
// Header sent automatically: Authorization: Bearer <token>
```

### Login flow diagram

```
User (Login form)
    │  email + password
    ▼
AuthContext.login()
    │  POST /api/auth/login
    ▼
server/routes/auth.js
    │  verify user → generate JWT
    ▼
Response { token, user }
    │
    ├── localStorage.setItem('token', token)
    ├── axios.defaults.headers['Authorization'] = Bearer ...
    └── setUser(user) → React re-renders → navigate to dashboard
```

---

## 4. Excel File Export

### What we use

| Part | Library | Version (approx.) |
|------|---------|-------------------|
| **Backend** (generates `.xlsx`) | **[ExcelJS](https://github.com/exceljs/exceljs)** | `exceljs@^4.4.0` in `server/package.json` |
| **Frontend** (downloads file) | **Axios** with `responseType: 'blob'` + browser `Blob` / `<a download>` | — |

Excel export is **server-side**. The browser does not build the spreadsheet; it receives binary data and triggers a download.

### Backend flow

1. **Module reports:** `GET /api/reports/export/:type?startDate=&endDate=`
   - **File:** `server/routes/reports.js`
   - Fetches data via `server/services/reportService.js`
   - Builds workbook with `new ExcelJS.Workbook()`
   - Sets headers and streams file:

```javascript
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
await workbook.xlsx.write(res);
```

2. **Activity log export:** `GET /api/activity-logs/export`
   - **File:** `server/routes/activityLogs.js`
   - Same ExcelJS pattern, admin-only.

3. **Email reports (optional):** `server/services/reportSender.js` uses `workbook.xlsx.writeBuffer()` to attach Excel to emails.

**Supported report types:** `sales`, `purchasing`, `inventory`, `manufacturing`, `crm`, `scm`, `hr`.

### Frontend download pattern

**Example:** `client/src/pages/HR/Reports.js`

```javascript
const response = await axios.get(
  `/api/reports/export/hr?startDate=${startDate}&endDate=${endDate}`,
  { responseType: 'blob' }   // important: receive binary, not JSON
);

const url = window.URL.createObjectURL(new Blob([response.data]));
const link = document.createElement('a');
link.href = url;
link.setAttribute('download', `hr-report-${startDate}-to-${endDate}.xlsx`);
link.click();
window.URL.revokeObjectURL(url);
```

Same pattern is used in: `HR/Reports.js`, `Sales/Reports.js`, `Purchasing/Reports.js`, `Inventory/Reports.js`, `Manufacturing/Reports.js`, `CRM/Reports.js`, `SCM/Reports.js`, and `Admin/ActivityLog.js`.

---

## 5. Arabic Language Support

### What we use

| Library | Purpose |
|---------|---------|
| **[i18next](https://www.i18next.com/)** | Core internationalization engine |
| **[react-i18next](https://react.i18next.com/)** | React hooks (`useTranslation`, `t()`) |
| **[i18next-browser-languagedetector](https://github.com/i18next/i18next-browser-languageDetector)** | Detect/save language from browser or `localStorage` |

**Translation files:**
- `client/src/i18n/locales/en.json` — English
- `client/src/i18n/locales/ar.json` — Arabic

**Configuration:** `client/src/i18n/config.js` (loaded in `client/src/index.js`).

### How it works

1. **Init** — i18next loads both language JSON files and sets fallback to `en`.
2. **Detection** — Language stored in `localStorage` under key `i18nextLng`.
3. **In components** — wrap text with the `t()` function:

```javascript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <h1>{t('hr.dashboard.title')}</h1>;
```

4. **Language switcher** — `client/src/components/LanguageSwitcher.js`:

```javascript
i18n.changeLanguage('ar');
document.documentElement.dir = 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = lng;
```

5. **RTL layout** — `client/src/index.css` contains `[dir="rtl"]` rules (flip margins, text alignment, flex direction) so Arabic reads right-to-left.

6. **Locale-aware formatting** — Charts and dates use `ar-EG` when Arabic is active:

```javascript
const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';
new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
```

---

## 6. Charts in Dashboards

### What we use

| Library | Purpose |
|---------|---------|
| **[Recharts](https://recharts.org/)** | React chart components (`LineChart`, `BarChart`, `PieChart`, etc.) |
| **lucide-react** | Icons next to chart titles/cards (not the chart engine itself) |
| **Axios** | Fetches chart data from API endpoints |

**Package:** `recharts@^2.8.0` in `client/package.json`.

### Where charts appear

| Dashboard / Component | Chart type | Data source |
|----------------------|------------|-------------|
| `pages/Sales/Dashboard.js` | Line chart (revenue over time) | `GET /api/sales/orders` |
| `pages/Inventory/Dashboard.js` | Pie chart (stock by category) | `GET /api/inventory/products` |
| `pages/Manufacturing/Dashboard.js` | Pie chart (completion rate) | Manufacturing orders API |
| `pages/Purchasing/Dashboard.js` | Bar/line charts (spending) | `GET /api/purchasing/spending`, orders |
| `pages/HR/Dashboard.js` | Charts for attendance/stats | HR APIs |
| `pages/Dashboard.js` | Admin overview charts | Multiple module APIs |
| `components/Finance/CashFlowChart.js` | Line chart | `GET /api/finance/cash-flow?period=` |
| `components/Finance/ExpensesPieChart.js` | Pie chart | `GET /api/finance/expenses` |
| `pages/Finance/Dashboard.js` | Embeds Finance chart components | — |

### Typical Recharts pattern

```javascript
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
  </LineChart>
</ResponsiveContainer>
```

**Flow:**
1. Dashboard `useEffect` loads data with Axios.
2. Raw API data is transformed into an array Recharts understands (e.g. `{ date, revenue }`).
3. Recharts renders SVG charts inside `ResponsiveContainer`.
4. Tooltips/labels use `t()` for translated text and `Intl` for locale-aware numbers.

---

## 7. Quick Reference — Key Files

| Topic | Frontend | Backend |
|-------|----------|---------|
| Login | `contexts/AuthContext.js`, `pages/Login.js` | `routes/auth.js`, `middleware/auth.js` |
| API proxy | `client/package.json` (`proxy`) | `server/index.js` (route mounting) |
| Excel export | `pages/*/Reports.js`, `Admin/ActivityLog.js` | `routes/reports.js`, `services/reportService.js`, `routes/activityLogs.js` |
| Arabic / i18n | `i18n/config.js`, `locales/*.json`, `LanguageSwitcher.js`, `index.css` | — (UI-only) |
| Charts | `pages/*/Dashboard.js`, `components/Finance/*Chart.js` | Various `GET /api/...` endpoints |

---

## 8. Running Both Apps

From project root:

```bash
npm run dev
```

This runs **concurrently**:
- Backend: `cd server && npm run dev` (port 5000)
- Frontend: `cd client && npm start` (port 3000)

The React dev server proxies `/api` requests to Express, so the frontend and backend work together without CORS issues in development.
