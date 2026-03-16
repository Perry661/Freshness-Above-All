if (!window.FreshTrackerData) {
  throw new Error("uiData.js did not load. Open http://localhost:3000 in a browser.");
}

if (!window.FreshTrackerAdd || !window.FreshTrackerSettings || !window.FreshTrackerTrash || !window.FreshTrackerCalendar || !window.FreshTrackerSound) {
  throw new Error("Required UI modules did not load. Check add.js, scan.js, setting.js, trash.js, calendar.js, and sound.js.");
}

if (!window.FreshTrackerAddPic) {
  throw new Error("addPic.js did not load. Check packaged photo recognition helpers.");
}

const {
  DAY_MS: MS_PER_DAY,
  formatDisplayDate: formatFoodDisplayDate,
  getExpiryMeta: getFoodExpiryMeta,
  fetchFoodItems: fetchFoodItemsFromApi,
  lookupBarcode: lookupBarcodeFromApi,
  searchProductByName: searchProductByNameFromApi,
  fetchAuthSession: fetchAuthSessionFromApi,
  registerWithEmail: registerWithEmailFromApi,
  loginWithEmail: loginWithEmailFromApi,
  logoutSession: logoutSessionFromApi,
  createFoodItem: buildFoodItem,
  createFoodItemOnServer: createFoodItemInApi,
  updateFoodItemOnServer: updateFoodItemInApi,
  deleteFoodItemOnServer: deleteFoodItemInApi,
  fetchSettings: fetchSettingsFromApi,
  updateSettingsOnServer: updateSettingsInApi,
  resetSettingsOnServer: resetSettingsInApi,
  fetchAddSettings: fetchAddSettingsFromApi,
  updateAddSettingsOnServer: updateAddSettingsInApi,
  resetAddSettingsOnServer: resetAddSettingsInApi,
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
  normalizeOcrText,
  extractPackagedFoodName,
  extractPackagedFoodKeywordQuery,
  isLowQualityNameCandidate
} = window.FreshTrackerAddPic;

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

const {
  renderCalendarPage,
  getCalendarViewModel,
  getDateKey,
  getMonthKey,
  parseMonthKey,
  addMonths
} = window.FreshTrackerCalendar;

const {
  setVolume: setSoundVolume,
  playAddSound,
  playDeleteSound,
  playClickSound
} = window.FreshTrackerSound;

const {
  start: startBarcodeScanner,
  stop: stopBarcodeScanner,
  isSupported: isBarcodeScannerSupported
} = window.FreshTrackerScan || {};

const TESSERACT_CDN_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
let tesseractScriptPromise = null;
let tesseractWorkerPromise = null;


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
  dashboardFilter: "all",
  trashSelectionMode: false,
  selectedTrashIds: [],
  allFoodSearch: "",
  allFoodFilter: "all",
  allFoodCategoryFilter: "all",
  allFoodIconFilter: "all",
  allFoodSort: "expiry_asc",
  allFoodSortDraft: "expiry_asc",
  allFoodSelectionMode: false,
  allFoodSelectedIds: [],
  showSortModal: false,
  showFilterModal: false,
  allFoodFilterDraft: "all",
  allFoodCategoryFilterDraft: "all",
  allFoodIconFilterDraft: "all",
  detailItemId: null,
  calendarMonth: getMonthKey(new Date()),
  calendarSelectedDate: getDateKey(new Date()),
  trashDetailItemId: null,
  quickDays: 0,
  expiryPickerMode: "wheel",
  entryMethod: "manual",
  photoToolSheetOpen: false,
  photoCaptureOpen: false,
  photoReviewOpen: false,
  photoRecognitionLoading: false,
  photoRecognitionStatus: "",
  photoFiles: [],
  photoReviewItems: [],
  modalMode: "create",
  editingId: null,
  addFoodScrollTop: 0,
  scanStatus: "",
  scanFeedback: null,
  scanManualCode: "",
  draft: createDraft({}, computeQuickExpiryDate),
  settings: getDefaultSettings(),
  account: { authenticated: false, user: null },
  showAuthSheet: false,
  authMode: "login",
  authEmail: "",
  authError: "",
  reminderDraft: null,
  cleanupDraft: null
};

async function initApp() {
  try {
    state.settings = normalizeSettings(await fetchSettingsFromApi());
  } catch (error) {
    console.warn("Failed to load settings from setting.json:", error);
  }

  try {
    hydrateAllFoodViewSettings(await fetchAddSettingsFromApi());
  } catch (error) {
    console.warn("Failed to load settings from addSetting.json:", error);
  }

  try {
    state.account = await fetchAuthSessionFromApi();
  } catch (error) {
    console.warn("Failed to load auth session:", error);
  }

  applyTheme(state.settings);
  setSoundVolume(state.settings.soundVolume);
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
  captureAddFoodScrollPosition();
  const root = document.getElementById("app");
  const model = buildDashboardModel(state.items);
  const notificationModal =
    state.view === "notification-settings" || state.view === "cleanup"
      ? ""
      : renderAddFoodSheet(state, escapeHtml);
  const detailSheet = state.view === "all-food" || state.view === "calendar" ? renderFoodDetailSheet(getDetailItem()) : "";
  const trashDetailSheet = state.view === "trash" ? renderTrashDetailSheet(getTrashDetailItem(), escapeHtml) : "";

  root.innerHTML = `
    <div class="mx-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden bg-background-light dark:bg-background-dark">
      ${renderCurrentView(model)}
      ${state.view === "notification-settings" || state.view === "cleanup" ? "" : renderBottomNav()}
      ${notificationModal}
      ${detailSheet}
      ${trashDetailSheet}
    </div>
  `;

  hydrateAddFormDefaults(state, computeQuickExpiryDate);
  restoreAddFoodScrollPosition();
  syncScannerUi();
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

  if (state.view === "calendar") {
    return renderCalendarPage(getCalendarViewModel(state.items, state, getFoodExpiryMeta), escapeHtml);
  }

  if (state.view === "all-food") {
    return renderAllFoodPage(getAllFoodViewModel());
  }

  return `
    ${renderHeader(model.stats)}
    ${renderRecentItems(getDashboardVisibleItems(model))}
  `;
}

function renderHeader(stats) {
  return `
    <header class="sticky top-0 z-10 border-b border-primary/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:bg-background-dark/95">
      <div class="flex items-center justify-between gap-3">
        <button type="button" id="dashboard-reset-home" class="group flex items-center gap-3 text-left">
          <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[30px]">kitchen</span>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">Freshness Above All!</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">Freshness comes first</p>
          </div>
        </button>
        <div class="flex items-center gap-1">
          <button id="open-reminder-settings-icon" class="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <span class="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </div>
      <div class="mt-6 grid grid-cols-3 gap-3">
        ${renderStatCard("Expired", stats.expired, "red", "expired")}
        ${renderStatCard("Today", stats.today, "orange", "today")}
        ${renderStatCard("3 Days", stats.threeDays, "amber", "threeDays")}
      </div>
    </header>
  `;
}

function renderStatCard(label, value, tone, filterKey) {
  const active = state.dashboardFilter === filterKey;
  const tones = {
    red: active
      ? "bg-red-100 border-red-300 text-red-700 ring-2 ring-red-200 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300"
      : "bg-red-50 border-red-100 text-red-600 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400",
    orange:
      active
        ? "bg-orange-100 border-orange-300 text-orange-700 ring-2 ring-orange-200 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-300"
        : "bg-orange-50 border-orange-100 text-orange-600 dark:bg-orange-950/30 dark:border-orange-900/50 dark:text-orange-400",
    amber:
      active
        ? "bg-amber-100 border-amber-300 text-amber-700 ring-2 ring-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300"
        : "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400"
  };

  return `
    <button type="button" data-dashboard-filter="${filterKey}" class="${tones[tone]} rounded-2xl border p-4 text-left transition hover:scale-[1.01]">
      <p class="mb-1 text-[10px] font-bold uppercase tracking-wider">${label}</p>
      <div class="flex items-baseline gap-1">
        <span class="text-2xl font-bold">${value}</span>
        <span class="text-xs font-medium">items</span>
      </div>
    </button>
  `;
}

