if (!window.FreshTrackerData) {
  throw new Error("uiData.js did not load. Open http://localhost:3000 in a browser.");
}

const {
  DAY_MS: MS_PER_DAY,
  fetchFoodItems: fetchFoodItemsFromApi,
  createFoodItem: buildFoodItem,
  createFoodItemOnServer: createFoodItemInApi,
  updateFoodItemOnServer: updateFoodItemInApi,
  deleteFoodItemOnServer: deleteFoodItemInApi,
  getDashboardModel: buildDashboardModel
} = window.FreshTrackerData;

const state = {
  items: [],
  isLoading: true,
  saving: false,
  error: "",
  quickDays: 0,
  entryMethod: "manual",
  modalMode: "create",
  editingId: null,
  draft: createDraft()
};

const iconOptions = [
  "restaurant",
  "water_drop",
  "eco",
  "egg",
  "bakery_dining",
  "local_pizza",
  "nutrition",
  "set_meal"
];

async function initApp() {
  renderApp();
  bindEvents();
  await refreshItems();
}

function createDraft(item = {}) {
  return {
    name: item.name || "",
    category: item.category || "",
    size: item.size || "",
    icon: item.icon || "restaurant",
    expiryDate: item.expiryDate || computeQuickExpiryDate(0)
  };
}

async function refreshItems() {
  state.isLoading = true;
  state.error = "";
  renderApp();

  try {
    state.items = await fetchFoodItemsFromApi();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.isLoading = false;
    renderApp();
  }
}

function renderApp() {
  const root = document.getElementById("app");
  const model = buildDashboardModel(state.items);

  root.innerHTML = `
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark">
      ${renderHeader(model.stats)}
      ${renderRecentItems(model.recentItems)}
      ${renderBottomNav()}
      ${renderAddFoodSheet()}
    </div>
  `;

  hydrateFormDefaults();
}

function renderHeader(stats) {
  return `
    <header class="sticky top-0 z-10 bg-background-light/80 px-6 pb-4 pt-8 backdrop-blur-md dark:bg-background-dark/80">
      <div class="mb-6 flex items-center justify-between">
        <a class="group flex items-center gap-3" href="#">
          <div class="rounded-xl bg-primary p-2 text-white">
            <span class="material-symbols-outlined block">kitchen</span>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">FreshTracker</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400">Keep it green, keep it fresh</p>
          </div>
        </a>
        <button class="rounded-full border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span class="material-symbols-outlined text-slate-600 dark:text-slate-300">notifications</span>
        </button>
      </div>
      <div class="grid grid-cols-3 gap-3">
        ${renderStatCard("Expired", stats.expired, "red")}
        ${renderStatCard("Today", stats.today, "orange")}
        ${renderStatCard("3 Days", stats.threeDays, "amber")}
      </div>
    </header>
  `;
}

function renderStatCard(label, value, tone) {
  const tones = {
    red: "bg-red-50 border-red-100 text-red-600 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400",
    orange:
      "bg-orange-50 border-orange-100 text-orange-600 dark:bg-orange-950/30 dark:border-orange-900/50 dark:text-orange-400",
    amber:
      "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400"
  };

  return `
    <div class="${tones[tone]} rounded-2xl border p-4">
      <p class="mb-1 text-[10px] font-bold uppercase tracking-wider">${label}</p>
      <div class="flex items-baseline gap-1">
        <span class="text-2xl font-bold">${value}</span>
        <span class="text-xs font-medium">items</span>
      </div>
    </div>
  `;
}

