// ================== LabTrack server (Node.js + Express + MySQL) ==================
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.json());                                      // read JSON sent by the browser
app.use(express.static(path.join(__dirname, "public")));      // serve the website files

const SECRET = process.env.JWT_SECRET || "change-this-secret-before-defense";
const PER_PAGE = 10;                                          // rows per page

// Works on your computer AND on Railway (Railway gives MYSQLHOST, MYSQLUSER, ... variables).
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
  port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
  user: process.env.DB_USER || process.env.MYSQLUSER || "root",
  password: process.env.DB_PASS || process.env.MYSQLPASSWORD || "password", // local default. Remove before pushing to GitHub!
  database: process.env.DB_NAME || "labtrack",
});

// ---------- Small helpers ----------
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Wraps a route so any error becomes a JSON reply instead of crashing the server.
const wrap = (route) => (req, res) =>
  route(req, res).catch((err) => {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Server error. Check the terminal." });
  });

// Must be logged in: reads the token sent by the browser.
function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please log in." });
  try {
    req.user = jwt.verify(token, SECRET);   // { id, name, role }
    next();
  } catch {
    res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

// Must be an admin (this is the REAL security; hiding buttons is not enough).
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Administrators only." });
  next();
}

// Runs several queries as ONE all-or-nothing transaction.
async function inTransaction(work) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await work(db);
    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  } finally {
    db.release();
  }
}

// ---------- Login / register ----------
app.post("/api/auth/register", wrap(async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ message: "All fields are required." });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

  const [existing] = await pool.execute("SELECT user_id FROM users WHERE username = ?", [username.trim()]);
  if (existing.length > 0) return res.status(409).json({ message: "Username is already taken." });

  const hash = await bcrypt.hash(password, 10);   // never store the plain password
  await pool.execute("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'student')",
    [name.trim(), username.trim(), hash]);          // public sign-up is always a STUDENT
  res.status(201).json({ message: "Account created. You can log in now." });
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [(username || "").trim()]);
  const user = rows[0];
  const passwordOk = user && (await bcrypt.compare(password || "", user.password_hash));
  if (!passwordOk) return res.status(401).json({ message: "Wrong username or password." });
  if (user.account_status !== "active") return res.status(403).json({ message: "This account is deactivated." });

  const token = jwt.sign({ id: user.user_id, name: user.name, role: user.role }, SECRET, { expiresIn: "8h" });
  res.json({ token, user: { id: user.user_id, name: user.name, role: user.role } });
}));

// ---------- Equipment ----------
function checkEquipment(b) {
  const total = Number(b.total_quantity);
  const available = Number(b.available_quantity);
  if (!b.name || !b.name.trim()) return "Name is required.";
  if (!b.category || !b.category.trim()) return "Category is required.";
  if (!Number.isInteger(total) || total < 0) return "Total quantity must be 0 or more.";
  if (!Number.isInteger(available) || available < 0) return "Available quantity must be 0 or more.";
  if (available > total) return "Available cannot be more than total.";
  return null;   // null = no problem
}
const equipmentValues = (b) => [
  b.name.trim(), b.category.trim(), (b.description || "").trim(), (b.location || "").trim(),
  Number(b.total_quantity), Number(b.available_quantity), b.item_condition || "Good",
];

// Anyone logged in can view. Optional filters: ?search=...&category=...
app.get("/api/equipment", requireLogin, wrap(async (req, res) => {
  let sql = "SELECT * FROM equipment WHERE status = 'active'";
  const params = [];
  if (req.query.search) { sql += " AND name LIKE ?"; params.push("%" + req.query.search + "%"); }
  if (req.query.category) { sql += " AND category = ?"; params.push(req.query.category); }
  const [rows] = await pool.execute(sql + " ORDER BY category, name", params);
  res.json(rows);
}));

app.get("/api/equipment-categories", requireLogin, wrap(async (req, res) => {
  const [rows] = await pool.execute("SELECT DISTINCT category FROM equipment WHERE status = 'active' ORDER BY category");
  res.json(rows.map((r) => r.category));
}));

app.get("/api/equipment/:id", requireLogin, wrap(async (req, res) => {
  const [rows] = await pool.execute("SELECT * FROM equipment WHERE equipment_id = ?", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: "Equipment not found." });
  res.json(rows[0]);
}));

