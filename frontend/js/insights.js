document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  const box = document.getElementById("insightsBox");
  const msg = document.getElementById("ins_msg");
  if (msg) msg.innerText = "";

  const parseDate = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const daysBetween = (a, b) =>
    Math.round((b - a) / (1000 * 60 * 60 * 24));

  const avg = (nums) => {
    if (!nums.length) return null;
    return Math.round((nums.reduce((x, y) => x + y, 0) / nums.length) * 10) / 10;
  };

  try {
    const logs = await fetchJSON("/api/period-logs/", {
      method: "GET",
      headers: authHeaders(),
    });

    if (!Array.isArray(logs) || logs.length < 2) {
      box.innerHTML = `<p>Add at least <strong>2 logs</strong> to see insights.</p>`;
      return;
    }

    logs.sort((a, b) => a.start_date.localeCompare(b.start_date));

    const periodLengths = logs
      .filter((l) => l.start_date && l.end_date)
      .map((l) => daysBetween(parseDate(l.start_date), parseDate(l.end_date)) + 1);

    const cycleLengths = [];
    for (let i = 0; i < logs.length - 1; i++) {
      cycleLengths.push(
        daysBetween(parseDate(logs[i].start_date), parseDate(logs[i + 1].start_date))
      );
    }

    const avgPeriod = avg(periodLengths);
    const avgCycle = avg(cycleLengths);

    const lastStart = parseDate(logs[logs.length - 1].start_date);
    const predicted = new Date(lastStart);
    predicted.setDate(predicted.getDate() + (avgCycle || 28));

    box.innerHTML = `
      <h3>Your Stats</h3>
      <p><strong>Average cycle length:</strong> ${avgCycle ?? "-"} days</p>
      <p><strong>Average period length:</strong> ${avgPeriod ?? "-"} days</p>
      <p><strong>Predicted next period:</strong> ${predicted.toDateString()}</p>
    `;
  } catch (e) {
    if (msg) msg.innerText = e.message;
  }
});
