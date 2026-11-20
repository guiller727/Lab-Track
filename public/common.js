// ================== common.js: helpers used by every page ==================
const $ = (id) => document.getElementById(id);   // short for document.getElementById

const IDLE_LIMIT_MS = 60 * 60 * 1000;            // auto logout after 1 hour of no activity

// Small line icons (drawn with SVG, no image files needed)
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  equipment: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',
  requests: '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  history: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  repeat: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// Tabs each role sees: [label, file, icon]. The FIRST tab is the page they land on after logging in.
const NAV = {
  admin: [["Dashboard", "dashboard.html", "dashboard"], ["Equipment", "index.html", "equipment"], ["Requests", "requests.html", "requests"]],
  student: [["Equipment", "index.html", "equipment"], ["Requests", "requests.html", "requests"], ["History", "history.html", "history"]],
};

// ---------- Not logged in? Leave BEFORE the page is drawn (this file loads in <head>) ----------
const ON_LOGIN_PAGE = ["/", "/login.html"].includes(window.location.pathname);
if (!ON_LOGIN_PAGE && !sessionStorage.getItem("token")) window.location.replace("/login.html");

// ---------- Session ----------
// sessionStorage is wiped automatically when the tab or browser is closed.
function getToken() { return sessionStorage.getItem("token"); }
function getUser() {
  try { return JSON.parse(sessionStorage.getItem("user")); } catch { return null; }
}
function logout(reason) {
  sessionStorage.clear();
  window.location.href = "/login.html" + (reason === "idle" ? "?reason=idle" : "");
}

// fetch() that sends the login token and returns the JSON (or throws the server's message).
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken(), ...(options.headers || {}) },
  });
  if (response.status === 401 && getToken()) { logout(); throw new Error("Please log in."); }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || "Request failed");
    error.status = response.status;   // e.g. 409 = already exists
    throw error;
  }
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
// Draws the top bar (logo + tabs + user + log out).
function setupPage() {
  const user = getUser();
  if (!getToken() || !user) {
    logout();
    throw new Error("Not logged in");          // throwing stops the rest of this page's script
  }
  const tabs = NAV[user.role];
  const here = window.location.pathname.split("/").pop() || "index.html";
  const current = tabs.find((tab) => tab[1] === here);
  if (!current) {                              // e.g. a student opening dashboard.html
    window.location.href = tabs[0][1];
    throw new Error("Wrong page for this role");
  }

  // Top bar: logo | tabs | user + log out. Only fixed text goes into innerHTML. Names are added with textContent below.
  $("topbar").innerHTML = `
    <div class="topbar-brand"><img class="brand-logo" src="/images/logo.webp" alt="University of Perpetual Help System logo"><strong>LabTrack</strong></div>
    <nav class="topnav">
      ${tabs.map(([label, file, ic]) =>
        `<a class="nav-link${file === here ? " active" : ""}" href="${file}"${file === here ? ' aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("")}
    </nav>
    <div class="user-chip">
      <div class="avatar" id="userInitial"></div>
      <div class="user-meta"><strong id="userName"></strong><span id="userRole"></span></div>
      <button type="button" class="btn btn-outline btn-sm" id="logoutBtn">${icon("logout")}<span>Log out</span></button>
    </div>`;
  $("userName").textContent = user.name;       // textContent keeps names safe
  $("userInitial").textContent = (user.name || "?").trim().charAt(0).toUpperCase();
  $("userRole").textContent = user.role === "admin" ? "Administrator" : "Student";
  $("logoutBtn").addEventListener("click", () => logout());

  document.body.classList.add("ready");     // login is confirmed: now show the page
  return user;
}

// ---------- Small UI helpers ----------
function say(text, type, boxId = "msg") {      // shows a message in <p id="msg"> (or another box)
  $(boxId).textContent = text;
  $(boxId).className = "msg " + (type || "");
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
  if (label) cell.dataset.label = label;
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
  return cell;
}

// "8 / 10" with a small bar under it (green, amber when low, red when none left).
function addQtyCell(row, label, item) {
  const cell = addCell(row, label, "");
  const box = document.createElement("div");
  box.className = "qty";
  const text = document.createElement("b");
  text.textContent = item.available_quantity + " ";
  const ofTotal = document.createElement("small");
  ofTotal.textContent = "of " + item.total_quantity;
  text.appendChild(ofTotal);
  const percent = item.total_quantity > 0 ? Math.round((item.available_quantity / item.total_quantity) * 100) : 0;
  const bar = document.createElement("div");
  bar.className = "qty-bar" + (item.available_quantity === 0 ? " none" : percent <= 30 ? " low" : "");
  const fill = document.createElement("span");
  fill.style.width = percent + "%";
  bar.appendChild(fill);
  box.append(text, bar);
  cell.appendChild(box);
  return cell;
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

// Paging: draws "Showing 1–10 of 25   ‹ Prev 1 2 3 Next ›" inside <div id="pager">.
// data = { page, pages, total } from the server. goToPage loads a page number.
const PER_PAGE = 10;
function showPager(data, goToPage, pagerId = "pager") {
  const pager = $(pagerId);
  pager.replaceChildren();
  pager.hidden = data.total === 0;
  if (data.total === 0) return;

  const from = (data.page - 1) * PER_PAGE + 1;
  const to = Math.min(data.total, data.page * PER_PAGE);
  const info = document.createElement("span");
  info.className = "pager-info";
  info.textContent = `Showing ${from}–${to} of ${data.total}`;

  const buttons = document.createElement("div");
  buttons.className = "pager-btns";
  const add = (text, page, disabled, active) => {
    const b = makeButton(text, "pager-btn" + (active ? " active" : ""), () => goToPage(page));
    b.disabled = disabled;
    if (active) b.setAttribute("aria-current", "page");
    buttons.appendChild(b);
  };
  add("‹ Prev", data.page - 1, data.page <= 1);
  // Page numbers: first, last, and the ones next to the current page (… for the gaps)
  let last = 0;
  for (let n = 1; n <= data.pages; n++) {
    if (n !== 1 && n !== data.pages && Math.abs(n - data.page) > 1) continue;
    if (n - last > 1) {
      const gap = document.createElement("span");
      gap.className = "pager-gap";
      gap.textContent = "…";
      buttons.appendChild(gap);
    }
    add(String(n), n, false, n === data.page);
    last = n;
  }
  add("Next ›", data.page + 1, data.page >= data.pages);
  pager.append(info, buttons);
}

// Fills a category <select> (keeps the current choice if it still exists).
async function loadCategoryOptions(selectId) {
  try {
    const categories = await api("/api/equipment-categories");
    const select = $(selectId);
    const chosen = select.value;
    select.replaceChildren(new Option("All categories", ""));
    categories.forEach((category) => select.appendChild(new Option(category, category)));
    select.value = categories.includes(chosen) ? chosen : "";
    return categories;
  } catch (error) { console.error(error); return []; }
}

// Waits until the user stops typing before running "work" (for search boxes).
function whenTypingStops(work, ms = 300) {
  let timer;
  return () => { clearTimeout(timer); timer = setTimeout(work, ms); };
}
