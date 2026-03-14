if (!window.FreshTrackerData) {
  throw new Error("uiData.js did not load. Open http://localhost:3000 in a browser.");
}

if (!window.FreshTrackerAdd || !window.FreshTrackerSettings || !window.FreshTrackerTrash) {
  throw new Error("Required UI modules did not load. Check add.js, setting.js, and trash.js.");
}

const {
  DAY_MS: MS_PER_DAY,
  formatDisplayDate: formatFoodDisplayDate,
  getExpiryMeta: getFoodExpiryMeta,
  fetchFoodItems: fetchFoodItemsFromApi,
  createFoodItem: buildFoodItem,
  createFoodItemOnServer: createFoodItemInApi,
  updateFoodItemOnServer: updateFoodItemInApi,
  deleteFoodItemOnServer: deleteFoodItemInApi,
  fetchSettings: fetchSettingsFromApi,
  updateSettingsOnServer: updateSettingsInApi,
  resetSettingsOnServer: resetSettingsInApi,
  fetchTrashItems: fetchTrashItemsFromApi,
  createTrashItemOnServer: createTrashItemInApi,
  deleteTrashItemOnServer: deleteTrashItemInApi,
  emptyTrashOnServer: emptyTrashInApi,
  getDashboardModel: buildDashboardModel
} = window.FreshTrackerData;

const {
  createDraft,
  renderAddFoodSheet,
  hydrateFormDefaults: hydrateAddFormDefaults,
  highlightEntryMethod
} = window.FreshTrackerAdd;

const {
  reminderStrategies,
  renderSettingsPage,
  renderNotificationSettingsPage,
  getDefaultSettings,
  normalizeSettings,
  applyTheme
} = window.FreshTrackerSettings;

const {
  createCleanupDraft,
  renderTrashPage,
  renderTrashDetailSheet,
  renderCleanupPage,
  buildTrashModel,
  createTrashItem
} = window.FreshTrackerTrash;

const state = {
  items: [],
  trashItems: [],
  isLoading: true,
  isTrashLoading: true,
  saving: false,
  error: "",
  view: "dashboard",
  selectionMode: false,
  selectedItemIds: [],
  allFoodSearch: "",
  allFoodFilter: "all",
  allFoodSort: "expiry_asc",
  allFoodSelectedIds: [],
  showSortModal: false,
  detailItemId: null,
  trashDetailItemId: null,
  quickDays: 0,
  entryMethod: "manual",
  modalMode: "create",
  editingId: null,
  draft: createDraft({}, computeQuickExpiryDate),
  settings: getDefaultSettings(),
  reminderDraft: null,
  cleanupDraft: null
};

