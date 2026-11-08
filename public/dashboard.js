setupPage();                                    // admins only (students are sent to Equipment)

// ---------- Stat cards ----------
async function loadSummary() {
  const s = await api("/api/dashboard/summary");
  const cards = [
    ["Total requests", s.total_requests],
    ["Pending", s.pending],
    ["Currently borrowed", s.currently_borrowed],
    ["Times borrowed (all time)", s.times_borrowed],
    ["Damaged (unresolved)", s.damaged],
    ["Resolved", s.resolved],
    ["Units in stock", s.equipment_available + " / " + s.equipment_total],
  ];
  $("stats").replaceChildren();
  cards.forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat";
    const big = document.createElement("b");
    big.textContent = value;
    const small = document.createElement("span");
    small.textContent = label;
    card.append(big, small);
    $("stats").appendChild(card);
  });
}

// ---------- History table (10 per page) ----------
async function loadHistory(page = 1) {
  const data = await api("/api/borrow-requests/history?page=" + page);
  const list = $("historyList");
  list.replaceChildren();
  if (data.rows.length === 0) showEmpty(list, 7, "No finished requests yet.");

  data.rows.forEach((r) => {
    const row = document.createElement("tr");
    addCell(row, "Equipment", r.equipment_name);
    addCell(row, "Qty", r.quantity);
    addCell(row, "Borrower", r.user_name);
    addCell(row, "Reason", r.reason || "-");
    addCell(row, "Requested", r.request_date);
    addCell(row, "Return by", r.needed_until);
    addBadge(row, "Result", r.status, r.status);
    list.appendChild(row);
  });
  showPager(data, loadHistory);
}

loadSummary().then(() => loadHistory()).catch((error) => say(error.message || "Unable to load dashboard.", "error"));
