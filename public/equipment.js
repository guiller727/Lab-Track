const user = setupPage();                       // checks login + draws the header
const isAdmin = user.role === "admin";

$("adminPanel").hidden = !isAdmin;              // admins get the add/edit form
$("requestPanel").hidden = isAdmin;             // students get the request form

// ---------- Show the equipment table ----------
async function loadEquipment() {
  try {
    const params = new URLSearchParams({ search: $("search").value.trim(), category: $("filterCategory").value });
    const items = await api("/api/equipment?" + params);

    const list = $("equipList");
    list.replaceChildren();
    if (items.length === 0) showEmpty(list, 7, "No equipment found.");

    items.forEach((item) => {
      const row = document.createElement("tr");
      addCell(row, "Name", item.name);
      addCell(row, "Category", item.category);
      addCell(row, "Location", item.location || "-");
      addCell(row, "Available", item.available_quantity + " / " + item.total_quantity);
      addCell(row, "Condition", item.item_condition);
      const inStock = item.available_quantity > 0;
      addBadge(row, "Status", inStock ? "ok" : "none", inStock ? "Available" : "Unavailable");

      const actions = addCell(row, "", "");
      actions.className = "row-actions";
      if (isAdmin) {
        actions.append(makeButton("Edit", "", () => startEdit(item)),
                       makeButton("Archive", "danger", () => archiveItem(item)));
      } else {
        const requestBtn = makeButton("Request", "primary", () => pickItem(item));
        requestBtn.disabled = !inStock;
        actions.appendChild(requestBtn);
      }
      list.appendChild(row);
    });
  } catch (error) { say(error.message, "error"); }
}

// ---------- Category dropdown ----------
async function loadCategories() {
  try {
    const categories = await api("/api/equipment-categories");
    const select = $("filterCategory");
    const chosen = select.value;
    select.replaceChildren(new Option("All categories", ""));
    categories.forEach((category) => select.appendChild(new Option(category, category)));
    select.value = categories.includes(chosen) ? chosen : "";
  } catch (error) { console.error(error); }
}

// ---------- Admin: add / edit / archive ----------
function startEdit(item) {                      // copy the item into the form
  $("equipId").value = item.equipment_id;
  $("name").value = item.name;
  $("category").value = item.category;
  $("location").value = item.location || "";
  $("condition").value = item.item_condition;
  $("total").value = item.total_quantity;
  $("available").value = item.available_quantity;
  $("description").value = item.description || "";
  $("formTitle").textContent = "Edit equipment";
  $("saveBtn").textContent = "Save changes";
  $("cancelBtn").hidden = false;
  $("equipForm").scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  $("equipForm").reset();
  $("equipId").value = "";
  $("formTitle").textContent = "Add equipment";
  $("saveBtn").textContent = "Add equipment";
  $("cancelBtn").hidden = true;
}
$("cancelBtn").addEventListener("click", resetForm);

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
    description: $("description").value.trim(),
  };
  try {
    const result = await api(id ? "/api/equipment/" + id : "/api/equipment", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(equipment),
    });
    say(result.message, "success");
    resetForm();
    await loadEquipment();
    await loadCategories();
  } catch (error) { say(error.message, "error"); }
});

async function archiveItem(item) {
  if (!confirm('Archive "' + item.name + '"?')) return;
  try {
    const result = await api("/api/equipment/" + item.equipment_id, { method: "DELETE" });
    say(result.message, "success");
    await loadEquipment();
    await loadCategories();
  } catch (error) { say(error.message, "error"); }
}

// ---------- Student: send a borrow request ----------
function pickItem(item) {                       // "Request" button on a row
  $("reqItemId").value = item.equipment_id;
  $("reqItemName").value = item.name + " (" + item.available_quantity + " available)";
  $("reqQty").max = item.available_quantity;
  $("reqQty").value = 1;
  $("requestPanel").scrollIntoView({ behavior: "smooth" });
  $("reqReason").focus();
}

function clearRequest() {
  $("requestForm").reset();
  $("reqItemId").value = "";
}
$("reqClear").addEventListener("click", clearRequest);
$("reqDate").min = new Date().toISOString().slice(0, 10);   // no past dates

$("requestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("reqItemId").value) { say("Tap Request on an item first.", "error"); return; }
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
    say(result.message + " Track it under Requests.", "success");
    clearRequest();
  } catch (error) { say(error.message, "error"); }
});

// ---------- Search + category filter reload the table ----------
let timer;
function reloadSoon() { clearTimeout(timer); timer = setTimeout(loadEquipment, 250); }   // wait while typing
$("search").addEventListener("input", reloadSoon);
$("filterCategory").addEventListener("change", loadEquipment);

loadEquipment();
loadCategories();
