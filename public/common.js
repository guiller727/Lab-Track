// ================== common.js: helpers used by every page ==================
const $ = (id) => document.getElementById(id);   // short for document.getElementById

const IDLE_LIMIT_MS = 60 * 60 * 1000;            // auto logout after 1 hour of no activity

// Tabs each role sees. The FIRST tab is the page they land on after logging in.
const NAV = {
  admin: [["Dashboard", "dashboard.html"], ["Equipment", "index.html"], ["Requests", "requests.html"]],
  student: [["Equipment", "index.html"], ["Requests", "requests.html"], ["History", "history.html"]],
};

// ---------- Session ----------
// sessionStorage is wiped automatically when the tab or browser is closed.
function getToken() { return sessionStorage.getItem("token"); }
function getUser() {
  try { return JSON.parse(sessionStorage.getItem("user")); } catch { return null; }
}
function logout(reason) {
  sessionStorage.clear();
  window.location.href = "login.html" + (reason === "idle" ? "?reason=idle" : "");
}

// fetch() that sends the login token and returns the JSON (or throws the server's message).
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken(), ...(options.headers || {}) },
  });
  if (response.status === 401 && getToken()) { logout(); throw new Error("Please log in."); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Request failed");
  return result;
}

// ---------- Auto logout when idle ----------
function touchActivity() { sessionStorage.setItem("lastActive", String(Date.now())); }
function checkIdle() {
  const last = Number(sessionStorage.getItem("lastActive")) || Date.now();
  if (getToken() && Date.now() - last > IDLE_LIMIT_MS) logout("idle");
}
if (getToken()) {
  checkIdle();
  touchActivity();
  ["click", "keydown", "touchstart", "mousemove", "scroll"].forEach((eventName) =>
    window.addEventListener(eventName, touchActivity, { passive: true }));
  setInterval(checkIdle, 30000);   // check every 30 seconds
}

// ---------- Page setup (call this first on every page except login) ----------
function setupPage() {
  const user = getUser();
  if (!getToken() || !user) {
    logout();
    throw new Error("Not logged in");          // throwing stops the rest of this page's script
  }
  const tabs = NAV[user.role];
  const here = window.location.pathname.split("/").pop() || "index.html";
  if (!tabs.some((tab) => tab[1] === here)) {  // e.g. a student opening dashboard.html
    window.location.href = tabs[0][1];
    throw new Error("Wrong page for this role");
  }

  // Header: brand | tabs (centered) | user box. Only fixed text goes in here.
  $("header").innerHTML = `
    <h1 class="brand">LabTrack</h1>
    <nav>${tabs.map(([label, file]) => `<a href="${file}"${file === here ? ' class="current"' : ""}>${label}</a>`).join("")}</nav>
    <div class="userbox">
      <span id="userName"></span>
      <span class="role" id="userRole"></span>
      <button type="button" id="logoutBtn">Log out</button>
    </div>`;
  $("userName").textContent = user.name;       // textContent keeps names safe
  $("userRole").textContent = user.role === "admin" ? "Admin" : "Student";
  $("logoutBtn").addEventListener("click", () => logout());
  return user;
}

// ---------- Small UI helpers ----------
function say(text, type) {                     // shows a message in <p id="msg">
  $("msg").textContent = text;
  $("msg").className = "msg " + (type || "");
}

function makeButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function addCell(row, label, text) {           // label is shown on phones
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function addBadge(row, label, cssClass, text) {
  const cell = addCell(row, label, "");
  const badge = document.createElement("span");
  badge.className = "badge " + cssClass;
  badge.textContent = text;
  cell.appendChild(badge);
}

function showEmpty(tbody, columns, text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.className = "empty";
  cell.colSpan = columns;
  cell.textContent = text;
  row.appendChild(cell);
  tbody.appendChild(row);
}

// Paging: draws "Previous | Page 1 of 3 | Next" inside <div id="pager">.
// goToPage is the function that loads a page number.
function showPager(data, goToPage) {
  const pager = $("pager");
  pager.replaceChildren();
  if (data.pages <= 1) return;                 // one page only: no buttons needed
  const previous = makeButton("« Previous", "", () => goToPage(data.page - 1));
  const next = makeButton("Next »", "", () => goToPage(data.page + 1));
  previous.disabled = data.page <= 1;
  next.disabled = data.page >= data.pages;
  const info = document.createElement("span");
  info.textContent = "Page " + data.page + " of " + data.pages;
  pager.append(previous, info, next);
}
