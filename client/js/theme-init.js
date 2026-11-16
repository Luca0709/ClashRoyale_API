// Wird blockierend im <head> geladen, damit beim Seitenaufbau das richtige Theme
// sofort aktiv ist (kein kurzes Aufblitzen des falschen Themes).
try {
  document.documentElement.dataset.theme = localStorage.getItem("theme") || "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}