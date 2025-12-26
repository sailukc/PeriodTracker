document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  const msg = document.getElementById("log_msg");
  const saveBtn = document.getElementById("saveBtn");
  const list = document.getElementById("logs_list");

  const setMsg = (t) => { if (msg) msg.innerText = t || ""; };
  setMsg("");

  saveBtn?.addEventListener("click", savePeriodLog);

  await loadPeriodLogs();

  async function savePeriodLog() {
    setMsg("");

    const data = {
      start_date: document.getElementById("start_date").value,
      end_date: document.getElementById("end_date").value || null,
      cycle_length: document.getElementById("cycle_length").value || null,
      flow_level: document.getElementById("flow_level").value,
      mood: document.getElementById("mood").value,
      symptoms: document.getElementById("symptoms").value,
      notes: document.getElementById("notes").value,
    };

    if (!data.start_date) {
      setMsg("Start date is required.");
      return;
    }

    saveBtn.disabled = true;

    try {
      await fetchJSON("/api/period-logs/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
      });

      alert("Log saved!");
      await loadPeriodLogs();
    } catch (err) {
      setMsg(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function loadPeriodLogs() {
    list.innerHTML = "";

    try {
      const logs = await fetchJSON("/api/period-logs/", {
        method: "GET",
        headers: authHeaders(),
      });

      if (!Array.isArray(logs) || logs.length === 0) {
        list.innerHTML = "<p>No logs yet.</p>";
        return;
      }

      logs.forEach((log) => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          <p><strong>${log.start_date}</strong> → ${log.end_date || "-"}</p>
          <p>Cycle: ${log.cycle_length || "-"} | Flow: ${log.flow_level || "-"}</p>
          <p>Mood: ${log.mood || "-"}</p>
          <p>Symptoms: ${log.symptoms || "-"}</p>
          <p>Notes: ${log.notes || "-"}</p>
        `;
        list.appendChild(div);
      });
    } catch (err) {
      list.innerHTML = `<p style="color:red">${err.message}</p>`;
    }
  }
});
