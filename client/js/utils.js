// Kleine Helfer, die von mehreren Seiten genutzt werden.

/** Schützt vor HTML-Injection – Spieler- und Clannamen sind frei wählbar! */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** fetch + JSON + verständliche Fehlermeldung in einem. */
export async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Server nicht erreichbar. Bitte später erneut versuchen.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Fehler ${response.status}`);
  }
  return data;
}

/** "#abc" → "ABC" (für URLs, ohne #). */
export function cleanTag(tag) {
  return String(tag ?? "").trim().toUpperCase().replace(/^#/, "");
}

export function formatNumber(value) {
  return value == null ? "—" : Number(value).toLocaleString("de-DE");
}

/** Die API liefert Zeiten als "20250101T120000.000Z". */
export function parseCrDate(value) {
  if (!value) return null;
  const iso = value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

const relativeTime = new Intl.RelativeTimeFormat("de", { numeric: "auto", style: "short" });
const TIME_UNITS = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60]
];

/** Date → "vor 3 Std." */
export function timeAgo(date) {
  if (!date) return "—";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  for (const [unit, unitSeconds] of TIME_UNITS) {
    if (seconds >= unitSeconds) {
      return relativeTime.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }
  return "gerade eben";
}

/** Einheitliche Lade-, Fehler- und Leer-Hinweise. type: loading | error | empty */
export function statusBox(type, message) {
  const spinner = type === "loading" ? `<span class="spinner"></span>` : "";
  return `<div class="status status-${type}">${spinner}${escapeHtml(message)}</div>`;
}

export function flagHtml(countryCode) {
  if (!countryCode) return "🌍";
  const code = escapeHtml(countryCode.toLowerCase());
  return `<img class="flag" src="https://flagcdn.com/w40/${code}.png" alt="" loading="lazy" data-fallback="🌍">`;
}

/** Clan-Wappen; fällt auf ein Platzhalter-Icon zurück, wenn das Bild nicht lädt. */
export function clanBadgeHtml(clan, className = "badge") {
  const src = clan?.badgeUrls?.medium
    ?? (clan?.badgeId ? `https://cdn.royaleapi.com/static/img/badges/${clan.badgeId}.png` : null);

  if (!src) {
    return `<span class="${className} badge-placeholder">🛡️</span>`;
  }
  return `<img class="${className}" src="${escapeHtml(src)}" alt="" loading="lazy" data-fallback="🛡️">`;
}

// Bilder mit data-fallback durch ein Icon ersetzen, wenn sie nicht geladen werden können.
// "error"-Events bubblen nicht, darum lauschen wir in der Capture-Phase.
document.addEventListener("error", (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;

  const placeholder = document.createElement("span");
  placeholder.className = `${img.className} badge-placeholder`;
  placeholder.textContent = img.dataset.fallback;
  img.replaceWith(placeholder);
}, true);