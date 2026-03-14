(function initFreshTrackerAdd(global) {
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

  const categoryOptions = [
    "staple foods",
    "meat",
    "vegetables",
    "eggs",
    "snacks",
    "drinks",
    "frozen",
    "refrigerated",
    "other"
  ];

  function createDraft(item = {}, computeQuickExpiryDate) {
    const normalizedCategory = String(item.category || "").trim().toLowerCase();
    const categoryOption = !normalizedCategory
      ? "staple foods"
      : categoryOptions.includes(normalizedCategory) && normalizedCategory !== "other"
        ? normalizedCategory
        : "other";

    return {
      name: item.name || "",
      category: item.category || categoryOption,
      categoryOption,
      customCategory: categoryOption === "other" ? item.category || "" : "",
      size: item.size || "TEXT",
      icon: item.icon || "restaurant",
      expiryDate: item.expiryDate || computeQuickExpiryDate(0)
    };
  }

  function renderAddFoodSheet(state, escapeHtml) {
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
              ${state.modalMode === "edit"
                ? `
                  <div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p class="text-xs font-bold uppercase tracking-wider text-primary">Current Setup</p>
                    <div class="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Category: ${escapeHtml(state.draft.category)}</span>
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Size: ${escapeHtml(state.draft.size || "TEXT")}</span>
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Icon: ${escapeHtml(state.draft.icon)}</span>
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Expires: ${escapeHtml(state.draft.expiryDate)}</span>
                    </div>
                  </div>
                `
                : ""}
              <div class="grid gap-4">
                <label class="grid gap-2">
                  <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Food Name</span>
                  <input name="name" value="${escapeHtml(state.draft.name)}" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="Whole Milk" />
                </label>
                <div class="grid gap-2">
                  <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Category</span>
                  <div class="flex flex-wrap gap-2">
                    ${categoryOptions.map((option) => renderCategoryOption(option, state.draft.categoryOption)).join("")}
                  </div>
                  ${state.draft.categoryOption === "other"
                    ? `
                      <input
                        name="customCategory"
                        value="${escapeHtml(state.draft.customCategory || "")}"
                        required
                        class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
                        placeholder="Enter custom category"
                      />
                    `
                    : ""}
                </div>
                <label class="grid gap-2">
                  <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Size <span class="font-medium normal-case text-slate-400">(Optional)</span></span>
                  <input name="size" value="${escapeHtml(state.draft.size)}" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="TEXT" />
                </label>
                <label class="grid gap-2">
                  <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Icon <span class="font-medium normal-case text-slate-400">(Optional)</span></span>
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
                  ${renderQuickExpiryButton(state.quickDays, "Eat Soon", 0)}
                  ${renderQuickExpiryButton(state.quickDays, "3 Days", 3)}
                  ${renderQuickExpiryButton(state.quickDays, "7 Days", 7)}
                  ${renderQuickExpiryButton(state.quickDays, "14 Days", 14)}
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

  function renderCategoryOption(option, selectedOption) {
    const active = option === selectedOption;
    const label = option
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return `
      <button
        type="button"
        data-category-option="${option}"
        class="rounded-full px-4 py-2 text-sm font-semibold transition ${
          active
            ? "border border-primary/30 bg-primary/20 text-primary"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        }"
      >
        ${label}
      </button>
    `;
  }

  function renderQuickExpiryButton(selectedDays, label, days) {
    const active = selectedDays === days;
    const base = active
      ? "border border-primary/30 bg-primary/20 text-primary"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

    return `
      <button type="button" data-quick-days="${days}" class="quick-expiry-btn rounded-full px-4 py-2 text-sm font-semibold ${base}">
        ${label}
      </button>
    `;
  }

  function hydrateFormDefaults(state, computeQuickExpiryDate) {
    const input = document.getElementById("expiry-date-input");
    if (!input) {
      return;
    }

    input.value = state.draft.expiryDate || computeQuickExpiryDate(state.quickDays ?? 0);
    highlightEntryMethod(state);
  }

  function highlightEntryMethod(state) {
    document.querySelectorAll(".entry-method-btn").forEach((button) => {
      const active = button.dataset.entryMethod === state.entryMethod;
      button.className =
        "entry-method-btn flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-5 transition-all " +
        (active
          ? "border-primary bg-primary/5 text-primary"
          : "border-slate-100 bg-white text-slate-600 hover:border-primary/50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300");
    });
  }

  global.FreshTrackerAdd = {
    categoryOptions,
    createDraft,
    iconOptions,
    renderAddFoodSheet,
    hydrateFormDefaults,
    highlightEntryMethod
  };
})(window);
