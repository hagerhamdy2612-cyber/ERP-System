# Auto-Purchase When System Is Closed

The ERP server runs auto-purchase (low-stock → purchase orders) **every hour** while it is running. When the server is **stopped**, nothing runs. To keep auto-purchase working when the system is closed, run the standalone script on a schedule using your OS.

## 1. Run once (manual)

From the **project root**:

```bash
npm run auto-purchase
```

Or:

```bash
node server/scripts/runAutoPurchaseOrders.js
```

Ensure `server/config.env` has `MONGODB_URI` set so the script can connect to the database.

## 2. Schedule when the server is OFF

### Windows (Task Scheduler)

1. Open **Task Scheduler**.
2. Create Basic Task → name e.g. "ERP Auto-Purchase".
3. Trigger: **Daily** (or Weekly) → Repeat every **1 hour** for a duration of **Indefinitely**.
4. Action: **Start a program**  
   - Program: `node`  
   - Add arguments: `C:\Users\Asus\Desktop\erp-grad\server\scripts\runAutoPurchaseOrders.js`  
   - Start in: `C:\Users\Asus\Desktop\erp-grad`
5. Finish. Ensure the user account running the task has access to the project folder and Node.

(Adjust paths if your project is elsewhere.)

### Linux / Mac (cron)

Edit crontab:

```bash
crontab -e
```

Add (runs every hour at minute 0):

```cron
0 * * * * cd /path/to/erp-grad && node server/scripts/runAutoPurchaseOrders.js >> /var/log/erp-auto-purchase.log 2>&1
```

Replace `/path/to/erp-grad` with your project root.

## Note

- When the **server is running**, the built-in scheduler already runs auto-purchase every hour; you do **not** need to run this script for that.
- Use this script + OS schedule only when you want auto-purchase to run **while the ERP server is stopped**.
