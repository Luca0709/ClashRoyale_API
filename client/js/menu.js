// menu.js

// -----------------------------
// Hamburger Menü
// -----------------------------
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

// Optional: Klick außerhalb schließt Sidebar
document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        sidebar.classList.remove("open");
    }
});

// -----------------------------
// Dark/Light Mode Switch
// -----------------------------
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

// Funktion zum Setzen des Themes
function setTheme(darkMode) {
    if (darkMode) {
        body.classList.add("dark");
        body.classList.remove("light");
        themeToggle.checked = true;
    } else {
        body.classList.add("light");
        body.classList.remove("dark");
        themeToggle.checked = false;
    }
    localStorage.setItem("theme", darkMode ? "dark" : "light");
}

// Initialisierung: Theme aus localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
    setTheme(true);
} else if (savedTheme === "light") {
    setTheme(false);
} else {
    // Standard Dark Mode
    setTheme(true);
}

// Event Listener für Toggle
themeToggle.addEventListener("change", () => {
    setTheme(themeToggle.checked);
});