async function initApp() {
  try {
    state.settings = normalizeSettings(await fetchSettingsFromApi());
  } catch (error) {
    console.warn("Failed to load settings from setting.json:", error);
  }

  applyTheme(state.settings);
  renderApp();
  bindEvents();
  await Promise.all([refreshItems(), refreshTrashItems()]);
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

async function refreshTrashItems() {
  state.isTrashLoading = true;
  renderApp();

  try {
    const items = await fetchTrashItemsFromApi();
    state.trashItems = buildTrashModel(items, state.settings.trashAutoDeleteDays);
  } catch (error) {
    state.error = error.message;
  } finally {
    state.isTrashLoading = false;
    renderApp();
  }
}

function renderApp() {
  const root = document.getElementById("app");
  const model = buildDashboardModel(state.items);
  const notificationModal =
    state.view === "notification-settings" || state.view === "cleanup"
      ? ""
      : renderAddFoodSheet(state, escapeHtml);
  const detailSheet = state.view === "all-food" ? renderFoodDetailSheet(getDetailItem()) : "";
  const trashDetailSheet = state.view === "trash" ? renderTrashDetailSheet(getTrashDetailItem(), escapeHtml) : "";

  root.innerHTML = `
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-background-dark">
      ${renderCurrentView(model)}
      ${state.view === "notification-settings" || state.view === "cleanup" ? "" : renderBottomNav()}
      ${notificationModal}
      ${detailSheet}
      ${trashDetailSheet}
    </div>
  `;

  hydrateAddFormDefaults(state, computeQuickExpiryDate);
}

function renderCurrentView(model) {
  if (state.view === "settings") {
    return renderSettingsPage(state, escapeHtml, window.FreshTrackerAppVersion);
  }

  if (state.view === "notification-settings") {
    return renderNotificationSettingsPage(state, escapeHtml);
  }

  if (state.view === "trash") {
    return renderTrashPage(state, escapeHtml);
  }

  if (state.view === "cleanup") {
    return renderCleanupPage(state, escapeHtml);
  }

  if (state.view === "all-food") {
    return renderAllFoodPage(getAllFoodViewModel());
  }

  return `
    ${renderHeader(model.stats)}
    ${renderRecentItems(model.recentItems)}
  `;
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
  const selectedCount = state.selectedItemIds.length;
  const hasItems = items.length > 0;

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
        <h2 class="text-lg font-bold">${state.selectionMode ? `${selectedCount} Selected` : "Recent Items"}</h2>
        <div class="flex items-center gap-3">
          ${state.selectionMode
            ? `
              <button id="cancel-selection" class="text-sm font-semibold text-slate-500 dark:text-slate-400">Cancel</button>
              <button ${selectedCount ? "" : "disabled"} id="delete-selected-foods" class="text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
            `
            : `
              <button id="refresh-foods" class="text-sm font-semibold text-primary">Refresh</button>
              <span class="h-5 w-px bg-current text-primary/70"></span>
              <button ${hasItems ? "" : "disabled"} id="toggle-selection-mode" class="text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40">Select</button>
            `}
        </div>
      </div>
      <div class="space-y-3">${content}</div>
      ${state.selectionMode
        ? `
          <div class="mt-8 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            Select one or more items, then choose <span class="font-semibold text-red-500">Delete</span> or <span class="font-semibold">Cancel</span>.
          </div>
        `
        : `
          <button
            id="open-add-food"
            class="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
          >
            <span class="material-symbols-outlined">add_circle</span>
            Add New Item
          </button>
        `}
    </main>
  `;
}

function renderRecentItemCard(item) {
  const faded = item.expiry.tone === "fresh";
  const isSelected = state.selectedItemIds.includes(item.id);

  return `
    <div class="rounded-2xl border p-4 shadow-sm ${
      faded
        ? "border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/50"
        : "border-slate-50 bg-white dark:border-slate-700 dark:bg-slate-800"
    } ${isSelected ? "ring-2 ring-primary/40" : ""}">
      <div class="flex items-center gap-4">
        ${state.selectionMode
          ? `
            <button
              type="button"
              data-select-id="${item.id}"
              class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                isSelected
                  ? "border-primary bg-primary text-white"
                  : "border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-900"
              }"
            >
              <span class="material-symbols-outlined text-[16px]">check</span>
            </button>
          `
          : ""}
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
      ${state.selectionMode
        ? ""
        : `
          <div class="mt-3 flex justify-end gap-2">
            <button data-edit-id="${item.id}" class="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">
              Edit
            </button>
            <button data-delete-id="${item.id}" class="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
              Delete
            </button>
          </div>
        `}
    </div>
  `;
}

function renderBottomNav() {
  const settingsActive = state.view === "settings";
  const dashboardActive = state.view === "all-food";
  const trashActive = state.view === "trash";

  return `
    <nav class="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-4 pb-6 pt-2 dark:border-slate-800 dark:bg-slate-900">
      <div class="relative mx-auto flex max-w-md items-center justify-between">
        <a class="flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-primary" href="#">
          <span class="material-symbols-outlined">calendar_today</span>
          <span class="text-[10px] font-medium">Calendar</span>
        </a>
        <button
          type="button"
          data-nav-view="all-food"
          class="flex flex-col items-center gap-1 transition-colors hover:text-primary ${dashboardActive ? "text-primary" : "text-slate-400"}"
        >
          <span class="material-symbols-outlined">inventory_2</span>
          <span class="text-[10px] font-medium">All Food</span>
        </button>
        <div class="-mt-8">
          <button
            id="nav-add-food"
            class="flex flex-col items-center gap-1 rounded-full border-4 border-white bg-primary p-3 text-white shadow-lg shadow-primary/40 dark:border-slate-900"
          >
            <span class="material-symbols-outlined text-2xl">add</span>
          </button>
          <span class="mt-1 block text-center text-[10px] font-bold text-primary">Add Food</span>
        </div>
        <button
          type="button"
          data-nav-view="trash"
          class="flex flex-col items-center gap-1 transition-colors hover:text-primary ${trashActive ? "text-primary" : "text-slate-400"}"
        >
          <span class="material-symbols-outlined ${trashActive ? "fill-1" : ""}">delete_outline</span>
          <span class="text-[10px] font-medium ${trashActive ? "font-bold" : ""}">Trash</span>
        </button>
        <button
          type="button"
          id="nav-settings"
          class="flex flex-col items-center gap-1 transition-colors hover:text-primary ${settingsActive || state.view === "notification-settings" ? "text-primary" : "text-slate-400"}"
        >
          <span class="material-symbols-outlined ${settingsActive || state.view === "notification-settings" ? "fill-1" : ""}">settings</span>
          <span class="text-[10px] font-medium ${settingsActive || state.view === "notification-settings" ? "font-bold" : ""}">Settings</span>
        </button>
      </div>
    </nav>
  `;
}


function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
}

async function handleClick(event) {
  const navViewButton = event.target.closest("[data-nav-view]");
  if (navViewButton) {
    setView(navViewButton.dataset.navView);
    return;
  }

  if (event.target.closest("#all-food-back-to-dashboard")) {
    setView("dashboard");
    return;
  }

  if (event.target.closest("#nav-settings")) {
    state.reminderDraft = state.settings.reminderStrategy;
    clearSelectionMode();
    setView("settings");
    return;
  }

  if (event.target.closest("#trash-change-settings")) {
    state.reminderDraft = state.settings.reminderStrategy;
    clearSelectionMode();
    setView("settings");
    return;
  }

  if (event.target.closest("#toggle-selection-mode")) {
    state.selectionMode = true;
    state.selectedItemIds = [];
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-open-sort")) {
    state.showSortModal = true;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-close-sort, #all-food-sort-overlay")) {
    state.showSortModal = false;
    renderApp();
    return;
  }

  const sortOptionButton = event.target.closest("[data-sort-option]");
  if (sortOptionButton) {
    state.allFoodSort = sortOptionButton.dataset.sortOption;
    state.showSortModal = false;
    renderApp();
    return;
  }

  const filterChip = event.target.closest("[data-filter-chip]");
  if (filterChip) {
    state.allFoodFilter = filterChip.dataset.filterChip;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-reset-filters")) {
    state.allFoodSearch = "";
    state.allFoodFilter = "all";
    state.allFoodSelectedIds = [];
    renderApp();
    return;
  }

  const allFoodSelectButton = event.target.closest("[data-all-food-select-id]");
  if (allFoodSelectButton) {
    toggleAllFoodSelectedItem(allFoodSelectButton.dataset.allFoodSelectId);
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-select-all")) {
    toggleAllFoodSelectAll();
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-clean-up")) {
    if (!state.allFoodSelectedIds.length) {
      return;
    }

    openCleanupFlow(state.allFoodSelectedIds);
    return;
  }

  const detailTrigger = event.target.closest("[data-detail-id]");
  if (detailTrigger) {
    state.detailItemId = detailTrigger.dataset.detailId;
    renderApp();
    return;
  }

  if (event.target.closest("#close-food-detail")) {
    state.detailItemId = null;
    renderApp();
    return;
  }

  if (event.target.closest("#detail-edit-food")) {
    const id = state.detailItemId;
    state.detailItemId = null;
    openEditModal(id);
    return;
  }

  if (event.target.closest("#detail-delete-food")) {
    const id = state.detailItemId;
    state.detailItemId = null;
    openCleanupFlow([id]);
    return;
  }

  const categoryOptionButton = event.target.closest("[data-category-option]");
  if (categoryOptionButton) {
    state.draft.categoryOption = categoryOptionButton.dataset.categoryOption;
    if (state.draft.categoryOption !== "other") {
      state.draft.category = state.draft.categoryOption;
      state.draft.customCategory = "";
    }
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("#cancel-selection")) {
    clearSelectionMode();
    renderApp();
    return;
  }

  if (event.target.closest("#delete-selected-foods")) {
    if (!state.selectedItemIds.length) {
      return;
    }

    openCleanupFlow(state.selectedItemIds);
    return;
  }

  const selectButton = event.target.closest("[data-select-id]");
  if (selectButton) {
    toggleSelectedItem(selectButton.dataset.selectId);
    renderApp();
    return;
  }

  if (event.target.closest("#open-reminder-settings, #open-reminder-settings-icon")) {
    state.reminderDraft = state.settings.reminderStrategy;
    clearSelectionMode();
    setView("notification-settings");
    return;
  }

  if (event.target.closest("#back-to-settings")) {
    state.reminderDraft = state.settings.reminderStrategy;
    clearSelectionMode();
    setView("settings");
    return;
  }

  const trashButton = event.target.closest("[data-trash-days]");
  if (trashButton) {
    state.settings.trashAutoDeleteDays = Number(trashButton.dataset.trashDays);
    state.settings = normalizeSettings(await updateSettingsInApi(state.settings));
    await refreshTrashItems();
    return;
  }

  const reminderButton = event.target.closest("[data-reminder-strategy]");
  if (reminderButton) {
    state.reminderDraft = reminderButton.dataset.reminderStrategy;
    renderApp();
    return;
  }

  if (event.target.closest("#save-reminder-settings")) {
    state.settings.reminderStrategy = state.reminderDraft || state.settings.reminderStrategy;
    state.settings = normalizeSettings(await updateSettingsInApi(state.settings));
    setView("settings");
    return;
  }

  if (event.target.closest("#theme-toggle")) {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    state.settings = normalizeSettings(await updateSettingsInApi(state.settings));
    applyTheme(state.settings);
    renderApp();
    return;
  }

  if (event.target.closest("#restore-settings-defaults")) {
    const confirmed = window.confirm("Restore all settings to defaults?");
    if (!confirmed) {
      return;
    }

    state.settings = normalizeSettings(await resetSettingsInApi());
    state.reminderDraft = state.settings.reminderStrategy;
    applyTheme(state.settings);
    await refreshTrashItems();
    renderApp();
    return;
  }

  if (event.target.closest("#empty-trash")) {
    const confirmed = window.confirm("Permanently delete all items in trash?");
    if (!confirmed) {
      return;
    }

    await emptyTrashInApi();
    await refreshTrashItems();
    return;
  }

  if (event.target.closest("#cancel-cleanup, #cancel-cleanup-top")) {
    state.cleanupDraft = null;
    clearSelectionMode();
    setView("dashboard");
    return;
  }

  if (event.target.closest("#confirm-cleanup")) {
    await confirmCleanup();
    return;
  }

  const restoreButton = event.target.closest("[data-restore-id]");
  if (restoreButton) {
    state.trashDetailItemId = null;
    await restoreTrashItem(restoreButton.dataset.restoreId);
    return;
  }

  const trashDetailTrigger = event.target.closest("[data-trash-detail-id]");
  if (trashDetailTrigger) {
    state.trashDetailItemId = trashDetailTrigger.dataset.trashDetailId;
    renderApp();
    return;
  }

  if (event.target.closest("#close-trash-detail")) {
    state.trashDetailItemId = null;
    renderApp();
    return;
  }

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
    openCleanupFlow([id]);
  }
}

function handleChange(event) {
  if (event.target.form?.id === "add-food-form" && event.target.name) {
    state.draft[event.target.name] = event.target.value;
  }

  if (event.target.name === "customCategory") {
    state.draft.category = event.target.value;
  }

  if (event.target.id === "expiry-date-input") {
    state.quickDays = null;
    state.draft.expiryDate = event.target.value;
  }

  if (event.target.name === "cleanup_reason") {
    state.cleanupDraft.reason = event.target.value;
  }
}

function handleInput(event) {
  if (event.target.id === "cleanup-notes" && state.cleanupDraft) {
    state.cleanupDraft.notes = event.target.value;
  }

  if (event.target.id === "all-food-search") {
    state.allFoodSearch = event.target.value;
    renderApp();
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
      category: getDraftCategory(),
      size: getDraftSize(),
      expiryDate: state.draft.expiryDate,
      icon: getDraftIcon(),
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

function getDraftCategory() {
  if (state.draft.categoryOption === "other") {
    return String(state.draft.customCategory || "").trim();
  }

  return String(state.draft.categoryOption || state.draft.category || "other").trim();
}

function getDraftSize() {
  const value = String(state.draft.size || "").trim();
  return value || "TEXT";
}

function getDraftIcon() {
  return String(state.draft.icon || "").trim() || "restaurant";
}

function getExistingQuickDays(expiryDate) {
  const today = computeQuickExpiryDate(0);
  const delta = Math.round((new Date(expiryDate).getTime() - new Date(today).getTime()) / MS_PER_DAY);
  return [0, 3, 7, 14].includes(delta) ? delta : null;
}

function openCreateModal() {
  state.view = state.view === "all-food" ? "all-food" : "dashboard";
  state.detailItemId = null;
  clearSelectionMode();
  clearAllFoodSelection();
  state.modalMode = "create";
  state.editingId = null;
  state.quickDays = 0;
  state.entryMethod = "manual";
  state.draft = createDraft({}, computeQuickExpiryDate);
  renderApp();
  openModal();
}

function openEditModal(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  state.view = state.view === "all-food" ? "all-food" : "dashboard";
  state.detailItemId = null;
  clearSelectionMode();
  state.modalMode = "edit";
  state.editingId = id;
  state.quickDays = getExistingQuickDays(item.expiryDate);
  state.entryMethod = "manual";
  state.draft = createDraft(item, computeQuickExpiryDate);
  renderApp();
  openModal();
}

function resetModalState() {
  state.saving = false;
  state.modalMode = "create";
  state.editingId = null;
  state.quickDays = 0;
  state.entryMethod = "manual";
  state.draft = createDraft({}, computeQuickExpiryDate);
}

function openModal() {
  const modal = document.getElementById("add-food-modal");
  if (!modal) {
    return;
  }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  highlightEntryMethod(state);
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

function computeQuickExpiryDate(days) {
  const date = new Date(Date.now() + days * MS_PER_DAY);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setView(view) {
  state.view = view;
  if (view !== "dashboard") {
    resetModalState();
    clearSelectionMode();
  }
  if (view !== "all-food") {
    clearAllFoodSelection();
    state.detailItemId = null;
    state.showSortModal = false;
  }
  if (view !== "trash") {
    state.trashDetailItemId = null;
  }
  renderApp();
}

function openCleanupFlow(itemIds) {
  closeModal();
  state.cleanupDraft = createCleanupDraft(itemIds);
  clearSelectionMode();
  clearAllFoodSelection();
  state.detailItemId = null;
  state.trashDetailItemId = null;
  state.view = "cleanup";
  renderApp();
}

async function confirmCleanup() {
  if (!state.cleanupDraft?.itemIds?.length) {
    return;
  }

  const itemsToDelete = state.items.filter((item) => state.cleanupDraft.itemIds.includes(item.id));
  if (!itemsToDelete.length) {
    state.cleanupDraft = null;
    setView("dashboard");
    return;
  }

  for (const item of itemsToDelete) {
    const trashItem = createTrashItem(item, state.cleanupDraft);
    await createTrashItemInApi(trashItem);
    await deleteFoodItemInApi(item.id);
  }

  state.cleanupDraft = null;
  state.view = "trash";
  await Promise.all([refreshItems(), refreshTrashItems()]);
}

async function restoreTrashItem(id) {
  const trashItem = state.trashItems.find((item) => item.id === id);
  if (!trashItem) {
    return;
  }

  const restoredItem = buildFoodItem({
    id: trashItem.id,
    name: trashItem.name,
    category: trashItem.category,
    size: trashItem.size,
    expiryDate: trashItem.expiryDate,
    icon: trashItem.icon,
    createdAt: trashItem.createdAt
  });

  await createFoodItemInApi(restoredItem);
  await deleteTrashItemInApi(id);
  await Promise.all([refreshItems(), refreshTrashItems()]);
}

function toggleSelectedItem(id) {
  if (state.selectedItemIds.includes(id)) {
    state.selectedItemIds = state.selectedItemIds.filter((itemId) => itemId !== id);
    return;
  }

  state.selectedItemIds = [...state.selectedItemIds, id];
}

function clearSelectionMode() {
  state.selectionMode = false;
  state.selectedItemIds = [];
}

function renderAllFoodPage(model) {
  return `
    <div class="relative flex h-screen w-full flex-col overflow-hidden">
      <header class="flex flex-col gap-4 border-b border-primary/10 bg-white px-4 pb-2 pt-6 dark:bg-background-dark">
        <div class="flex items-center justify-between">
          <button id="all-food-back-to-dashboard" class="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span class="material-symbols-outlined text-3xl text-primary">kitchen</span>
            <h1 class="text-xl font-bold tracking-tight">All Food Inventory</h1>
          </button>
          <div class="flex items-center gap-1">
            <button class="rounded-full p-2 transition-colors hover:bg-primary/10">
              <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">notifications</span>
            </button>
            <button class="rounded-full p-2 transition-colors hover:bg-primary/10">
              <span class="material-symbols-outlined text-slate-700 dark:text-slate-300">more_vert</span>
            </button>
          </div>
        </div>
        <div class="flex gap-2">
          <label class="flex flex-1 items-center rounded-xl border border-primary/5 bg-background-light px-3 py-2 transition-all focus-within:border-primary/30 dark:bg-slate-800/50">
            <span class="material-symbols-outlined mr-2 text-xl text-slate-400">search</span>
            <input id="all-food-search" value="${escapeHtml(state.allFoodSearch)}" class="w-full border-none bg-transparent text-sm placeholder:text-slate-400 focus:ring-0" placeholder="Search food items..." type="text"/>
          </label>
          <button id="all-food-open-sort" class="mr-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20">
            <span class="material-symbols-outlined">sort</span>
          </button>
          <button id="all-food-reset-filters" class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20">
            <span class="material-symbols-outlined">tune</span>
          </button>
        </div>
        <div class="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          ${renderAllFoodFilterChip("all", "All Items")}
          ${renderAllFoodFilterChip("fresh", "Fresh")}
          ${renderAllFoodFilterChip("soon", "Expiring Soon")}
          ${renderAllFoodFilterChip("expired", "Expired")}
        </div>
      </header>
      <main class="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div class="mb-4 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-3">
          <button id="all-food-select-all" class="flex items-center gap-2">
            <span class="flex h-5 w-5 items-center justify-center rounded border border-primary/30 text-primary ${model.selectAll ? "bg-primary text-white" : "bg-white"}">
              <span class="material-symbols-outlined text-[14px]">check</span>
            </span>
            <span class="text-sm font-medium text-slate-600 dark:text-slate-300">Select All</span>
          </button>
          <button ${model.selectedCount ? "" : "disabled"} id="all-food-clean-up" class="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40">
            <span class="material-symbols-outlined text-sm">delete_sweep</span>
            Clean Up
          </button>
        </div>
        ${renderAllFoodList(model.items)}
      </main>
      ${state.showSortModal ? renderAllFoodSortModal() : ""}
    </div>
  `;
}

function renderAllFoodFilterChip(id, label) {
  const active = state.allFoodFilter === id;
  return `
    <button data-filter-chip="${id}" class="whitespace-nowrap rounded-full px-4 py-1.5 text-xs ${active ? "bg-primary font-semibold text-white" : "border border-primary/10 bg-background-light font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"}">
      ${label}
    </button>
  `;
}

function renderAllFoodList(items) {
  if (!items.length) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
        <p class="font-bold text-slate-500 dark:text-slate-400">No matching food items</p>
        <p class="mt-1 text-sm text-slate-400">Try a different search or filter.</p>
      </div>
    `;
  }

  return items.map(renderAllFoodCard).join("");
}

