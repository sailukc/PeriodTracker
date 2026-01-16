document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const box = document.getElementById("insightsBox");
  const msg = document.getElementById("ins_msg");
  const aiBtn = document.getElementById("aiExplainBtn");
  const aiBox = document.getElementById("aiInsightBox");

  msg.innerText = "";
  box.innerHTML = `
    <p>Click <b>Explain with AI</b> to generate insights from your logs.</p>
  `;

  aiBtn.onclick = async () => {
    aiBox.innerText = "Thinking...";

    try {
      const data = await fetchJSON("/api/ai/insights/", {
        method: "GET",
        headers: authHeaders(),
      });

      aiBox.innerText = data.text || "No AI insights returned.";
    } catch (e) {
      aiBox.innerText = e.message || "Failed to load AI insights.";
    }
  };
});
