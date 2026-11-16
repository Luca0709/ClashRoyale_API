// Zugriff auf die offizielle Clash Royale API.

const API_KEY = process.env.CR_API_KEY;
// Optional: z. B. "https://proxy.royaleapi.dev/v1" für lokale Entwicklung ohne fixe IP
const API_BASE = process.env.CR_API_BASE || "https://api.clashroyale.com/v1";

if (!API_KEY) {
  console.warn("⚠️  CR_API_KEY ist nicht gesetzt – API-Anfragen werden fehlschlagen.");
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ERROR_MESSAGES = {
  400: "Ungültige Anfrage an die Clash Royale API.",
  403: "Zugriff verweigert – API-Key oder IP-Freigabe prüfen.",
  404: "Nicht gefunden.",
  429: "Zu viele Anfragen – bitte kurz warten.",
  503: "Die Clash Royale API ist gerade in Wartung."
};

/** Ruft einen Endpunkt der offiziellen API auf und liefert das JSON zurück. */
export async function crFetch(endpoint) {
  if (!API_KEY) {
    throw new ApiError(500, "Der Server hat keinen API-Key konfiguriert.");
  }

  let response;
  try {
    response = await fetch(API_BASE + endpoint, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new ApiError(504, "Die Clash Royale API antwortet nicht.");
  }

  if (!response.ok) {
    const message = ERROR_MESSAGES[response.status] ?? `API-Fehler (${response.status}).`;
    throw new ApiError(response.status, message);
  }

  return response.json();
}

/**
 * Macht aus "#abc", "abc" oder "ABO" einen gültigen, URL-kodierten Tag.
 * Clash-Royale-Tags bestehen nur aus 0289PYLQGRJCUV – ein "O" ist meist eine Null.
 */
export function normalizeTag(rawTag, what = "Tag") {
  const tag = String(rawTag ?? "")
    .trim()
    .toUpperCase()
    .replace(/^#/, "")
    .replace(/O/g, "0");

  if (!/^[0289PYLQGRJCUV]{3,14}$/.test(tag)) {
    throw new ApiError(400, `Ungültiger ${what}. Erlaubt sind nur 0289PYLQGRJCUV.`);
  }

  return encodeURIComponent(`#${tag}`);
}

/** Die API liefert Zeiten als "20250101T120000.000Z". */
export function parseCrDate(value) {
  if (!value) return null;
  const iso = value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}