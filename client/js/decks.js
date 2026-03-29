function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAverageElixir(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

function renderDeckCards(cards = []) {
  return cards.map(card => `
    <div class="deck-card-icon" title="${escapeHtml(card.name)}">
      <img src="${card.iconUrls?.medium || ""}" alt="${escapeHtml(card.name)}">
    </div>
  `).join("");
}

function renderDecks(payload) {
  const container = document.getElementById("deckContainer");
  const stats = document.getElementById("deckStats");
  const errorBox = document.getElementById("deckError");

  errorBox.innerHTML = "";
  container.innerHTML = "";

  const meta = payload.meta || {};
  const decks = payload.decks || [];

  stats.innerHTML = `
    <div class="stat-chip">Players geprüft: <strong>${meta.playersChecked ?? 0}</strong></div>
    <div class="stat-chip">Decks gefunden: <strong>${meta.decksFound ?? 0}</strong></div>
    <div class="stat-chip">Eindeutige Decks: <strong>${meta.uniqueDecks ?? 0}</strong></div>
    <div class="stat-chip">Quelle: <strong>${escapeHtml(meta.source || "Ultimate Champion")}</strong></div>
  `;

  if (!decks.length) {
    container.innerHTML = `
      <div class="card info-box empty-state-card">
        <h5>Keine Decks verfügbar</h5>
        <p>Es konnten aktuell keine Decks geladen werden. Das kann an fehlenden API-Daten liegen.</p>
      </div>
    `;
    return;
  }

  decks.forEach((deck, index) => {
    const card = document.createElement("article");
    card.className = "card info-box deck-meta-card";

    const players = (deck.players || []).slice(0, 4).map(player => `
      <div class="deck-player-pill">
        <span class="deck-player-name">${escapeHtml(player.name)}</span>
        <span class="deck-player-meta">#${player.rank ?? "—"} · ${escapeHtml(player.clan || "Kein Clan")}</span>
      </div>
    `).join("");

    card.innerHTML = `
      <div class="deck-meta-header">
        <div>
          <div class="deck-meta-rank">Deck #${index + 1}</div>
          <h3 class="deck-meta-title">${deck.label || `Meta Deck ${index + 1}`}</h3>
        </div>
        <div class="deck-frequency-badge">${deck.occurrences}x gesehen</div>
      </div>

      <div class="deck-card-grid">
        ${renderDeckCards(deck.cards)}
      </div>

      <div class="deck-summary-grid">
        <div class="deck-summary-item">
          <span>Ø Elixir</span>
          <strong>${formatAverageElixir(deck.averageElixir)}</strong>
        </div>
        <div class="deck-summary-item">
          <span>Spieler</span>
          <strong>${deck.players?.length ?? 0}</strong>
        </div>
        <div class="deck-summary-item">
          <span>Basis</span>
          <strong>${escapeHtml(deck.origin || "Leaderboard")}</strong>
        </div>
      </div>

      <div class="deck-player-list">
        ${players || '<div class="deck-player-pill"><span class="deck-player-name">Keine Spielerinfos</span></div>'}
      </div>
    `;

    container.appendChild(card);
  });
}

async function loadDecks() {
  const container = document.getElementById("deckContainer");
  const errorBox = document.getElementById("deckError");
  const stats = document.getElementById("deckStats");

  container.innerHTML = `
    <div class="card info-box empty-state-card">
      <h5>Decks werden geladen …</h5>
      <p>Top-Spieler der Ultimate-Champion-Rangliste werden ausgewertet.</p>
    </div>
  `;
  errorBox.innerHTML = "";
  stats.innerHTML = '<div class="stat-chip">Lade Deck-Daten …</div>';

  try {
    const res = await fetch("/decks/meta");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Decks konnten nicht geladen werden");
    }

    renderDecks(data);
  } catch (err) {
    console.error(err);
    stats.innerHTML = '<div class="stat-chip">Fehler beim Laden</div>';
    container.innerHTML = "";
    errorBox.innerHTML = `
      <div class="card info-box error-card">
        <h5>Fehler</h5>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("reloadDecksBtn")?.addEventListener("click", loadDecks);
  loadDecks();
});