function renderRecentItems(items) {
  const filterTitles = {
    all: "Recent Items",
    expired: "Expired Items",
    today: "Today's Items",
    threeDays: "Items Due In 3 Days"
  };

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
        <p class="font-bold text-slate-500 dark:text-slate-400">${state.dashboardFilter === "all" ? "No food tracked yet" : "No matching food items"}</p>
        <p class="mt-1 text-sm text-slate-400">${state.dashboardFilter === "all" ? "Tap Add New Item to create your first record." : "Tap the dashboard title to restore the default list."}</p>
      </div>
    `;
  } else {
    content = items.map(renderRecentItemCard).join("");
  }

  return `
    <main class="flex-1 overflow-y-auto px-6 pb-32">
      <div class="mb-4 mt-4 flex items-center justify-between">
        <h2 class="text-lg font-bold">${state.selectionMode ? `${selectedCount} Selected` : filterTitles[state.dashboardFilter] || "Recent Items"}</h2>
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
  const calendarActive = state.view === "calendar";
  const allFoodActive = state.view === "all-food";
  const trashActive = state.view === "trash";

  return `
    <nav class="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-4 pb-6 pt-2 dark:border-slate-800 dark:bg-slate-900">
      <div class="relative mx-auto flex max-w-md items-center justify-between">
        <button
          type="button"
          data-nav-view="calendar"
          class="flex flex-col items-center gap-1 transition-colors hover:text-primary ${calendarActive ? "text-primary" : "text-slate-400"}"
        >
          <span class="material-symbols-outlined ${calendarActive ? "fill-1" : ""}">calendar_month</span>
          <span class="text-[10px] font-medium ${calendarActive ? "font-bold" : ""}">Calendar</span>
        </button>
        <button
          type="button"
          data-nav-view="all-food"
          class="flex flex-col items-center gap-1 transition-colors hover:text-primary ${allFoodActive ? "text-primary" : "text-slate-400"}"
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
  const clickedButton = event.target.closest("button");
  if (clickedButton) {
    playClickSound();
  }

  if (event.target.closest("#dashboard-reset-home")) {
    state.dashboardFilter = "all";
    clearSelectionMode();
    setView("dashboard");
    return;
  }

  const dashboardFilterButton = event.target.closest("[data-dashboard-filter]");
  if (dashboardFilterButton) {
    state.dashboardFilter = dashboardFilterButton.dataset.dashboardFilter;
    clearSelectionMode();
    renderApp();
    return;
  }

  const navViewButton = event.target.closest("[data-nav-view]");
  if (navViewButton) {
    setView(navViewButton.dataset.navView);
    return;
  }

  if (event.target.closest("#all-food-back-to-dashboard, #calendar-back-to-dashboard")) {
    setView("dashboard");
    return;
  }

  if (event.target.closest("#calendar-previous-month")) {
    state.calendarMonth = getMonthKey(addMonths(parseMonthKey(state.calendarMonth), -1));
    state.calendarSelectedDate = null;
    renderApp();
    return;
  }

  if (event.target.closest("#calendar-next-month")) {
    state.calendarMonth = getMonthKey(addMonths(parseMonthKey(state.calendarMonth), 1));
    state.calendarSelectedDate = null;
    renderApp();
    return;
  }

  if (event.target.closest("#calendar-go-today")) {
    const today = new Date();
    state.calendarMonth = getMonthKey(today);
    state.calendarSelectedDate = getDateKey(today);
    renderApp();
    return;
  }

  const calendarDateButton = event.target.closest("[data-calendar-date]");
  if (calendarDateButton) {
    state.calendarSelectedDate = calendarDateButton.dataset.calendarDate;
    renderApp();
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

  if (event.target.closest("#open-auth-sheet")) {
    state.showAuthSheet = true;
    state.authError = "";
    state.authEmail = state.account?.user?.email || "";
    renderApp();
    return;
  }

  if (event.target.closest("#close-auth-sheet") || event.target.id === "auth-sheet-overlay") {
    state.showAuthSheet = false;
    state.authError = "";
    renderApp();
    return;
  }

  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    state.authMode = authModeButton.dataset.authMode;
    state.authError = "";
    renderApp();
    return;
  }

  if (event.target.closest("#log-out")) {
    void handleLogout();
    return;
  }

  if (event.target.closest("#toggle-selection-mode")) {
    state.selectionMode = true;
    state.selectedItemIds = [];
    renderApp();
    return;
  }

  if (event.target.closest("#toggle-trash-selection")) {
    state.trashSelectionMode = true;
    state.selectedTrashIds = [];
    renderApp();
    return;
  }

  if (event.target.closest("#cancel-trash-selection")) {
    state.trashSelectionMode = false;
    state.selectedTrashIds = [];
    renderApp();
    return;
  }

  const trashSelectButton = event.target.closest("[data-trash-select-id]");
  if (trashSelectButton) {
    toggleSelectedTrashItem(trashSelectButton.dataset.trashSelectId);
    renderApp();
    return;
  }

  if (event.target.closest("#delete-selected-trash")) {
    if (!state.selectedTrashIds.length) {
      return;
    }

    const confirmed = window.confirm(`Permanently delete ${state.selectedTrashIds.length} item(s) from trash?`);
    if (!confirmed) {
      return;
    }

    await deleteSelectedTrashItems();
    return;
  }

  if (event.target.closest("#toggle-all-food-selection")) {
    state.allFoodSelectionMode = true;
    state.allFoodSelectedIds = [];
    renderApp();
    return;
  }

  if (event.target.closest("#cancel-all-food-selection")) {
    clearAllFoodSelection();
    state.allFoodSelectionMode = false;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-open-sort")) {
    state.allFoodSortDraft = state.allFoodSort;
    state.showSortModal = true;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-open-filter")) {
    state.allFoodFilterDraft = state.allFoodFilter;
    state.allFoodCategoryFilterDraft = state.allFoodCategoryFilter;
    state.allFoodIconFilterDraft = state.allFoodIconFilter;
    state.showFilterModal = true;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-close-sort") || event.target.id === "all-food-sort-overlay") {
    state.allFoodSortDraft = state.allFoodSort;
    state.showSortModal = false;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-close-filter") || event.target.id === "all-food-filter-overlay") {
    syncAllFoodViewDrafts();
    state.showFilterModal = false;
    renderApp();
    return;
  }

  const sortOptionButton = event.target.closest("[data-sort-option]");
  if (sortOptionButton) {
    state.allFoodSortDraft = sortOptionButton.dataset.sortOption;
    renderApp();
    return;
  }

  const filterStatusButton = event.target.closest("[data-filter-status]");
  if (filterStatusButton) {
    state.allFoodFilterDraft = filterStatusButton.dataset.filterStatus;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-apply-sort")) {
    state.allFoodSort = state.allFoodSortDraft;
    state.showSortModal = false;
    persistAllFoodViewSettings();
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-reset-sort")) {
    state.allFoodSort = "expiry_asc";
    state.allFoodSortDraft = "expiry_asc";
    state.showSortModal = false;
    persistAllFoodViewSettings();
    renderApp();
    return;
  }

  const filterChip = event.target.closest("[data-filter-chip]");
  if (filterChip) {
    state.allFoodFilter = filterChip.dataset.filterChip;
    state.allFoodFilterDraft = filterChip.dataset.filterChip;
    persistAllFoodViewSettings();
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-clear-filters")) {
    state.allFoodSearch = "";
    state.allFoodFilter = "all";
    state.allFoodCategoryFilter = "all";
    state.allFoodIconFilter = "all";
    syncAllFoodViewDrafts();
    state.allFoodSelectedIds = [];
    state.showFilterModal = false;
    persistAllFoodViewSettings();
    renderApp();
    return;
  }

  const categoryFilterButton = event.target.closest("[data-category-filter]");
  if (categoryFilterButton) {
    state.allFoodCategoryFilterDraft = categoryFilterButton.dataset.categoryFilter;
    renderApp();
    return;
  }

  const iconFilterButton = event.target.closest("[data-icon-filter]");
  if (iconFilterButton) {
    state.allFoodIconFilterDraft = iconFilterButton.dataset.iconFilter;
    renderApp();
    return;
  }

  if (event.target.closest("#all-food-apply-filter")) {
    state.allFoodFilter = state.allFoodFilterDraft;
    state.allFoodCategoryFilter = state.allFoodCategoryFilterDraft;
    state.allFoodIconFilter = state.allFoodIconFilterDraft;
    state.showFilterModal = false;
    persistAllFoodViewSettings();
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
    await persistSettings()
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
    await persistSettings()
    setView("settings");
    return;
  }

  if (event.target.closest("#theme-toggle")) {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    await persistSettings()
    applyTheme(state.settings);
    renderApp();
    return;
  }

  if (event.target.closest("#restore-settings-defaults")) {
    const confirmed = window.confirm("Restore all settings to defaults?");
    if (!confirmed) {
      return;
    }

    await restoreDefaultSettings()
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
    state.expiryPickerMode = "wheel";
    state.draft.expiryDate = computeQuickExpiryDate(state.quickDays);
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("[data-open-custom-expiry]")) {
    state.quickDays = null;
    state.expiryPickerMode = "native";
    renderApp();
    openModal();
    const input = document.getElementById("expiry-date-input");
    if (input?.showPicker) {
      input.showPicker();
    } else {
      input?.focus();
      input?.click();
    }
    return;
  }

  if (event.target.closest("[data-expiry-mode-toggle]")) {
    state.expiryPickerMode = state.expiryPickerMode === "wheel" ? "native" : "wheel";
    state.quickDays = null;
    renderApp();
    openModal();
    if (state.expiryPickerMode === "native") {
      const input = document.getElementById("expiry-date-input");
      if (input?.showPicker) {
        input.showPicker();
      } else {
        input?.focus();
      }
    }
    return;
  }

  const expiryAdjustButton = event.target.closest("[data-expiry-adjust]");
  if (expiryAdjustButton) {
    state.quickDays = null;
    state.expiryPickerMode = "wheel";
    state.draft.expiryDate = adjustExpiryDate(
      state.draft.expiryDate,
      expiryAdjustButton.dataset.expiryAdjust,
      Number(expiryAdjustButton.dataset.expiryOffset || 0)
    );
    renderApp();
    openModal();
    return;
  }

  const methodButton = event.target.closest(".entry-method-btn");
  if (methodButton) {
    if (methodButton.dataset.entryMethod === "photo") {
      state.photoToolSheetOpen = true;
      renderApp();
      openModal();
      return;
    }

    state.entryMethod = methodButton.dataset.entryMethod;
    state.photoToolSheetOpen = false;
    state.photoCaptureOpen = false;
    state.photoReviewOpen = false;
    if (state.entryMethod !== "scan") {
      stopBarcodeScanner?.();
      state.scanStatus = "";
      state.scanFeedback = null;
    }
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("#close-photo-tool-sheet") || event.target.id === "photo-tool-overlay") {
    state.photoToolSheetOpen = false;
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("#open-barcode-option")) {
    state.entryMethod = "scan";
    state.photoToolSheetOpen = false;
    renderApp();
    openModal();
    return;
  }

  if (
    event.target.closest("#open-photo-capture") ||
    event.target.closest("#photo-shutter") ||
    event.target.closest("#photo-add-more") ||
    event.target.closest("#photo-add-more-top") ||
    event.target.closest("#photo-open-library")
  ) {
    state.entryMethod = "manual";
    state.photoToolSheetOpen = false;
    state.photoCaptureOpen = true;
    state.photoReviewOpen = false;
    renderApp();
    openModal();
    document.getElementById("photo-file-input")?.click();
    return;
  }

  if (event.target.closest("#close-photo-capture")) {
    state.photoCaptureOpen = false;
    renderApp();
    openModal();
    return;
  }

  const removePhotoButton = event.target.closest("[data-remove-photo-id]");
  if (removePhotoButton) {
    removeCapturedPhoto(removePhotoButton.dataset.removePhotoId);
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("#photo-review-trigger")) {
    if (!state.photoFiles.length) {
      return;
    }
    void runPhotoRecognitionFlow();
    return;
  }

  if (event.target.closest("#back-to-photo-capture")) {
    state.photoReviewOpen = false;
    state.photoCaptureOpen = true;
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("#retake-photo-review")) {
    state.photoReviewOpen = false;
    state.photoCaptureOpen = true;
    state.photoReviewItems = [];
    renderApp();
    openModal();
    document.getElementById("photo-file-input")?.click();
    return;
  }

  if (event.target.closest("#save-photo-review-items")) {
    void savePhotoReviewItems();
    return;
  }

  if (event.target.closest("#barcode-start-scan")) {
    startScannerFlow();
    return;
  }

  if (event.target.closest("#barcode-stop-scan")) {
    stopBarcodeScanner?.();
    state.scanStatus = "Scanner stopped.";
    state.scanFeedback = null;
    renderApp();
    openModal();
    return;
  }

  if (event.target.closest("#barcode-use-manual")) {
    const code = normalizeBarcodeInput(state.scanManualCode);
    if (!code) {
      state.scanStatus = "Enter a barcode first.";
      state.scanFeedback = { type: "error", message: "Enter a barcode first." };
      renderApp();
      openModal();
      return;
    }

    const validation = validateBarcodeValue(code);
    if (!validation.valid) {
      state.scanStatus = validation.message;
      state.scanManualCode = code;
      state.scanFeedback = { type: "error", message: validation.message };
      renderApp();
      openModal();
      return;
    }

    applyBarcodeResult(code, { source: "manual" });
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

async function handleChange(event) {
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

  if (event.target.id === "photo-file-input") {
    appendCapturedPhotos(event.target.files);
    event.target.value = "";
    return;
  }

  if (event.target.name === "authEmail") {
    state.authEmail = event.target.value;
  }

  if (event.target.dataset.reviewItemId && event.target.dataset.reviewField) {
    updatePhotoReviewField(event.target.dataset.reviewItemId, event.target.dataset.reviewField, event.target.value);
    renderApp();
    openModal();
  }

  if (event.target.name === "cleanup_reason") {
    state.cleanupDraft.reason = event.target.value;
  }

  if (event.target.id === "sound-volume-input") {
    state.settings.soundVolume = Math.min(200, Math.max(0, Math.round(Number(event.target.value) || 0)));
    await persistSettings()
    setSoundVolume(state.settings.soundVolume);
    renderApp();
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

  if (event.target.id === "barcode-manual-input") {
    state.scanManualCode = normalizeBarcodeInput(event.target.value);
    state.scanFeedback = null;
  }

  if (event.target.id === "sound-volume-input") {
    const nextVolume = Math.min(200, Math.max(0, Math.round(Number(event.target.value) || 0)));
    state.settings.soundVolume = nextVolume;
    setSoundVolume(nextVolume);
    const valueLabel = document.getElementById("sound-volume-value");
    if (valueLabel) {
      valueLabel.textContent = String(nextVolume);
    }
  }

  if (event.target.dataset.reviewItemId && event.target.dataset.reviewField) {
    updatePhotoReviewField(event.target.dataset.reviewItemId, event.target.dataset.reviewField, event.target.value);
  }
}

async function handleSubmit(event) {
  if (event.target.id === "auth-form") {
    event.preventDefault();
    await handleAuthSubmit();
    return;
  }

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
      barcode: getDraftBarcode(),
      brand: getDraftBrand(),
      imageUrl: getDraftImageUrl(),
      source: getDraftSource(),
      createdAt: getExistingCreatedAt()
    });

    if (state.modalMode === "edit") {
      await updateFoodItemInApi(state.editingId, payload);
    } else {
      await createFoodItemInApi(payload);
      playAddSound();
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

function getDraftBarcode() {
  return String(state.draft.barcode || "").trim();
}

function getDraftBrand() {
  return String(state.draft.brand || "").trim();
}

function getDraftImageUrl() {
  return String(state.draft.imageUrl || "").trim();
}

function getDraftSource() {
  return String(state.draft.source || "manual").trim() || "manual";
}

function getExistingQuickDays(expiryDate) {
  const today = computeQuickExpiryDate(0);
  const delta = Math.round((new Date(expiryDate).getTime() - new Date(today).getTime()) / MS_PER_DAY);
  return [0, 3, 7, 14].includes(delta) ? delta : null;
}

function adjustExpiryDate(value, part, offset) {
  const base = parseLocalDateString(value || computeQuickExpiryDate(0));

  if (part === "day") {
    base.setDate(base.getDate() + offset);
    return formatLocalDateString(base);
  }

  if (part === "month") {
    const nextMonth = base.getMonth() + offset;
    const targetYear = base.getFullYear() + Math.floor(nextMonth / 12);
    const normalizedMonth = ((nextMonth % 12) + 12) % 12;
    const targetDay = Math.min(base.getDate(), getDaysInMonth(targetYear, normalizedMonth));
    return formatLocalDateString(new Date(targetYear, normalizedMonth, targetDay));
  }

  if (part === "year") {
    const targetYear = base.getFullYear() + offset;
    const targetDay = Math.min(base.getDate(), getDaysInMonth(targetYear, base.getMonth()));
    return formatLocalDateString(new Date(targetYear, base.getMonth(), targetDay));
  }

  return formatLocalDateString(base);
}

function parseLocalDateString(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function openCreateModal() {
  state.view = ["all-food", "calendar"].includes(state.view) ? state.view : "dashboard";
  state.detailItemId = null;
  clearSelectionMode();
  clearAllFoodSelection();
  state.modalMode = "create";
  state.editingId = null;
  state.quickDays = 0;
  state.expiryPickerMode = "wheel";
  state.entryMethod = "manual";
  state.photoToolSheetOpen = false;
  state.photoCaptureOpen = false;
  state.photoReviewOpen = false;
  state.photoRecognitionLoading = false;
  state.photoRecognitionStatus = "";
  state.photoFiles = [];
  state.photoReviewItems = [];
  state.addFoodScrollTop = 0;
  state.scanStatus = "";
  state.scanFeedback = null;
  state.scanManualCode = "";
  state.draft = createDraft({}, computeQuickExpiryDate);
  renderApp();
  openModal();
}

function openEditModal(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  state.view = ["all-food", "calendar"].includes(state.view) ? state.view : "dashboard";
  state.detailItemId = null;
  clearSelectionMode();
  state.modalMode = "edit";
  state.editingId = id;
  state.quickDays = getExistingQuickDays(item.expiryDate);
  state.expiryPickerMode = "wheel";
  state.entryMethod = "manual";
  state.photoToolSheetOpen = false;
  state.photoCaptureOpen = false;
  state.photoReviewOpen = false;
  state.photoRecognitionLoading = false;
  state.photoRecognitionStatus = "";
  state.photoFiles = [];
  state.photoReviewItems = [];
  state.addFoodScrollTop = 0;
  state.scanStatus = "";
  state.scanFeedback = null;
  state.scanManualCode = "";
  state.draft = createDraft(item, computeQuickExpiryDate);
  renderApp();
  openModal();
}

function resetModalState() {
  revokeCapturedPhotoUrls();
  state.saving = false;
  state.modalMode = "create";
  state.editingId = null;
  state.quickDays = 0;
  state.expiryPickerMode = "wheel";
  state.entryMethod = "manual";
  state.photoToolSheetOpen = false;
  state.photoCaptureOpen = false;
  state.photoReviewOpen = false;
  state.photoRecognitionLoading = false;
  state.photoRecognitionStatus = "";
  state.photoFiles = [];
  state.photoReviewItems = [];
  state.addFoodScrollTop = 0;
  state.scanStatus = "";
  state.scanFeedback = null;
  state.scanManualCode = "";
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
  restoreAddFoodScrollPosition();
  syncScannerUi();
}

function closeModal() {
  const modal = document.getElementById("add-food-modal");
  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  modal.classList.remove("flex");
  stopBarcodeScanner?.();
  if (!state.saving) {
    resetModalState();
    renderApp();
  }
}

function captureAddFoodScrollPosition() {
  const scrollArea = document.getElementById("add-food-scroll-area");
  if (!scrollArea) {
    return;
  }

  state.addFoodScrollTop = scrollArea.scrollTop;
}

function restoreAddFoodScrollPosition() {
  const scrollArea = document.getElementById("add-food-scroll-area");
  if (!scrollArea) {
    return;
  }

  scrollArea.scrollTop = state.addFoodScrollTop || 0;
}

function openModalIfEditing() {
  if (state.modalMode === "edit" || state.saving) {
    openModal();
  }
}

function syncScannerUi() {
  if (state.entryMethod === "scan" && state.view !== "notification-settings" && state.view !== "cleanup") {
    const fallback = isBarcodeScannerSupported?.()
      ? "Ready to scan. Use Start Scan or enter a barcode manually."
      : "Barcode scanning is not supported in this browser. Use manual barcode entry.";
    if (!state.scanStatus) {
      state.scanStatus = fallback;
    }
    return;
  }

  stopBarcodeScanner?.();
}

function startScannerFlow() {
  state.scanStatus = "Starting camera...";
  renderApp();
  openModal();

  startBarcodeScanner?.({
    videoId: "barcode-video",
    onStatus(message) {
      state.scanStatus = message;
      const statusNode = document.getElementById("barcode-status-text");
      if (statusNode) {
        statusNode.textContent = message;
      }
    },
    onDetected(code) {
      applyBarcodeResult(code, { source: "scan" });
    }
  });
}

function applyBarcodeResult(code, options = {}) {
  const normalizedCode = normalizeBarcodeInput(code);
  if (!normalizedCode) {
    return;
  }

  const validation = validateBarcodeValue(normalizedCode);
  if (!validation.valid) {
    state.scanStatus = validation.message;
    state.scanManualCode = normalizedCode;
    state.scanFeedback = { type: "error", message: validation.message };
    renderApp();
    openModal();
    return;
  }

  stopBarcodeScanner?.();
  state.scanManualCode = normalizedCode;
  state.scanFeedback = null;
  state.scanStatus = options.source === "scan"
    ? `Barcode scanned: ${normalizedCode}`
    : `Barcode saved: ${normalizedCode}`;
  state.draft.barcode = normalizedCode;

  if (state.modalMode === "create") {
    const existing = state.items.find((item) => String(item.barcode || "").trim() === normalizedCode);
    if (existing) {
      const matchedDraft = createDraft(existing, computeQuickExpiryDate);
      state.draft = {
        ...state.draft,
        name: matchedDraft.name,
        category: matchedDraft.category,
        categoryOption: matchedDraft.categoryOption,
        customCategory: matchedDraft.customCategory,
        size: matchedDraft.size,
        icon: matchedDraft.icon,
        barcode: normalizedCode,
        brand: matchedDraft.brand || "",
        imageUrl: matchedDraft.imageUrl || "",
        source: "local_barcode_match"
      };
      state.scanStatus = `Matched existing barcode. Food details were auto-filled from ${existing.name}.`;
      state.scanFeedback = null;
      renderApp();
      openModal();
      return;
    }

    lookupBarcodeFromOpenFoodFacts(normalizedCode);
    return;
  }

  renderApp();
  openModal();
}

function normalizeBarcodeInput(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .toUpperCase();
}

function validateBarcodeValue(code) {
  if (!code) {
    return {
      valid: false,
      message: "Enter a barcode first."
    };
  }

  if (/^\d{8}$/.test(code)) {
    return {
      valid: true,
      message: "Valid 8-digit barcode format detected."
    };
  }

  if (/^\d{12}$/.test(code)) {
    return {
      valid: true,
      message: "Valid 12-digit barcode format detected."
    };
  }

  if (/^\d{13}$/.test(code)) {
    return {
      valid: true,
      message: "Valid 13-digit barcode format detected."
    };
  }

  if (/^[A-Z0-9-]{4,32}$/.test(code)) {
    return {
      valid: true,
      message: "Alphanumeric barcode format detected."
    };
  }

  return {
    valid: false,
    message: "This barcode format looks invalid. Use 8/12/13 digits or a simple alphanumeric code."
  };
}

async function lookupBarcodeFromOpenFoodFacts(code) {
  state.scanStatus = "Looking up product details from Open Food Facts...";
  state.scanFeedback = null;
  renderApp();
  openModal();

  try {
    const result = await lookupBarcodeFromApi(code);
    if (!result?.found) {
      state.scanStatus = "Barcode saved, but no product details were found in Open Food Facts.";
      state.scanFeedback = {
        type: "info",
        message: "No matching product was found in Open Food Facts for this barcode."
      };
      renderApp();
      openModal();
      return;
    }

    state.draft = {
      ...state.draft,
      name: result.name || state.draft.name,
      category: result.category || state.draft.category,
      categoryOption: normalizeDraftCategoryOption(result.category),
      customCategory: normalizeDraftCategoryOption(result.category) === "other" ? (result.category || "") : "",
      size: result.size || state.draft.size,
      icon: inferIconFromCategory(result.category || state.draft.category),
      barcode: result.barcode || code,
      brand: result.brand || "",
      imageUrl: result.imageUrl || "",
      source: result.source || "open_food_facts"
    };
    state.scanStatus = `Matched Open Food Facts product${result.name ? `: ${result.name}` : ""}.`;
    state.scanFeedback = null;
  } catch (error) {
    state.scanStatus = `Barcode saved, but lookup failed: ${error.message}`;
    state.scanFeedback = {
      type: "error",
      message: `Lookup failed: ${error.message}`
    };
  }

  renderApp();
  openModal();
}

function normalizeDraftCategoryOption(category) {
  const normalized = String(category || "").trim().toLowerCase();
  return window.FreshTrackerAdd.categoryOptions.includes(normalized) ? normalized : "other";
}

function inferIconFromCategory(category) {
  const normalized = String(category || "").trim().toLowerCase();
  if (normalized === "drinks") {
    return "water_drop";
  }
  if (normalized === "vegetables") {
    return "eco";
  }
  if (normalized === "eggs") {
    return "egg";
  }
  if (normalized === "staple foods") {
    return "bakery_dining";
  }
  if (normalized === "meat") {
    return "set_meal";
  }
  if (normalized === "snacks") {
    return "nutrition";
  }
  return "restaurant";
}

function appendCapturedPhotos(fileList) {
  const files = Array.from(fileList || []).filter((file) => file && String(file.type || "").startsWith("image/"));
  if (!files.length) {
    return;
  }

  const nextPhotos = files.map((file, index) => ({
    id: `photo-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || `Photo ${index + 1}`,
    url: URL.createObjectURL(file),
    file,
    active: false
  }));

  state.photoFiles = [...state.photoFiles.map((photo) => ({ ...photo, active: false })), ...nextPhotos];
  state.photoRecognitionStatus = `${state.photoFiles.length} photo${state.photoFiles.length === 1 ? "" : "s"} ready. Add more photos or start AI review.`;
  if (state.photoFiles.length) {
    state.photoFiles[state.photoFiles.length - 1].active = true;
  }
  renderApp();
  openModal();
}

