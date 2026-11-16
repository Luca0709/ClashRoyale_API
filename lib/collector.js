// Sammelt regelmäßig Path-of-Legends-Kämpfe der Top-Spieler.
//
// Ablauf: Ein externer Cron-Dienst ruft alle ~10 Minuten /api/collect auf.
// Jeder Aufruf arbeitet eine Portion Spieler ab (Standard: 100). So ist die Last
// gleichmäßig verteilt und der Gratis-Server auf Render schläft nicht ein.

import { crFetch, parseCrDate } from "./crApi.js";
import { getDb } from "./db.js";
import { deckKey } from "./cards.js";
import { computeMeta } from "./meta.js";

const TOP_PLAYERS = Number(process.env.COLLECT_TOP_PLAYERS) || 1000;
const BATCH_SIZE = Number(process.env.COLLECT_BATCH_SIZE) || 100;
const CONCURRENCY = 5; // gleichzeitige API-Anfragen
const PLAYER_LIST_MAX_AGE_MS = 6 * 60 * 60 * 1000; // Rangliste alle 6 Stunden neu laden
const META_INTERVAL_MS = 60 * 60 * 1000; // Auswertung höchstens einmal pro Stunde

let running = false;


/** Ein Sammelschritt. Gibt eine kleine Statistik zurück. */
export async function runCollectStep({ forceMeta = false } = {}) {
  if (running) {
    return { skipped: true, reason: "Ein Sammelschritt läuft bereits." };
  }

  running = true;
  try {
    return await collect(forceMeta);
  } finally {
    running = false;
  }
}

async function collect(forceMeta) {
  const db = await getDb();
  const stateCollection = db.collection("state");
  const state = await stateCollection.findOne({ _id: "collector" })
    ?? { _id: "collector", players: [], cursor: 0, round: 0 };

  // 1. Spielerliste (Top-Rangliste) bei Bedarf aktualisieren
  const listAge = Date.now() - (state.playersUpdatedAt?.getTime() ?? 0);
  if (!state.players.length || listAge > PLAYER_LIST_MAX_AGE_MS) {
    state.players = await fetchTopPlayers();
    state.playersUpdatedAt = new Date();
  }
  if (state.cursor >= state.players.length) state.cursor = 0;

  // 2. Battle-Logs der nächsten Portion laden
  const batch = state.players.slice(state.cursor, state.cursor + BATCH_SIZE);
  const result = await collectBattles(batch);
  const newBattles = await saveBattles(db, result.battles);

  state.cursor += result.processed;
  if (state.cursor >= state.players.length) {
    state.cursor = 0;
    state.round += 1;
  }
  state.lastRunAt = new Date();
  await stateCollection.replaceOne({ _id: "collector" }, state, { upsert: true });

  // 3. Auswertung regelmäßig neu berechnen
  const metaAge = Date.now() - (state.lastMetaAt?.getTime() ?? 0);
  let meta = null;
  if (forceMeta || metaAge > META_INTERVAL_MS) {
    try {
      const computed = await computeMeta(db);
      await stateCollection.updateOne({ _id: "collector" }, { $set: { lastMetaAt: new Date() } });
      meta = { decks: computed.decks.length, battles: computed.battles };
    } catch (err) {
      console.error("Meta-Auswertung fehlgeschlagen:", err);
      meta = { error: err.message };
    }
  }

  return {
    playersProcessed: result.processed,
    battlesFound: result.battles.length,
    newBattles,
    errors: result.errors,
    rateLimited: result.rateLimited,
    progress: `${state.cursor}/${state.players.length}`,
    round: state.round,
    meta
  };
}


// ---------------------------------------------------------------------------
// API-Abfragen
// ---------------------------------------------------------------------------

async function fetchTopPlayers() {
  let data;
  try {
    data = await crFetch(`/locations/global/pathoflegend/players?limit=${TOP_PLAYERS}`);
  } catch (err) {
    // Falls die API so viele Einträge nicht erlaubt: mit 200 weitermachen
    if (err.status !== 400 || TOP_PLAYERS <= 200) throw err;
    data = await crFetch("/locations/global/pathoflegend/players?limit=200");
  }

  return data.items.map((player) => player.tag);
}

async function collectBattles(tags) {
  const battles = [];
  let processed = 0;
  let errors = 0;
  let rateLimited = false;

  for (let i = 0; i < tags.length && !rateLimited; i += CONCURRENCY) {
    const chunk = tags.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((tag) => crFetch(`/players/${encodeURIComponent(tag)}/battlelog`))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        battles.push(...result.value.map(toBattleDoc).filter(Boolean));
      } else if (result.reason?.status === 429) {
        rateLimited = true; // beim nächsten Aufruf hier weitermachen
      } else {
        errors += 1; // z. B. Spieler gelöscht – einfach überspringen
      }
    }

    if (!rateLimited) processed += chunk.length;
  }

  return { battles, processed, errors, rateLimited };
}


// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------

/**
 * Wandelt einen Kampf aus dem Battle-Log in einen kompakten Datenbank-Eintrag um.
 * Gespeichert werden nur 1-gegen-1-Kämpfe im Path of Legends ohne Unentschieden.
 */
function toBattleDoc(battle) {
  if (battle.type !== "pathOfLegend") return null;
  if (battle.team?.length !== 1 || battle.opponent?.length !== 1) return null;

  const [a] = battle.team;
  const [b] = battle.opponent;

  if (a.cards?.length !== 8 || b.cards?.length !== 8) return null;
  if (a.crowns === b.crowns) return null;

  const time = parseCrDate(battle.battleTime);
  if (!time) return null;

  // Derselbe Kampf steht im Log beider Spieler → gleicher Schlüssel, egal wer ihn liefert
  const tags = [a.tag, b.tag].sort();

  return {
    _id: `${battle.battleTime}_${tags.join("_")}`,
    time,
    sides: [
      { deck: deckKey(a.cards), win: a.crowns > b.crowns },
      { deck: deckKey(b.cards), win: b.crowns > a.crowns }
    ]
  };
}

/** Speichert neue Kämpfe; bereits bekannte werden übersprungen. Gibt die Anzahl neuer zurück. */
async function saveBattles(db, battles) {
  const unique = new Map(battles.map((battle) => [battle._id, battle]));
  if (!unique.size) return 0;

  const operations = [...unique.values()].map(({ _id, ...battle }) => ({
    updateOne: {
      filter: { _id },
      update: { $setOnInsert: battle },
      upsert: true
    }
  }));

  const result = await db.collection("battles").bulkWrite(operations, { ordered: false });
  return result.upsertedCount;
}