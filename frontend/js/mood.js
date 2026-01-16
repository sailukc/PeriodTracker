document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const dateEl = document.getElementById("moodDate");
  const moodEl = document.getElementById("moodValue");
  const intensityEl = document.getElementById("moodIntensity");
  const noteEl = document.getElementById("moodNote");

  const saveBtn = document.getElementById("saveMoodBtn");
  const aiBtn = document.getElementById("aiMoodBtn");

  const listEl = document.getElementById("moodList");
  const msgEl = document.getElementById("mood_msg");
  const aiBox = document.getElementById("aiMoodBox");

  const setMsg = (t) => (msgEl.innerText = t || "");
  const today = new Date().toISOString().slice(0, 10);

  // Default date = today
  if (dateEl) dateEl.value = today;

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c]));
  }

  function renderList(items) {
    if (!items || items.length === 0) {
      listEl.innerHTML = "<p>No mood logs yet.</p>";
      return;
    }

    listEl.innerHTML = items.map((m) => `
      <div class="card" style="margin:10px 0; padding:12px;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div>
            <b>${escapeHtml(m.date)}</b> •
            <span>${escapeHtml(m.mood)}</span> •
            Intensity: <b>${escapeHtml(m.intensity)}</b>
          </div>
          <div style="display:flex; gap:8px;">
            <button data-action="edit" data-id="${m.id}">Edit</button>
            <button data-action="delete" data-id="${m.id}">Delete</button>
          </div>
        </div>
        ${m.note ? `<div style="margin-top:8px;">📝 ${escapeHtml(m.note)}</div>` : ""}
      </div>
    `).join("");
  }

  async function loadMoodLogs() {
    try {
      const items = await fetchJSON("/api/mood-logs/", {
        method: "GET",
        headers: authHeaders(),
      });
      renderList(items);
      setMsg("");
    } catch (e) {
      listEl.innerHTML = "";
      setMsg(e.message || "Failed to load mood logs.");
    }
  }

  async function createMood() {
    const payload = {
      date: dateEl.value,
      mood: moodEl.value,
      intensity: Number(intensityEl.value || 5),
      note: noteEl.value || "",
    };

    if (!payload.date || !payload.mood) {
      setMsg("Please select date and mood.");
      return;
    }

    try {
      await fetchJSON("/api/mood-logs/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      setMsg("");
      noteEl.value = "";
      await loadMoodLogs();
    } catch (e) {
      setMsg(e.message || "Failed to save mood.");
    }
  }

  async function updateMood(id) {
    const payload = {
      date: dateEl.value,
      mood: moodEl.value,
      intensity: Number(intensityEl.value || 5),
      note: noteEl.value || "",
    };

    try {
      await fetchJSON(`/api/mood-logs/${id}/`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      setMsg("");
      saveBtn.dataset.mode = "create";
      saveBtn.dataset.editId = "";
      saveBtn.innerText = "Save Mood";
      noteEl.value = "";
      await loadMoodLogs();
    } catch (e) {
      setMsg(e.message || "Failed to update mood.");
    }
  }

  async function deleteMood(id) {
    if (!confirm("Delete this mood log?")) return;

    try {
      await fetchJSON(`/api/mood-logs/${id}/`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      setMsg("");
      await loadMoodLogs();
    } catch (e) {
      setMsg(e.message || "Failed to delete mood.");
    }
  }

  async function getAiMoodTip() {
    aiBox.innerText = "Thinking...";
    setMsg("");

    const mood = moodEl.value;
    const intensity = Number(intensityEl.value || 5);

    if (!mood) {
      aiBox.innerText = "";
      setMsg("Select a mood first to get AI tip.");
      return;
    }

    try {
      const data = await fetchJSON("/api/ai/mood/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ mood, intensity }),
      });

      aiBox.innerText = data.text || "No AI tip returned.";
    } catch (e) {
      aiBox.innerText = "";
      setMsg(e.message || "AI tip failed.");
    }
  }

  // Save button (create or update)
  saveBtn.addEventListener("click", async () => {
    aiBox.innerText = "";

    const mode = saveBtn.dataset.mode || "create";
    const editId = saveBtn.dataset.editId;

    if (mode === "edit" && editId) {
      await updateMood(editId);
    } else {
      await createMood();
    }
  });

  aiBtn.addEventListener("click", getAiMoodTip);

  // Edit/Delete actions (event delegation)
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === "delete") {
      await deleteMood(id);
      return;
    }

    if (action === "edit") {
      // Find log info from the UI text (better way: keep cached list; but simple is okay)
      // We'll fetch the list again and find the item
      try {
        const items = await fetchJSON("/api/mood-logs/", {
          method: "GET",
          headers: authHeaders(),
        });
        const item = items.find((x) => String(x.id) === String(id));
        if (!item) return;

        dateEl.value = item.date || today;
        moodEl.value = item.mood || "";
        intensityEl.value = item.intensity ?? 5;
        noteEl.value = item.note || "";

        saveBtn.dataset.mode = "edit";
        saveBtn.dataset.editId = id;
        saveBtn.innerText = "Update Mood";
        setMsg("Editing mood log. Update and save.");
      } catch (err) {
        setMsg("Could not load mood log for editing.");
      }
    }
  });

  loadMoodLogs();
});