function removeCapturedPhoto(photoId) {
  const removed = state.photoFiles.find((photo) => photo.id === photoId);
  if (removed?.url) {
    URL.revokeObjectURL(removed.url);
  }

  state.photoFiles = state.photoFiles
    .filter((photo) => photo.id !== photoId)
    .map((photo, index, list) => ({ ...photo, active: index === list.length - 1 }));

  if (!state.photoFiles.length) {
    state.photoCaptureOpen = false;
    state.photoReviewOpen = false;
    state.photoReviewItems = [];
    state.photoToolSheetOpen = true;
    state.photoRecognitionStatus = "";
  }
}

function revokeCapturedPhotoUrls() {
  state.photoFiles.forEach((photo) => {
    if (photo?.url) {
      URL.revokeObjectURL(photo.url);
    }
  });
}

function buildPhotoReviewItems() {
  return state.photoFiles.map((photo, index) => {
    const recognition = recognizePhotoDraft(photo, "", index);
    return {
      id: `review-${photo.id}`,
      photoId: photo.id,
      previewUrl: photo.url,
      icon: recognition.icon,
      name: recognition.name,
      expiryDate: recognition.expiryDate,
      missingFields: recognition.missingFields
    };
  });
}

function recognizePhotoDraft(photo, recognizedText, index) {
  const fileName = String(photo.name || "");
  const stem = fileName.replace(/\.[^.]+$/, "");
  const expiryDate = extractExpiryDateFromText(recognizedText) || extractDateFromPhotoName(stem);
  const name = extractNameFromText(recognizedText) || extractNameFromPhotoName(stem);
  const normalizedName = String(name || "").trim();

  return {
    name: normalizedName,
    expiryDate,
    icon: inferIconFromName(normalizedName),
    missingFields: [
      ...(normalizedName ? [] : ["name"]),
      ...(expiryDate ? [] : ["expiryDate"])
    ]
  };
}