function renderAllFoodCard(item) {
  const selected = state.allFoodSelectedIds.includes(item.id);
  const badge = getAllFoodBadge(item.expiry);
  const datePrefix = item.expiry.tone === "expired" ? "Expired" : "Expires";
  const detailTarget = `data-detail-id="${item.id}"`;

  return `
    <div class="group flex items-center gap-4 rounded-xl border border-primary/5 bg-white p-3 shadow-sm transition-all hover:border-primary/30 dark:bg-slate-800/40">
      <div class="relative">
        <button ${detailTarget} class="flex h-14 w-14 items-center justify-center rounded-lg border border-primary/10 bg-primary/10 text-primary">
          <span class="material-symbols-outlined text-3xl">${item.icon}</span>
        </button>
        <button data-all-food-select-id="${item.id}" class="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded border border-primary/30 bg-white text-primary">
          ${selected ? '<span class="material-symbols-outlined text-[12px]">check</span>' : ""}
        </button>
      </div>
      <div class="min-w-0 flex-1">
        <button ${detailTarget} class="truncate text-left font-bold text-slate-800 dark:text-white">${escapeHtml(item.name)}</button>
        <div class="mt-0.5 flex items-center gap-1 text-xs ${badge.metaClass}">
          <span class="material-symbols-outlined text-[14px]">${badge.icon}</span>
          <span>${datePrefix}: ${escapeHtml(formatFoodDisplayDate(item.expiryDate))}</span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-2">
        <span class="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.badgeClass}">${badge.label}</span>
        <button ${detailTarget} class="material-symbols-outlined cursor-pointer text-slate-300 transition-colors group-hover:text-primary">chevron_right</button>
      </div>
    </div>
  `;
}

