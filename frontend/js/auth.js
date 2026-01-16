// frontend/js/auth.js
console.log("auth.js loaded ✅");

// If you have frontend/js/config.js, it should set: window.API_BASE = "http://127.0.0.1:8000";
const API_BASE = window.API_BASE || "http://127.0.0.1:8000";

/* ---------- AUTH HELPERS ---------- */
function getToken() {
  return localStorage.getItem("token");
}

function requireAuth() {
  const token = getToken();
  if (!token) {
    alert("Please login first");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "login.html";
}

function authHeaders(json = true) {
  const token = getToken();
  const headers = { Authorization: `Token ${token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/* ---------- URL HELPER (prevents double base URL bug) ---------- */
function withBase(urlOrPath) {
  if (!urlOrPath) return API_BASE;

  // already full URL
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    return urlOrPath;
  }

  // ensure single slash between base and path
  if (urlOrPath.startsWith("/")) return `${API_BASE}${urlOrPath}`;
  return `${API_BASE}/${urlOrPath}`;
}

/* ---------- API HELPER ---------- */
async function fetchJSON(pathOrUrl, options = {}) {
  const url = withBase(pathOrUrl);

  const res = await fetch(url, options);

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      (data && (data.error || data.detail)) || `Request failed (${res.status})`
    );
  }

  return data;
}
