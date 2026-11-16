import "./layout.js";
import { escapeHtml, fetchJson, formatNumber, timeAgo, statusBox } from "./utils.js";
import { deckHtml } from "./cards.js";

const MAX_SHOWN = 50;

const SORTS = {
  popular: (a, b) => b.games - a.games,
  strong: (a, b) => b.rating - a.rating
};

const subtitle = document.getElementById("metaSubtitle");
const notice = document.getElementById("metaNotice");
const list = document.getElementById("metaList");
const sortControl = document.getElementById("metaSort");
const cardFilter = document.getElementById("cardFilter");

let meta = null;
let sort = "popular";


// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

async function loadMeta() {
  list.innerHTML = statusBox("loading", "Meta-Decks werden geladen …");

  try {
    meta = await fetchJson("/api/meta");
  } catch (err) {
    list.innerHTML = statusBox("error", err.message);
    return;
  }

  // Kartendaten (Name, Bilder) an die Decks hängen
  for (const deck of meta.decks) {
    deck.cardObjects = deck.cards.map((card) => ({
      ...(meta.cards[card.id] ?? { name: `Karte ${card.id}`, iconUrls: {} }),
      id: card.id,
      form: card.form ?? "normal"
    }));
    deck.searchText = deck.cardObjects.map((card) => card.name).join(" ").toLowerCase();
  }

  renderHeader();
  renderDecks();
}


// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

function renderHeader() {
  if (!meta.updatedAt) {
    subtitle.textContent = "Die meistgespielten Decks der Top-Spieler";
    return;
  }

  subtitle.textContent =
    `${formatNumber(meta.battles)} Kämpfe der Top-Spieler · letzte ${meta.windowDays} Tage · ` +
    `aktualisiert ${timeAgo(new Date(meta.updatedAt))}`;

  notice.innerHTML = meta.preliminary
    ? statusBox("info", `ℹ️ Es sind noch wenige Daten vorhanden – angezeigt werden Decks ab ${meta.minGames} Spielen. Die Werte sind vorläufig.`)
    : "";
}

function renderDecks() {
  if (!meta.decks.length) {
    list.innerHTML = statusBox("empty", "Es werden noch Daten gesammelt. Schau in ein paar Stunden wieder vorbei!");
    return;
  }

  const query = cardFilter.value.trim().toLowerCase();
  const decks = meta.decks
    .filter((deck) => !query || deck.searchText.includes(query))
    .sort(SORTS[sort])
    .slice(0, MAX_SHOWN);

  if (!decks.length) {
    list.innerHTML = statusBox("empty", "Kein Deck mit dieser Karte gefunden.");
    return;
  }

  list.innerHTML = decks.map(deckCardHtml).join("");
}

function deckCardHtml(deck, index) {
  const winRate = deck.winRate != null ? deck.winRate * 100 : null;
  let winClass = "";
  if (winRate != null && winRate >= 52) winClass = "text-success";
  if (winRate != null && winRate < 48) winClass = "text-danger";

  return `
    <article class="card meta-deck">
      <div class="meta-deck-main">
        <header class="meta-deck-head">
          <span class="meta-rank">${index + 1}</span>
          <h2 class="meta-deck-name">${escapeHtml(deck.name)}</h2>
        </header>
        ${deckHtml(deck.cardObjects, "row")}
      </div>

      <div class="meta-deck-side">
        <dl class="meta-stats">
          <div><dt>Siegquote</dt><dd class="${winClass}">${winRate != null ? `${winRate.toFixed(1)} %` : "—"}</dd></div>
          <div><dt>Spiele</dt><dd>${formatNumber(deck.games)}</dd></div>
          <div><dt>Nutzung</dt><dd>${(deck.usage * 100).toFixed(2)} %</dd></div>
          <div><dt>Ø Elixier</dt><dd>💧 ${deck.avgElixir ?? "—"}</dd></div>
        </dl>
        <a class="btn btn-primary btn-sm" href="${copyLink(deck)}" target="_blank" rel="noopener">
          Deck ins Spiel kopieren
        </a>
      </div>
    </article>
  `;
}

/** Offizieller Link, der das Deck im Spiel öffnet (Karten in Slot-Reihenfolge). */
function copyLink(deck) {
  const ids = deck.cards.map((card) => card.id).join(";");
  return `https://link.clashroyale.com/deck/de?deck=${ids}`;
}


// ---------------------------------------------------------------------------
// Events & Start
// ---------------------------------------------------------------------------

sortControl.addEventListener("click", (e) => {
  const button = e.target.closest("[data-sort]");
  if (!button || !meta) return;

  sort = button.dataset.sort;
  sortControl.querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn === button));
  renderDecks();
});

cardFilter.addEventListener("input", () => {
  if (meta) renderDecks();
});

loadMeta();