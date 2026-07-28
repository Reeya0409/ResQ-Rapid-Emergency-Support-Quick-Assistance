/* ============================================================
   RESQ — Centralized API Client
   Every page script routes network calls through `api.*` helpers
   here instead of calling fetch() directly. Handles: base URL,
   JWT attachment, silent refresh-on-401, toast notifications,
   and a consistent error shape.
   ============================================================ */

const API_BASE_URL =
  window.RESQ_API_BASE_URL ||
  "https://resq-rapid-emergency-support-quick.onrender.com/api/v1";const TOKEN_KEYS = {
  access: "resq_access_token",
  refresh: "resq_refresh_token",
  user: "resq_user",
};

// ---------- Token storage ----------
const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEYS.access),
  getRefresh: () => localStorage.getItem(TOKEN_KEYS.refresh),
  getUser: () => {
    const raw = localStorage.getItem(TOKEN_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  },
  set: (accessToken, refreshToken, user) => {
    localStorage.setItem(TOKEN_KEYS.access, accessToken);
    localStorage.setItem(TOKEN_KEYS.refresh, refreshToken);
    if (user) localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(user));
  },
  setAccess: (accessToken) => localStorage.setItem(TOKEN_KEYS.access, accessToken),
  clear: () => {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
    localStorage.removeItem(TOKEN_KEYS.user);
  },
  isLoggedIn: () => !!localStorage.getItem(TOKEN_KEYS.refresh),
};

// ---------- Toasts ----------
function ensureToastStack() {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  return stack;
}

function showToast(message, type = "info") {
  const stack = ensureToastStack();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const iconName = type === "success" ? "check" : type === "error" ? "alertTriangle" : type === "warning" ? "alertTriangle" : "info";
  const iconColor = type === "success" ? "var(--color-success)" : type === "error" ? "var(--color-danger)" : type === "warning" ? "var(--color-warning)" : "var(--color-secondary)";

  toast.innerHTML = `
    <span class="toast-icon" style="color:${iconColor};">${typeof icon === "function" ? icon(iconName, 18) : ""}</span>
    <span class="toast-body">${message}</span>
    <button class="toast-close" aria-label="Dismiss">${typeof icon === "function" ? icon("close", 14) : "&times;"}</button>`;

  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 200);
  };
  toast.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, 4500);
}

// ---------- Core request wrapper ----------
class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new ApiError("No refresh token", 401);

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new ApiError(body.message || "Session expired", res.status, body.data);
        tokenStore.set(body.data.access_token, body.data.refresh_token);
        return body.data.access_token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Core request function. Set `auth: false` for public endpoints.
 * Automatically retries once after a silent token refresh on 401.
 */
async function apiRequest(path, { method = "GET", body, auth = true, isFormData = false, _retried = false } = {}) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    showToast("Network error — check your connection and that the backend is running.", "error");
    throw new ApiError("Network error", 0);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, message: "Unexpected server response" };
  }

  if (response.status === 401 && auth && !_retried) {
    try {
      await refreshAccessToken();
      return apiRequest(path, { method, body, auth, isFormData, _retried: true });
    } catch {
      tokenStore.clear();
      showToast("Your session has expired. Please log in again.", "warning");
      setTimeout(() => (window.location.href = "login.html"), 1200);
      throw new ApiError("Session expired", 401);
    }
  }

  if (!response.ok) {
    throw new ApiError(payload.message || "Something went wrong", response.status, payload.data);
  }

  return payload;
}

// ---------- Public API surface ----------
const api = {
  base: API_BASE_URL,
  tokenStore,
  showToast,
  ApiError,

  // Auth
  register: (data) => apiRequest("/auth/register", { method: "POST", body: data, auth: false }),
  login: (data) => apiRequest("/auth/login", { method: "POST", body: data, auth: false }),
  googleLogin: (idToken) => apiRequest("/auth/google", { method: "POST", body: { id_token: idToken }, auth: false }),
  logout: () => {
    const refreshToken = tokenStore.getRefresh();
    return apiRequest("/auth/logout", { method: "POST", body: { refresh_token: refreshToken }, auth: false }).catch(() => {});
  },
  forgotPassword: (email) => apiRequest("/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  me: () => apiRequest("/auth/me"),

  // Users
  getProfile: () => apiRequest("/users/me"),
  updateProfile: (data) => apiRequest("/users/me", { method: "PUT", body: data }),
  getChecklist: () => apiRequest("/users/me/checklist"),
  updateChecklist: (completedIndices) => apiRequest("/users/me/checklist", { method: "PUT", body: { completed_indices: completedIndices } }),

  // Dashboard
  getDashboardSummary: (lat, lng) => apiRequest(`/dashboard/summary?lat=${lat}&lng=${lng}`),

  // Weather
  getCurrentWeather: (lat, lng) => apiRequest(`/weather/current?lat=${lat}&lng=${lng}`),
  getForecast: (lat, lng) => apiRequest(`/weather/forecast?lat=${lat}&lng=${lng}`),
  getWeatherAlerts: (lat, lng) => apiRequest(`/weather/alerts?lat=${lat}&lng=${lng}`),

  // Shelters
  getNearbyShelters: (lat, lng, params = {}) => {
    const qs = new URLSearchParams({ lat, lng, ...params }).toString();
    return apiRequest(`/shelters/nearby?${qs}`);
  },

  // Emergency services
  getNearbyServices: (lat, lng, params = {}) => {
    const qs = new URLSearchParams({ lat, lng, ...params }).toString();
    return apiRequest(`/emergency-services/nearby?${qs}`);
  },

  // Chatbot
  sendChatMessage: (message, imageBase64 = null, language = null, lat = null, lng = null) =>
    apiRequest("/chatbot/message", {
      method: "POST",
      body: { message, image_base64: imageBase64, language, lat, lng },
    }),
  getChatHistory: () => apiRequest("/chatbot/history"),

  // Uploads
  analyzeImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/uploads/analyze", { method: "POST", body: formData, isFormData: true });
  },

  // Guides
  getGuides: () => apiRequest("/guides"),
  getGuide: (category) => apiRequest(`/guides/${category}`),
  searchGuides: (q) => apiRequest(`/guides/search?q=${encodeURIComponent(q)}`),

  // Alerts / SOS
  getAlerts: () => apiRequest("/alerts"),
  triggerSOS: (action, lat, lng) => apiRequest("/alerts/sos", { method: "POST", body: { action, lat, lng } }),

  // Notifications
  getNotifications: (unreadOnly = false) => apiRequest(`/notifications?unread_only=${unreadOnly}`),
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: "PUT" }),

  // Emergency contacts
  getEmergencyContacts: () => apiRequest("/emergency-contacts"),
  addEmergencyContact: (data) => apiRequest("/emergency-contacts", { method: "POST", body: data }),
  deleteEmergencyContact: (id) => apiRequest(`/emergency-contacts/${id}`, { method: "DELETE" }),
};
