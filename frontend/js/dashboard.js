document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  const welcome = document.getElementById("welcomeText");
  const box = document.getElementById("recent_logs");

  if (welcome) {
    const u = localStorage.getItem("username") || "User";
    welcome.innerText = `Welcome, ${u} 👋`;
  }

  box.innerHTML = "";

  try {
    const logs = await fetchJSON("/api/period-logs/", {
      method: "GET",
      headers: authHeaders(),
    });

    if (!Array.isArray(logs) || logs.length === 0) {
      box.innerHTML = "<p>No logs yet.</p>";
      return;
    }

    logs.slice(0, 3).forEach((log) => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <p><strong>${log.start_date}</strong> → ${log.end_date || "-"}</p>
        <p>Flow: ${log.flow_level || "-"} | Cycle: ${log.cycle_length || "-"}</p>
        <p>Mood: ${log.mood || "-"}</p>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    box.innerHTML = `<p style="color:red">${err.message}</p>`;
  }
});
