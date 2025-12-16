const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    "Authorization": `Token ${token}`
  };
}

function requireLogin() {
  const token = getToken();
  if (!token) {
    alert("Please login first");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// --- Calendar rendering helpers ---
let current = new Date();

function fmtDate(d) {
  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(s) {
  // s = "YYYY-MM-DD"
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateInRange(day, start, end) {
  return day >= start && day <= end;
}

function buildCalendarGrid(monthDate, logs) {
  const grid = document.getElementById("calendar_grid");
  grid.innerHTML = "";

  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(7, 1fr)";
  grid.style.gap = "8px";

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  document.getElementById("month_title").innerText =
    monthDate.toLocaleString(undefined, { month: "long", year: "numeric" });

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const startOffset = first.getDay(); // 0 Sun .. 6 Sat
  const totalDays = last.getDate();

  // Day labels
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  labels.forEach(l => {
    const el = document.createElement("div");
    el.innerText = l;
    el.style.fontWeight = "700";
    grid.appendChild(el);
  });

  // Empty slots before day 1
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    grid.appendChild(empty);
  }

  // Days
  for (let d = 1; d <= totalDays; d++) {
    const cellDate = new Date(year, month, d);

    const cell = document.createElement("div");
    cell.className = "card";
    cell.style.padding = "10px";
    cell.style.minHeight = "60px";
    cell.innerHTML = `<strong>${d}</strong>`;

    // mark if it falls within any period log range
    const isPeriodDay = logs.some(log => {
      const s = parseDate(log.start_date);
      const e = parseDate(log.end_date);
      return dateInRange(cellDate, s, e);
    });

    if (isPeriodDay) {
      cell.style.border = "2px solid #ff4d88";
      cell.style.background = "#ffe6ef";
      const tag = document.createElement("div");
      tag.innerText = "Period";
      tag.style.marginTop = "6px";
      tag.style.fontSize = "12px";
      cell.appendChild(tag);
    }

    grid.appendChild(cell);
  }
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

async function render() {
  const logs = await fetchLogs();
  buildCalendarGrid(current, logs);
}

window.addEventListener("load", async () => {
  if (!requireLogin()) return;

  document.getElementById("prev_month").addEventListener("click", async () => {
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    await render();
  });

  document.getElementById("next_month").addEventListener("click", async () => {
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    await render();
  });

  await render();
});
