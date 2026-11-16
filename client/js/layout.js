// Gemeinsames Layout für alle Seiten: Topbar, Sidebar und Theme-Umschalter.
// Jede Seite bindet diese Datei (direkt oder per import) ein.

const NAV_ITEMS = [
  { href: "/", label: "Spielersuche", icon: "🔍" },
  { href: "/leaderboards.html", label: "Leaderboards", icon: "🏆" },
  { href: "/clans.html", label: "Clansuche", icon: "🛡️" },
  { href: "/decks.html", label: "Meta-Decks", icon: "🃏" }
];

function renderLayout() {
  const currentPath = location.pathname === "/index.html" ? "/" : location.pathname;

  const links = NAV_ITEMS.map((item) => `
    <a href="${item.href}" class="nav-link ${item.href === currentPath ? "active" : ""}">
      <span class="nav-icon">${item.icon}</span>${item.label}
    </a>
  `).join("");

  document.body.insertAdjacentHTML("afterbegin", `
    <header class="topbar">
      <button class="icon-btn" id="menuBtn" aria-label="Menü öffnen" aria-expanded="false">☰</button>
      <a href="/" class="brand"><span class="brand-logo">👑</span>Clash Royale API</a>
      <button class="icon-btn" id="themeToggle" aria-label="Theme wechseln"></button>
    </header>

    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
    <nav class="sidebar" id="sidebar" aria-label="Hauptnavigation">${links}</nav>
  `);
}

function setupSidebar() {
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  const setOpen = (open) => {
    sidebar.classList.toggle("open", open);
    backdrop.classList.toggle("show", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  };

  menuBtn.addEventListener("click", () => setOpen(!sidebar.classList.contains("open")));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    toggle.textContent = theme === "dark" ? "☀️" : "🌙";
    toggle.title = theme === "dark" ? "Zum hellen Design wechseln" : "Zum dunklen Design wechseln";
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // localStorage nicht verfügbar (z. B. privater Modus) – Theme gilt nur für diese Seite
    }
  };

  applyTheme(root.dataset.theme === "light" ? "light" : "dark");
  toggle.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });
}

renderLayout();
setupSidebar();
setupThemeToggle();