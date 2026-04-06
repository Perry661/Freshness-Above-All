(function initFreshTrackerSettings(global) {
  const DEFAULT_SETTINGS = {
    trashAutoDeleteDays: 7,
    reminderStrategy: "standard",
    theme: "light",
    soundVolume: 100
  };
  const trashRetentionOptions = [7, 14, 30];
  const reminderStrategies = [
    {
      id: "light",
      badge: "Minimal",
      name: "Light Reminder",
      description: "7/1 days before and day of. Best for users who check the app daily.",
      shortLabel: "Light",
      cadence: ["7 days before", "1 day before", "On expiry day"],
      tone: "slate",
      isDefault: false
    },
    {
      id: "standard",
      badge: "Recommended",
      name: "Standard Reminder",
      description: "7/3/1 days before and day of, plus cleanup reminders. Our most popular choice.",
      shortLabel: "Standard",
      cadence: ["7, 3, and 1 days before", "On expiry day", "Cleanup follow-up"],
      tone: "primary",
      isDefault: true
    },
    {
      id: "high",
      badge: "Maximum Awareness",
      name: "High Frequency",
      description: "Starts 7 days before, constant reminders after expiration. Ensure zero waste.",
      shortLabel: "High",
      cadence: ["Daily countdown starts early", "On expiry day", "Repeated overdue reminders"],
      tone: "amber",
      isDefault: false
    }
  ];

  function renderSettingsPage(state, escapeHtml, appVersion) {
    const strategy = getReminderStrategy(state.settings.reminderStrategy);
    const account = state.account || { authenticated: false, user: null };
    const initials = account.authenticated
      ? getAccountInitials(account.user?.name || account.user?.email || "")
      : "";

    return `
      <header class="sticky top-0 z-10 border-b border-primary/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:bg-background-dark/95">
        <div class="flex items-center justify-between gap-3">
          <button type="button" data-nav-view="dashboard" class="group flex items-center gap-3 text-left">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[30px]">settings</span>
            </div>
            <h2 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">Freshness Above All!</h2>
          </button>
        </div>
      </header>
      <main data-view-scroll="settings" class="flex-1 overflow-y-auto pb-[calc(10rem+env(safe-area-inset-bottom))]">
        <div class="px-4 pb-2 pt-6">
          <h1 class="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <section class="mt-6">
          <div class="px-4 py-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Account / Profile</div>
          <button type="button" id="open-auth-sheet" class="mx-4 flex w-[calc(100%-2rem)] items-center gap-4 rounded-xl bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800">
            <div class="relative size-12 overflow-hidden rounded-full border-2 border-primary/20">
              ${account.authenticated
                ? `<div class="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-bold text-primary">${escapeHtml(initials)}</div>`
                : `<div class="flex h-full w-full items-center justify-center bg-slate-200/80 text-slate-400 dark:bg-slate-700/80 dark:text-slate-300"><span class="material-symbols-outlined text-[30px]">account_circle</span></div>`}
            </div>
            <div class="flex-1">
              <h4 class="font-bold">${account.authenticated ? escapeHtml(account.user?.name || "Account") : "Login or Sign Up"}</h4>
              <p class="text-sm text-slate-500">${account.authenticated ? escapeHtml(account.user?.email || "") : "Use your email to sign in"}</p>
            </div>
            <span class="material-symbols-outlined text-slate-400">chevron_right</span>
          </button>
        </section>
        <section class="mt-8">
          <div class="flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span class="material-symbols-outlined text-sm">delete_sweep</span> Trash Settings
          </div>
          <div class="px-4">
            <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div class="mb-4 flex items-center justify-between">
                <span class="text-slate-700 dark:text-slate-200">Auto-delete after <span class="block text-xs text-slate-400">Trash cleanup schedule</span></span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                ${trashRetentionOptions.map((days) => renderTrashOption(state, days)).join("")}
              </div>
            </div>
          </div>
        </section>
        <section class="mt-8 px-4">
          <div class="py-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notification Settings</div>
          <div class="overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              id="open-reminder-settings"
              class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <div class="flex flex-col items-start">
                <span class="font-medium text-slate-700 dark:text-slate-200">Reminder Strategy</span>
                <span class="text-xs text-slate-400">Reminder strategy</span>
                <span class="mt-1 rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">${escapeHtml(strategy.shortLabel)}</span>
              </div>
              <span class="material-symbols-outlined text-slate-400">arrow_forward_ios</span>
            </button>
          </div>
        </section>
        <section class="mt-6 px-4">
          <div class="py-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Browser Push</div>
          ${renderBrowserNotificationSection(state, escapeHtml, account)}
        </section>
        <section class="mt-8 px-4">
          <div class="py-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">General</div>
          <div class="overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div class="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-slate-400">language</span>
                <span class="text-slate-700 dark:text-slate-200">Language</span>
              </div>
              <span class="text-sm font-medium text-primary">English</span>
            </div>
            <div class="border-b border-slate-100 p-4 dark:border-slate-800">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-slate-400">volume_up</span>
                  <span class="text-slate-700 dark:text-slate-200">Sound Volume</span>
                </div>
                <span id="sound-volume-value" class="text-sm font-medium text-primary">${escapeHtml(state.settings.soundVolume)}</span>
              </div>
              <input id="sound-volume-input" type="range" min="0" max="200" step="1" value="${escapeHtml(state.settings.soundVolume)}" class="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary dark:bg-slate-700" />
              <div class="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>0</span>
                <span>100</span>
                <span>200</span>
              </div>
            </div>
            <button type="button" id="theme-toggle" class="flex w-full items-center justify-between p-4 text-left">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-slate-400">dark_mode</span>
                <span class="text-slate-700 dark:text-slate-200">Theme</span>
              </div>
              <span class="flex w-12 items-center rounded-full bg-slate-200 p-1 transition dark:bg-slate-700">
                <span class="size-4 rounded-full bg-white shadow-sm transition-transform ${state.settings.theme === "dark" ? "translate-x-6 bg-primary" : "translate-x-0"}"></span>
              </span>
            </button>
          </div>
        </section>
        <section class="mt-8 px-4">
          <div class="py-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">About & Support</div>
          <div class="overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <a href="https://github.com/Perry661/Freshness-Above-All/blob/main/SUPPORT.md" target="_blank" rel="noreferrer" class="flex items-center justify-between border-b border-slate-100 p-4 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-700">
              <span class="text-slate-700 dark:text-slate-200">Help Center</span>
              <span class="material-symbols-outlined text-sm text-slate-400">open_in_new</span>
            </a>
            <div class="border-b border-slate-100 p-4 dark:border-slate-800">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined mt-0.5 text-slate-400">photo_camera</span>
                <div>
                  <p class="font-medium text-slate-700 dark:text-slate-200">Camera Access Help</p>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">If scan or photo capture stops opening, re-allow Camera for this site in your browser's site settings. On macOS, also check System Settings → Privacy & Security → Camera.</p>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between p-4">
              <span class="text-slate-700 dark:text-slate-200">App Version</span>
              <span class="font-mono text-sm text-slate-400">v${escapeHtml(appVersion)}</span>
            </div>
          </div>
        </section>
        <div class="mt-8 px-4">
          <button type="button" id="restore-settings-defaults" class="w-full rounded-xl border border-primary/20 bg-primary/5 py-3 font-bold text-primary transition-colors hover:bg-primary/10">
            Restore Defaults
          </button>
        </div>
        ${account.authenticated
          ? `
            <div class="mt-4 px-4">
              <button type="button" id="log-out" class="w-full rounded-xl border-2 border-slate-100 py-3 font-bold text-red-500 transition-colors hover:bg-red-50 dark:border-slate-800">
                Log Out
              </button>
            </div>
            <div class="mt-3 px-4">
              <button type="button" id="delete-account" class="w-full rounded-xl border border-red-200 bg-red-50 py-3 font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                Delete Account
              </button>
            </div>
          `
          : ""}
      </main>
      ${state.showAuthSheet ? renderAuthSheet(state, escapeHtml) : ""}
    `;
  }

  function renderAuthSheet(state, escapeHtml) {
    const loginActive = state.authMode !== "register";
    const title = loginActive ? "Login" : "Sign Up";
    const subtitle = loginActive
      ? "Use an email you've already registered on this device."
      : "Create a local account with your email.";

    return `
      <div id="auth-sheet-overlay" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0">
        <div class="sheet-enter w-full max-w-lg overflow-hidden rounded-t-[32px] bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] dark:bg-slate-900">
          <div class="flex h-8 w-full items-center justify-center pt-3">
            <div class="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <div class="px-6 pb-8 pt-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">${title}</h2>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${subtitle}</p>
              </div>
              <button type="button" id="close-auth-sheet" class="rounded-full p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <span class="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>
            <div class="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
              <button type="button" data-auth-mode="login" class="rounded-xl px-4 py-2 text-sm font-semibold ${loginActive ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-300"}">Login</button>
              <button type="button" data-auth-mode="register" class="rounded-xl px-4 py-2 text-sm font-semibold ${!loginActive ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-300"}">Sign Up</button>
            </div>
            <form id="auth-form" class="mt-6 space-y-4">
              <label class="grid gap-2">
                <span class="text-sm font-bold uppercase tracking-wider text-slate-500">Email</span>
                <input id="auth-email-input" name="authEmail" type="email" value="${escapeHtml(state.authEmail || "")}" required class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800" placeholder="you@example.com" />
              </label>
              ${state.authError
                ? `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">${escapeHtml(state.authError)}</div>`
                : ""}
              <button type="submit" class="w-full rounded-xl bg-primary py-4 font-bold text-slate-900 shadow-lg shadow-primary/20 transition-opacity hover:opacity-90">
                ${loginActive ? "Login with Email" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function renderTrashOption(state, days) {
    const active = state.settings.trashAutoDeleteDays === days;
    const classes = active
      ? "border-primary bg-primary/10 text-primary font-bold"
      : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400";

    return `
      <button
        type="button"
        data-trash-days="${days}"
        class="rounded-lg border-2 px-3 py-2 text-sm ${classes}"
      >
        ${days} Days
      </button>
    `;
  }

  function renderBrowserNotificationSection(state, escapeHtml, account) {
    const isLoggedIn = Boolean(account?.authenticated);
    const isSupported = Boolean(state.notificationSupport);
    const isSubscribed = Boolean(state.notificationSubscription);
    const isLoading = Boolean(state.notificationLoading);
    const permission = state.notificationPermission || "default";
    const error = String(state.notificationError || "").trim();

    let statusLabel = "Sign in required";
    let description = "Sign in to receive browser reminders on this device.";
    let actions = "";

    if (isLoggedIn && !isSupported) {
      statusLabel = "Unsupported browser";
      description = "This browser does not support push notifications.";
      actions = `
        <button
          type="button"
          id="retry-browser-notifications"
          class="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          ${isLoading ? "disabled" : ""}
        >
          ${isLoading ? "Checking..." : "Refresh Status"}
        </button>
      `;
    } else if (isLoggedIn && isSubscribed) {
      statusLabel = "Notifications enabled on this device";
      description = "This browser will receive reminder summaries even when the page is closed.";
      actions = `
        <button
          type="button"
          id="disable-browser-notifications"
          class="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
          ${isLoading ? "disabled" : ""}
        >
          ${isLoading ? "Disabling..." : "Disable Notifications"}
        </button>
      `;
    } else if (isLoggedIn && permission === "denied") {
      statusLabel = "Permission blocked";
      description = "Notifications are blocked in your browser settings.";
      actions = `
        <button
          type="button"
          id="retry-browser-notifications"
          class="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          ${isLoading ? "disabled" : ""}
        >
          ${isLoading ? "Checking..." : "Refresh Status"}
        </button>
      `;
    } else if (isLoggedIn) {
      statusLabel = permission === "granted" ? "Ready to enable" : "Permission not requested";
      description = "Enable browser reminders for this device to get daily freshness summaries.";
      actions = `
        <button
          type="button"
          id="enable-browser-notifications"
          class="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 dark:bg-primary dark:text-slate-900"
          ${isLoading ? "disabled" : ""}
        >
          ${isLoading ? "Enabling..." : "Enable Notifications"}
        </button>
      `;
    }

    return `
      <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
        <div class="flex items-start gap-3">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">notifications</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-slate-700 dark:text-slate-200">Browser Notifications</p>
              <span class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-200">${escapeHtml(statusLabel)}</span>
            </div>
            <p class="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">${escapeHtml(description)}</p>
            ${error
              ? `<div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">${escapeHtml(error)}</div>`
              : ""}
            ${actions}
          </div>
        </div>
      </div>
    `;
  }

  function renderNotificationSettingsPage(state, escapeHtml) {
    const selected = state.reminderDraft || state.settings.reminderStrategy;
    const selectedStrategy = getReminderStrategy(selected);

    return `
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background-light dark:bg-background-dark">
        <div class="sticky top-0 z-10 border-b border-primary/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:bg-background-dark/95">
          <div class="flex items-center justify-between gap-3">
            <button type="button" id="back-to-settings" class="group flex items-center gap-3 text-left">
              <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[30px]">notifications_active</span>
              </div>
              <h2 class="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">Notification Settings</h2>
            </button>
          </div>
        </div>
        <div class="px-4 pb-2 pt-6">
          <h3 class="text-xl font-bold leading-tight tracking-tight">Reminder Strategy</h3>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">Choose how often you want to be notified about expiring food items.</p>
        </div>
        <div class="px-4 pb-3">
          <div class="rounded-3xl border border-primary/10 bg-white/80 p-4 shadow-[0_14px_40px_-28px_rgba(17,212,50,0.7)] backdrop-blur-sm dark:border-primary/15 dark:bg-slate-900/70">
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Current Choice</p>
            <div class="mt-3 flex items-start justify-between gap-4">
              <div>
                <p class="text-lg font-bold text-slate-900 dark:text-slate-100">${escapeHtml(selectedStrategy.name)}</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">${escapeHtml(selectedStrategy.description)}</p>
              </div>
              <span class="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">${escapeHtml(selectedStrategy.shortLabel)}</span>
            </div>
          </div>
        </div>
        <div data-view-scroll="notification-settings" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
          <div class="flex flex-col gap-4 pb-2">
          ${reminderStrategies.map((strategy) => renderReminderStrategyCard(strategy, selected, escapeHtml)).join("")}
          </div>
        </div>
        <div class="border-t border-primary/10 bg-white/95 p-4 backdrop-blur-md dark:bg-background-dark/90">
          <button
            type="button"
            id="save-reminder-settings"
            class="w-full rounded-xl bg-slate-900 py-3 font-bold text-white shadow-lg transition-transform active:scale-95 dark:bg-primary"
          >
            Save Preferences
          </button>
        </div>
      </div>
    `;
  }

  function renderReminderStrategyCard(strategy, selectedId, escapeHtml) {
    const active = selectedId === strategy.id;
    const toneClasses = getReminderToneClasses(strategy.tone, active);
    const icon = active ? "check_circle" : "radio_button_unchecked";
    const cta = active ? "Selected" : "Tap to select";

    return `
      <button
        type="button"
        data-reminder-strategy="${strategy.id}"
        aria-pressed="${active ? "true" : "false"}"
        class="group block w-full overflow-hidden rounded-[28px] border text-left transition-all duration-150 ${toneClasses.shell}"
      >
        <div class="relative flex w-full flex-col gap-4 p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-xs font-bold uppercase tracking-[0.22em] ${toneClasses.badge}">${escapeHtml(strategy.badge)}</p>
                ${strategy.isDefault ? '<span class="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Default</span>' : ""}
              </div>
              <p class="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">${escapeHtml(strategy.name)}</p>
            </div>
            <div class="flex size-10 items-center justify-center rounded-full ${toneClasses.iconWrap}">
              <span class="material-symbols-outlined text-[22px] ${toneClasses.icon}">${icon}</span>
            </div>
          </div>
          <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">${escapeHtml(strategy.description)}</p>
          <div class="grid gap-2">
            ${strategy.cadence.map((item) => `
              <div class="flex items-center gap-3 rounded-2xl ${toneClasses.row}">
                <span class="material-symbols-outlined text-[18px] ${toneClasses.rowIcon}">notifications</span>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-200">${escapeHtml(item)}</span>
              </div>
            `).join("")}
          </div>
          <div class="flex items-center justify-between border-t border-slate-200/70 pt-4 dark:border-slate-700/70">
            <span class="text-sm font-semibold ${active ? "text-primary" : "text-slate-500 dark:text-slate-400"}">${cta}</span>
            <span class="material-symbols-outlined text-[20px] ${active ? "text-primary" : "text-slate-300 dark:text-slate-600"}">arrow_forward</span>
          </div>
        </div>
      </button>
    `;
  }

  function getReminderToneClasses(tone, active) {
    const palette = {
      slate: {
        shell: active
          ? "border-slate-400 bg-white shadow-[0_18px_45px_-30px_rgba(51,65,85,0.7)] dark:border-slate-500 dark:bg-slate-900/90"
          : "border-slate-200/80 bg-white/90 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)] hover:border-slate-300 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900/70",
        badge: "text-slate-500 dark:text-slate-300",
        iconWrap: active ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-100/80 dark:bg-slate-800/80",
        icon: active ? "text-slate-700 dark:text-slate-100" : "text-slate-400 dark:text-slate-500",
        row: "bg-slate-50 px-4 py-3 dark:bg-slate-800/80",
        rowIcon: "text-slate-400 dark:text-slate-500"
      },
      amber: {
        shell: active
          ? "border-amber-300 bg-white shadow-[0_18px_45px_-30px_rgba(245,158,11,0.6)] dark:border-amber-500 dark:bg-slate-900/90"
          : "border-amber-100 bg-white/90 shadow-[0_16px_40px_-34px_rgba(245,158,11,0.35)] hover:border-amber-300 hover:-translate-y-0.5 dark:border-amber-900/60 dark:bg-slate-900/70",
        badge: "text-amber-600 dark:text-amber-300",
        iconWrap: active ? "bg-amber-100 dark:bg-amber-500/20" : "bg-amber-50 dark:bg-amber-500/10",
        icon: active ? "text-amber-600 dark:text-amber-300" : "text-amber-300 dark:text-amber-500",
        row: "bg-amber-50/80 px-4 py-3 dark:bg-amber-500/10",
        rowIcon: "text-amber-500 dark:text-amber-300"
      },
      primary: {
        shell: active
          ? "border-primary bg-white shadow-[0_22px_50px_-30px_rgba(17,212,50,0.7)] dark:border-primary dark:bg-slate-900/90"
          : "border-primary/20 bg-white/95 shadow-[0_18px_45px_-34px_rgba(17,212,50,0.4)] hover:border-primary/50 hover:-translate-y-0.5 dark:border-primary/20 dark:bg-slate-900/70",
        badge: "text-primary",
        iconWrap: active ? "bg-primary/15 dark:bg-primary/20" : "bg-primary/10 dark:bg-primary/15",
        icon: active ? "text-primary" : "text-primary/50",
        row: "bg-primary/5 px-4 py-3 dark:bg-primary/10",
        rowIcon: "text-primary"
      }
    };

    return palette[tone] || palette.primary;
  }

  function getReminderStrategy(strategyId) {
    return reminderStrategies.find((strategy) => strategy.id === strategyId) || reminderStrategies[1];
  }

  function getDefaultSettings() {
    return { ...DEFAULT_SETTINGS };
  }

  function getAccountInitials(value) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) {
      return "U";
    }
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function normalizeSettings(settings) {
    const parsed = settings && typeof settings === "object" ? settings : {};

    return {
      trashAutoDeleteDays: trashRetentionOptions.includes(parsed.trashAutoDeleteDays)
        ? parsed.trashAutoDeleteDays
        : DEFAULT_SETTINGS.trashAutoDeleteDays,
      reminderStrategy: reminderStrategies.some((strategy) => strategy.id === parsed.reminderStrategy)
        ? parsed.reminderStrategy
        : DEFAULT_SETTINGS.reminderStrategy,
      theme: parsed.theme === "dark" ? "dark" : DEFAULT_SETTINGS.theme,
      soundVolume: Number.isFinite(Number(parsed.soundVolume))
        ? Math.min(200, Math.max(0, Math.round(Number(parsed.soundVolume))))
        : DEFAULT_SETTINGS.soundVolume
    };
  }

  function applyTheme(settings) {
    const isDark = settings.theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.body.classList.toggle("dark", isDark);
  }

  global.FreshTrackerSettings = {
    getDefaultSettings,
    normalizeSettings,
    trashRetentionOptions,
    reminderStrategies,
    renderSettingsPage,
    renderNotificationSettingsPage,
    getReminderStrategy,
    applyTheme
  };
})(window);
