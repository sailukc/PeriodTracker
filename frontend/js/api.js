// frontend/js/api.js
function getToken() {
  return localStorage.getItem("token");
}

function authHeaders(json = true) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Token ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

// Always use full backend URL
function apiUrl(path) {
  const base = window.CONFIG?.API_BASE || "http://127.0.0.1:8000";
  return `${base}${path}`;
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(apiUrl(path), options);

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.error)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}