function extractDateFromPhotoName(value) {
  const text = String(value || "");
  const iso = text.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const us = text.match(/([01]?\d)[-_]([0-3]?\d)[-_](20\d{2})/);
  if (us) {
    const month = String(us[1]).padStart(2, "0");
    const day = String(us[2]).padStart(2, "0");
    return `${us[3]}-${month}-${day}`;
  }

  return "";
}

function extractExpiryDateFromText(value) {
  const text = String(value || "");
  const upper = text.toUpperCase();

  const monthMap = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12"
  };

  const labeledIso = upper.match(/(?:EXP|EXPIRES|EXPIRATION|BEST BY|USE BY|SELL BY)[^\dA-Z]{0,8}(20\d{2})[\/\-. ]([01]?\d)[\/\-. ]([0-3]?\d)/);
  if (labeledIso) {
    return `${labeledIso[1]}-${String(labeledIso[2]).padStart(2, "0")}-${String(labeledIso[3]).padStart(2, "0")}`;
  }

  const labeledUs = upper.match(/(?:EXP|EXPIRES|EXPIRATION|BEST BY|USE BY|SELL BY)[^\dA-Z]{0,8}([01]?\d)[\/\-. ]([0-3]?\d)[\/\-. ](20\d{2})/);
  if (labeledUs) {
    return `${labeledUs[3]}-${String(labeledUs[1]).padStart(2, "0")}-${String(labeledUs[2]).padStart(2, "0")}`;
  }

  const labeledTextual = upper.match(/(?:EXP|EXPIRES|EXPIRATION|BEST BY|USE BY|SELL BY)[^A-Z0-9]{0,8}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+([0-3]?\d)[, ]+\s*(20\d{2})/);
  if (labeledTextual) {
    return `${labeledTextual[3]}-${monthMap[labeledTextual[1]]}-${String(labeledTextual[2]).padStart(2, "0")}`;
  }

  const plainIso = upper.match(/\b(20\d{2})[\/\-. ]([01]?\d)[\/\-. ]([0-3]?\d)\b/);
  if (plainIso) {
    return `${plainIso[1]}-${String(plainIso[2]).padStart(2, "0")}-${String(plainIso[3]).padStart(2, "0")}`;
  }

  const plainUs = upper.match(/\b([01]?\d)[\/\-. ]([0-3]?\d)[\/\-. ](20\d{2})\b/);
  if (plainUs) {
    return `${plainUs[3]}-${String(plainUs[1]).padStart(2, "0")}-${String(plainUs[2]).padStart(2, "0")}`;
  }

  return "";
}

