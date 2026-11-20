setupPage();                                    // students only (admins are sent to the Dashboard)

// ---------- One page of history (10 per page, search + category) ----------
async function loadHistory(page = 1) {
  try {
    const params = new URLSearchParams({ page, search: $("search").value.trim(), category: $("filterCategory").value });
    const data = await api("/api/borrow-requests/history?" + params);
    const list = $("historyList");
    list.replaceChildren();
    if (data.rows.length === 0) {
      const filtered = $("search").value.trim() || $("filterCategory").value;
      showEmpty(list, 7, filtered ? "No history matches your search." : "Nothing here yet. Returned items will show up here.");
    }

    data.rows.forEach((r) => {
      const row = document.createElement("tr");
      addCell(row, "Equipment", r.equipment_name).className = "title";
      addCell(row, "Category", r.category);
      addCell(row, "Qty", r.quantity);
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

loadHistory();
loadCategoryOptions("filterCategory");
