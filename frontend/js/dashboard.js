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

function renderRecentLogs(logs) {
  const box = document.getElementById("recent_logs");
  box.innerHTML = "";

  if (!Array.isArray(logs) || logs.length === 0) {
    box.innerHTML = "<p>No logs yet.</p>";
    return;
  }

  // show only last 3
  logs.slice(0, 3).forEach(log => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <p><strong>${log.start_date}</strong> → ${log.end_date || "-"}</p>
      <p>Flow: ${log.flow_level || "-"} | Cycle: ${log.cycle_length || "-"}</p>
      <p>Mood: ${log.mood || "-"}</p>
    `;
    box.appendChild(div);
  });
}

function loadDashboardLogs() {
  fetch(`${API_BASE}/api/period-logs/`, {
    method: "GET",
    headers: authHeaders()
  })
    .then(res => res.json().then(data => ({ status: res.status, data })))
    .then(({ status, data }) => {
      if (status >= 400) {
        console.error("API error:", data);
        document.getElementById("recent_logs").innerHTML =
          "<p style='color:red;'>Could not load logs. Login again.</p>";
        return;
      }
      renderRecentLogs(data);
    })
    .catch(err => {
      console.error(err);
      document.getElementById("recent_logs").innerHTML =
        "<p style='color:red;'>Network error</p>";
    });
}

window.addEventListener("load", () => {
  if (!requireLogin()) return;
  loadDashboardLogs();
});