function extractNameFromPhotoName(value) {
  const text = String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/g, " ")
    .replace(/([01]?\d)[-_]([0-3]?\d)[-_](20\d{2})/g, " ")
    .replace(/\b(img|image|photo|scan|capture|dsc|pxl|mvimg)\b/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || /^[\d\s]+$/.test(text)) {
    return "";
  }

  return text
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractNameFromText(value) {
  const rawText = String(value || "");
  const normalizedText = normalizeOcrText(rawText);
  const packagedName = extractPackagedFoodName(normalizedText);
  if (packagedName) {
    return packagedName;
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocked = [
    "nutrition facts",
    "ingredients",
    "barcode",
    "best by",
    "use by",
    "sell by",
    "exp",
    "expires",
    "distributed by",
    "keep refrigerated",
    "net wt",
    "serving size"
  ];

  const candidates = lines
    .filter((line) => {
      const normalized = line.toLowerCase();
      if (normalized.length < 3 || normalized.length > 48) {
        return false;
      }
      if (/\d{2,}/.test(normalized) && !/[a-z]/i.test(normalized.replace(/\d+/g, ""))) {
        return false;
      }
      if (blocked.some((token) => normalized.includes(token))) {
        return false;
      }
      if (/^[^a-z]*$/i.test(normalized)) {
        return false;
      }
      return /[a-z]/i.test(normalized);
    })
    .sort((a, b) => scoreNameCandidate(b) - scoreNameCandidate(a));

  return candidates[0] || "";
}

function scoreNameCandidate(line) {
  const normalized = String(line || "").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  let score = 0;
  score += Math.min(18, normalized.length);
  score += Math.min(10, words.length * 2);
  if (/^[A-Z][A-Z\s]+$/.test(normalized)) {
    score += 4;
  }
  if (/^[A-Za-z][A-Za-z\s&()%'-]+$/.test(normalized)) {
    score += 4;
  }
  if (/[’']s\b/.test(normalized)) {
    score += 4;
  }
  if (/\b(classic|original|cheese|milk|chips|bread|yogurt|eggs|spinach|water)\b/i.test(normalized)) {
    score += 5;
  }
  if (words.length >= 2 && words.length <= 5) {
    score += 4;
  }
  if (/\b(no|free|artificial|gluten|ingredients|potatoes)\b/i.test(normalized)) {
    score -= 6;
  }
  return score;
}

function inferIconFromName(name) {
  const value = String(name || "").toLowerCase();
  if (!value) {
    return "restaurant";
  }
  if (/(chocolate|candy|hazelnut|snickers|twix|kitkat|ferrero|rocher)/.test(value)) {
    return "nutrition";
  }
  if (/(milk|organic milk|omega-3 milk|dha milk|whole milk|reduced fat milk|low fat milk)/.test(value)) {
    return "water_drop";
  }
  if (/(milk|drink|juice|water|tea|coffee)/.test(value)) {
    return "water_drop";
  }
  if (/(spinach|lettuce|vegetable|salad|broccoli)/.test(value)) {
    return "eco";
  }
  if (/(egg)/.test(value)) {
    return "egg";
  }
  if (/(bread|toast|bagel)/.test(value)) {
    return "bakery_dining";
  }
  if (/(pizza)/.test(value)) {
    return "local_pizza";
  }
  if (/(yogurt|milk|cheese)/.test(value)) {
    return "nutrition";
  }
  return "restaurant";
}

async function runPhotoRecognitionFlow() {
  state.photoRecognitionLoading = true;
  state.photoRecognitionStatus = "Preparing free on-device OCR...";
  renderApp();
  openModal();

  try {
    const worker = await getTesseractWorker();
    const reviewItems = [];

    for (let index = 0; index < state.photoFiles.length; index += 1) {
      const photo = state.photoFiles[index];
      state.photoRecognitionStatus = `Analyzing photo ${index + 1} of ${state.photoFiles.length}...`;
      renderApp();
      openModal();

      let recognizedText = "";
      try {
        const result = await worker.recognize(photo.file);
        recognizedText = String(result?.data?.text || "");
      } catch (error) {
        console.warn("Photo OCR failed for", photo.name, error);
      }

      let recognition = recognizePhotoDraft(photo, recognizedText, index);
      const searchQuery = buildProductSearchQuery(recognition.name, recognizedText);
      if (searchQuery) {
        state.photoRecognitionStatus = `Matching product ${index + 1} of ${state.photoFiles.length} with Open Food Facts...`;
        renderApp();
        openModal();
        try {
          const searchResult = await searchProductByNameFromApi(searchQuery);
          const matchedProduct = pickBestOpenFoodFactsMatch(searchQuery, recognition.name, searchResult?.results || []);
          if (matchedProduct) {
            recognition = {
              ...recognition,
              name: matchedProduct.name,
              icon: inferIconFromName(matchedProduct.name),
              missingFields: recognition.missingFields.filter((field) => field !== "name")
            };
          }
        } catch (error) {
          console.warn("Open Food Facts search fallback failed:", error);
        }
      }

      reviewItems.push({
        id: `review-${photo.id}`,
        photoId: photo.id,
        previewUrl: photo.url,
        icon: recognition.icon,
        name: recognition.name,
        expiryDate: recognition.expiryDate,
        missingFields: recognition.missingFields
      });
    }

    state.photoReviewItems = reviewItems;
    state.photoCaptureOpen = false;
    state.photoReviewOpen = true;
    state.photoRecognitionStatus = "";
  } catch (error) {
    console.warn("Falling back to heuristic photo parsing:", error);
    state.photoReviewItems = buildPhotoReviewItems();
    state.photoCaptureOpen = false;
    state.photoReviewOpen = true;
    state.photoRecognitionStatus = "";
  } finally {
    state.photoRecognitionLoading = false;
    renderApp();
    openModal();
  }
}

function loadTesseractScript() {
  if (globalThis.Tesseract) {
    return Promise.resolve(globalThis.Tesseract);
  }

  if (!tesseractScriptPromise) {
    tesseractScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tesseract-loader="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(globalThis.Tesseract), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Tesseract.js.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = TESSERACT_CDN_URL;
      script.async = true;
      script.dataset.tesseractLoader = "true";
      script.onload = () => resolve(globalThis.Tesseract);
      script.onerror = () => reject(new Error("Failed to load Tesseract.js."));
      document.head.appendChild(script);
    });
  }

  return tesseractScriptPromise;
}

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const Tesseract = await loadTesseractScript();
      if (!Tesseract?.createWorker) {
        throw new Error("Tesseract.js is not available.");
      }

      const worker = await Tesseract.createWorker("eng");
      return worker;
    })();
  }

  return tesseractWorkerPromise;
}