// Only admins can add, edit or archive.
app.post("/api/equipment", requireLogin, requireAdmin, wrap(async (req, res) => {
  const problem = checkEquipment(req.body);
  if (problem) return res.status(400).json({ message: problem });
  const [result] = await pool.execute(
    `INSERT INTO equipment (name, category, description, location, total_quantity, available_quantity, item_condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, equipmentValues(req.body));
  res.status(201).json({ message: "Equipment added.", equipment_id: result.insertId });
}));

app.put("/api/equipment/:id", requireLogin, requireAdmin, wrap(async (req, res) => {
  const problem = checkEquipment(req.body);
  if (problem) return res.status(400).json({ message: problem });
  const [result] = await pool.execute(
    `UPDATE equipment SET name=?, category=?, description=?, location=?, total_quantity=?,
     available_quantity=?, item_condition=? WHERE equipment_id=?`, [...equipmentValues(req.body), req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: "Equipment not found." });
  res.json({ message: "Equipment updated." });
}));

// "Delete" = archive, so old requests still point to a real record.
app.delete("/api/equipment/:id", requireLogin, requireAdmin, wrap(async (req, res) => {
  const [result] = await pool.execute("UPDATE equipment SET status = 'archived' WHERE equipment_id = ?", [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: "Equipment not found." });
  res.json({ message: "Equipment archived." });
}));

// ---------- Borrow requests ----------
// Statuses: pending -> approved -> returned   (or approved -> damaged -> resolved)
//           pending -> rejected

// Reused by the list and history routes (joins names from the other tables).
const REQUEST_SELECT = `SELECT r.request_id, r.quantity, r.status, r.reason,
    DATE_FORMAT(r.needed_until, '%Y-%m-%d') AS needed_until,
    DATE_FORMAT(r.request_date, '%Y-%m-%d') AS request_date,
    u.name AS user_name, e.name AS equipment_name
  FROM borrow_requests r
  JOIN users u ON u.user_id = r.user_id
  JOIN equipment e ON e.equipment_id = r.equipment_id`;

// Sends ONE page (10 rows) of the requests that match "where".
async function sendPage(req, res, where, params) {
  const [[count]] = await pool.execute(`SELECT COUNT(*) AS n FROM borrow_requests r WHERE ${where}`, params);
  const total = Number(count.n);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  const offset = (page - 1) * PER_PAGE;
  const [rows] = await pool.execute(
    `${REQUEST_SELECT} WHERE ${where} ORDER BY r.request_id DESC LIMIT ${PER_PAGE} OFFSET ${offset}`, params);
  res.json({ rows, page, pages, total });
}

// Student submits a request.
app.post("/api/borrow-requests", requireLogin, wrap(async (req, res) => {
  const equipmentId = Number(req.body.equipment_id);
  const quantity = Number(req.body.quantity);
  const neededUntil = req.body.needed_until;
  const reason = (req.body.reason || "").trim();
  const today = new Date().toISOString().slice(0, 10);

  if (!reason) return res.status(400).json({ message: "Please give a reason for the request." });
  if (reason.length > 255) return res.status(400).json({ message: "Reason is too long (max 255 characters)." });
  if (!Number.isInteger(equipmentId)) return res.status(400).json({ message: "Pick an equipment item." });
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: "Quantity must be at least 1." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neededUntil || "") || neededUntil < today)
    return res.status(400).json({ message: "Choose a return date that is today or later." });

  const [rows] = await pool.execute("SELECT * FROM equipment WHERE equipment_id = ? AND status = 'active'", [equipmentId]);
  if (rows.length === 0) return res.status(404).json({ message: "Equipment not found." });
  if (quantity > rows[0].available_quantity)
    return res.status(400).json({ message: "Only " + rows[0].available_quantity + " available right now." });

  await pool.execute(
    "INSERT INTO borrow_requests (user_id, equipment_id, quantity, needed_until, reason) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, equipmentId, quantity, neededUntil, reason]);
  res.status(201).json({ message: "Request sent! An admin will review it." });
}));

// "Requests" tab. Admin: all unfinished requests. Student: their own unfinished ones.
app.get("/api/borrow-requests", requireLogin, wrap(async (req, res) => {
  if (req.user.role === "admin")
    return sendPage(req, res, "r.status IN ('pending','approved','damaged')", []);
  return sendPage(req, res, "r.user_id = ? AND r.status NOT IN ('returned','resolved')", [req.user.id]);
}));

// History. Admin (Dashboard): all finished requests. Student: their successful borrows.
app.get("/api/borrow-requests/history", requireLogin, wrap(async (req, res) => {
  if (req.user.role === "admin")
    return sendPage(req, res, "r.status IN ('returned','rejected','resolved')", []);
  return sendPage(req, res, "r.user_id = ? AND r.status IN ('returned','resolved')", [req.user.id]);
}));

// --- Admin actions. They use "lockRequest" so two admins can't change the same request at once.
async function lockRequest(db, id, expectedStatus) {
  const [rows] = await db.execute("SELECT * FROM borrow_requests WHERE request_id = ? FOR UPDATE", [id]);
  if (rows.length === 0) throw httpError(404, "Request not found.");
  if (rows[0].status !== expectedStatus) throw httpError(409, "This request is not " + expectedStatus + ".");
  return rows[0];
}
function giveBackStock(db, r) {   // never goes above the total quantity
  return db.execute(
    "UPDATE equipment SET available_quantity = LEAST(total_quantity, available_quantity + ?) WHERE equipment_id = ?",
    [r.quantity, r.equipment_id]);
}

// Approve: take the units out of stock AND mark approved (both succeed or both fail).
app.patch("/api/borrow-requests/:id/approve", requireLogin, requireAdmin, wrap(async (req, res) => {
  await inTransaction(async (db) => {
    const r = await lockRequest(db, req.params.id, "pending");
    const [stock] = await db.execute(
      "UPDATE equipment SET available_quantity = available_quantity - ? WHERE equipment_id = ? AND available_quantity >= ?",
      [r.quantity, r.equipment_id, r.quantity]);
    if (stock.affectedRows === 0) throw httpError(409, "Not enough units available to approve this.");
    await db.execute("UPDATE borrow_requests SET status = 'approved', processed_by = ? WHERE request_id = ?",
      [req.user.id, req.params.id]);
  });
  res.json({ message: "Request approved." });
}));

app.patch("/api/borrow-requests/:id/reject", requireLogin, requireAdmin, wrap(async (req, res) => {
  const [result] = await pool.execute(
    "UPDATE borrow_requests SET status = 'rejected', processed_by = ? WHERE request_id = ? AND status = 'pending'",
    [req.user.id, req.params.id]);
  if (result.affectedRows === 0) return res.status(409).json({ message: "Only pending requests can be rejected." });
  res.json({ message: "Request rejected." });
}));

// Return: good = units go back to stock. damaged = units stay out until "resolve".
app.patch("/api/borrow-requests/:id/return", requireLogin, requireAdmin, wrap(async (req, res) => {
  const damaged = req.body.condition === "damaged";
  await inTransaction(async (db) => {
    const r = await lockRequest(db, req.params.id, "approved");
    if (damaged) {
      await db.execute("UPDATE borrow_requests SET status = 'damaged' WHERE request_id = ?", [req.params.id]);
    } else {
      await giveBackStock(db, r);
      await db.execute("UPDATE borrow_requests SET status = 'returned' WHERE request_id = ?", [req.params.id]);
    }
  });
  res.json({ message: damaged ? "Returned as damaged. Mark it resolved once handled." : "Marked as returned." });
}));

// Resolve a damaged return (repaired or replaced): units go back to stock.
app.patch("/api/borrow-requests/:id/resolve", requireLogin, requireAdmin, wrap(async (req, res) => {
  await inTransaction(async (db) => {
    const r = await lockRequest(db, req.params.id, "damaged");
    await giveBackStock(db, r);
    await db.execute("UPDATE borrow_requests SET status = 'resolved' WHERE request_id = ?", [req.params.id]);
  });
  res.json({ message: "Marked as resolved." });
}));

// ---------- Dashboard (admin) ----------
app.get("/api/dashboard/summary", requireLogin, requireAdmin, wrap(async (req, res) => {
  const [rows] = await pool.execute("SELECT status, COUNT(*) AS n FROM borrow_requests GROUP BY status");
  const count = {};
  rows.forEach((r) => { count[r.status] = Number(r.n); });
  const n = (status) => count[status] || 0;

  const [stock] = await pool.execute(
    "SELECT COALESCE(SUM(total_quantity),0) AS total, COALESCE(SUM(available_quantity),0) AS available FROM equipment WHERE status = 'active'");
  res.json({
    total_requests: Object.values(count).reduce((a, b) => a + b, 0),
    pending: n("pending"),
    currently_borrowed: n("approved"),
    times_borrowed: n("approved") + n("returned") + n("damaged") + n("resolved"),
    damaged: n("damaged"),
    resolved: n("resolved"),
    equipment_total: Number(stock[0].total),
    equipment_available: Number(stock[0].available),
  });
}));

// ---------- Start ----------
// First run only: create one admin and one student so you can log in.
async function createDemoUsers() {
  const [rows] = await pool.execute("SELECT COUNT(*) AS n FROM users");
  if (rows[0].n > 0) return;
  const demo = [
    ["Lab Administrator", "admin", "admin123", "admin"],
    ["Sample Student", "student", "student123", "student"],
  ];
  for (const [name, username, password, role] of demo) {
    await pool.execute("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, username, await bcrypt.hash(password, 10), role]);
  }
  console.log("Demo accounts created: admin / admin123  and  student / student123");
}

const PORT = process.env.PORT || 3000;
createDemoUsers()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`LabTrack running on http://localhost:${PORT}`)))
  .catch((err) => { console.error("Cannot connect to MySQL:", err.message); process.exit(1); });
