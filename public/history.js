setupPage();                                    // students only (admins are sent to the Dashboard)

async function loadHistory(page = 1) {
  try {
    const data = await api("/api/borrow-requests/history?page=" + page);
    const list = $("historyList");
    list.replaceChildren();
    if (data.rows.length === 0) showEmpty(list, 6, "Nothing here yet. Returned items will show up here.");

    data.rows.forEach((r) => {
      const row = document.createElement("tr");
      addCell(row, "Equipment", r.equipment_name);
      addCell(row, "Qty", r.quantity);
      addCell(row, "Reason", r.reason || "-");
      addCell(row, "Requested", r.request_date);
      addCell(row, "Return by", r.needed_until);
      addBadge(row, "Result", r.status, r.status);
      list.appendChild(row);
    });
    showPager(data, loadHistory);
  } catch (error) { say(error.message || "Unable to load history.", "error"); }
}

loadHistory();
