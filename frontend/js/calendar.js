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

  const setMsg = (t) => { if (calMsg) calMsg.innerText = t || ""; };

  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  function rangeDates(start, end) {
    const out = [];
    let d = new Date(start);
    while (d <= end) {
      out.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  async function getPeriodDaysSet() {
    const logs = await fetchJSON("/api/period-logs/", {
      method: "GET",
      headers: authHeaders(),
    });

    const days = new Set();
    logs.forEach((log) => {
      if (!log.start_date || !log.end_date) return;
      const s = new Date(log.start_date);
      const e = new Date(log.end_date);
      rangeDates(s, e).forEach((d) => days.add(d));
    });

    return days;
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
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

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

    let periodDays = new Set();
    try {
      periodDays = await getPeriodDaysSet();
    } catch (e) {
      setMsg(e.message);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = ymd(dateObj);

      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.innerText = day;

      if (periodDays.has(key)) cell.classList.add("period-day");

      grid.appendChild(cell);
    }
  }

  render();
});
