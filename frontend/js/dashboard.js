document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;

  const welcome = document.getElementById("welcomeText");
  const recentBox = document.getElementById("recent_logs");
  const cycleBox = document.getElementById("cycleBox");
  const fertileBox = document.getElementById("fertileBox");

  // NEW UI for phase bar
  const phaseFill = document.getElementById("phaseFill");
  const phaseText = document.getElementById("phaseText");
  const fertileLeftEl = document.getElementById("fertileLeft");

  const u = localStorage.getItem("username") || "User";
  if (welcome) welcome.innerText = `Welcome, ${u} 👋`;

  recentBox.innerHTML = "";
  if (cycleBox) cycleBox.innerHTML = "Loading...";
  if (fertileBox) fertileBox.innerHTML = "Loading...";

  const parseYMD = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const fmt = (d) => d.toISOString().slice(0, 10);

  const daysBetween = (a, b) =>
    Math.round((b - a) / (1000 * 60 * 60 * 24));

  const avg = (arr) => {
    if (!arr.length) return null;
    return Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 10) / 10;
  };

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  function phaseName(cycleDay) {
    if (cycleDay <= 5) return "Menstrual phase";
    if (cycleDay <= 13) return "Follicular phase";
    if (cycleDay <= 16) return "Ovulation window";
    return "Luteal phase";
  }

  function pregnancyChanceLabel(cycleDay, fertileStartDay, fertileEndDay) {
    if (cycleDay >= fertileStartDay && cycleDay <= fertileEndDay) return "High";
    if (cycleDay === fertileStartDay - 1 || cycleDay === fertileEndDay + 1) return "Medium";
    return "Low";
  }

  function setPhaseBar(cycleDay, avgCycle) {
    if (!phaseFill) return;
    const pct = Math.max(0, Math.min(100, (cycleDay / avgCycle) * 100));
    phaseFill.style.width = `${pct}%`;
  }

  try {
    const logs = await fetchJSON("/api/period-logs/", {
      method: "GET",
      headers: authHeaders(),
    });

    if (!Array.isArray(logs) || logs.length === 0) {
      recentBox.innerHTML = "<p>No logs yet.</p>";
      if (cycleBox) cycleBox.innerHTML = "<p>Add at least 1 period log to see predictions.</p>";
      if (fertileBox) fertileBox.innerHTML = "";
      return;
    }

    // oldest -> newest
    const sorted = [...logs].sort((a, b) =>
      (a.start_date || "").localeCompare(b.start_date || "")
    );

    const last = sorted[sorted.length - 1];
    const lastStart = parseYMD(last.start_date);

    // Prefer user-entered cycle_length, else compute from start_date gaps
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

    const useManual = manualCycles.length >= 2;
    const avgCycle = avg(useManual ? manualCycles : computedCycles) || 28;
    const cycleSource = useManual ? "Manual cycle_length" : "Computed from start dates";

    const today = new Date();
    const cycleDay = daysBetween(lastStart, today) + 1;

    const nextPeriod = addDays(lastStart, Math.round(avgCycle));
    const daysRemaining = daysBetween(today, nextPeriod);

    // ovulation approx avgCycle - 14
    const ovulationOffset = Math.max(10, Math.round(avgCycle) - 14);
    const ovulationDate = addDays(lastStart, ovulationOffset);

    // fertile window: ovulation -5 to +1
    const fertileStartDate = addDays(ovulationDate, -5);
    const fertileEndDate = addDays(ovulationDate, 1);

    const fertileStartDay = daysBetween(lastStart, fertileStartDate) + 1;
    const fertileEndDay = daysBetween(lastStart, fertileEndDate) + 1;

    const phase = phaseName(cycleDay);
    const chance = pregnancyChanceLabel(cycleDay, fertileStartDay, fertileEndDay);

    // Fertile days left
    let fertileLeftText = "Fertile window not active today.";
    if (cycleDay >= fertileStartDay && cycleDay <= fertileEndDay) {
      const left = fertileEndDay - cycleDay;
      fertileLeftText = left === 0
        ? "Last fertile day is today."
        : `Fertile window ends in ${left} day(s).`;
    }

    // Render cards
    if (cycleBox) {
      cycleBox.innerHTML = `
        <div class="card">
          <h3>Cycle Prediction</h3>
          <p><strong>Cycle day:</strong> ${cycleDay}</p>
          <p><strong>Phase:</strong> ${phase}</p>
          <p><strong>Average cycle:</strong> ${avgCycle} days <span style="color:#666;">(${cycleSource})</span></p>
          <p><strong>Next period estimate:</strong> ${fmt(nextPeriod)}</p>
          <p><strong>Countdown:</strong> ${daysRemaining >= 0 ? `${daysRemaining} day(s)` : "Past due (log your period)"} </p>
        </div>
      `;
    }

    if (fertileBox) {
      fertileBox.innerHTML = `
        <div class="card">
          <h3>Fertility Estimate</h3>
          <p><strong>Ovulation estimate:</strong> ${fmt(ovulationDate)}</p>
          <p><strong>Fertile window:</strong> ${fmt(fertileStartDate)} → ${fmt(fertileEndDate)}</p>
          <p><strong>Pregnancy chance today:</strong> ${chance}</p>
          <p style="color:#666; font-size:14px;">
            Estimates only — not contraception or medical advice.
          </p>
        </div>
      `;
    }

    // Phase bar
    setPhaseBar(cycleDay, avgCycle);
    if (phaseText) phaseText.innerText = `You’re in: ${phase} (Day ${cycleDay} of ~${Math.round(avgCycle)})`;
    if (fertileLeftEl) fertileLeftEl.innerText = fertileLeftText;

    // Recent logs
    recentBox.innerHTML = "";
    sorted.slice(-3).reverse().forEach((log) => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <p><strong>${log.start_date}</strong> → ${log.end_date || "-"}</p>
        <p>Flow: ${log.flow_level || "-"} | Cycle: ${log.cycle_length || "-"}</p>
        <p>Mood: ${log.mood || "-"}</p>
      `;
      recentBox.appendChild(div);
    });

  } catch (err) {
    recentBox.innerHTML = `<p style="color:red">${err.message}</p>`;
    if (cycleBox) cycleBox.innerHTML = `<p style="color:red">${err.message}</p>`;
    if (fertileBox) fertileBox.innerHTML = "";
  }
});
