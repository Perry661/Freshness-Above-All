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
      barcode: item.barcode || "",
      brand: item.brand || "",
      imageUrl: item.imageUrl || "",
      source: item.source || "manual",
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
    const expiryPicker = getExpiryPickerModel(state.draft.expiryDate);
    const isWheelMode = state.expiryPickerMode !== "native";

    return `
      <div id="add-food-modal" class="fixed inset-0 z-50 hidden items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
        <div class="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl dark:bg-slate-900">
          <div class="flex h-6 w-full items-center justify-center pt-2">
            <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <div class="flex items-center justify-between px-6 pb-2 pt-4">
            <h1 class="text-[44px] font-bold tracking-tight leading-none text-slate-900 dark:text-slate-100">${title.replace(" ", "")}</h1>
            <button id="close-add-food" class="rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
              <span class="material-symbols-outlined text-[36px] text-slate-400">close</span>
            </button>
          </div>
          <div id="add-food-scroll-area" class="max-h-[80vh] overflow-y-auto px-6 py-4">
            <div class="grid grid-cols-2 gap-5">
              <button data-entry-method="manual" class="entry-method-btn flex min-h-[168px] flex-col items-center justify-center gap-5 rounded-[24px] border-2 p-5 transition-all">
                <span class="material-symbols-outlined text-[42px]">edit_note</span>
                <span class="text-[18px] font-bold leading-none">Manual Entry</span>
              </button>
              <button data-entry-method="photo" class="entry-method-btn flex min-h-[168px] flex-col items-center justify-center gap-5 rounded-[24px] border-2 p-5 transition-all">
                <span class="material-symbols-outlined text-[42px]">photo_camera</span>
                <span class="text-[18px] font-bold leading-none">Photo / Scan</span>
              </button>
            </div>

            <form id="add-food-form" class="mt-8 flex flex-col gap-6">
              ${state.entryMethod === "scan" ? renderBarcodePanel(state, escapeHtml) : ""}
              <label class="grid gap-2">
                <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Food Name</span>
                <input name="name" value="${escapeHtml(state.draft.name)}" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="Whole Milk" />
              </label>

              <div class="flex flex-col gap-3">
                <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Quick Expiry</h3>
                <div class="flex flex-wrap gap-2">
                  ${renderQuickExpiryButton(state.quickDays, "Eat Soon", 0)}
                  ${renderQuickExpiryButton(state.quickDays, "3 Days", 3)}
                  ${renderQuickExpiryButton(state.quickDays, "7 Days", 7)}
                  ${renderQuickExpiryButton(state.quickDays, "14 Days", 14)}
                  ${renderCustomExpiryButton(state.quickDays)}
                </div>
              </div>

              <div class="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-bold uppercase tracking-wider text-slate-500">Select Expiration Date</p>
                    <p class="mt-1 text-sm text-slate-400">Use quick expiry above or pick a custom calendar date below.</p>
                  </div>
                  <button
                    type="button"
                    data-expiry-mode-toggle="true"
                    class="flex size-11 shrink-0 items-center justify-center rounded-2xl transition ${
                      isWheelMode
                        ? "bg-primary/10 text-primary"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                    }"
                  >
                    <span class="material-symbols-outlined">${isWheelMode ? "edit_calendar" : "calendar_month"}</span>
                  </button>
                </div>

                ${isWheelMode
                  ? `
                    <div class="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                      <div class="grid grid-cols-3 gap-3">
                        ${renderExpiryWheelColumn("month", expiryPicker.monthWheel.previous, expiryPicker.monthWheel.current, expiryPicker.monthWheel.next)}
                        ${renderExpiryWheelColumn("day", expiryPicker.dayWheel.previous, expiryPicker.dayWheel.current, expiryPicker.dayWheel.next)}
                        ${renderExpiryWheelColumn("year", expiryPicker.yearWheel.previous, expiryPicker.yearWheel.current, expiryPicker.yearWheel.next)}
                      </div>
                    </div>
                    <input id="expiry-date-input" name="expiryDate" type="date" required class="sr-only" />
                  `
                  : `
                    <label class="relative mt-5 block cursor-pointer">
                      <div class="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 dark:border-slate-800 dark:bg-slate-800/60">
                        <div class="flex items-center justify-between gap-4">
                          <div>
                            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Native Picker</p>
                            <p class="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">${escapeHtml(expiryPicker.display)}</p>
                          </div>
                          <span class="material-symbols-outlined text-2xl text-primary">calendar_month</span>
                        </div>
                      </div>
                      <input id="expiry-date-input" name="expiryDate" type="date" required class="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                  `}

                <div class="mt-4 flex items-center justify-between rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3">
                  <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-primary">Selected Date</p>
                    <p class="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">${escapeHtml(expiryPicker.display)}</p>
                  </div>
                  <button type="button" data-open-custom-expiry="true" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200">
                    ${isWheelMode ? "Custom" : "Pick Date"}
                  </button>
                </div>
              </div>

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

              ${state.modalMode === "edit"
                ? `
                  <div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p class="text-xs font-bold uppercase tracking-wider text-primary">Current Setup</p>
                    <div class="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Category: ${escapeHtml(state.draft.category)}</span>
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Size: ${escapeHtml(state.draft.size || "TEXT")}</span>
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Icon: ${escapeHtml(state.draft.icon)}</span>
                      ${state.draft.brand ? `<span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Brand: ${escapeHtml(state.draft.brand)}</span>` : ""}
                      ${state.draft.barcode ? `<span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Barcode: ${escapeHtml(state.draft.barcode)}</span>` : ""}
                      <span class="rounded-full bg-white px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Expires: ${escapeHtml(state.draft.expiryDate)}</span>
                    </div>
                  </div>
                `
                : ""}

              ${state.modalMode === "edit" ? `
                <button type="button" id="delete-in-modal" class="rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100">
                  Delete This Item
                </button>
              ` : ""}

            </form>
          </div>
          <div class="bg-white p-6 pt-2 dark:bg-slate-900">
            <button ${state.saving ? "disabled" : ""} form="add-food-form" class="w-full rounded-xl bg-primary py-4 font-bold text-slate-900 shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              ${cta}
            </button>
          </div>
        </div>
        <input id="photo-file-input" type="file" accept="image/*" capture="environment" multiple class="hidden" />
        ${state.photoToolSheetOpen ? renderPhotoToolSheet() : ""}
        ${state.photoCaptureOpen ? renderPhotoCaptureSheet(state, escapeHtml) : ""}
        ${state.photoReviewOpen ? renderPhotoReviewSheet(state, escapeHtml) : ""}
      </div>
    `;
  }

  function renderPhotoToolSheet() {
    return `
      <div id="photo-tool-overlay" class="absolute inset-0 z-[60] flex items-end justify-center bg-slate-900/45 p-0">
        <div class="sheet-enter w-full max-w-lg overflow-hidden rounded-t-[32px] bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] dark:bg-slate-900">
          <div class="flex h-8 w-full items-center justify-center pt-3">
            <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <div class="px-8 pb-10 pt-4">
            <div class="flex flex-col gap-1">
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Add Item</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Choose how you'd like to capture food details</p>
            </div>
            <div class="mt-8 grid grid-cols-2 gap-5">
              <button id="open-barcode-option" class="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 bg-slate-50/70 p-8 transition-all hover:border-primary dark:border-slate-800 dark:bg-slate-800/30">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm transition-colors group-hover:bg-primary/10 dark:bg-slate-800">
                  <span class="material-symbols-outlined text-4xl text-slate-700 group-hover:text-primary dark:text-slate-200">barcode_scanner</span>
                </div>
                <span class="font-bold text-slate-900 dark:text-white">Scan Barcode</span>
              </button>
              <button id="open-photo-capture" class="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 bg-slate-50/70 p-8 transition-all hover:border-primary dark:border-slate-800 dark:bg-slate-800/30">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm transition-colors group-hover:bg-primary/10 dark:bg-slate-800">
                  <span class="material-symbols-outlined text-4xl text-slate-700 group-hover:text-primary dark:text-slate-200">photo_camera</span>
                </div>
                <span class="font-bold text-slate-900 dark:text-white">Take Picture</span>
              </button>
            </div>
            <button id="close-photo-tool-sheet" class="mt-8 w-full py-4 text-center text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPhotoCaptureSheet(state, escapeHtml) {
    const count = state.photoFiles.length;
    return `
      <div class="absolute inset-0 z-[70] flex items-end justify-center bg-black">
        <div class="flex h-full w-full max-w-lg flex-col bg-black text-white">
          <div class="flex items-center justify-between px-6 py-4">
            <button id="close-photo-capture" class="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md">
              <span class="material-symbols-outlined text-white">close</span>
            </button>
            <div class="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 backdrop-blur-md">
              <div class="h-2 w-2 rounded-full bg-primary ${count ? "animate-pulse" : ""}"></div>
              <span class="text-sm font-semibold tracking-wide">${count} PHOTO${count === 1 ? "" : "S"} TAKEN</span>
            </div>
            <button id="photo-add-more-top" class="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md">
              <span class="material-symbols-outlined text-white">add_a_photo</span>
            </button>
          </div>

          <div class="relative mx-auto aspect-[3/4] w-full overflow-hidden bg-slate-950">
            ${state.photoFiles.length
              ? `<img alt="Latest capture preview" class="h-full w-full object-cover opacity-90" src="${escapeHtml(state.photoFiles[state.photoFiles.length - 1].url)}" />`
              : `<div class="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(17,212,50,0.16),transparent_34%),linear-gradient(180deg,#101010_0%,#050505_100%)]">
                  <div class="flex flex-col items-center gap-3 text-center">
                    <span class="material-symbols-outlined text-[64px] text-white/80">photo_camera</span>
                    <p class="max-w-xs text-sm font-medium text-white/70">Take one or more photos of the package front and expiration date.</p>
                  </div>
                </div>`}
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div class="relative h-48 w-48 rounded-lg border border-white/30">
                <div class="absolute -left-1 -top-1 h-4 w-4 border-l-2 border-t-2 border-primary"></div>
                <div class="absolute -right-1 -top-1 h-4 w-4 border-r-2 border-t-2 border-primary"></div>
                <div class="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-primary"></div>
                <div class="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-primary"></div>
              </div>
            </div>
            <div class="pointer-events-none absolute bottom-6 left-0 right-0 text-center">
              <p class="text-sm font-medium text-white/80 drop-shadow-md">Align item name and expiration date within the frame</p>
            </div>
          </div>

          <div class="flex flex-1 flex-col justify-between bg-black px-6 py-6">
            <div class="mb-4 min-h-[52px]">
              ${state.photoRecognitionStatus
                ? `<div class="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur-sm">
                    ${escapeHtml(state.photoRecognitionStatus)}
                  </div>`
                : ""}
            </div>
            <div class="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              ${state.photoFiles.length
                ? state.photoFiles.map((photo) => `
                    <div class="relative shrink-0">
                      <img alt="${escapeHtml(photo.name)}" class="h-16 w-16 rounded-lg border-2 ${photo.active ? "border-primary" : "border-white/20"} object-cover" src="${escapeHtml(photo.url)}" />
                      <button type="button" data-remove-photo-id="${photo.id}" class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                        <span class="material-symbols-outlined text-[12px] text-white">close</span>
                      </button>
                    </div>
                  `).join("")
                : `<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-white/30">
                    <span class="material-symbols-outlined text-xl">photo_library</span>
                  </div>`}
              <button id="photo-add-more" class="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-white/40 transition hover:border-primary/60 hover:text-primary">
                <span class="material-symbols-outlined text-xl">add</span>
              </button>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <button id="photo-open-library" class="flex h-12 w-12 items-center justify-center">
                <span class="material-symbols-outlined text-3xl text-white">image</span>
              </button>
              <button id="photo-shutter" class="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white transition-transform active:scale-95">
                <span class="h-[58px] w-[58px] rounded-full bg-white"></span>
              </button>
              <button id="photo-flip-camera" class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <span class="material-symbols-outlined text-white">flip_camera_ios</span>
              </button>
            </div>

            <div class="mt-6">
              <button id="photo-review-trigger" ${(count && !state.photoRecognitionLoading) ? "" : "disabled"} class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-black shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                <span>${state.photoRecognitionLoading ? "Analyzing Photos..." : "Review AI Scan"}</span>
                <span class="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPhotoReviewSheet(state, escapeHtml) {
    return `
      <div class="absolute inset-0 z-[80] flex items-end justify-center bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
        <div class="flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden">
          <header class="sticky top-0 z-30 border-b border-slate-100 bg-white/85 px-4 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
            <div class="mx-auto flex max-w-lg items-center justify-between">
              <button id="back-to-photo-capture" class="p-2 -ml-2">
                <span class="material-symbols-outlined text-slate-500">arrow_back_ios</span>
              </button>
              <h1 class="text-lg font-bold">Review AI Scan</h1>
              <div class="w-10"></div>
            </div>
          </header>
          <main class="min-h-0 flex-1 overflow-y-auto pb-56">
            <div class="mx-auto max-w-lg px-4 py-6">
              <div class="mb-6">
                <p class="text-sm font-medium text-slate-500">${state.photoReviewItems.length} item${state.photoReviewItems.length === 1 ? "" : "s"} recognized from your photos. Tap any field to correct.</p>
              </div>
              <div class="space-y-4">
                ${state.photoReviewItems.map((item) => renderPhotoReviewCard(item, escapeHtml)).join("")}
              </div>
            </div>
          </main>
          <div class="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white/90 p-6 pb-8 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
            <div class="mx-auto flex max-w-lg flex-col gap-3">
              <button id="save-photo-review-items" class="w-full rounded-xl bg-primary py-4 font-bold text-slate-900 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                Save All Items
              </button>
              <button id="retake-photo-review" class="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 transition-all active:scale-[0.98] dark:bg-slate-800 dark:text-slate-300">
                Retake Photos
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPhotoReviewCard(item, escapeHtml) {
    const missingName = item.missingFields.includes("name");
    const missingExpiry = item.missingFields.includes("expiryDate");
    const ocrCandidates = Array.isArray(item.ocrDebug?.candidateRegions) ? item.ocrDebug.candidateRegions : [];
    const ocrText = String(item.ocrDebug?.text || "").trim();

    return `
      <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="flex gap-4">
          <div class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            ${item.previewUrl
              ? `<img alt="${escapeHtml(item.name || "Captured item")}" class="h-full w-full object-cover" src="${escapeHtml(item.previewUrl)}" />`
              : `<span class="material-symbols-outlined text-3xl text-slate-400">${escapeHtml(item.icon || "restaurant")}</span>`}
          </div>
          <div class="flex-1 space-y-3">
            <div>
              <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider ${missingName ? "text-red-500" : "text-slate-400"}">Item Name</label>
              <div class="${missingName ? "rounded-lg border-2 border-red-300 bg-red-50 px-2 py-1.5 dark:border-red-800 dark:bg-red-950/20" : ""}">
                <input data-review-item-id="${item.id}" data-review-field="name" class="w-full border-none bg-transparent p-0 text-base font-semibold text-slate-900 focus:ring-0 dark:text-white" type="text" value="${escapeHtml(item.name || "")}" placeholder="${missingName ? "Set item name manually" : ""}" />
              </div>
              ${missingName ? `<p class="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-500"><span class="material-symbols-outlined text-xs">info</span>Cannot see the item name</p>` : ""}
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider ${missingExpiry ? "text-red-500" : "text-slate-400"}">Expiration Date</label>
              <div class="flex items-center gap-2 ${missingExpiry ? "rounded-lg border-2 border-red-300 bg-red-50 px-2 py-1.5 dark:border-red-800 dark:bg-red-950/20" : ""}">
                <span class="material-symbols-outlined text-sm ${missingExpiry ? "text-red-500" : "text-slate-400"}">${missingExpiry ? "event_busy" : "calendar_today"}</span>
                <input data-review-item-id="${item.id}" data-review-field="expiryDate" class="w-full border-none bg-transparent p-0 text-sm text-slate-600 focus:ring-0 dark:text-slate-300 ${missingExpiry ? "placeholder:text-red-300 dark:placeholder:text-red-500/70" : ""}" type="date" value="${escapeHtml(item.expiryDate || "")}" placeholder="${missingExpiry ? "Set date manually" : ""}" />
              </div>
              ${missingExpiry ? `<p class="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-500"><span class="material-symbols-outlined text-xs">info</span>Cannot see the expiration date</p>` : ""}
            </div>
          </div>
        </div>
        ${(ocrCandidates.length || ocrText)
          ? `<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-slate-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-slate-200">
              <p class="mb-2 font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">OCR Debug</p>
              ${ocrCandidates.length
                ? `<div class="space-y-1">
                    ${ocrCandidates.slice(0, 6).map((candidate, index) => `
                      <div class="rounded-md bg-white/80 px-2 py-1 dark:bg-slate-900/40">
                        <span class="font-semibold text-amber-700 dark:text-amber-300">#${index + 1}</span>
                        <span class="ml-2">${escapeHtml(candidate)}</span>
                      </div>
                    `).join("")}
                  </div>`
                : ""}
              ${ocrText
                ? `<div class="mt-2 rounded-md bg-white/70 px-2 py-2 text-[11px] leading-5 text-slate-600 dark:bg-slate-900/30 dark:text-slate-300">
                    ${escapeHtml(ocrText.slice(0, 500))}
                  </div>`
                : ""}
            </div>`
          : ""}
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

  function renderCustomExpiryButton(selectedDays) {
    const active = selectedDays === null;

    return `
      <button type="button" data-open-custom-expiry="true" class="rounded-full px-4 py-2 text-sm font-semibold ${
        active
          ? "border border-primary/30 bg-primary/20 text-primary"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }">
        <span class="material-symbols-outlined mr-1 text-base align-[-3px]">calendar_month</span>
        Custom
      </button>
    `;
  }

  function renderBarcodePanel(state, escapeHtml) {
    const status = state.scanStatus || "Start scanning to capture a barcode. If this code already exists, fields will auto-fill.";
    const feedback = state.scanFeedback || { type: "", message: "" };
    const inputClass = feedback.type === "error"
      ? "border-red-300 bg-red-50 text-red-700 focus:border-red-400 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
      : "border-slate-200 bg-white focus:border-primary dark:border-slate-700 dark:bg-slate-800";

    return `
      <section class="rounded-[28px] border border-primary/15 bg-primary/[0.04] p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-bold uppercase tracking-wider text-slate-500">Barcode Scan</p>
            <p id="barcode-status-text" class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(status)}</p>
          </div>
          <span class="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span class="material-symbols-outlined">barcode_scanner</span>
          </span>
        </div>
        <div id="barcode-scanner-root" class="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 dark:border-slate-800">
          <div class="relative aspect-[4/3]">
            <video id="barcode-video" class="h-full w-full object-cover" autoplay playsinline muted></video>
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div class="h-24 w-56 rounded-2xl border-2 border-white/85 shadow-[0_0_0_999px_rgba(15,23,42,0.34)]"></div>
            </div>
          </div>
        </div>
        <div class="mt-4 flex gap-3">
          <button type="button" id="barcode-start-scan" class="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-slate-900 shadow-lg shadow-primary/20 transition hover:bg-primary/90">
            Start Scan
          </button>
          <button type="button" id="barcode-stop-scan" class="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Stop
          </button>
        </div>
        <div class="mt-4 grid gap-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500">Manual Barcode Entry</label>
          <p class="text-xs text-slate-400">Supports 8 / 12 / 13-digit barcodes, or simple alphanumeric codes like <span class="font-semibold">LOT-2026-001</span>.</p>
          <div class="flex gap-3">
            <input id="barcode-manual-input" value="${escapeHtml(state.scanManualCode || "")}" class="flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition ${inputClass}" placeholder="Enter UPC / EAN / Code 128" />
            <button type="button" id="barcode-use-manual" class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10">
              Use Code
            </button>
          </div>
          ${feedback.message
            ? `
              <p class="text-xs font-semibold ${feedback.type === "error" ? "text-red-500" : "text-amber-600 dark:text-amber-400"}">
                ${feedback.type === "error" ? "ERROR: " : ""}
                ${escapeHtml(feedback.message)}
              </p>
            `
            : ""}
        </div>
        <input type="hidden" name="barcode" value="${escapeHtml(state.draft.barcode || "")}" />
      </section>
    `;
  }

  function renderExpiryWheelColumn(part, previous, current, next) {
    return `
      <div class="rounded-[24px] bg-white/70 px-3 py-4 text-center dark:bg-slate-900/40">
        <button type="button" data-expiry-adjust="${part}" data-expiry-offset="-1" class="flex w-full items-center justify-center rounded-2xl px-2 py-4 text-2xl font-semibold text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-800">
          ${previous}
        </button>
        <div class="my-2 rounded-[22px] bg-primary/10 px-2 py-6 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          ${current}
        </div>
        <button type="button" data-expiry-adjust="${part}" data-expiry-offset="1" class="flex w-full items-center justify-center rounded-2xl px-2 py-4 text-2xl font-semibold text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-slate-800">
          ${next}
        </button>
      </div>
    `;
  }

  function getExpiryPickerModel(value) {
    const selectedDate = parsePickerDate(value);
    const previousDay = shiftDate(selectedDate, -1);
    const nextDay = shiftDate(selectedDate, 1);
    const previousMonth = shiftMonth(selectedDate, -1);
    const nextMonth = shiftMonth(selectedDate, 1);
    const previousYear = shiftYear(selectedDate, -1);
    const nextYear = shiftYear(selectedDate, 1);

    return {
      previous: formatPickerParts(previousDay),
      current: formatPickerParts(selectedDate),
      next: formatPickerParts(nextDay),
      monthWheel: {
        previous: formatPickerParts(previousMonth).month,
        current: formatPickerParts(selectedDate).month,
        next: formatPickerParts(nextMonth).month
      },
      dayWheel: {
        previous: formatPickerParts(previousDay).day,
        current: formatPickerParts(selectedDate).day,
        next: formatPickerParts(nextDay).day
      },
      yearWheel: {
        previous: formatPickerParts(previousYear).year,
        current: formatPickerParts(selectedDate).year,
        next: formatPickerParts(nextYear).year
      },
      display: selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    };
  }

  function parsePickerDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function shiftDate(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function shiftMonth(date, offset) {
    const next = new Date(date);
    const targetMonth = next.getMonth() + offset;
    next.setMonth(targetMonth, 1);
    next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    return next;
  }

  function shiftYear(date, offset) {
    const next = new Date(date);
    const targetYear = next.getFullYear() + offset;
    next.setFullYear(targetYear, next.getMonth(), 1);
    next.setDate(Math.min(date.getDate(), new Date(targetYear, next.getMonth() + 1, 0).getDate()));
    return next;
  }

  function formatPickerParts(date) {
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: String(date.getDate()).padStart(2, "0"),
      year: String(date.getFullYear())
    };
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
      const active =
        button.dataset.entryMethod === "manual"
          ? state.entryMethod === "manual"
          : state.entryMethod === "scan" || state.photoToolSheetOpen || state.photoCaptureOpen || state.photoReviewOpen;
      button.className =
        "entry-method-btn flex min-h-[168px] flex-col items-center justify-center gap-5 rounded-[24px] border-2 p-5 transition-all " +
        (active
          ? "border-primary bg-primary/5 text-primary shadow-[inset_0_0_0_1px_rgba(17,212,50,0.1)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-primary/50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300");
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
