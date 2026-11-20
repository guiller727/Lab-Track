const user = setupPage();                       // checks login + draws the top bar
const isAdmin = user.role === "admin";
let currentPage = 1;

$("addBtn").hidden = !isAdmin;                  // admins get "+ Add equipment"
$("pageHint").textContent = isAdmin
  ? "Add, edit and archive laboratory equipment."
  : "Browse the equipment and tap Request on what you need.";

// Every "Cancel" and "×" button closes its pop-up.
document.querySelectorAll("[data-close]").forEach((button) =>
  button.addEventListener("click", () => button.closest("dialog").close()));

// ---------- Show one page of the equipment table (10 per page) ----------
async function loadEquipment(page = 1) {
  try {
    const params = new URLSearchParams({ page, search: $("search").value.trim(), category: $("filterCategory").value });
    const data = await api("/api/equipment?" + params);
    currentPage = data.page;

    const list = $("equipList");
    list.replaceChildren();
    if (data.rows.length === 0) showEmpty(list, 7, "No equipment found.");

    data.rows.forEach((item) => {
      const row = document.createElement("tr");
      addCell(row, "Name", item.name).className = "title";
      addCell(row, "Category", item.category);
      addCell(row, "Location", item.location || "-");
      addQtyCell(row, "Available", item);
      addBadge(row, "Condition", item.item_condition.toLowerCase().replace(" ", "-"), item.item_condition);
      const inStock = item.available_quantity > 0;
      addBadge(row, "Status", inStock ? "ok" : "none", inStock ? "Available" : "Unavailable");

      const cell = addCell(row, "", "");
      cell.className = "row-actions";
      const actions = document.createElement("div");
      actions.className = "actions";
      if (isAdmin) {
        actions.append(makeButton("Edit", "btn btn-outline btn-sm", () => startEdit(item)),
                       makeButton("Archive", "btn btn-outline-danger btn-sm", () => archiveItem(item)));
      } else {
        const requestBtn = makeButton(inStock ? "Request" : "Unavailable", "btn btn-primary btn-sm", () => pickItem(item));
        requestBtn.disabled = !inStock;
        actions.appendChild(requestBtn);
      }
      cell.appendChild(actions);
      list.appendChild(row);
    });
    showPager(data, loadEquipment);
  } catch (error) { say(error.message, "error"); }
}

// ---------- Category dropdown (+ suggestions in the admin form) ----------
async function loadCategories() {
  const categories = await loadCategoryOptions("filterCategory");
  $("categoryList").replaceChildren(...categories.map((c) => new Option(c)));
}

// ---------- Admin: add / edit / archive ----------
function openForm() {
  say("", "", "equipMsg");
  $("equipDialog").showModal();
}

$("addBtn").addEventListener("click", () => {
  $("equipForm").reset();
  $("equipId").value = "";
  $("formTitle").textContent = "Add equipment";
  $("saveBtn").textContent = "Add equipment";
  openForm();
  $("name").focus();
});

function startEdit(item) {                      // copy the item into the form
  $("equipId").value = item.equipment_id;
  $("name").value = item.name;
  $("category").value = item.category;
  $("location").value = item.location || "";
  $("condition").value = item.item_condition;
  $("total").value = item.total_quantity;
  $("available").value = item.available_quantity;
  $("formTitle").textContent = "Edit equipment";
  $("saveBtn").textContent = "Save changes";
  openForm();
}

$("equipForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("equipId").value;                // empty = new item, filled = editing
  const equipment = {
    name: $("name").value.trim(),
    category: $("category").value.trim(),
    location: $("location").value.trim(),
    item_condition: $("condition").value,
    total_quantity: Number($("total").value),
    available_quantity: Number($("available").value),
  };
  try {
    const result = await api(id ? "/api/equipment/" + id : "/api/equipment", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(equipment),
    });
    $("equipDialog").close();
    say(result.message, "success");
    await loadEquipment(id ? currentPage : 1);
    await loadCategories();
  } catch (error) { say(error.message, "error", "equipMsg"); }
});

async function archiveItem(item) {
  if (!confirm('Archive "' + item.name + '"?')) return;
  try {
    const result = await api("/api/equipment/" + item.equipment_id, { method: "DELETE" });
    say(result.message, "success");
    await loadEquipment(currentPage);
    await loadCategories();
  } catch (error) { say(error.message, "error"); }
}

// ---------- Student: send a borrow request ----------
$("reqDate").min = new Date().toISOString().slice(0, 10);   // no past dates

function pickItem(item) {                       // "Request" button on a row
  $("requestForm").reset();
  say("", "", "reqMsg");
  $("reqItemId").value = item.equipment_id;
  $("reqItemName").textContent = item.name;
  $("reqItemInfo").textContent = item.category + " · " + (item.location || "No location") + " · " + item.available_quantity + " available";
  $("reqQty").max = item.available_quantity;
  $("reqQty").value = 1;
  $("requestDialog").showModal();
  $("reqReason").focus();
}

$("requestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/borrow-requests", {
      method: "POST",
      body: JSON.stringify({
        equipment_id: Number($("reqItemId").value),
        quantity: Number($("reqQty").value),
        needed_until: $("reqDate").value,
        reason: $("reqReason").value.trim(),
      }),
    });
    $("requestDialog").close();
    say(result.message + " Track it under Requests.", "success");
  } catch (error) { say(error.message, "error", "reqMsg"); }
});

// ---------- Search + category filter reload the table from page 1 ----------
$("search").addEventListener("input", whenTypingStops(() => loadEquipment(1)));
$("filterCategory").addEventListener("change", () => loadEquipment(1));

loadEquipment();
loadCategories();
