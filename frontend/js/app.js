document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
});

async function loadNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;

  try {
    const html = await fetch("../components/navbar.html").then(r => r.text());
    nav.innerHTML = html;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "login.html";
      });
    }
  } catch (err) {
    console.error("Navbar load failed:", err);
  }
}
