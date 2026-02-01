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

const API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImVmYjE5MWI4LWIzMzctNDJlYS04YmQ2LTE0OGMwZDJmMjU0ZiIsImlhdCI6MTc2OTc5NjY2NCwic3ViIjoiZGV2ZWxvcGVyLzQ0ODJkYzU1LTk1ZTEtOTM5MC1hMmJlLTk3ZGVlZTc2ODE0ZSIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyIyMTMuMjI1LjguMTE3Il0sInR5cGUiOiJjbGllbnQifV19.DdRm3jOi0oQMqfySGb0P3Zmwonc83435fENYnEDDbt-T87h3NF7DNCWGfWpMvUw5pX68er3aXhiyc6_uhcc2Sg"; // besser später über .env
 
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


app.listen(PORT, () =>
    console.log(`✅ http://localhost:${PORT}`)
);



//9RQ8U9YQR
