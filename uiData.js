const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseExpiryDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function diffInDays(expiryDate, now = new Date()) {
  const today = normalizeDate(now);
  const target = normalizeDate(expiryDate);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function formatDisplayDate(value) {
  const date = parseExpiryDate(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getExpiryMeta(item, now = new Date()) {
  const daysUntil = diffInDays(parseExpiryDate(item.expiryDate), now);

  if (daysUntil < 0) {
    return {
      daysUntil,
      label: "Expired",
      sublabel: formatDisplayDate(item.expiryDate),
      tone: "expired",
      badgeClass: "text-red-500"
    };
  }

  if (daysUntil === 0) {
    return {
      daysUntil,
      label: "Expires Today",
      sublabel: formatDisplayDate(item.expiryDate),
      tone: "today",
      badgeClass: "text-orange-500"
    };
  }

  if (daysUntil <= 3) {
    return {
      daysUntil,
      label: `${daysUntil} Day${daysUntil === 1 ? "" : "s"} Left`,
      sublabel: formatDisplayDate(item.expiryDate),
      tone: "soon",
      badgeClass: "text-amber-500"
    };
  }

  return {
    daysUntil,
    label: `${daysUntil} Days Left`,
    sublabel: formatDisplayDate(item.expiryDate),
    tone: "fresh",
    badgeClass: "text-slate-400"
  };
}

function createFoodItem({
  id,
  name,
  category,
  size,
  expiryDate,
  icon,
  createdAt,
  barcode = "",
  brand = "",
  imageUrl = "",
  source = "manual"
}) {
  return {
    id: id || `food-${Date.now()}`,
    name: String(name).trim(),
    category: String(category).trim(),
    size: String(size).trim(),
    icon: icon || "restaurant",
    barcode: String(barcode || "").trim(),
    brand: String(brand || "").trim(),
    imageUrl: String(imageUrl || "").trim(),
    source: String(source || "manual").trim(),
    expiryDate,
    createdAt: createdAt || new Date().toISOString()
  };
}

function getDashboardModel(items, now = new Date()) {
  const enriched = items
    .map((item) => ({
      ...item,
      expiry: getExpiryMeta(item, now)
    }))
    .sort((a, b) => {
      const dayDiff = a.expiry.daysUntil - b.expiry.daysUntil;
      if (dayDiff !== 0) {
        return dayDiff;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return {
    stats: {
      expired: enriched.filter((item) => item.expiry.daysUntil < 0).length,
      today: enriched.filter((item) => item.expiry.daysUntil === 0).length,
      threeDays: enriched.filter(
        (item) => item.expiry.daysUntil >= 1 && item.expiry.daysUntil <= 3
      ).length
    },
    allItems: enriched,
    recentItems: enriched.slice(0, 8)
  };
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Ignore invalid json from server error responses.
    }
    throw new Error(message);
  }

  return response.json();
}

function fetchFoodItems() {
  return request("/api/foods");
}

function createFoodItemOnServer(item) {
  return request("/api/foods", {
    method: "POST",
    body: JSON.stringify(item)
  });
}

function updateFoodItemOnServer(id, item) {
  return request(`/api/foods/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(item)
  });
}

function deleteFoodItemOnServer(id) {
  return request(`/api/foods/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

function lookupBarcode(code) {
  return request(`/api/barcode/${encodeURIComponent(code)}`);
}

function searchProductByName(query) {
  return request(`/api/product-search?q=${encodeURIComponent(query)}`);
}

function fetchSettings() {
  return request("/api/settings");
}

function fetchAuthSession() {
  return request("/api/auth/session");
}

function fetchNotificationPublicKey() {
  return request("/api/notifications/public-key");
}

function fetchNotificationSubscription() {
  return request("/api/notifications/subscription");
}

function createNotificationSubscription(subscription) {
  return request("/api/notifications/subscription", {
    method: "POST",
    body: JSON.stringify(subscription)
  });
}

function deleteNotificationSubscription(endpoint) {
  return request("/api/notifications/subscription", {
    method: "DELETE",
    body: JSON.stringify({ endpoint })
  });
}

function registerWithEmail(email) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

function loginWithEmail(email) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

function logoutSession() {
  return request("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
}

function deleteCurrentAccount() {
  return request("/api/auth/account", {
    method: "DELETE"
  });
}

function updateSettingsOnServer(settings) {
  return request("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

function resetSettingsOnServer() {
  return request("/api/settings", {
    method: "DELETE"
  });
}

function fetchAddSettings() {
  return request("/api/add-settings");
}

function updateAddSettingsOnServer(settings) {
  return request("/api/add-settings", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

function resetAddSettingsOnServer() {
  return request("/api/add-settings", {
    method: "DELETE"
  });
}

function fetchTrashItems() {
  return request("/api/trash");
}

function createTrashItemOnServer(item) {
  return request("/api/trash", {
    method: "POST",
    body: JSON.stringify(item)
  });
}

function deleteTrashItemOnServer(id) {
  return request(`/api/trash/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

function emptyTrashOnServer() {
  return request("/api/trash", {
    method: "DELETE"
  });
}

window.FreshTrackerData = {
  DAY_MS,
  formatDisplayDate,
  getExpiryMeta,
  fetchFoodItems,
  lookupBarcode,
  searchProductByName,
  createFoodItem,
  createFoodItemOnServer,
  updateFoodItemOnServer,
  deleteFoodItemOnServer,
  fetchSettings,
  fetchAuthSession,
  fetchNotificationPublicKey,
  fetchNotificationSubscription,
  createNotificationSubscription,
  deleteNotificationSubscription,
  registerWithEmail,
  loginWithEmail,
  logoutSession,
  deleteCurrentAccount,
  updateSettingsOnServer,
  resetSettingsOnServer,
  fetchAddSettings,
  updateAddSettingsOnServer,
  resetAddSettingsOnServer,
  fetchTrashItems,
  createTrashItemOnServer,
  deleteTrashItemOnServer,
  emptyTrashOnServer,
  getDashboardModel
};
