const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Token ${getToken()}`
  };
}

function requireLogin() {
  if (!getToken()) {
    alert("Please login first");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date) {
  return date.toLocaleDateString();
}

async function fetchLogs() {
  const res = await fetch(`${API_BASE}/api/period-logs/`, {
    method: "GET",
    headers: authHeaders()
  });
  if (res.status === 401) {
    alert("Session expired. Please login again.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return [];
  }
  return await res.json();
}

window.addEventListener("load", async () => {
  if (!requireLogin()) return;

  const logs = await fetchLogs();
  if (!Array.isArray(logs) || logs.length < 2) {
    document.getElementById("avg_cycle").innerText =
      "Not enough logs yet. Add at least 2 cycles to see insights.";
    document.getElementById("next_prediction").innerText = "";
    return;
  }

  // logs are newest first in your backend order_by('-start_date')
  const sorted = [...logs].sort((a,b) => parseDate(a.start_date) - parseDate(b.start_date));

  // cycle lengths: difference between consecutive start_dates
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDate(sorted[i - 1].start_date);
    const curr = parseDate(sorted[i].start_date);
    const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (days > 0 && days < 90) diffs.push(days);
  }

  const avg = Math.round(diffs.reduce((a,b) => a + b, 0) / diffs.length);
  document.getElementById("avg_cycle").innerText = `Average cycle length: ${avg} days`;

  const lastStart = parseDate(sorted[sorted.length - 1].start_date);
  const nextStart = addDays(lastStart, avg);
  document.getElementById("next_prediction").innerText =
    `Next predicted period start: ${fmt(nextStart)}`;
});