function renderRecentItems(items) {
  let content = "";

  if (state.error) {
    content = `
      <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        ${escapeHtml(state.error)}
      </div>
    `;
  } else if (state.isLoading) {
    content = `
      <div class="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center text-slate-500">
        Loading food items...
      </div>
    `;
  } else if (!items.length) {
    content = `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
        <p class="font-bold text-slate-500 dark:text-slate-400">No food tracked yet</p>
        <p class="mt-1 text-sm text-slate-400">Tap Add New Item to create your first record.</p>
      </div>
    `;
  } else {
    content = items.map(renderRecentItemCard).join("");
  }

  return `
    <main class="flex-1 overflow-y-auto px-6 pb-32">
      <div class="mb-4 mt-4 flex items-center justify-between">
        <h2 class="text-lg font-bold">Recent Items</h2>
        <button id="refresh-foods" class="text-sm font-semibold text-primary">Refresh</button>
      </div>
      <div class="space-y-3">${content}</div>
      <button
        id="open-add-food"
        class="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
      >
        <span class="material-symbols-outlined">add_circle</span>
        Add New Item
      </button>
    </main>
  `;
}

function renderRecentItemCard(item) {
  const faded = item.expiry.tone === "fresh";

  return `
    <div class="rounded-2xl border p-4 shadow-sm ${
      faded
        ? "border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/50"
        : "border-slate-50 bg-white dark:border-slate-700 dark:bg-slate-800"
    }">
      <div class="flex items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
          <span class="material-symbols-outlined">${item.icon}</span>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.name)}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(item.category)} • ${escapeHtml(item.size)}</p>
        </div>
        <div class="text-right">
          <p class="text-xs font-bold ${item.expiry.badgeClass}">${item.expiry.label}</p>
          <p class="text-[10px] text-slate-400">${item.expiry.sublabel}</p>
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button data-edit-id="${item.id}" class="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">
          Edit
        </button>
        <button data-delete-id="${item.id}" class="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
          Delete
        </button>
      </div>
    </div>
  `;
}

function renderBottomNav() {
  return `
    <nav class="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-4 pb-6 pt-2 dark:border-slate-800 dark:bg-slate-900">
      <div class="relative mx-auto flex max-w-md items-center justify-between">
        <a class="flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-primary" href="#">
          <span class="material-symbols-outlined">calendar_today</span>
          <span class="text-[10px] font-medium">Calendar</span>
        </a>
        <a class="flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-primary" href="#">
          <span class="material-symbols-outlined">inventory_2</span>
          <span class="text-[10px] font-medium">All Food</span>
        </a>
        <div class="-mt-8">
          <button
            id="nav-add-food"
            class="flex flex-col items-center gap-1 rounded-full border-4 border-white bg-primary p-3 text-white shadow-lg shadow-primary/40 dark:border-slate-900"
          >
            <span class="material-symbols-outlined text-2xl">add</span>
          </button>
          <span class="mt-1 block text-center text-[10px] font-bold text-primary">Add Food</span>
        </div>
        <a class="flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-primary" href="#">
          <span class="material-symbols-outlined">delete_outline</span>
          <span class="text-[10px] font-medium">Trash</span>
        </a>
        <a class="flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-primary" href="#">
          <span class="material-symbols-outlined">settings</span>
          <span class="text-[10px] font-medium">Settings</span>
        </a>
      </div>
    </nav>
  `;
}