function renderAllFoodSortModal() {
  return `
    <div id="all-food-sort-overlay" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-background-dark">
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-lg font-bold">Sort Food Items</h2>
          <button id="all-food-close-sort" class="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="space-y-2">
          ${renderSortOption("expiry_asc", "schedule", "Fastest to Slowest Expiration")}
          ${renderSortOption("created_asc", "calendar_add_on", "Addition Date: Oldest to Newest")}
          ${renderSortOption("created_desc", "history", "Addition Date: Newest to Oldest")}
        </div>
      </div>
    </div>
  `;
}

function renderSortOption(id, icon, label) {
  const active = state.allFoodSort === id;

  return `
    <button data-sort-option="${id}" class="flex w-full items-center justify-between rounded-2xl border ${active ? "border-primary/20 bg-primary/10 font-semibold text-primary" : "border-transparent text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"} p-4">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined ${active ? "" : "text-slate-400"}">${icon}</span>
        <span>${label}</span>
      </div>
      ${active ? '<span class="material-symbols-outlined text-primary">check_circle</span>' : ""}
    </button>
  `;
}

function renderFoodDetailSheet(item) {
  if (!item) {
    return "";
  }

  const badge = getAllFoodBadge(item.expiry);

  return `
    <div class="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm">
      <div class="mx-auto flex w-full max-w-2xl flex-col rounded-t-xl bg-white shadow-2xl dark:bg-background-dark">
        <button class="flex h-6 w-full items-center justify-center">
          <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </button>
        <div class="max-h-[85vh] flex-1 overflow-y-auto">
          <div class="flex items-center justify-between px-4 py-2">
            <button id="close-food-detail" class="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              <span class="material-symbols-outlined">close</span>
            </button>
            <div class="flex gap-2">
              <button id="detail-edit-food" class="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20">
                <span class="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
              <button id="detail-delete-food" class="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30">
                <span class="material-symbols-outlined text-sm">delete</span>
                Delete
              </button>
            </div>
          </div>
          <div class="px-4 py-2">
            <div class="flex min-h-64 w-full items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <span class="material-symbols-outlined text-8xl">${item.icon}</span>
            </div>
          </div>
          <div class="px-4 pt-4">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-3xl font-bold leading-tight text-slate-900 dark:text-slate-100">${escapeHtml(item.name)}</h2>
                <div class="mt-1 flex items-center gap-2">
                  <span class="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">${escapeHtml(item.category)}</span>
                  <span class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(item.size)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="mx-4 mt-6 flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
              <span class="material-symbols-outlined text-2xl">${badge.icon === "priority_high" ? "timer_off" : "timer"}</span>
            </div>
            <div>
              <p class="text-sm font-medium uppercase tracking-wide text-primary/80">${escapeHtml(item.expiry.label)}</p>
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">${escapeHtml(formatFoodDisplayDate(item.expiryDate))}</p>
            </div>
          </div>
          <div class="space-y-4 px-4 py-6">
            ${renderDetailRow("shopping_basket", "Added On", formatFoodDisplayDate(item.createdAt.slice(0, 10)))}
            ${renderDetailRow("category", "Category", item.category)}
            ${renderDetailRow("straighten", "Size", item.size)}
            ${renderDetailRow("kitchen", "Icon", item.icon.replaceAll("_", " "))}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDetailRow(icon, label, value) {
  return `
    <div class="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-slate-400">${icon}</span>
        <span class="text-slate-600 dark:text-slate-300">${escapeHtml(label)}</span>
      </div>
      <span class="font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(value)}</span>
    </div>
  `;
}

function getAllFoodViewModel() {
  const query = state.allFoodSearch.trim().toLowerCase();
  let items = state.items.map((item) => ({
    ...item,
    expiry: getFoodExpiryMeta(item)
  }));

  if (query) {
    items = items.filter((item) =>
      [item.name, item.category, item.size].some((value) => String(value).toLowerCase().includes(query))
    );
  }

  if (state.allFoodFilter === "fresh") {
    items = items.filter((item) => item.expiry.tone === "fresh");
  } else if (state.allFoodFilter === "soon") {
    items = items.filter((item) => item.expiry.tone === "soon" || item.expiry.tone === "today");
  } else if (state.allFoodFilter === "expired") {
    items = items.filter((item) => item.expiry.tone === "expired");
  }

  items = sortAllFoodItems(items);

  const visibleIds = items.map((item) => item.id);
  const selectedVisibleCount = visibleIds.filter((id) => state.allFoodSelectedIds.includes(id)).length;

  return {
    items,
    selectedCount: state.allFoodSelectedIds.length,
    selectAll: visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  };
}

function sortAllFoodItems(items) {
  const sorted = [...items];

  if (state.allFoodSort === "created_asc") {
    return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  if (state.allFoodSort === "created_desc") {
    return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return sorted.sort((a, b) => {
    const diff = a.expiry.daysUntil - b.expiry.daysUntil;
    if (diff !== 0) {
      return diff;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getAllFoodBadge(expiry) {
  if (expiry.tone === "expired") {
    return {
      label: "Expired",
      icon: "priority_high",
      badgeClass: "bg-red-100 text-red-600",
      metaClass: "font-bold text-red-500"
    };
  }

  if (expiry.tone === "soon" || expiry.tone === "today") {
    return {
      label: "Expiring Soon",
      icon: "warning",
      badgeClass: "bg-orange-100 text-orange-600",
      metaClass: "font-medium text-orange-500"
    };
  }

  return {
    label: "Fresh",
    icon: "calendar_today",
    badgeClass: "bg-primary/10 text-primary",
    metaClass: "text-slate-500 dark:text-slate-400"
  };
}

function toggleAllFoodSelectedItem(id) {
  if (state.allFoodSelectedIds.includes(id)) {
    state.allFoodSelectedIds = state.allFoodSelectedIds.filter((itemId) => itemId !== id);
    return;
  }

  state.allFoodSelectedIds = [...state.allFoodSelectedIds, id];
}

function toggleAllFoodSelectAll() {
  const visibleIds = getAllFoodViewModel().items.map((item) => item.id);
  const shouldSelectAll = visibleIds.some((id) => !state.allFoodSelectedIds.includes(id));

  if (!shouldSelectAll) {
    state.allFoodSelectedIds = state.allFoodSelectedIds.filter((id) => !visibleIds.includes(id));
    return;
  }

  state.allFoodSelectedIds = [...new Set([...state.allFoodSelectedIds, ...visibleIds])];
}

function clearAllFoodSelection() {
  state.allFoodSelectedIds = [];
}

function getDetailItem() {
  if (!state.detailItemId) {
    return null;
  }

  const item = state.items.find((entry) => entry.id === state.detailItemId);
  if (!item) {
    return null;
  }

  return {
    ...item,
    expiry: getFoodExpiryMeta(item)
  };
}

function getTrashDetailItem() {
  if (!state.trashDetailItemId) {
    return null;
  }

  return state.trashItems.find((item) => item.id === state.trashDetailItemId) || null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.FreshTrackerAppVersion = "1.0.0";

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
