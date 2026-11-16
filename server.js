import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Lokal: Variablen aus .env laden (Node >= 20.12). Auf Render kommen sie aus dem Dashboard.
try {
  process.loadEnvFile();
} catch {
  // keine .env vorhanden – ist auf dem Server normal
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.CR_API_KEY;
// Optional: z. B. "https://proxy.royaleapi.dev/v1" für lokale Entwicklung ohne fixe IP
const API_BASE = process.env.CR_API_BASE || "https://api.clashroyale.com/v1";

if (!API_KEY) {
  console.warn("⚠️  CR_API_KEY ist nicht gesetzt – API-Anfragen werden fehlschlagen.");
}

const app = express();
app.use(express.static(path.join(__dirname, "client")));


// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

class ApiError extends Error {
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
async function crFetch(endpoint) {
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

/*
 * Sehr einfacher In-Memory-Cache. Spart API-Aufrufe und macht die Seite
 * auf dem Gratis-Server spürbar schneller.
 */
const cache = new Map();
const CACHE_MAX_ENTRIES = 500;

async function cached(key, ttlSeconds, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value;
  }

  const value = await loader();

  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value); // ältesten Eintrag entfernen
  }
  cache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });

  return value;
}

/**
 * Macht aus "#abc", "abc" oder "ABO" einen gültigen, URL-kodierten Tag.
 * Clash-Royale-Tags bestehen nur aus 0289PYLQGRJCUV – ein "O" ist meist eine Null.
 */
function normalizeTag(rawTag, what = "Tag") {
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

/** Wrapper für Routen: liefert JSON oder eine saubere Fehlermeldung. */
function route(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      if (status >= 500) console.error(err);

      res.status(status).json({
        error: err instanceof ApiError ? err.message : "Interner Serverfehler."
      });
    }
  };
}

/** Ersetzt eine generische 404-Meldung durch eine passende. */
function notFoundAs(message) {
  return (err) => {
    if (err instanceof ApiError && err.status === 404) {
      throw new ApiError(404, message);
    }
    throw err;
  };
}


// ---------------------------------------------------------------------------
// API-Routen
// ---------------------------------------------------------------------------

// Spielerprofil
app.get("/api/player/:tag", route((req) => {
  const tag = normalizeTag(req.params.tag, "Spieler-Tag");

  return cached(`player:${tag}`, 60, () =>
    crFetch(`/players/${tag}`).catch(notFoundAs("Spieler nicht gefunden."))
  );
}));

// Battle-Log eines Spielers
app.get("/api/player/:tag/battles", route((req) => {
  const tag = normalizeTag(req.params.tag, "Spieler-Tag");

  return cached(`battles:${tag}`, 60, () =>
    crFetch(`/players/${tag}/battlelog`).catch(notFoundAs("Spieler nicht gefunden."))
  );
}));

// Alle Länder (für Region-Auswahl bei Leaderboard und Clansuche)
app.get("/api/locations", route(() =>
  cached("locations", 24 * 60 * 60, async () => {
    const data = await crFetch("/locations");

    return data.items
      .filter((loc) => loc.isCountry)
      .map(({ id, name, countryCode }) => ({ id, name, countryCode }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  })
));

// Path-of-Legends-Rangliste (global oder pro Land)
app.get("/api/leaderboard", route((req) => {
  const region = String(req.query.region || "global").toLowerCase();

  if (region !== "global" && !/^\d+$/.test(region)) {
    throw new ApiError(400, "Ungültige Region.");
  }

  return cached(`leaderboard:${region}`, 5 * 60, async () => {
    const data = await crFetch(`/locations/${region}/pathoflegend/players?limit=100`)
      .catch(notFoundAs("Region nicht gefunden."));

    return data.items.slice(0, 100);
  });
}));

// Clansuche nach Name (optional mit Region)
app.get("/api/clans", route((req) => {
  const name = String(req.query.name ?? "").trim();
  const locationId = String(req.query.locationId ?? "").trim();

  if (name.length < 3) {
    throw new ApiError(400, "Der Clanname muss mindestens 3 Zeichen lang sein.");
  }
  if (locationId && !/^\d+$/.test(locationId)) {
    throw new ApiError(400, "Ungültige Region.");
  }

  const params = new URLSearchParams({ name, limit: "30" });
  if (locationId) params.set("locationId", locationId);

  return cached(`clans:${params}`, 2 * 60, async () => {
    const data = await crFetch(`/clans?${params}`);
    return data.items ?? [];
  });
}));

// Clan-Details inkl. Mitgliederliste
app.get("/api/clans/:tag", route((req) => {
  const tag = normalizeTag(req.params.tag, "Clan-Tag");

  return cached(`clan:${tag}`, 2 * 60, () =>
    crFetch(`/clans/${tag}`).catch(notFoundAs("Clan nicht gefunden."))
  );
}));

// Unbekannte API-Pfade
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Unbekannter API-Endpunkt." });
});


app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});