// Berechnet die Meta-Decks aus den gesammelten Kämpfen.

import { crFetch } from "./crApi.js";
import { cached } from "./cache.js";
import { getDb } from "./db.js";
import { parseCardToken, arrangeSlots, cardInfo } from "./cards.js";
import { buildDeckName } from "./deckNames.js";

const WINDOW_DAYS = Number(process.env.META_WINDOW_DAYS) || 7;
const MIN_GAMES = Number(process.env.META_MIN_GAMES) || 50;

// Solange noch wenig Daten da sind, zeigen wir vorläufige Werte mit niedrigerer Grenze
const MIN_GAMES_PRELIMINARY = 10;
const MIN_DECKS = 10;
const MAX_DECKS = 200;


/** Liest das zuletzt berechnete Ergebnis (für die Website). */
export async function getMeta() {
  const db = await getDb();
  const meta = await db.collection("meta").findOne({ _id: "current" }, { projection: { _id: 0 } });

  return meta ?? { updatedAt: null, battles: 0, decks: [], cards: {} };
}

/** Wertet die Kämpfe der letzten Tage aus und speichert das Ergebnis. */
export async function computeMeta(db) {
  const battles = db.collection("battles");
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const totalBattles = await battles.countDocuments({ time: { $gte: since } });
  const groups = await battles.aggregate([
    { $match: { time: { $gte: since } } },

    // Spiegelkampf = beide Seiten spielen exakt dasselbe Deck
    {
      $project: {
        sides: 1,
        mirror: { $eq: [{ $arrayElemAt: ["$sides.deck", 0] }, { $arrayElemAt: ["$sides.deck", 1] }] }
      }
    },
    { $unwind: "$sides" },
    {
      $group: {
        _id: "$sides.deck",
        games: { $sum: 1 },
        wins: { $sum: { $cond: ["$sides.win", 1, 0] } },
        mirrors: { $sum: { $cond: ["$mirror", 1, 0] } }
      }
    },
    { $match: { games: { $gte: MIN_GAMES_PRELIMINARY } } },
    { $sort: { games: -1 } },
    { $limit: MAX_DECKS * 3 }
  ], { allowDiskUse: true }).toArray();

  let minGames = MIN_GAMES;
  let candidates = groups.filter((group) => group.games >= MIN_GAMES);
  const preliminary = candidates.length < MIN_DECKS;
  if (preliminary) {
    minGames = MIN_GAMES_PRELIMINARY;
    candidates = groups;
  }

  const catalog = await getCardCatalog();
  const usedCards = {};

  const decks = candidates.slice(0, MAX_DECKS).map((group) => {
    const deck = buildDeck(group, totalBattles, catalog);
    for (const card of deck.cardObjects) {
      usedCards[card.id] ??= cardInfo(catalog.get(card.id) ?? { name: `Karte ${card.id}` });
    }
    delete deck.cardObjects;
    return deck;
  });

  const meta = {
    updatedAt: new Date(),
    windowDays: WINDOW_DAYS,
    battles: totalBattles,
    minGames,
    preliminary,
    cards: usedCards,
    decks
  };

  await db.collection("meta").replaceOne({ _id: "current" }, meta, { upsert: true });
  return meta;
}

function buildDeck(group, totalBattles, catalog) {
  const cards = arrangeSlots(group._id.split("-").map((token) => {
    const { id, form } = parseCardToken(token);
    const card = catalog.get(id);
    return {
      id,
      name: card?.name ?? `Karte ${id}`,
      elixirCost: card?.elixirCost,
      form: form ?? (card?.rarity === "champion" ? "champion" : null)
    };
  }));

  // Spiegelkämpfe zählen nicht zur Siegquote: Dort gewinnt das Deck immer genau einmal
  const decided = group.games - group.mirrors;
  const wins = group.wins - group.mirrors / 2;

  const costs = cards.map((card) => card.elixirCost).filter((cost) => typeof cost === "number");
  const avgElixir = costs.length ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : null;

  return {
    key: group._id,
    name: buildDeckName(cards, avgElixir),
    cards: cards.map((card) => ({ id: card.id, form: card.form })),
    games: group.games,
    winRate: decided > 0 ? wins / decided : null,
    rating: wilsonLowerBound(wins, decided),
    usage: totalBattles ? group.games / (totalBattles * 2) : 0,
    avgElixir: avgElixir != null ? Math.round(avgElixir * 10) / 10 : null,
    cardObjects: cards
  };
}

/**
 * Vorsichtige Siegquote: untere Grenze des 95-%-Konfidenzintervalls (Wilson-Score).
 * 60 % aus 500 Spielen landet damit vor 70 % aus 20 Spielen.
 */
function wilsonLowerBound(wins, games, z = 1.96) {
  if (games <= 0) return 0;

  const p = wins / games;
  const z2 = z * z;
  const center = p + z2 / (2 * games);
  const margin = z * Math.sqrt((p * (1 - p)) / games + z2 / (4 * games * games));

  return (center - margin) / (1 + z2 / games);
}

/** Alle Karten mit Namen, Kosten und Bildern (einmal pro Tag laden). */
function getCardCatalog() {
  return cached("cardCatalog", 24 * 60 * 60, async () => {
    const data = await crFetch("/cards");
    return new Map(data.items.map((card) => [card.id, card]));
  });
}