document.addEventListener("DOMContentLoaded", () => {
  const msgEl = document.getElementById("message");
  const btn = document.getElementById("registerBtn");

  const setMsg = (t) => { if (msgEl) msgEl.innerText = t || ""; };
  setMsg("");

  btn?.addEventListener("click", async () => {
    setMsg("");

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !email || !password) {
      setMsg("Please fill all fields.");
      return;
    }

    btn.disabled = true;

    try {
      await fetchJSON("/api/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      alert("Registration successful! Please login.");
      window.location.href = "login.html";
    } catch (err) {
      setMsg(err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