function renderAddFoodSheet() {
  const title = state.modalMode === "edit" ? "Edit Food" : "Add Food";
  const cta = state.saving
    ? "Saving..."
    : state.modalMode === "edit"
      ? "Save Changes"
      : "Confirm & Add Food";

  return `
    <div id="add-food-modal" class="fixed inset-0 z-50 hidden items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <div class="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl dark:bg-slate-900">
        <div class="flex h-6 w-full items-center justify-center pt-2">
          <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>
        <div class="flex items-center justify-between px-6 pb-2 pt-4">
          <h1 class="text-2xl font-bold tracking-tight">${title}</h1>
          <button id="close-add-food" class="rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <span class="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>
        <div class="max-h-[80vh] overflow-y-auto px-6 py-4">
          <div class="grid grid-cols-2 gap-4">
            <button data-entry-method="manual" class="entry-method-btn flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-5 transition-all">
              <span class="material-symbols-outlined text-3xl">edit_note</span>
              <span class="text-sm font-bold">Manual Entry</span>
            </button>
            <button data-entry-method="photo" class="entry-method-btn flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-5 transition-all">
              <span class="material-symbols-outlined text-3xl">photo_camera</span>
              <span class="text-sm font-bold">Photo Capture</span>
            </button>
          </div>

          <form id="add-food-form" class="mt-8 flex flex-col gap-6">
            <div class="grid gap-4">
              <label class="grid gap-2">
                <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Food Name</span>
                <input name="name" value="${escapeHtml(state.draft.name)}" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="Whole Milk" />
              </label>
              <div class="grid grid-cols-2 gap-4">
                <label class="grid gap-2">
                  <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Category</span>
                  <input name="category" value="${escapeHtml(state.draft.category)}" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="Dairy" />
                </label>
                <label class="grid gap-2">
                  <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Size</span>
                  <input name="size" value="${escapeHtml(state.draft.size)}" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="1L Bottle" />
                </label>
              </div>
              <label class="grid gap-2">
                <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Icon</span>
                <select name="icon" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800">
                  ${iconOptions
                    .map(
                      (icon) =>
                        `<option value="${icon}" ${state.draft.icon === icon ? "selected" : ""}>${icon.replaceAll("_", " ")}</option>`
                    )
                    .join("")}
                </select>
              </label>
            </div>

            <div class="flex flex-col gap-3">
              <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Quick Expiry</h3>
              <div class="flex flex-wrap gap-2">
                ${renderQuickExpiryButton("Eat Soon", 0)}
                ${renderQuickExpiryButton("3 Days", 3)}
                ${renderQuickExpiryButton("7 Days", 7)}
                ${renderQuickExpiryButton("14 Days", 14)}
              </div>
            </div>

            <label class="grid gap-2">
              <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Expiration Date</span>
              <input id="expiry-date-input" name="expiryDate" type="date" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" />
            </label>

            ${state.modalMode === "edit" ? `
              <button type="button" id="delete-in-modal" class="rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100">
                Delete This Item
              </button>
            ` : ""}

            <div class="rounded-xl border border-primary/10 bg-primary/5 p-4">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-primary">tips_and_updates</span>
                <div>
                  <p class="font-semibold text-slate-800 dark:text-slate-100">Photo Capture preview only</p>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Because this version persists to food.json, please run it through the local server in VS Code instead of opening with file://.</p>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="bg-white p-6 pt-2 dark:bg-slate-900">
          <button ${state.saving ? "disabled" : ""} form="add-food-form" class="w-full rounded-xl bg-primary py-4 font-bold text-slate-900 shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
            ${cta}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderQuickExpiryButton(label, days) {
  const active = state.quickDays === days;
  const base = active
    ? "border border-primary/30 bg-primary/20 text-primary"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return `
    <button type="button" data-quick-days="${days}" class="quick-expiry-btn rounded-full px-4 py-2 text-sm font-semibold ${base}">
      ${label}
    </button>
  `;
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
}

async function handleClick(event) {
  const openTrigger = event.target.closest("#open-add-food, #nav-add-food");
  if (openTrigger) {
    openCreateModal();
    return;
  }

  if (event.target.closest("#refresh-foods")) {
    await refreshItems();
    return;
  }

  const closeTrigger = event.target.closest("#close-add-food");
  if (closeTrigger || event.target.id === "add-food-modal") {
    closeModal();
    return;
  }

  const quickButton = event.target.closest(".quick-expiry-btn");
  if (quickButton) {
    state.quickDays = Number(quickButton.dataset.quickDays);
    state.draft.expiryDate = computeQuickExpiryDate(state.quickDays);
    renderApp();
    openModal();
    return;
  }

  const methodButton = event.target.closest(".entry-method-btn");
  if (methodButton) {
    state.entryMethod = methodButton.dataset.entryMethod;
    renderApp();
    openModal();
    return;
  }

  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    openEditModal(editButton.dataset.editId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id], #delete-in-modal");
  if (deleteButton) {
    const id = deleteButton.dataset.deleteId || state.editingId;
    if (!id) {
      return;
    }

    const confirmed = window.confirm("Delete this food item?");
    if (!confirmed) {
      return;
    }

    state.saving = true;
    renderApp();
    openModalIfEditing();

    try {
      await deleteFoodItemInApi(id);
      closeModal();
      await refreshItems();
    } catch (error) {
      state.error = error.message;
      state.saving = false;
      renderApp();
      openModalIfEditing();
    }
  }
}

function handleChange(event) {
  if (event.target.form?.id === "add-food-form" && event.target.name) {
    state.draft[event.target.name] = event.target.value;
  }

  if (event.target.id === "expiry-date-input") {
    state.quickDays = null;
    state.draft.expiryDate = event.target.value;
  }
}

async function handleSubmit(event) {
  if (event.target.id !== "add-food-form") {
    return;
  }

  event.preventDefault();
  state.saving = true;
  renderApp();
  openModal();

  try {
  const payload = buildFoodItem({
      id: state.editingId,
      name: state.draft.name,
      category: state.draft.category,
      size: state.draft.size,
      expiryDate: state.draft.expiryDate,
      icon: state.draft.icon,
      createdAt: getExistingCreatedAt()
    });

    if (state.modalMode === "edit") {
      await updateFoodItemInApi(state.editingId, payload);
    } else {
      await createFoodItemInApi(payload);
    }

    resetModalState();
    closeModal();
    await refreshItems();
  } catch (error) {
    state.error = error.message;
    state.saving = false;
    renderApp();
    openModalIfEditing();
  }
}

function getExistingCreatedAt() {
  if (!state.editingId) {
    return undefined;
  }

  const existing = state.items.find((item) => item.id === state.editingId);
  return existing?.createdAt;
}

function openCreateModal() {
  state.modalMode = "create";
  state.editingId = null;
  state.quickDays = 0;
  state.entryMethod = "manual";
  state.draft = createDraft();
  renderApp();
  openModal();
}

function openEditModal(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  state.modalMode = "edit";
  state.editingId = id;
  state.quickDays = null;
  state.entryMethod = "manual";
  state.draft = createDraft(item);
  renderApp();
  openModal();
}

function resetModalState() {
  state.saving = false;
  state.modalMode = "create";
  state.editingId = null;
  state.quickDays = 0;
  state.entryMethod = "manual";
  state.draft = createDraft();
}

function openModal() {
  const modal = document.getElementById("add-food-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  highlightEntryMethod();
}

function closeModal() {
  const modal = document.getElementById("add-food-modal");
  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  modal.classList.remove("flex");
  if (!state.saving) {
    resetModalState();
    renderApp();
  }
}

function openModalIfEditing() {
  if (state.modalMode === "edit" || state.saving) {
    openModal();
  }
}

function hydrateFormDefaults() {
  const input = document.getElementById("expiry-date-input");
  if (!input) {
    return;
  }

  input.value = state.draft.expiryDate || computeQuickExpiryDate(state.quickDays ?? 0);
  highlightEntryMethod();
}

function computeQuickExpiryDate(days) {
  const date = new Date(Date.now() + days * MS_PER_DAY);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function highlightEntryMethod() {
  document.querySelectorAll(".entry-method-btn").forEach((button) => {
    const active = button.dataset.entryMethod === state.entryMethod;
    button.className =
      "entry-method-btn flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-5 transition-all " +
      (active
        ? "border-primary bg-primary/5 text-primary"
        : "border-slate-100 bg-white text-slate-600 hover:border-primary/50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300");
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

initApp().catch((error) => {
  const root = document.getElementById("app");
  if (root) {
    root.innerHTML = `
      <div class="boot-error">
        <strong>FreshTracker failed to start.</strong>\n\n${escapeHtml(error.message || String(error))}
      </div>
    `;
  }
});
