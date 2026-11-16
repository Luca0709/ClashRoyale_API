// Verbindung zu MongoDB (z. B. kostenloser Atlas-Cluster).

import { MongoClient } from "mongodb";
import { ApiError } from "./crApi.js";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "crapi";

// Kämpfe werden nach dieser Zeit automatisch von MongoDB gelöscht (TTL-Index)
export const BATTLE_RETENTION_DAYS = 14;

let dbPromise = null;

/** Liefert die Datenbank. Die Verbindung wird beim ersten Aufruf aufgebaut und wiederverwendet. */
export function getDb() {
  if (!MONGODB_URI) {
    return Promise.reject(new ApiError(503, "Es ist keine Datenbank konfiguriert (MONGODB_URI fehlt)."));
  }

  if (!dbPromise) {
    const client = new MongoClient(MONGODB_URI, { maxPoolSize: 5 });

    dbPromise = client.connect()
      .then(async () => {
        const db = client.db(DB_NAME);
        await ensureIndexes(db);
        console.log("✅ Mit MongoDB verbunden");
        return db;
      })
      .catch((err) => {
        dbPromise = null; // beim nächsten Aufruf neu versuchen
        console.error("MongoDB-Verbindung fehlgeschlagen:", err.message);
        throw new ApiError(503, "Die Datenbank ist gerade nicht erreichbar.");
      });
  }

  return dbPromise;
}

async function ensureIndexes(db) {
  // Alte Kämpfe räumt MongoDB selbst weg – so bleibt der Gratis-Speicher klein
  await db.collection("battles").createIndex(
    { time: 1 },
    { expireAfterSeconds: BATTLE_RETENTION_DAYS * 24 * 60 * 60 }
  );
}