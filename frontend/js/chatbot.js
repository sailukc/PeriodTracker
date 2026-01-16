document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const chatBox = document.getElementById("chatBox");
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");   // ✅ NEW
  const msgEl = document.getElementById("chat_msg");
  const typingEl = document.getElementById("typing");     // ✅ NEW (optional)

  const setMsg = (t) => {
    if (msgEl) msgEl.innerText = t || "";
  };

  const setTyping = (on) => {
    if (!typingEl) return;
    typingEl.style.display = on ? "block" : "none";
  };

  function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function bubble(role, text) {
    const div = document.createElement("div");
    div.className = `bubble ${role === "user" ? "user" : "bot"}`;
    div.innerText = text;
    chatBox.appendChild(div);
    scrollToBottom();
    return div;
  }

  function resetChatUI() {
    chatBox.innerHTML = `
      <div class="bubble bot">
        Hi! Ask me anything about cycles, cramps, mood, and tracking tips.
        (I’m not a doctor.)
      </div>
    `;
  }

  async function loadHistory() {
    try {
      setMsg("");
      const history = await fetchJSON("/api/chat/history/?limit=30", {
        method: "GET",
        headers: authHeaders(),
      });

      resetChatUI();
      history.forEach((m) => bubble(m.role, m.content));
    } catch (e) {
      setMsg("Could not load chat history. Please login again.");
      console.error(e);
    }
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    setMsg("");
    input.value = "";

    bubble("user", text);
    setTyping(true);

    try {
      const data = await fetchJSON("/api/chatbot/", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: text }),
      });

      bubble("assistant", data.reply || "No reply received.");

      // Optional tiny info message (not error)
      if (data.source === "fallback") {
        setMsg("AI is running in fallback mode (check OpenAI credits/quota).");
      }
    } catch (e) {
      bubble("assistant", "I couldn’t reach the AI right now. Please try again.");
      setMsg(""); // keep UI clean
      console.error(e);
    } finally {
      setTyping(false);
    }
  }

  async function clearChat() {
    try {
      setMsg("");
      setTyping(false);

      await fetchJSON("/api/chat/clear/", {
        method: "POST",
        headers: authHeaders(false),
      });

      resetChatUI();
    } catch (e) {
      setMsg("Could not clear chat. Try again.");
      console.error(e);
    }
  }

  // ✅ listeners
  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // ✅ clear button is optional, only attach if exists
  if (clearBtn) clearBtn.addEventListener("click", clearChat);

  // ✅ initial load
  resetChatUI();
  loadHistory();
});
