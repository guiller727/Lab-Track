const user = setupPage();
const isAdmin = user.role === "admin";
let currentPage = 1;

$("title").textContent = isAdmin ? "Active requests" : "My requests";
$("hint").textContent = isAdmin
  ? "Approve, reject, and mark returns. Finished requests move to the Dashboard history."
  : "Your open requests. Returned items move to History.";
$("actionHead").hidden = !isAdmin;              // only admins have action buttons
if (!isAdmin) document.querySelector("thead th:nth-child(3)").remove();   // students don't need "Requested by"
const COLUMNS = isAdmin ? 8 : 6;

// ---------- Show one page of requests (10 per page) ----------
async function loadRequests(page = 1) {
  try {
    const data = await api("/api/borrow-requests?page=" + page);
    currentPage = data.page;

    const list = $("reqList");
    list.replaceChildren();
    if (data.rows.length === 0) {
      showEmpty(list, COLUMNS, isAdmin ? "No active requests." : "No requests yet. Go to Equipment and tap Request.");
    }

    const today = new Date().toISOString().slice(0, 10);
    data.rows.forEach((r) => {
      const row = document.createElement("tr");
      addCell(row, "Equipment", r.equipment_name).className = "title";
      addCell(row, "Qty", r.quantity);
      if (isAdmin) addCell(row, "Requested by", r.user_name);
      addCell(row, "Reason", r.reason || "-").classList.add("reason");
      addCell(row, "Requested", r.request_date);
      addCell(row, "Return by", r.needed_until);

      const overdue = r.status === "approved" && r.needed_until < today;
      addBadge(row, "Status", overdue ? "overdue" : r.status, overdue ? "overdue" : r.status);

      if (isAdmin) {
        const cell = addCell(row, "", "");
        cell.className = "row-actions";
        const box = document.createElement("div");
        box.className = "actions";
        cell.appendChild(box);
        showActions(box, r);
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
    box.append(makeButton("Approve", "btn btn-success btn-sm", () => act(r.request_id, "approve")),
               makeButton("Reject", "btn btn-outline-danger btn-sm", () => act(r.request_id, "reject")));
  }
  if (r.status === "approved") {
    box.appendChild(makeButton("Mark returned", "btn btn-primary btn-sm", () => askCondition(box, r)));
  }
  if (r.status === "damaged") {
    box.appendChild(makeButton("Mark resolved", "btn btn-success btn-sm", () => act(r.request_id, "resolve")));
  }
}

// After "Mark returned": was the item good or damaged?
function askCondition(box, r) {
  const question = document.createElement("span");
  question.className = "ask";
  question.textContent = "Condition?";
  box.replaceChildren(
    question,
    makeButton("Good", "btn btn-success btn-sm", () => act(r.request_id, "return", { condition: "good" })),
    makeButton("Damaged", "btn btn-danger btn-sm", () => act(r.request_id, "return", { condition: "damaged" })),
    makeButton("Cancel", "btn btn-outline btn-sm", () => showActions(box, r))
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
