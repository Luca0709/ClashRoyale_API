import "./lib/env.js"; // muss zuerst kommen (lädt .env)

import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { ApiError, crFetch, normalizeTag } from "./lib/crApi.js";
import { cached, clearCached } from "./lib/cache.js";
import { runCollectStep } from "./lib/collector.js";
import { getMeta } from "./lib/meta.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const COLLECT_SECRET = process.env.COLLECT_SECRET;

const app = express();
app.use(express.static(path.join(__dirname, "client")));


// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

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

/** Vergleicht zwei Strings, ohne über die Laufzeit etwas zu verraten. */
function safeEqual(a, b) {
  const hash = (value) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
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

// Meta-Decks (fertig berechnetes Ergebnis aus der Datenbank)
app.get("/api/meta", route(() => cached("meta", 60, getMeta)));

// Sammelschritt – wird von einem Cron-Dienst alle ~10 Minuten aufgerufen.
// ?secret=… ist Pflicht, ?meta=1 erzwingt eine sofortige Neuberechnung.
app.all("/api/collect", route(async (req) => {
  if (!COLLECT_SECRET) {
    throw new ApiError(503, "COLLECT_SECRET ist auf dem Server nicht gesetzt.");
  }

  const secret = String(req.query.secret ?? req.get("x-collect-secret") ?? "");
  if (!safeEqual(secret, COLLECT_SECRET)) {
    throw new ApiError(401, "Falsches Secret.");
  }

  const result = await runCollectStep({ forceMeta: req.query.meta === "1" });
  if (result.meta && !result.meta.error) clearCached("meta");

  return result;
}));

// Unbekannte API-Pfade
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Unbekannter API-Endpunkt." });
});


app.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});