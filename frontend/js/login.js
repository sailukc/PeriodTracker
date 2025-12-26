document.addEventListener("DOMContentLoaded", () => {
  const msgEl = document.getElementById("login_msg");
  const loginBtn = document.getElementById("loginBtn");

  const setMsg = (t) => { if (msgEl) msgEl.innerText = t || ""; };
  setMsg("");

  loginBtn?.addEventListener("click", async () => {
    setMsg("");

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      setMsg("Please enter username and password.");
      return;
    }

    loginBtn.disabled = true;

    try {
      const data = await fetchJSON("/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!data.token) {
        setMsg("Token not received from backend.");
        console.log("Login response:", data);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username || username);

      window.location.href = "dashboard.html";
    } catch (err) {
      setMsg(err.message);
    } finally {
      loginBtn.disabled = false;
    }
  });
});
