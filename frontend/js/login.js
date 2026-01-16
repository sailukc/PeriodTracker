document.addEventListener("DOMContentLoaded", () => {
  const msgEl = document.getElementById("login_msg");
  const setMsg = (t) => { if (msgEl) msgEl.innerText = t || ""; };
  setMsg("");

  document.getElementById("loginBtn").addEventListener("click", loginUser);

  async function loginUser() {
    setMsg("");

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      setMsg("Please enter username and password.");
      return;
    }

    try {
      const data = await fetchJSON(`${API_BASE}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username || username);

      window.location.href = "dashboard.html";
    } catch (err) {
      setMsg(err.message);
    }
  }
});
