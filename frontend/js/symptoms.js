document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const dateEl = document.getElementById("symDate");
  const severityEl = document.getElementById("symSeverity");
  const noteEl = document.getElementById("symNote");

  const chipsWrap = document.getElementById("symptomChips");
  const selectedCountEl = document.getElementById("selectedCount");
  const selectedPreviewEl = document.getElementById("selectedPreview");

  const saveBtn = document.getElementById("saveSymBtn");
  const msgEl = document.getElementById("sym_msg");

  const listEl = document.getElementById("symList");

  const aiTipEl = document.getElementById("aiSymTip");
  const aiMsgEl = document.getElementById("aiSymMsg");
  const getAiTipsBtn = document.getElementById("getAiTipsBtn");

  const setMsg = (t = "") => (msgEl.innerText = t);
  const setAiMsg = (t = "") => (aiMsgEl.innerText = t);

  // default date = today
  dateEl.value = new Date().toISOString().slice(0, 10);

  const SYMPTOMS = [
    "Cramps",
    "Headache",
    "Back pain",
    "Bloating",
    "Nausea",
    "Breast tenderness",
    "Acne",
    "Fatigue",
    "Dizziness",
    "Mood swings",
    "Insomnia",
    "Food cravings",
  ];

  const selected = new Set();

  function renderSelectedPreview() {
    selectedCountEl.innerText = String(selected.size);
    selectedPreviewEl.innerText = selected.size
      ? Array.from(selected).join(", ")
      : "None";
  }

  function renderChips() {
    chipsWrap.innerHTML = "";
    SYMPTOMS.forEach((s) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerText = s;

      if (selected.has(s)) chip.classList.add("active");

      chip.addEventListener("click", () => {
        if (selected.has(s)) selected.delete(s);
        else selected.add(s);

        chip.classList.toggle("active");
        renderSelectedPreview();
      });

      chipsWrap.appendChild(chip);
    });
  }

  async function loadAiTips(symptoms, severity) {
    aiTipEl.innerText = "Thinking...";
    setAiMsg("");

    try {
      const data = await fetchJSON("/api/ai/symptoms/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ symptoms, severity }),
      });

      aiTipEl.innerText = data.text || "No tip returned.";
    } catch (e) {
      aiTipEl.innerText = "Tips unavailable.";
      setAiMsg(e.message || "AI request failed.");
    }
  }

  async function loadSymptomLogs() {
    listEl.innerHTML = "Loading...";
    try {
      const logs = await fetchJSON("/api/symptom-logs/", {
        method: "GET",
        headers: authHeaders(),
      });

      if (!Array.isArray(logs) || logs.length === 0) {
        listEl.innerHTML = "<p>No symptom logs yet.</p>";
        aiTipEl.innerText =
          "Save symptoms or select symptoms, then click “Get Tips”.";
        return;
      }

      // ✅ Auto-load tips for latest saved log (first item)
      const latest = logs[0];
      const latestSymptoms = Array.isArray(latest.symptoms)
        ? latest.symptoms
        : [];
      const latestSeverity = latest.severity ?? 5;

      if (latestSymptoms.length) {
        loadAiTips(latestSymptoms, latestSeverity);
      }

      listEl.innerHTML = "";
      logs.forEach((log) => {
        const div = document.createElement("div");
        div.className = "card";
        div.style.marginBottom = "12px";

        const symText = Array.isArray(log.symptoms)
          ? log.symptoms.join(", ")
          : log.symptoms || "";

        div.innerHTML = `
          <p><strong>${log.date}</strong> — Severity: ${log.severity ?? "-"}</p>
          <p><strong>Symptoms:</strong> ${symText || "-"}</p>
          <p>${log.note ? log.note : ""}</p>

          <div style="display:flex; gap:10px; margin-top:8px;">
            <button class="btn" data-action="tips"
              data-symptoms='${JSON.stringify(log.symptoms || [])}'
              data-severity="${log.severity ?? 5}">
              Get Tips
            </button>

            <button class="btn" data-action="delete" data-id="${log.id}">
              Delete
            </button>
          </div>
        `;

        listEl.appendChild(div);
      });
    } catch (e) {
      listEl.innerHTML = `<p style="color:red;">${e.message}</p>`;
      aiTipEl.innerText = "Tips unavailable.";
      setAiMsg(e.message);
    }
  }

  async function saveSymptoms() {
    setMsg("");

    const payload = {
      date: dateEl.value,
      symptoms: Array.from(selected),
      severity: Number(severityEl.value || 5),
      note: noteEl.value.trim(),
    };

    if (!payload.date) {
      setMsg("Please select a date.");
      return;
    }
    if (payload.symptoms.length === 0) {
      setMsg("Please select at least 1 symptom.");
      return;
    }

    try {
      await fetchJSON("/api/symptom-logs/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      await loadSymptomLogs(); // this will auto-load tips for latest
      noteEl.value = "";
      selected.clear();
      renderChips();
      renderSelectedPreview();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteSymptom(id) {
    const ok = confirm("Delete this symptom log?");
    if (!ok) return;

    try {
      await fetchJSON(`/api/symptom-logs/${id}/`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      await loadSymptomLogs();
    } catch (e) {
      setMsg(e.message);
    }
  }

  // ✅ Button: Get tips using selected symptoms (without saving)
  getAiTipsBtn.addEventListener("click", () => {
    const symptoms = Array.from(selected);
    const severity = Number(severityEl.value || 5);

    if (symptoms.length === 0) {
      setAiMsg("Please select at least 1 symptom to get tips.");
      return;
    }

    loadAiTips(symptoms, severity);
  });

  saveBtn.addEventListener("click", saveSymptoms);

  // ✅ Tips + Delete buttons in history list
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");

    if (action === "delete") {
      const id = btn.getAttribute("data-id");
      deleteSymptom(id);
    }

    if (action === "tips") {
      const symptoms = JSON.parse(btn.getAttribute("data-symptoms") || "[]");
      const severity = Number(btn.getAttribute("data-severity") || 5);
      loadAiTips(symptoms, severity);
    }
  });

  // init
  renderChips();
  renderSelectedPreview();
  loadSymptomLogs();
});
