const user = setupPage();
const isAdmin = user.role === "admin";
let currentPage = 1;

$("title").textContent = isAdmin ? "Active requests" : "My requests";
$("adminHint").hidden = !isAdmin;
$("actionHead").hidden = !isAdmin;              // only admins have action buttons

// ---------- Show one page of requests ----------
async function loadRequests(page = 1) {
  try {
    const data = await api("/api/borrow-requests?page=" + page);
    currentPage = data.page;

    const list = $("reqList");
    list.replaceChildren();
    if (data.rows.length === 0) {
      showEmpty(list, 8, isAdmin ? "No active requests." : "No requests yet. Go to Equipment and tap Request.");
    }

    const today = new Date().toISOString().slice(0, 10);
    data.rows.forEach((r) => {
      const row = document.createElement("tr");
      addCell(row, "Equipment", r.equipment_name);
      addCell(row, "Qty", r.quantity);
      addCell(row, "Requested by", r.user_name);
      addCell(row, "Reason", r.reason || "-");
      addCell(row, "Requested", r.request_date);
      addCell(row, "Return by", r.needed_until);

      const overdue = r.status === "approved" && r.needed_until < today;
      addBadge(row, "Status", overdue ? "overdue" : r.status, overdue ? "overdue" : r.status);

      if (isAdmin) {
        const actions = addCell(row, "", "");
        actions.className = "row-actions";
        showActions(actions, r);
      }
      list.appendChild(row);
    });
    showPager(data, loadRequests);
  } catch (error) { say(error.message || "Unable to load requests.", "error"); }
}

// ---------- Admin buttons (they depend on the request's status) ----------
function showActions(box, r) {
  box.replaceChildren();
  if (r.status === "pending") {
    box.append(makeButton("Approve", "good", () => act(r.request_id, "approve")),
               makeButton("Reject", "danger", () => act(r.request_id, "reject")));
  }
  if (r.status === "approved") {
    box.appendChild(makeButton("Mark returned", "primary", () => askCondition(box, r)));
  }
  if (r.status === "damaged") {
    box.appendChild(makeButton("Mark resolved", "good", () => act(r.request_id, "resolve")));
  }
}

// After "Mark returned": was the item good or damaged?
function askCondition(box, r) {
  box.replaceChildren(
    "Condition?",
    makeButton("Good", "good", () => act(r.request_id, "return", { condition: "good" })),
    makeButton("Damaged", "danger", () => act(r.request_id, "return", { condition: "damaged" })),
    makeButton("Cancel", "", () => showActions(box, r))
  );
}

// Sends the action to the server, then reloads the same page.
async function act(id, action, body) {
  try {
    const result = await api("/api/borrow-requests/" + id + "/" + action, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
    say(result.message, "success");
    await loadRequests(currentPage);
  } catch (error) { say(error.message, "error"); }
}

loadRequests();
