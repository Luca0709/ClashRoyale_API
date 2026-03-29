import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client")));

const API_KEY ="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImIwOWUxM2Q5LTA5MjQtNGVhNi05MDM5LTZkNmNjNDgxMWRlZCIsImlhdCI6MTc2OTk3MjkwNywic3ViIjoiZGV2ZWxvcGVyLzQ0ODJkYzU1LTk1ZTEtOTM5MC1hMmJlLTk3ZGVlZTc2ODE0ZSIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyI3NC4yMjAuNTEuMjUwIl0sInR5cGUiOiJjbGllbnQifV19.chADcrwF4f5Owlh7HOckBIJ2Gt6BYQsqOSKm7TiXA_BgV5-nzkgxeGEb1g_MF-BDdZIQ9jYfmlkk3FPpXFfgQg";

const apiHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: "application/json"
};

async function clashFetch(url) {
  const response = await fetch(url, { headers: apiHeaders });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.reason || errorBody.message || "Clash Royale API Fehler");
    error.status = response.status;
    error.details = errorBody;
    throw error;
  }

  return response.json();
}

function normalizeTag(tag = "") {
  return `%23${String(tag).replace("#", "")}`;
}

function buildDeckKey(cards = []) {
  return cards
    .map(card => card.id)
    .filter(Boolean)
    .sort((a, b) => a - b)
    .join("-");
}

function averageElixir(cards = []) {
  if (!cards.length) return null;
  const total = cards.reduce((sum, card) => sum + (card.elixirCost ?? 0), 0);
  return total / cards.length;
}

app.get("/player/:tag", async (req, res) => {
  try {
    const tag = normalizeTag(req.params.tag);
    const data = await clashFetch(`https://api.clashroyale.com/v1/players/${tag}`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.details || { error: "Serverfehler" });
  }
});

app.get("/player/:tag/battles", async (req, res) => {
  try {
    const tag = normalizeTag(req.params.tag);
    const data = await clashFetch(`https://api.clashroyale.com/v1/players/${tag}/battlelog`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.details || { error: "Battlelog Fehler" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const region = (req.query.region || "global").toLowerCase();
    let url = "https://api.clashroyale.com/v1/locations/global/pathoflegend/players";

    if (region !== "global") {
      const regionMap = {
        "österreich": "Austria",
        "oesterreich": "Austria",
        "austria": "Austria",
        "deutschland": "Germany",
        "germany": "Germany",
        "amerika": "United States",
        "usa": "United States",
        "united states": "United States"
      };

      const apiRegionName = regionMap[region];

      if (!apiRegionName) {
        return res.status(400).json({ error: "Ungültige Region" });
      }

      const locationsData = await clashFetch("https://api.clashroyale.com/v1/locations");
      const location = locationsData.items.find(
        loc => loc.name?.toLowerCase() === apiRegionName.toLowerCase()
      );

      if (!location) {
        return res.status(404).json({ error: `Region nicht gefunden: ${apiRegionName}` });
      }

      url = `https://api.clashroyale.com/v1/locations/${location.id}/pathoflegend/players`;
    }

    const data = await clashFetch(url);
    res.json((data.items || []).slice(0, 100));
  } catch (err) {
    console.error("Leaderboard Fehler:", err);
    res.status(err.status || 500).json(err.details || { error: "Leaderboard Fehler" });
  }
});

app.get("/clans", async (req, res) => {
  try {
    const name = req.query.name?.trim();

    if (!name) {
      return res.status(400).json({ error: "Clanname fehlt" });
    }

    const data = await clashFetch(
      `https://api.clashroyale.com/v1/clans?name=${encodeURIComponent(name)}`
    );

    res.json(data.items || []);
  } catch (err) {
    console.error("Clansuche Fehler:", err);
    res.status(err.status || 500).json(err.details || { error: "Clansuche Fehler" });
  }
});

app.get("/decks/meta", async (_req, res) => {
  try {
    const leaderboard = await clashFetch(
      "https://api.clashroyale.com/v1/locations/global/pathoflegend/players"
    );

    const topPlayers = (leaderboard.items || []).slice(0, 24);

    const playerProfiles = await Promise.all(
      topPlayers.map(async entry => {
        try {
          const profile = await clashFetch(
            `https://api.clashroyale.com/v1/players/${normalizeTag(entry.tag)}`
          );

          const currentDeck = Array.isArray(profile.currentDeck) ? profile.currentDeck : [];
          let cards = currentDeck;
          let origin = "currentDeck";

          if (!cards.length) {
            try {
              const battles = await clashFetch(
                `https://api.clashroyale.com/v1/players/${normalizeTag(entry.tag)}/battlelog`
              );
              const latestBattleDeck = battles?.[0]?.team?.[0]?.cards || [];
              if (latestBattleDeck.length) {
                cards = latestBattleDeck;
                origin = "battlelog";
              }
            } catch {
              // fallback silently
            }
          }

          if (!cards.length) return null;

          return {
            rank: entry.rank,
            tag: entry.tag,
            name: profile.name || entry.name,
            clan: profile.clan?.name || entry.clan?.name || "",
            cards,
            origin
          };
        } catch {
          return null;
        }
      })
    );

    const validProfiles = playerProfiles.filter(Boolean);
    const groupedDecks = new Map();

    for (const profile of validProfiles) {
      const key = buildDeckKey(profile.cards);
      if (!key) continue;

      if (!groupedDecks.has(key)) {
        groupedDecks.set(key, {
          key,
          label: profile.cards.map(card => card.name).slice(0, 2).join(" / "),
          cards: profile.cards,
          occurrences: 0,
          players: [],
          averageElixir: averageElixir(profile.cards),
          origin: profile.origin === "battlelog" ? "Battlelog-Fallback" : "Player Deck"
        });
      }

      const deck = groupedDecks.get(key);
      deck.occurrences += 1;
      deck.players.push({
        name: profile.name,
        tag: profile.tag,
        rank: profile.rank,
        clan: profile.clan
      });
    }

    const decks = [...groupedDecks.values()]
      .sort((a, b) => b.occurrences - a.occurrences || (a.averageElixir ?? 0) - (b.averageElixir ?? 0))
      .slice(0, 12);

    res.json({
      meta: {
        source: "Ultimate Champion Leaderboard",
        playersChecked: topPlayers.length,
        decksFound: validProfiles.length,
        uniqueDecks: groupedDecks.size
      },
      decks
    });
  } catch (err) {
    console.error("Meta Deck Fehler:", err);
    res.status(err.status || 500).json(err.details || { error: "Meta Decks konnten nicht geladen werden" });
  }
});

app.listen(PORT, () =>
  console.log(`✅ http://localhost:${PORT}`)
);
