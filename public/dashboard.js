setupPage();                                    // admins only (students are sent to Equipment)

// ---------- Stat cards ----------
async function loadSummary() {
  const s = await api("/api/dashboard/summary");
  // [label, value, small text under it, icon, color, link]
  const cards = [
    ["Equipment items", s.equipment_items, s.out_of_stock + " out of stock", "layers", "blue", "index.html"],
    ["Pending requests", s.pending, "waiting for review", "clock", "amber", "requests.html"],
    ["Currently borrowed", s.currently_borrowed, "approved, not yet returned", "equipment", "purple", "requests.html"],
    ["Damaged", s.damaged, "unresolved · " + s.resolved + " resolved", "alert", "red", "requests.html"],
    ["Times borrowed", s.times_borrowed, s.total_requests + " requests in total", "repeat", "gray", null],
  ];
  $("stats").replaceChildren();
  cards.forEach(([label, value, sub, ic, color, link]) => {
    const card = document.createElement(link ? "a" : "div");
    card.className = "stat-card";
    if (link) card.href = link;
    card.innerHTML = `<div class="stat-icon ${color}">${icon(ic)}</div>
      <div><div class="stat-label"></div><div class="stat-value"></div><div class="stat-sub"></div></div>`;
    card.querySelector(".stat-label").textContent = label;
    card.querySelector(".stat-value").textContent = value;
    card.querySelector(".stat-sub").textContent = sub;
    $("stats").appendChild(card);
  });
}

// ---------- Equipment availability (10 per page) ----------
async function loadEquipment(page = 1) {
  try {
    const data = await api("/api/equipment?page=" + page);
    const list = $("equipList");
    list.replaceChildren();
    if (data.rows.length === 0) showEmpty(list, 5, "No equipment yet. Add some under Equipment.");

    data.rows.forEach((item) => {
      const row = document.createElement("tr");
      addCell(row, "Equipment", item.name).className = "title";
      addCell(row, "Category", item.category);
      addCell(row, "Location", item.location || "-");
      addQtyCell(row, "Available", item);
      const inStock = item.available_quantity > 0;
      addBadge(row, "Status", inStock ? "ok" : "none", inStock ? "Available" : "Unavailable");
      list.appendChild(row);
    });
    showPager(data, loadEquipment, "equipPager");
  } catch (error) { say(error.message || "Unable to load equipment.", "error"); }
}

// ---------- History table (10 per page, search + category) ----------
async function loadHistory(page = 1) {
  try {
    const params = new URLSearchParams({ page, search: $("search").value.trim(), category: $("filterCategory").value });
    const data = await api("/api/borrow-requests/history?" + params);
    const list = $("historyList");
    list.replaceChildren();
    if (data.rows.length === 0) {
      const filtered = $("search").value.trim() || $("filterCategory").value;
      showEmpty(list, 8, filtered ? "No history matches your search." : "No finished requests yet.");
    }

    data.rows.forEach((r) => {
      const row = document.createElement("tr");
      addCell(row, "Equipment", r.equipment_name).className = "title";
      addCell(row, "Category", r.category);
      addCell(row, "Qty", r.quantity);
      addCell(row, "Borrower", r.user_name);
      addCell(row, "Reason", r.reason || "-").classList.add("reason");
      addCell(row, "Requested", r.request_date);
      addCell(row, "Return by", r.needed_until);
      addBadge(row, "Result", r.status, r.status);
      list.appendChild(row);
    });
    showPager(data, loadHistory);
  } catch (error) { say(error.message || "Unable to load history.", "error"); }
}

// Typing in search or picking a category starts again from page 1.
$("search").addEventListener("input", whenTypingStops(() => loadHistory(1)));
$("filterCategory").addEventListener("change", () => loadHistory(1));

loadSummary().catch((error) => say(error.message || "Unable to load dashboard.", "error"));
loadEquipment();
loadHistory();
loadCategoryOptions("filterCategory");
