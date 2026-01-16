document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  const monthTitle = document.getElementById("monthTitle");
  const grid = document.getElementById("calendarGrid");
  const calMsg = document.getElementById("cal_msg");

  let current = new Date();

  document.getElementById("prevBtn")?.addEventListener("click", () => {
    current.setMonth(current.getMonth() - 1);
    render();
  });

  document.getElementById("nextBtn")?.addEventListener("click", () => {
    current.setMonth(current.getMonth() + 1);
    render();
  });

  const setMsg = (t) => {
    if (calMsg) calMsg.innerText = t || "";
  };

  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const parseYMD = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const daysBetween = (a, b) =>
    Math.round((b - a) / (1000 * 60 * 60 * 24));

  const avg = (arr) => {
    if (!arr.length) return null;
    return Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 10) / 10;
  };

  function rangeDatesSet(start, end) {
    const out = new Set();
    let d = new Date(start);
    while (d <= end) {
      out.add(ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  async function loadLogs() {
    return await fetchJSON("/api/period-logs/", {
      method: "GET",
      headers: authHeaders(),
    });
  }

  function buildCalendarMarks(logs) {
    const periodDays = new Set();
    const fertileDays = new Set();
    let ovulationKey = null;
    let nextPeriodKey = null;

    if (!Array.isArray(logs) || logs.length === 0) {
      return { periodDays, fertileDays, ovulationKey, nextPeriodKey };
    }

    // sort oldest -> newest
    const sorted = [...logs].sort((a, b) =>
      (a.start_date || "").localeCompare(b.start_date || "")
    );

    // PERIOD days
    sorted.forEach((log) => {
      if (!log.start_date || !log.end_date) return;
      const s = parseYMD(log.start_date);
      const e = parseYMD(log.end_date);
      const set = rangeDatesSet(s, e);
      set.forEach((d) => periodDays.add(d));
    });

    // Average cycle length
    const manualCycles = sorted
      .map((l) => Number(l.cycle_length))
      .filter((n) => Number.isFinite(n) && n > 0);

    const computedCycles = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (!sorted[i].start_date || !sorted[i + 1].start_date) continue;
      const s1 = parseYMD(sorted[i].start_date);
      const s2 = parseYMD(sorted[i + 1].start_date);
      const diff = daysBetween(s1, s2);
      if (diff > 0 && diff < 60) computedCycles.push(diff);
    }

    const avgCycle = avg(manualCycles.length >= 2 ? manualCycles : computedCycles) || 28;

    // Use last start date for predictions
    const lastStart = parseYMD(sorted[sorted.length - 1].start_date);

    // Next period estimate
    const nextPeriod = addDays(lastStart, Math.round(avgCycle));
    nextPeriodKey = ymd(nextPeriod);

    // Ovulation estimate (avgCycle - 14)
    const ovOffset = Math.max(10, Math.round(avgCycle) - 14);
    const ovDate = addDays(lastStart, ovOffset);
    ovulationKey = ymd(ovDate);

    // Fertile window: ovulation -5 to ovulation +1
    const fertileStart = addDays(ovDate, -5);
    const fertileEnd = addDays(ovDate, 1);
    const fertileSet = rangeDatesSet(fertileStart, fertileEnd);
    fertileSet.forEach((d) => fertileDays.add(d));

    return { periodDays, fertileDays, ovulationKey, nextPeriodKey };
  }

  async function render() {
    setMsg("");
    grid.innerHTML = "";

    const year = current.getFullYear();
    const month = current.getMonth();

    if (monthTitle) {
      monthTitle.innerText = current.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0 Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // week day names
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    names.forEach((n) => {
      const el = document.createElement("div");
      el.className = "day-cell day-name";
      el.innerText = n;
      grid.appendChild(el);
    });

    for (let i = 0; i < startDay; i++) {
      const blank = document.createElement("div");
      blank.className = "day-cell";
      blank.innerHTML = "&nbsp;";
      grid.appendChild(blank);
    }

    let marks = {
      periodDays: new Set(),
      fertileDays: new Set(),
      ovulationKey: null,
      nextPeriodKey: null,
    };

    try {
      const logs = await loadLogs();
      marks = buildCalendarMarks(logs);
    } catch (e) {
      setMsg(e.message || "Failed to load logs.");
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = ymd(dateObj);

      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.innerText = day;

      // Order matters (so important markers win visually)
      if (marks.fertileDays.has(key)) cell.classList.add("fertile-day");
      if (marks.ovulationKey === key) cell.classList.add("ovulation-day");
      if (marks.nextPeriodKey === key) cell.classList.add("next-period-day");
      if (marks.periodDays.has(key)) cell.classList.add("period-day");

      grid.appendChild(cell);
    }
  }

  render();
});
