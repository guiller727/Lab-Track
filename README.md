# LabTrack – Laboratory Equipment Management

Node.js + Express + MySQL, plain HTML / CSS / JavaScript (no frameworks on the frontend).

## 1. Install first
- Node.js 18 or newer: https://nodejs.org
- MySQL Server (or XAMPP / MySQL Workbench)

## 2. Create the database
Start MySQL, then run `schema.sql` once:

    mysql -u root -p < schema.sql

(or in MySQL Workbench: File > Open SQL Script > schema.sql > lightning bolt).

## 3. Start the website
Open a terminal inside the `labtrack` folder:

    npm install
    npm start

The database password defaults to `password` (see the top of `server.js`).
Different password? PowerShell: `$env:DB_PASS="other"; npm start`   Mac/Linux: `DB_PASS=other npm start`
Before pushing to GitHub, change that default in `server.js` back to `""`.

You should see `LabTrack running on http://localhost:3000`.

## 4. Open it
Go to http://localhost:3000

| Role    | Username | Password   |
|---------|----------|------------|
| Admin   | admin    | admin123   |
| Student | student  | student123 |

New students can use the "Student sign up" tab (sign-ups are always students).

## 5. Test on your phone
Phone and computer on the same Wi-Fi. Find your computer's IP (`ipconfig` / `ifconfig`),
then open `http://<that-ip>:3000` on the phone. Allow Node.js through the firewall if asked.

## Pages
| Page | Who | What it does |
|------|-----|--------------|
| Dashboard | Admin (landing page) | Stat cards + history of finished requests, 10 per page |
| Equipment | Both | Search, filter by category. Admin adds/edits/archives. Student taps Request |
| Requests | Both | Admin: approve / reject / mark returned (good or damaged) / resolve. Student: their open requests. 10 per page |
| History | Student | Their successfully returned borrows, 10 per page |

Logout happens automatically after 1 hour of no activity (`IDLE_LIMIT_MS` in `public/common.js`)
and when the tab or browser is closed.

## Borrowing flow
1. Student taps **Request** on an item, gives quantity, return date and a reason.
2. Admin opens **Requests** and approves or rejects. Approving reduces the available quantity.
3. When it comes back, admin taps **Mark returned** and chooses **Good** or **Damaged**.
   - Good: units go back to stock, request moves to history.
   - Damaged: units stay out of stock until the admin taps **Mark resolved**.

## Files
    server.js          all API routes (login, equipment, requests, dashboard)
    schema.sql         the 3 database tables
    public/
      common.js        helpers shared by all pages (login session, header, tables, paging)
      style.css        all styling
      login.html/.js
      index.html + equipment.js     (Equipment page)
      requests.html/.js
      history.html/.js              (student)
      dashboard.html/.js            (admin)

## Defense notes
- Passwords are saved as bcrypt hashes, never plain text.
- Admin-only routes use `requireAdmin` in `server.js`, so hiding buttons is not the only protection.
- Approve / return / resolve use a database transaction: stock and status change together or not at all.
- Student request history uses the same code path as the admin history; only the SQL `WHERE` differs.
- Test with Postman: POST /api/auth/login, copy the token, then send `Authorization: Bearer <token>`.

## Deploying to Railway
1. Push the project to GitHub (`node_modules` is already ignored by `.gitignore`).
2. Railway: **New Project > Deploy from GitHub repo** (pick this repo).
3. In the same project: **+ New > Database > MySQL**.
4. Open your app service > **Variables** and add these (use "Add reference" to the MySQL service):
   `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, plus your own `JWT_SECRET` (any long random text).
5. Create the tables once: run `schema.sql` against the Railway MySQL (Workbench or the `mysql` command, using the
   public connection details from the MySQL service). It creates a database named `labtrack`, which the app uses by default.
6. App service > **Settings > Networking > Generate Domain**, then open the link.
7. Log in as admin, and change the demo passwords (or delete the demo users) before sharing the link.
