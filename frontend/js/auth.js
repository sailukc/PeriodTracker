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

function authHeaders({ json = true } = {}) {
  const token = getToken();
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Token ${token}`;
  return headers;
}

function buildURL(path) {
  const base = window.API_BASE || "http://127.0.0.1:8000";

  if (!path) return base;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return base + path;
  return base + "/" + path;
}

// ✅ Global helper for all API calls
async function fetchJSON(path, options = {}) {
  const url = buildURL(path);

  const res = await fetch(url, options);

  // parse response safely
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw || null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.error || data.message)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
