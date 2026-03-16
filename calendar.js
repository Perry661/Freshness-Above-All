(function initFreshTrackerCalendar(global) {
  function renderCalendarPage(model, escapeHtml) {
    return `
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header class="sticky top-0 z-10 border-b border-primary/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:bg-background-dark/95">
          <div class="flex items-center justify-between gap-3">
            <button id="calendar-back-to-dashboard" class="group flex items-center gap-3 text-left">
              <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[30px]">calendar_month</span>
              </div>
              <h1 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">Calendar</h1>
            </button>
          </div>
        </header>
        <main class="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col gap-6 overflow-y-auto p-4 pb-28">
          <div class="rounded-xl border border-primary/5 bg-white p-4 shadow-sm dark:bg-slate-800/50">
            <div class="mb-4 flex items-center justify-between">
              <button id="calendar-previous-month" class="rounded-full p-2 text-slate-600 hover:bg-primary/10 dark:text-slate-400">
                <span class="material-symbols-outlined">chevron_left</span>
              </button>
              <div class="flex flex-col items-center gap-2">
                <p class="text-base font-bold leading-tight text-slate-900 dark:text-slate-100">${escapeHtml(model.monthLabel)}</p>
                <button id="calendar-go-today" class="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10">
                  Today
                </button>
              </div>
              <button id="calendar-next-month" class="rounded-full p-2 text-slate-600 hover:bg-primary/10 dark:text-slate-400">
                <span class="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div class="grid grid-cols-7 text-center">
              ${model.weekdays.map((day) => `<p class="py-2 text-[13px] font-bold text-slate-400">${day}</p>`).join("")}
              ${model.cells.map((cell) => renderCalendarCell(cell, escapeHtml)).join("")}
            </div>
          </div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between px-1">
              <h3 class="text-lg font-bold leading-tight tracking-[-0.015em] text-slate-900 dark:text-slate-100">${escapeHtml(model.listTitle)}</h3>
              <span class="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">${escapeHtml(model.listChip)}</span>
            </div>
            <div class="flex flex-col gap-2">
              ${renderCalendarSelectedList(model.selectedItems, escapeHtml)}
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function renderCalendarCell(cell, escapeHtml) {
    if (!cell.inMonth) {
      return '<div class="h-12 opacity-0"></div>';
    }

    const marker = renderCalendarCellMarker(cell, escapeHtml);
    const selectedClasses = cell.selected
      ? "text-primary font-bold"
      : cell.isToday
        ? "font-bold text-slate-900 dark:text-slate-100"
        : "font-medium text-slate-700 dark:text-slate-200";

    return `
      <button data-calendar-date="${cell.dateKey}" class="relative flex h-12 w-full flex-col items-center justify-center rounded-xl transition hover:bg-primary/5">
        ${cell.selected ? '<div class="absolute inset-1 rounded-full border border-primary bg-primary/20"></div>' : ""}
        <span class="relative z-10 text-sm ${selectedClasses}">${cell.day}</span>
        <div class="relative z-10 mt-0.5 flex min-h-[16px] items-center justify-center">${marker}</div>
      </button>
    `;
  }

  function renderCalendarCellMarker(cell, escapeHtml) {
    if (!cell.items.length) {
      return "";
    }

    if (cell.showCount) {
      return `<span class="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${cell.countClass}">${cell.items.length}</span>`;
    }

    return cell.items.slice(0, 2).map((item) => `
      <span class="material-symbols-outlined text-[14px] ${item.calendarIconClass}">${escapeHtml(item.icon)}</span>
    `).join("");
  }

  function renderCalendarSelectedList(items, escapeHtml) {
    if (!items.length) {
      return `
        <div class="rounded-xl border border-dashed border-slate-200 bg-white/60 p-5 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <p class="font-semibold text-slate-500 dark:text-slate-400">No food expires on this date.</p>
          <p class="mt-1 text-sm text-slate-400">Select another day to inspect upcoming expirations.</p>
        </div>
      `;
    }

    return items.map((item) => `
      <div class="flex items-center gap-4 rounded-xl border border-primary/5 bg-white px-4 py-3 shadow-sm dark:bg-slate-800">
        <button data-detail-id="${item.id}" class="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-100 bg-primary/10 text-primary dark:border-slate-700">
          <span class="material-symbols-outlined text-3xl">${escapeHtml(item.icon)}</span>
        </button>
        <div class="flex min-w-0 flex-1 flex-col justify-center">
          <button data-detail-id="${item.id}" class="truncate text-left text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">${escapeHtml(item.name)}</button>
          <p class="mt-0.5 flex items-center gap-1 text-sm font-medium ${item.listMetaClass}">
            <span class="material-symbols-outlined text-sm">${item.listMetaIcon}</span>
            ${escapeHtml(item.listMetaLabel)}
          </p>
        </div>
        <button data-detail-id="${item.id}" class="text-slate-400 transition hover:text-primary">
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    `).join("");
  }

  function getCalendarViewModel(items, calendarState, getExpiryMeta) {
    const monthDate = parseMonthKey(calendarState.calendarMonth);
    const today = new Date();
    const todayKey = getDateKey(today);
    const calendarItems = items
      .map((item) => buildCalendarItem(item, getExpiryMeta))
      .filter((item) => isSameMonth(item.expiryDateValue, monthDate));

    const grouped = new Map();
    for (const item of calendarItems) {
      const existing = grouped.get(item.expiryDate) || [];
      existing.push(item);
      grouped.set(item.expiryDate, existing);
    }

    for (const groupedItems of grouped.values()) {
      groupedItems.sort((a, b) => {
        const dayDiff = a.expiry.daysUntil - b.expiry.daysUntil;
        if (dayDiff !== 0) {
          return dayDiff;
        }

        return a.name.localeCompare(b.name);
      });
    }

    const selectedDateKey = getCalendarSelectedDateKey(grouped, monthDate, todayKey, calendarState.calendarSelectedDate);
    const selectedItems = grouped.get(selectedDateKey) || [];

    return {
      monthLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate),
      weekdays: ["S", "M", "T", "W", "T", "F", "S"],
      cells: buildCalendarCells(monthDate, grouped, selectedDateKey, todayKey),
      listTitle: selectedItems.length ? `Expiring on ${formatCalendarShortDate(selectedDateKey)}` : "Selected Date",
      listChip: selectedDateKey ? formatCalendarShortDate(selectedDateKey) : "No date",
      selectedItems
    };
  }

  function buildCalendarItem(item, getExpiryMeta) {
    const expiry = getExpiryMeta(item);
    return {
      ...item,
      expiry,
      expiryDateValue: parseFoodDate(item.expiryDate),
      calendarIconClass: getCalendarToneClass(expiry.tone),
      listMetaClass: getCalendarListMetaClass(expiry.tone),
      listMetaIcon: getCalendarListMetaIcon(expiry.tone),
      listMetaLabel: getCalendarListMetaLabel(expiry)
    };
  }

  function buildCalendarCells(monthDate, grouped, selectedDateKey, todayKey) {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay.getDay(); i += 1) {
      cells.push({ inMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const dateKey = getDateKey(date);
      const items = grouped.get(dateKey) || [];
      const showCount = items.length > 1 || items.some((item) => !item.icon);

      cells.push({
        inMonth: true,
        day,
        dateKey,
        items,
        showCount,
        selected: dateKey === selectedDateKey,
        isToday: dateKey === todayKey,
        countClass: getCalendarCountClass(items)
      });
    }

    return cells;
  }

  function getCalendarSelectedDateKey(grouped, monthDate, todayKey, calendarSelectedDate) {
    if (calendarSelectedDate && isSameMonth(parseFoodDate(calendarSelectedDate), monthDate)) {
      return calendarSelectedDate;
    }

    if (isSameMonth(parseFoodDate(todayKey), monthDate)) {
      return todayKey;
    }

    const firstEventDate = Array.from(grouped.keys()).sort()[0];
    if (firstEventDate) {
      return firstEventDate;
    }

    return getDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  }

  function getCalendarToneClass(tone) {
    if (tone === "expired") {
      return "text-red-500";
    }

    if (tone === "today" || tone === "soon") {
      return "text-amber-500";
    }

    return "text-primary";
  }

  function getCalendarCountClass(items) {
    const tone = items.some((item) => item.expiry.tone === "expired")
      ? "expired"
      : items.some((item) => item.expiry.tone === "today" || item.expiry.tone === "soon")
        ? "soon"
        : "fresh";

    if (tone === "expired") {
      return "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400";
    }

    if (tone === "soon") {
      return "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400";
    }

    return "bg-primary/15 text-primary";
  }

  function getCalendarListMetaClass(tone) {
    if (tone === "expired") {
      return "text-red-500";
    }

    if (tone === "today" || tone === "soon") {
      return "text-yellow-600 dark:text-yellow-500";
    }

    return "text-slate-500 dark:text-slate-400";
  }

  function getCalendarListMetaIcon(tone) {
    if (tone === "expired") {
      return "error";
    }

    if (tone === "today" || tone === "soon") {
      return "warning";
    }

    return "schedule";
  }

  function getCalendarListMetaLabel(expiry) {
    if (expiry.tone === "expired") {
      return expiry.daysUntil === -1 ? "Expired yesterday" : "Expired";
    }

    if (expiry.tone === "today") {
      return "Expires today";
    }

    if (expiry.tone === "soon") {
      return `Expires in ${expiry.daysUntil} day${expiry.daysUntil === 1 ? "" : "s"}`;
    }

    return `Expires in ${expiry.daysUntil} days`;
  }

  function parseFoodDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function parseMonthKey(value) {
    const [year, month] = String(value).split("-").map(Number);
    return new Date(year, month - 1, 1);
  }

  function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function formatCalendarShortDate(value) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parseFoodDate(value));
  }

  global.FreshTrackerCalendar = {
    renderCalendarPage,
    getCalendarViewModel,
    getDateKey,
    getMonthKey,
    parseMonthKey,
    addMonths
  };
})(window);
