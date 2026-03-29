(function initFreshTrackerTrash(global) {
  const cleanupReasons = [
    {
      id: "finished",
      title: "Finished",
      description: "I consumed everything",
      icon: "check_circle"
    },
    {
      id: "expired",
      title: "Expired",
      description: "Items are no longer fresh",
      icon: "event_busy"
    },
    {
      id: "other",
      title: "Other",
      description: "Something else happened",
      icon: "more_horiz"
    }
  ];

  function createCleanupDraft(itemIds = []) {
    return {
      itemIds,
      reason: "finished",
      notes: ""
    };
  }

  function renderTrashPage(state, escapeHtml) {
    const items = state.trashItems || [];
    const hasItems = items.length > 0;
    const selectedCount = (state.selectedTrashIds || []).length;
    const content = state.isTrashLoading
      ? `
        <div class="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center text-slate-500">
          Loading deleted items...
        </div>
      `
      : renderTrashList(state, items, escapeHtml);

    return `
      <header class="sticky top-0 z-10 border-b border-primary/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:bg-background-dark/95">
        <div class="flex items-center justify-between gap-3">
          <button type="button" data-nav-view="dashboard" class="group flex items-center gap-3 text-left">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[30px]">delete</span>
            </div>
            <h1 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">Trash</h1>
          </button>
          <div class="flex items-center gap-1">
            ${state.trashSelectionMode
              ? `<button type="button" id="cancel-trash-selection" class="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>`
              : `<button type="button" id="toggle-trash-selection" ${hasItems ? '' : 'disabled'} class="rounded-full px-3 py-2 text-sm font-semibold text-primary transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800">Select</button>`}
            <button
              type="button"
              id="empty-trash"
              ${hasItems && !state.trashSelectionMode ? '' : 'disabled'}
              class="flex h-10 w-10 items-center justify-center rounded-full text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span class="material-symbols-outlined">delete_sweep</span>
            </button>
          </div>
        </div>
      </header>
      <main data-view-scroll="trash" class="flex-1 overflow-y-auto pb-[calc(10rem+env(safe-area-inset-bottom))]">
        <div class="px-4 pb-2 pt-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">${state.trashSelectionMode ? `${selectedCount} Selected` : 'Recently Deleted'}</h2>
            ${state.trashSelectionMode ? `<button ${selectedCount ? '' : 'disabled'} id="delete-selected-trash" class="text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>` : ''}
          </div>
          ${content}
        </div>
      </main>
    `;
  }

  function renderTrashList(state, items, escapeHtml) {
    if (!items.length) {
      return `
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <p class="font-bold text-slate-500 dark:text-slate-400">Trash is empty</p>
          <p class="mt-1 text-sm text-slate-400">Deleted items will appear here until they expire or are restored.</p>
        </div>
      `;
    }

    return `<div class="space-y-3">${items.map((item) => renderTrashCard(state, item, escapeHtml)).join("")}</div>`;
  }

  function renderTrashCard(state, item, escapeHtml) {
    const faded = item.timeLeft.totalMs <= 24 * 60 * 60 * 1000;
    const selected = (state.selectedTrashIds || []).includes(item.id);

    return `
      <div class="flex items-center gap-4 rounded-xl border border-primary/5 bg-white p-3 shadow-sm dark:bg-slate-900/50 ${faded ? "opacity-80" : ""} ${selected ? "ring-2 ring-primary/40" : ""}">
        ${state.trashSelectionMode ? `
          <button type="button" data-trash-select-id="${item.id}" class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition ${selected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-900"}">
            <span class="material-symbols-outlined text-[16px]">check</span>
          </button>
        ` : ""}
        <button data-trash-detail-id="${item.id}" class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15 ${state.trashSelectionMode ? "pointer-events-none" : ""}">
          <span class="material-symbols-outlined text-3xl">${escapeHtml(item.icon)}</span>
        </button>
        <div class="min-w-0 flex-1">
          <button data-trash-detail-id="${item.id}" class="truncate text-left font-bold text-slate-900 dark:text-slate-100 ${state.trashSelectionMode ? "pointer-events-none" : ""}">${escapeHtml(item.name)}</button>
          <div class="mt-0.5 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-red-500">schedule</span>
            <p class="text-sm font-medium text-red-500">${escapeHtml(item.timeLeft.label)}</p>
          </div>
        </div>
        ${state.trashSelectionMode ? "" : `
          <button
            type="button"
            data-restore-id="${item.id}"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-primary/90"
          >
            Restore
          </button>
        `}
      </div>
    `;
  }

  function renderTrashDetailSheet(item, escapeHtml) {
    if (!item) {
      return "";
    }

    return `
      <div class="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm">
        <div class="mx-auto flex w-full max-w-2xl flex-col rounded-t-xl bg-white shadow-2xl dark:bg-background-dark">
          <button class="flex h-6 w-full items-center justify-center">
            <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </button>
          <div class="max-h-[75vh] flex-1 overflow-y-auto">
            <div class="flex items-center justify-between px-4 py-2">
              <button id="close-trash-detail" class="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                <span class="material-symbols-outlined">close</span>
              </button>
              <button data-restore-id="${item.id}" class="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-primary/90">
                Restore
              </button>
            </div>
            <div class="px-4 py-2">
              <div class="flex min-h-56 w-full items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                <span class="material-symbols-outlined text-8xl">${escapeHtml(item.icon)}</span>
              </div>
            </div>
            <div class="px-4 pt-4">
              <h2 class="text-3xl font-bold leading-tight text-slate-900 dark:text-slate-100">${escapeHtml(item.name)}</h2>
              <div class="mt-2 flex flex-wrap gap-2">
                <span class="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">${escapeHtml(item.category)}</span>
                <span class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(item.size)}</span>
              </div>
            </div>
            <div class="mx-4 mt-6 rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p class="text-xs font-bold uppercase tracking-wider text-rose-500">Deleted Because</p>
              <p class="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">${escapeHtml(formatCleanupReason(item.cleanupReason))}</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(item.cleanupNotes || "No additional details were provided.")}</p>
            </div>
            <div class="space-y-4 px-4 py-6">
              ${renderTrashDetailRow("schedule", "Time Left", item.timeLeft.label, escapeHtml)}
              ${renderTrashDetailRow("delete", "Deleted At", formatDeletedDate(item.deletedAt), escapeHtml)}
              ${renderTrashDetailRow("event", "Permanent Removal", formatDeletedDate(item.expiresAt), escapeHtml)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTrashDetailRow(icon, label, value, escapeHtml) {
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

  function formatCleanupReason(reasonId) {
    return cleanupReasons.find((reason) => reason.id === reasonId)?.title || "Unknown";
  }

  function formatDeletedDate(value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function renderCleanupPage(state, escapeHtml) {
    const selectedItems = getCleanupItems(state);
    const primaryReason = cleanupReasons[0].id;
    const draft = state.cleanupDraft || createCleanupDraft(selectedItems.map((item) => item.id));

    return `
      <div class="relative flex min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-white shadow-xl dark:bg-background-dark">
        <div class="sticky top-0 z-10 border-b border-primary/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:bg-background-dark/95">
          <div class="flex items-center justify-between gap-3">
            <button type="button" id="cancel-cleanup-top" class="group flex items-center gap-3 text-left">
              <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[30px]">delete_sweep</span>
              </div>
              <h2 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">Clean Up Items</h2>
            </button>
          </div>
        </div>
        <div class="px-4 pb-2 pt-6">
          <div class="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4">
            <div class="flex items-center justify-center rounded-full bg-primary p-2 text-white">
              <span class="material-symbols-outlined text-[20px]">delete_sweep</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">${buildCleanupSummaryTitle(selectedItems.length)}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(buildCleanupSummaryLabel(selectedItems))}</p>
            </div>
          </div>
        </div>
        <h2 class="px-4 pb-3 pt-5 text-[22px] font-bold leading-tight tracking-[-0.015em] text-slate-900 dark:text-slate-100">Why are you removing these?</h2>
        <div class="flex flex-col gap-3 p-4">
          ${cleanupReasons.map((reason) => renderCleanupReason(reason, draft.reason || primaryReason)).join("")}
        </div>
        <div class="flex flex-col gap-4 px-4 py-3">
          <label class="flex w-full flex-col">
            <p class="pb-2 text-base font-medium leading-normal text-slate-900 dark:text-slate-100">Additional Details (Optional)</p>
            <textarea
              id="cleanup-notes"
              class="form-input min-h-[120px] w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-base font-normal leading-normal text-slate-900 placeholder:text-slate-400 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600"
              placeholder="Tell us more about why you're cleaning up..."
            >${escapeHtml(draft.notes || "")}</textarea>
          </label>
        </div>
        <div class="mt-auto p-4 pb-8">
          <button type="button" id="confirm-cleanup" class="flex h-14 w-full items-center justify-center overflow-hidden rounded-xl bg-primary px-5 text-base font-bold leading-normal tracking-[0.015em] text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]">
            <span class="truncate">Confirm Cleanup</span>
          </button>
          <button type="button" id="cancel-cleanup" class="mt-3 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-transparent px-5 text-sm font-semibold leading-normal text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <span>Cancel</span>
          </button>
        </div>
        <div class="h-2 bg-primary/10"></div>
      </div>
    `;
  }

  function renderCleanupReason(reason, selectedReason) {
    const active = reason.id === selectedReason;

    return `
      <label class="group flex cursor-pointer items-center gap-4 rounded-xl border border-solid border-slate-200 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
        <input ${active ? "checked" : ""} class="radio-custom h-5 w-5 border-2 border-slate-300 bg-transparent text-primary focus:outline-none focus:ring-0 focus:ring-offset-0 checked:border-primary dark:border-slate-700" name="cleanup_reason" type="radio" value="${reason.id}"/>
        <div class="flex grow flex-col">
          <p class="text-base font-medium leading-normal text-slate-900 dark:text-slate-100">${reason.title}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">${reason.description}</p>
        </div>
        <span class="material-symbols-outlined text-slate-400 transition-colors group-hover:text-primary">${reason.icon}</span>
      </label>
    `;
  }

  function buildCleanupSummaryTitle(count) {
    return `Removing ${count} item${count === 1 ? "" : "s"}`;
  }

  function buildCleanupSummaryLabel(items) {
    if (!items.length) {
      return "No items selected";
    }

    if (items.length === 1) {
      return items[0].name;
    }

    if (items.length === 2) {
      return `${items[0].name} and ${items[1].name}`;
    }

    return `${items[0].name}, ${items[1].name}, and ${items.length - 2} other item${items.length - 2 === 1 ? "" : "s"}`;
  }

  function getCleanupItems(state) {
    const draft = state.cleanupDraft || createCleanupDraft([]);
    const ids = new Set(draft.itemIds || []);
    return state.items.filter((item) => ids.has(item.id));
  }

  function buildTrashModel(items, retentionDays, now = new Date()) {
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const nowTime = now.getTime();

    return items
      .map((item) => {
        const deletedAtMs = new Date(item.deletedAt).getTime();
        const expiresAtMs = deletedAtMs + retentionMs;
        const remainingMs = expiresAtMs - nowTime;

        return {
          ...item,
          expiresAt: new Date(expiresAtMs).toISOString(),
          timeLeft: {
            totalMs: remainingMs,
            label: formatTimeLeft(remainingMs)
          }
        };
      })
      .filter((item) => item.timeLeft.totalMs > 0)
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }

  function formatTimeLeft(remainingMs) {
    const dayMs = 24 * 60 * 60 * 1000;

    if (remainingMs <= dayMs) {
      return "24 hours left";
    }

    const daysLeft = Math.ceil(remainingMs / dayMs);
    return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  }

  function createTrashItem(item, cleanupDraft) {
    return {
      ...item,
      deletedAt: new Date().toISOString(),
      cleanupReason: cleanupDraft.reason,
      cleanupNotes: cleanupDraft.notes || ""
    };
  }

  global.FreshTrackerTrash = {
    cleanupReasons,
    createCleanupDraft,
    renderTrashPage,
    renderTrashDetailSheet,
    renderCleanupPage,
    buildTrashModel,
    createTrashItem
  };
})(window);
