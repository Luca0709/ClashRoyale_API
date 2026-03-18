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


app.get("/player/:tag", async (req, res) => {
    try {
        const tag = `%23${req.params.tag.replace("#", "")}`;
        const response = await fetch(
            `https://api.clashroyale.com/v1/players/${tag}`,
            {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    Accept: "application/json"
                }
            }
        );

        if (!response.ok) {
            return res.status(response.status).json(await response.json());
        }

        res.json(await response.json());
    } catch (err) {
        res.status(500).json({ error: "Serverfehler" });
    }
});


///BAttle Logs eigener endpoint-->

app.get("/player/:tag/battles", async (req, res) => {
  try {
    const tag = `%23${req.params.tag.replace("#", "")}`;

    const response = await fetch(
      `https://api.clashroyale.com/v1/players/${tag}/battlelog`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json(await response.json());
    }

    res.json(await response.json());
  } catch {
    res.status(500).json({ error: "Battlelog Fehler" });
  }
});


// ENDPOINT LEADERBOARDS:
app.get("/leaderboard", async (req, res) => {
  try {
    const region = (req.query.region || "global").toLowerCase();

    const headers = {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json"
    };

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

      // Alle Locations laden
      const locationsResponse = await fetch(
        "https://api.clashroyale.com/v1/locations",
        { headers }
      );

      if (!locationsResponse.ok) {
        return res.status(locationsResponse.status).json(await locationsResponse.json());
      }

      const locationsData = await locationsResponse.json();

      const location = locationsData.items.find(
        loc => loc.name?.toLowerCase() === apiRegionName.toLowerCase()
      );

      if (!location) {
        return res.status(404).json({ error: `Region nicht gefunden: ${apiRegionName}` });
      }

      url = `https://api.clashroyale.com/v1/locations/${location.id}/pathoflegend/players`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return res.status(response.status).json(await response.json());
    }

    const data = await response.json();

    res.json(data.items.slice(0, 100));
  } catch (err) {
    console.error("Leaderboard Fehler:", err);
    res.status(500).json({ error: "Leaderboard Fehler" });
  }
});


// ENDPOINT CLANSUCHE:
app.get("/clans", async (req, res) => {
  try {
    const name = req.query.name?.trim();

    if (!name) {
      return res.status(400).json({ error: "Clanname fehlt" });
    }

    const response = await fetch(
      `https://api.clashroyale.com/v1/clans?name=${encodeURIComponent(name)}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json(await response.json());
    }

    const data = await response.json();

    res.json(data.items || []);
  } catch (err) {
    console.error("Clansuche Fehler:", err);
    res.status(500).json({ error: "Clansuche Fehler" });
  }
});


app.listen(PORT, () =>
    console.log(`✅ http://localhost:${PORT}`)
);



//#9RQ8U9YQR