function buildProductSearchQuery(nameCandidate, recognizedText) {
  const normalizedText = normalizeOcrText(recognizedText);
  const packagedName = extractPackagedFoodName(normalizedText);
  if (packagedName) {
    return packagedName;
  }

  const packagedKeywords = extractPackagedFoodKeywordQuery(normalizedText);
  if (packagedKeywords) {
    return packagedKeywords;
  }

  const preferred = String(nameCandidate || "").trim();
  if (preferred && !isLowQualityNameCandidate(preferred)) {
    return preferred;
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[a-z]/i.test(line))
    .slice(0, 3);

  return lines.join(" ").slice(0, 60).trim();
}

function pickBestOpenFoodFactsMatch(query, recognizedName, results) {
  const baseline = String(recognizedName || query || "").trim();
  const scored = results
    .map((result) => ({
      ...result,
      score: scoreProductMatch(baseline, result.name, result.brand)
    }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score < 0.34) {
    return null;
  }

  return scored[0];
}

function scoreProductMatch(inputName, candidateName, brand) {
  const inputTokens = tokenizeProductName(inputName);
  const candidateTokens = tokenizeProductName(candidateName);
  const brandTokens = tokenizeProductName(brand);

  if (!inputTokens.length || !candidateTokens.length) {
    return 0;
  }

  const intersection = inputTokens.filter((token) => candidateTokens.includes(token)).length;
  const union = new Set([...inputTokens, ...candidateTokens]).size || 1;
  const jaccard = intersection / union;
  const prefixBonus = candidateName.toLowerCase().startsWith(String(inputName || "").trim().toLowerCase()) ? 0.18 : 0;
  const brandBonus = inputTokens.some((token) => brandTokens.includes(token)) ? 0.15 : 0;

  return jaccard + prefixBonus + brandBonus;
}

function tokenizeProductName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/lay'?s/g, "lays")
    .replace(/dorito'?s/g, "doritos")
    .replace(/cheeto'?s/g, "cheetos")
    .replace(/ruffle'?s/g, "ruffles")
    .replace(/pringle'?s/g, "pringles")
    .replace(/reese'?s/g, "reeses")
    .replace(/m&m'?s/g, "mms")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !["with", "made", "real", "the", "and"].includes(token));
}

function updatePhotoReviewField(itemId, field, value) {
  state.photoReviewItems = state.photoReviewItems.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const nextValue = field === "name" ? value : value;
    const missingFields = item.missingFields.filter((entry) => entry !== field);
    if (!String(nextValue || "").trim()) {
      missingFields.push(field);
    }

    return {
      ...item,
      [field]: nextValue,
      missingFields
    };
  });
}

async function savePhotoReviewItems() {
  const invalid = state.photoReviewItems.find((item) => !String(item.name || "").trim() || !String(item.expiryDate || "").trim());
  if (invalid) {
    state.error = "Complete item name and expiration date for every recognized item before saving.";
    renderApp();
    openModal();
    return;
  }

  state.saving = true;
  renderApp();
  openModal();

  try {
    for (const item of state.photoReviewItems) {
      const payload = buildFoodItem({
        name: item.name,
        category: "other",
        size: "TEXT",
        expiryDate: item.expiryDate,
        icon: item.icon || "restaurant",
        imageUrl: "",
        source: "photo_ai_review"
      });
      await createFoodItemInApi(payload);
    }

    playAddSound();
    resetModalState();
    closeModal();
    await refreshItems();
  } catch (error) {
    state.error = error.message;
    state.saving = false;
    renderApp();
    openModal();
  }
}

async function handleAuthSubmit() {
  state.authError = "";
  const email = String(state.authEmail || "").trim().toLowerCase();
  if (!email) {
    state.authError = "Enter an email first.";
    renderApp();
    return;
  }

  try {
    state.account = state.authMode === "register"
      ? await registerWithEmailFromApi(email)
      : await loginWithEmailFromApi(email);
    state.showAuthSheet = false;
    state.authEmail = state.account?.user?.email || "";
  } catch (error) {
    state.authError = error.message;
  }

  renderApp();
}

async function handleLogout() {
  try {
    state.account = await logoutSessionFromApi();
  } catch (error) {
    state.authError = error.message;
  }

  state.showAuthSheet = false;
  state.authEmail = "";
  state.authError = "";
  renderApp();
}

function computeQuickExpiryDate(days) {
  const date = new Date(Date.now() + days * MS_PER_DAY);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function persistSettings() {
  const savedSettings = await updateSettingsInApi(state.settings);
  state.settings = normalizeSettings({ ...state.settings, ...(savedSettings || {}) });
  setSoundVolume(state.settings.soundVolume);
  return state.settings;
}

async function restoreDefaultSettings() {
  const savedSettings = await resetSettingsInApi();
  state.settings = normalizeSettings({ ...getDefaultSettings(), ...(savedSettings || {}) });
  setSoundVolume(state.settings.soundVolume);
  return state.settings;
}

function setView(view) {
  state.view = view;
  if (view !== "dashboard") {
    state.dashboardFilter = "all";
    resetModalState();
    clearSelectionMode();
  }
  if (view !== "all-food") {
    clearAllFoodSelection();
    state.allFoodSelectionMode = false;
    state.showSortModal = false;
    state.showFilterModal = false;
  }
  if (view !== "all-food" && view !== "calendar") {
    state.detailItemId = null;
  }
  if (view !== "trash") {
    state.trashDetailItemId = null;
    state.trashSelectionMode = false;
    state.selectedTrashIds = [];
  }
  renderApp();
}

function getDashboardVisibleItems(model) {
  const items = model.allItems || model.recentItems || [];

  if (state.dashboardFilter === "expired") {
    return items.filter((item) => item.expiry.daysUntil < 0);
  }

  if (state.dashboardFilter === "today") {
    return items.filter((item) => item.expiry.daysUntil === 0);
  }

  if (state.dashboardFilter === "threeDays") {
    return items.filter((item) => item.expiry.daysUntil >= 1 && item.expiry.daysUntil <= 3);
  }

  return model.recentItems || [];
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

  playDeleteSound();
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

async function deleteSelectedTrashItems() {
  const ids = [...state.selectedTrashIds];
  for (const id of ids) {
    await deleteTrashItemInApi(id);
  }

  state.selectedTrashIds = [];
  state.trashSelectionMode = false;
  await refreshTrashItems();
}

function toggleSelectedTrashItem(id) {
  if (state.selectedTrashIds.includes(id)) {
    state.selectedTrashIds = state.selectedTrashIds.filter((itemId) => itemId !== id);
    return;
  }

  state.selectedTrashIds = [...state.selectedTrashIds, id];
}

function clearSelectionMode() {
  state.selectionMode = false;
  state.selectedItemIds = [];
}

function renderAllFoodPage(model) {
  return `
    <div class="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
      <header class="flex flex-col gap-2 border-b border-primary/10 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-md dark:bg-background-dark/95">
        <div class="flex items-center justify-between gap-3">
          <button id="all-food-back-to-dashboard" class="group flex items-center gap-3 text-left transition-opacity hover:opacity-80">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[30px]">kitchen</span>
            </div>
            <div>
              <h1 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">All Food Inventory</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400">${model.items.length} item${model.items.length === 1 ? "" : "s"} visible</p>
            </div>
          </button>
        </div>
        <div class="-mb-1 rounded-[28px] border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70">
          <div class="flex gap-2">
            <label class="flex flex-1 items-center rounded-2xl border border-slate-200 bg-background-light px-4 py-3 transition-all focus-within:border-primary/30 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800/60">
              <span class="material-symbols-outlined mr-2 text-xl text-slate-400">search</span>
            <input id="all-food-search" value="${escapeHtml(state.allFoodSearch)}" class="w-full border-none bg-transparent text-sm placeholder:text-slate-400 focus:ring-0" placeholder="Search food items..." type="text"/>
            </label>
            <button id="all-food-open-sort" class="flex h-14 min-w-14 items-center justify-center rounded-2xl border ${isAllFoodSortActive() ? "border-primary/20 bg-primary/10 text-primary shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"} transition-colors hover:border-primary/20 hover:bg-primary/10 hover:text-primary">
              <span class="material-symbols-outlined">sort</span>
            </button>
            <button id="all-food-open-filter" class="flex h-14 min-w-14 items-center justify-center rounded-2xl border ${isAllFoodFilterActive() ? "border-primary/20 bg-primary/10 text-primary shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"} transition-colors hover:border-primary/20 hover:bg-primary/10 hover:text-primary">
              <span class="material-symbols-outlined">tune</span>
            </button>
          </div>
          <div class="mt-3 no-scrollbar flex gap-2 overflow-x-auto">
            ${renderAllFoodFilterChip("all", "All Items")}
            ${renderAllFoodFilterChip("fresh", "Fresh")}
            ${renderAllFoodFilterChip("soon", "Expiring Soon")}
            ${renderAllFoodFilterChip("expired", "Expired")}
          </div>
        </div>
      </header>
      <main class="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-32 pt-4">
        ${state.allFoodSelectionMode ? `
          <div class="mb-4 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-3">
            <button id="all-food-select-all" class="flex items-center gap-2">
              <span class="flex h-5 w-5 items-center justify-center rounded border border-primary/30 text-primary ${model.selectAll ? "bg-primary text-white" : "bg-white"}">
                <span class="material-symbols-outlined text-[14px]">check</span>
              </span>
              <span class="text-sm font-medium text-slate-600 dark:text-slate-300">Select All</span>
            </button>
            <div class="flex items-center gap-3">
              <button id="cancel-all-food-selection" class="text-sm font-semibold text-slate-500 dark:text-slate-400">Cancel</button>
              <button ${model.selectedCount ? "" : "disabled"} id="all-food-clean-up" class="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40">
                <span class="material-symbols-outlined text-sm">delete_sweep</span>
                Clean Up
              </button>
            </div>
          </div>
        ` : `
          <div class="mb-4 flex items-center justify-end gap-3">
            <button id="refresh-foods" class="text-sm font-semibold text-primary">Refresh</button>
            <span class="h-5 w-px bg-current text-primary/70"></span>
            <button ${model.items.length ? '' : 'disabled'} id="toggle-all-food-selection" class="text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40">Select</button>
          </div>
        `}
        ${renderAllFoodList(model.items)}
      </main>
      ${state.showSortModal ? renderAllFoodSortModal() : ""}
      ${state.showFilterModal ? renderAllFoodFilterModal(model) : ""}
    </div>
  `;
}

function renderAllFoodFilterChip(id, label) {
  const active = state.allFoodFilter === id;
  return `
    <button data-filter-chip="${id}" class="whitespace-nowrap rounded-full px-4 py-2 text-xs ${active ? "bg-primary font-semibold text-slate-900 shadow-lg shadow-primary/20" : "border border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}">
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
  const selectionMode = state.allFoodSelectionMode;
  const badge = getAllFoodBadge(item.expiry);
  const datePrefix = item.expiry.tone === "expired" ? "Expired" : "Expires";
  const detailTarget = `data-detail-id="${item.id}"`;

  return `
    <div class="group flex items-center gap-4 rounded-xl border border-primary/5 bg-white p-3 shadow-sm transition-all hover:border-primary/30 dark:bg-slate-800/40">
      <div class="relative">
        <button ${detailTarget} class="flex h-14 w-14 items-center justify-center rounded-lg border border-primary/10 bg-primary/10 text-primary ${selectionMode ? 'pointer-events-none' : ''}">
          <span class="material-symbols-outlined text-3xl">${item.icon}</span>
        </button>
        ${selectionMode ? `
          <button data-all-food-select-id="${item.id}" class="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded border border-primary/30 bg-white text-primary">
            ${selected ? '<span class="material-symbols-outlined text-[12px]">check</span>' : ""}
          </button>
        ` : ''}
      </div>
      <div class="min-w-0 flex-1">
        <button ${detailTarget} class="block w-full truncate text-left font-bold text-slate-800 dark:text-white ${selectionMode ? 'pointer-events-none' : ''}">${escapeHtml(item.name)}</button>
        <div class="mt-0.5 flex items-center gap-1 text-xs ${badge.metaClass}">
          <span class="material-symbols-outlined text-[14px]">${badge.icon}</span>
          <span>${datePrefix}: ${escapeHtml(formatFoodDisplayDate(item.expiryDate))}</span>
        </div>
      </div>
      <div class="shrink-0 flex flex-col items-end gap-2">
        <span class="whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.badgeClass}">${badge.label}</span>
        <button ${detailTarget} class="material-symbols-outlined cursor-pointer text-slate-300 transition-colors group-hover:text-primary ${selectionMode ? 'pointer-events-none' : ''}">chevron_right</button>
      </div>
    </div>
  `;
}

function renderAllFoodSortModal() {
  return `
    <div id="all-food-sort-overlay" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
      <div class="sheet-enter w-full max-w-md overflow-hidden rounded-t-[32px] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:bg-slate-900">
        <div class="flex h-5 w-full items-center justify-center pt-2">
          <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>
        <div class="px-6 pb-8 pt-4">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-slate-100">Sort By</h2>
            <button id="all-food-close-sort" class="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span class="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>
          <div class="mb-6">
            <div class="mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-sm">event_busy</span>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Expiration Date</h3>
            </div>
            <div class="space-y-2">
              ${renderSortOption("expiry_asc", "calendar_add_on", "Oldest to Newest")}
              ${renderSortOption("expiry_desc", "event_upcoming", "Newest to Oldest")}
            </div>
          </div>
          <div class="mb-8">
            <div class="mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-sm">calendar_add_on</span>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Addition Date</h3>
            </div>
            <div class="space-y-2">
              ${renderSortOption("created_asc", "schedule", "Oldest to Newest")}
              ${renderSortOption("created_desc", "history", "Newest to Oldest")}
            </div>
          </div>
          <div class="flex gap-3">
            <button id="all-food-reset-sort" class="flex-1 rounded-xl border border-primary/20 bg-primary/5 py-4 font-semibold text-primary transition hover:bg-primary/10">Refresh</button>
            <button id="all-food-apply-sort" class="flex-1 rounded-xl bg-primary py-4 font-bold text-slate-900 shadow-lg shadow-primary/20 transition hover:bg-primary/90">Apply Sort</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSortOption(id, icon, label) {
  const active = state.allFoodSortDraft === id;

  return `
    <button data-sort-option="${id}" class="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${active ? "border-primary/25 bg-primary/10 text-slate-900 dark:text-slate-100" : "border-slate-100 bg-slate-50/60 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800"}">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[20px]">${icon}</span>
        <span class="text-sm font-semibold">${label}</span>
      </div>
      <span class="flex h-5 w-5 items-center justify-center rounded-full border-2 ${active ? "border-primary bg-primary" : "border-slate-300 dark:border-slate-600"}">
        ${active ? '<span class="h-2.5 w-2.5 rounded-full bg-white"></span>' : ""}
      </span>
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

function renderAllFoodFilterModal(model) {
  return `
    <div id="all-food-filter-overlay" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
      <div class="sheet-enter w-full max-w-md overflow-hidden rounded-t-[32px] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:bg-slate-900">
        <div class="flex h-5 w-full items-center justify-center pt-2">
          <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>
        <div class="px-6 pb-8 pt-4">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-slate-100">Apply Filters</h2>
            <button id="all-food-close-filter" class="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span class="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>
          <div class="space-y-6">
            <div>
              <div class="mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-sm">instant_mix</span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</h3>
              </div>
              <div class="grid grid-cols-2 gap-2">
                ${renderAllFoodSegmentButton("all", "All Items", state.allFoodFilterDraft, "filter-status")}
                ${renderAllFoodSegmentButton("fresh", "Fresh", state.allFoodFilterDraft, "filter-status")}
                ${renderAllFoodSegmentButton("soon", "Expiring Soon", state.allFoodFilterDraft, "filter-status")}
                ${renderAllFoodSegmentButton("expired", "Expired", state.allFoodFilterDraft, "filter-status")}
              </div>
            </div>
            <div>
              <div class="mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-sm">category</span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</h3>
              </div>
              <div class="flex flex-wrap gap-2">
                ${renderAllFoodModalChip("all", "All Categories", state.allFoodCategoryFilterDraft, "category-filter")}
                ${model.categories.map((category) => renderAllFoodModalChip(category.value, category.label, state.allFoodCategoryFilterDraft, "category-filter")).join("")}
              </div>
            </div>
            <div>
              <div class="mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-sm">widgets</span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Icon Type</h3>
              </div>
              <div class="flex flex-wrap gap-2">
                ${renderAllFoodModalChip("all", "All Icons", state.allFoodIconFilterDraft, "icon-filter")}
                ${renderAllFoodModalChip("system-icon", "Custom Icon", state.allFoodIconFilterDraft, "icon-filter")}
                ${renderAllFoodModalChip("default-restaurant", "Default Restaurant", state.allFoodIconFilterDraft, "icon-filter")}
              </div>
            </div>
            <div class="rounded-xl border border-primary/10 bg-primary/5 p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-primary">Preview</p>
              <p class="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">${getAllFoodFilterSummary(model)}</p>
            </div>
          </div>
          <div class="mt-6 flex gap-3">
            <button id="all-food-clear-filters" class="flex-1 rounded-xl border border-primary/20 bg-primary/5 py-3 font-semibold text-primary transition hover:bg-primary/10">Reset</button>
            <button id="all-food-apply-filter" class="flex-1 rounded-xl bg-primary py-3 font-bold text-slate-900 shadow-lg shadow-primary/20 transition hover:bg-primary/90">Apply</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAllFoodModalChip(value, label, selectedValue, dataKey) {
  const active = value === selectedValue;
  const attribute = dataKey === "category-filter" ? "data-category-filter" : "data-icon-filter";
  return `
    <button ${attribute}="${escapeHtml(value)}" class="rounded-full px-4 py-2 text-sm ${active ? "bg-primary font-semibold text-slate-900 shadow-lg shadow-primary/20" : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}">
      ${escapeHtml(label)}
    </button>
  `;
}

function renderAllFoodSegmentButton(value, label, selectedValue, dataKey) {
  const active = value === selectedValue;
  const attribute = dataKey === "filter-status" ? "data-filter-status" : "";

  return `
    <button ${attribute}="${escapeHtml(value)}" class="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${active ? "border-primary/20 bg-primary/10 text-primary" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}">
      ${escapeHtml(label)}
    </button>
  `;
}

function getAllFoodFilterSummary(model) {
  const statusMap = {
    all: "All items",
    fresh: "Fresh only",
    soon: "Expiring soon",
    expired: "Expired only"
  };

  const iconMap = {
    all: "all icons",
    "system-icon": "custom icons",
    "default-restaurant": "default restaurant icon"
  };

  const category = state.allFoodCategoryFilterDraft === "all"
    ? "all categories"
    : model.categories.find((item) => item.value === state.allFoodCategoryFilterDraft)?.label || state.allFoodCategoryFilterDraft;

  return `${statusMap[state.allFoodFilterDraft] || "All items"}, ${category}, ${iconMap[state.allFoodIconFilterDraft] || "all icons"}.`;
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

  if (state.allFoodCategoryFilter && state.allFoodCategoryFilter !== "all") {
    items = items.filter((item) => String(item.category).toLowerCase() === state.allFoodCategoryFilter);
  }

  if (state.allFoodIconFilter === "system-icon") {
    items = items.filter((item) => Boolean(item.icon));
  } else if (state.allFoodIconFilter === "default-restaurant") {
    items = items.filter((item) => !item.icon || item.icon === "restaurant");
  }

  items = sortAllFoodItems(items);

  const visibleIds = items.map((item) => item.id);
  const selectedVisibleCount = visibleIds.filter((id) => state.allFoodSelectedIds.includes(id)).length;

  const categories = Array.from(new Set(state.items.map((item) => String(item.category || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map((category) => ({ value: category.toLowerCase(), label: category }));

  return {
    items,
    categories,
    selectedCount: state.allFoodSelectedIds.length,
    selectAll: visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  };
}

function getAllFoodViewSettingsPayload() {
  return {
    allFoodSort: state.allFoodSort,
    allFoodFilter: state.allFoodFilter,
    allFoodCategoryFilter: state.allFoodCategoryFilter,
    allFoodIconFilter: state.allFoodIconFilter
  };
}

function hydrateAllFoodViewSettings(settings) {
  const next = settings && typeof settings === "object" ? settings : {};
  state.allFoodSort = ["expiry_asc", "expiry_desc", "created_asc", "created_desc"].includes(next.allFoodSort) ? next.allFoodSort : "expiry_asc";
  state.allFoodFilter = ["all", "fresh", "soon", "expired"].includes(next.allFoodFilter) ? next.allFoodFilter : "all";
  state.allFoodCategoryFilter = typeof next.allFoodCategoryFilter === "string" && next.allFoodCategoryFilter ? next.allFoodCategoryFilter : "all";
  const normalizedIconFilter = next.allFoodIconFilter === "with-icon" ? "system-icon" : next.allFoodIconFilter === "default-icon" ? "default-restaurant" : next.allFoodIconFilter;
  state.allFoodIconFilter = ["all", "system-icon", "default-restaurant"].includes(normalizedIconFilter) ? normalizedIconFilter : "all";
  syncAllFoodViewDrafts();
}

function syncAllFoodViewDrafts() {
  state.allFoodSortDraft = state.allFoodSort;
  state.allFoodFilterDraft = state.allFoodFilter;
  state.allFoodCategoryFilterDraft = state.allFoodCategoryFilter;
  state.allFoodIconFilterDraft = state.allFoodIconFilter;
}

function persistAllFoodViewSettings() {
  updateAddSettingsInApi(getAllFoodViewSettingsPayload()).catch((error) => {
    console.warn("Failed to save settings to addSetting.json:", error);
  });
}

function isAllFoodSortActive() {
  return state.showSortModal || state.allFoodSort !== "expiry_asc";
}

function isAllFoodFilterActive() {
  return state.showFilterModal || state.allFoodFilter !== "all" || state.allFoodCategoryFilter !== "all" || state.allFoodIconFilter !== "all";
}

function sortAllFoodItems(items) {
  const sorted = [...items];

  if (state.allFoodSort === "created_asc") {
    return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  if (state.allFoodSort === "created_desc") {
    return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  if (state.allFoodSort === "expiry_desc") {
    return sorted.sort((a, b) => {
      const diff = b.expiry.daysUntil - a.expiry.daysUntil;
      if (diff !== 0) {
        return diff;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
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
        <strong>Freshness Above All! failed to start.</strong>\n\n${escapeHtml(error.message || String(error))}
      </div>
    `;
  }
});
