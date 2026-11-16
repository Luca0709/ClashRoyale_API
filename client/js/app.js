import "./layout.js";
import {
  escapeHtml, fetchJson, cleanTag, formatNumber, parseCrDate, timeAgo,
  statusBox, clanBadgeHtml
} from "./utils.js";
import { deckHtml } from "./cards.js";

const BATTLES_PER_PAGE = 5;

const ROLE_LABELS = {
  leader: "Anführer",
  coLeader: "Vize-Anführer",
  elder: "Ältester",
  member: "Mitglied"
};

const BATTLE_TYPES = {
  PvP: "Ladder",
  pathOfLegend: "Path of Legends",
  riverRacePvP: "Clankrieg",
  riverRaceDuel: "Clankrieg-Duell",
  riverRaceDuelColosseum: "Kolosseum",
  boatBattle: "Bootsschlacht",
  challenge: "Challenge",
  grandChallenge: "Große Challenge",
  friendly: "Freundschaftskampf",
  clanMate: "Clan-Kampf",
  tournament: "Turnier",
  trail: "Event"
};

const form = document.getElementById("playerForm");
const tagInput = document.getElementById("tagInput");
const statusEl = document.getElementById("playerStatus");
const resultEl = document.getElementById("playerResult");
const battleLogEl = document.getElementById("battleLog");
const moreBattlesBtn = document.getElementById("moreBattlesBtn");

let battles = [];
let visibleBattles = BATTLES_PER_PAGE;
let latestRequest = 0;


// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

async function loadPlayer(rawTag) {
  const tag = cleanTag(rawTag);

  if (!tag) {
    statusEl.innerHTML = statusBox("error", "Bitte gib einen Spieler-Tag ein.");
    return;
  }

  const requestId = ++latestRequest;
  tagInput.value = `#${tag}`;
  history.replaceState(null, "", `?tag=${encodeURIComponent(tag)}`);
  statusEl.innerHTML = statusBox("loading", "Spieler wird geladen …");
  resultEl.hidden = true;

  // Profil und Battle-Log parallel laden – ein Fehler im Log soll das Profil nicht blockieren
  const [playerResult, battleResult] = await Promise.allSettled([
    fetchJson(`/api/player/${encodeURIComponent(tag)}`),
    fetchJson(`/api/player/${encodeURIComponent(tag)}/battles`)
  ]);

  if (requestId !== latestRequest) return; // inzwischen wurde ein anderer Spieler gesucht

  if (playerResult.status === "rejected") {
    statusEl.innerHTML = statusBox("error", playerResult.reason.message);
    return;
  }

  statusEl.innerHTML = "";
  renderPlayer(playerResult.value);

  battles = battleResult.status === "fulfilled" ? battleResult.value : [];
  visibleBattles = BATTLES_PER_PAGE;
  renderBattleLog(battleResult.status === "rejected" ? battleResult.reason.message : null);

  resultEl.hidden = false;
}


// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

function renderPlayer(p) {
  renderHero(p);

  const pol = p.currentPathOfLegendSeasonResult;
  document.getElementById("progressInfo").innerHTML = keyValueList([
    ["🏆 Trophäen", formatNumber(p.trophies)],
    ["🎖️ Bestwert", formatNumber(p.bestTrophies)],
    ["🏰 Arena", escapeHtml(p.arena?.name ?? "—")],
    ["👑 Path of Legends", pol?.leagueNumber ? `Liga ${pol.leagueNumber}` : "—"]
  ]);

  const decided = (p.wins ?? 0) + (p.losses ?? 0);
  const winRate = decided ? (p.wins / decided) * 100 : 0;
  document.getElementById("battleStats").innerHTML = `
    ${keyValueList([
      ["✅ Siege", formatNumber(p.wins)],
      ["❌ Niederlagen", formatNumber(p.losses)],
      ["👑 3-Kronen-Siege", formatNumber(p.threeCrownWins)],
      ["🎮 Kämpfe gesamt", formatNumber(p.battleCount)]
    ])}
    <div class="winrate">
      <div class="winrate-label"><span>Siegquote</span><strong>${winRate.toFixed(1)} %</strong></div>
      <div class="progress"><div class="progress-fill" style="width: ${winRate}%"></div></div>
    </div>
  `;

  const favourite = p.currentFavouriteCard;
  document.getElementById("extraInfo").innerHTML = `
    ${favourite ? `
      <div class="favourite-card">
        <img src="${escapeHtml(favourite.iconUrls?.medium ?? "")}" alt="">
        <div><span class="muted">Lieblingskarte</span><strong>${escapeHtml(favourite.name)}</strong></div>
      </div>` : ""}
    ${keyValueList([
      ["🎁 Spenden gesamt", formatNumber(p.totalDonations)],
      ["🃏 Clankarten gesammelt", formatNumber(p.clanCardsCollected)],
      ["⚔️ Kriegstag-Siege", formatNumber(p.warDayWins)]
    ])}
  `;

  renderCurrentDeck(p.currentDeck ?? []);
  document.getElementById("rawData").textContent = JSON.stringify(p, null, 2);
}

function renderHero(p) {
  const clan = p.clan
    ? `<a class="chip chip-link" href="/clans.html?tag=${encodeURIComponent(cleanTag(p.clan.tag))}">
         ${clanBadgeHtml(p.clan, "badge badge-xs")} ${escapeHtml(p.clan.name)}
       </a>`
    : `<span class="chip">Kein Clan</span>`;

  const role = ROLE_LABELS[p.role] ? `<span class="chip">${ROLE_LABELS[p.role]}</span>` : "";

  document.getElementById("playerHero").innerHTML = `
    <div class="hero-level" title="King Level">
      <small>Level</small>${escapeHtml(p.expLevel)}
    </div>
    <div class="hero-main">
      <h2 class="hero-name">${escapeHtml(p.name)}</h2>
      <div class="hero-meta">
        <span class="tag">${escapeHtml(p.tag)}</span>
        ${clan}
        ${role}
      </div>
    </div>
    <div class="hero-trophies">
      <strong>🏆 ${formatNumber(p.trophies)}</strong>
      <small>Trophäen</small>
    </div>
  `;
}

function renderCurrentDeck(cards) {
  const container = document.getElementById("currentDeck");
  const elixirEl = document.getElementById("deckElixir");

  if (!cards.length) {
    container.innerHTML = statusBox("empty", "Kein Deck verfügbar.");
    elixirEl.textContent = "";
    return;
  }

  container.innerHTML = deckHtml(cards, "lg");

  const costs = cards.map((card) => card.elixirCost).filter((cost) => typeof cost === "number");
  elixirEl.textContent = costs.length === cards.length
    ? `💧 Ø ${(costs.reduce((sum, cost) => sum + cost, 0) / costs.length).toFixed(1)} Elixier`
    : "";
}


// ---------------------------------------------------------------------------
// Battle-Log
// ---------------------------------------------------------------------------

function renderBattleLog(errorMessage) {
  if (errorMessage) {
    battleLogEl.innerHTML = statusBox("error", errorMessage);
    moreBattlesBtn.hidden = true;
    return;
  }

  if (!battles.length) {
    battleLogEl.innerHTML = statusBox("empty", "Keine Battles gefunden.");
    moreBattlesBtn.hidden = true;
    return;
  }

  battleLogEl.innerHTML = battles.slice(0, visibleBattles).map(battleHtml).join("");
  moreBattlesBtn.hidden = visibleBattles >= battles.length;
}

function battleHtml(battle) {
  const team = battle.team ?? [];
  const opponent = battle.opponent ?? [];
  const ownCrowns = team[0]?.crowns ?? 0;
  const enemyCrowns = opponent[0]?.crowns ?? 0;

  let result = "draw";
  if (ownCrowns > enemyCrowns) result = "win";
  if (ownCrowns < enemyCrowns) result = "loss";

  const resultLabels = { win: "Sieg", loss: "Niederlage", draw: "Unentschieden" };
  const mode = BATTLE_TYPES[battle.type] ?? battle.gameMode?.name ?? battle.type ?? "Battle";

  return `
    <article class="battle battle-${result}">
      <header class="battle-head">
        <span class="chip">${escapeHtml(mode)}</span>
        ${battle.arena?.name ? `<span class="muted">${escapeHtml(battle.arena.name)}</span>` : ""}
        <span class="muted battle-time">${timeAgo(parseCrDate(battle.battleTime))}</span>
      </header>

      <div class="battle-body">
        <div class="battle-side">${team.map(participantHtml).join("")}</div>

        <div class="battle-center">
          <div class="score">${ownCrowns} : ${enemyCrowns}</div>
          <div class="result result-${result}">${resultLabels[result]}</div>
        </div>

        <div class="battle-side">${opponent.map(participantHtml).join("")}</div>
      </div>
    </article>
  `;
}

function participantHtml(p) {
  let trophies = "";
  if (typeof p.trophyChange === "number") {
    const sign = p.trophyChange > 0 ? "+" : "";
    const cls = p.trophyChange >= 0 ? "text-success" : "text-danger";
    trophies = `<span class="${cls}">🏆 ${sign}${p.trophyChange}</span>`;
  }

  const leaked = typeof p.elixirLeaked === "number" ? p.elixirLeaked.toFixed(1) : "—";

  return `
    <div class="participant">
      <div class="participant-head">
        <a href="/?tag=${encodeURIComponent(cleanTag(p.tag))}" class="participant-name">${escapeHtml(p.name)}</a>
        <span class="participant-clan">${escapeHtml(p.clan?.name ?? "Kein Clan")}</span>
      </div>
      ${deckHtml(p.cards ?? [], "sm")}
      <div class="participant-meta">
        <span title="Verschwendetes Elixier">💧 ${leaked} verschwendet</span>
        ${trophies}
      </div>
    </div>
  `;
}

function keyValueList(rows) {
  const items = rows.map(([label, value]) => `
    <div class="kv-row"><dt>${label}</dt><dd>${value}</dd></div>
  `).join("");

  return `<dl class="kv-list">${items}</dl>`;
}


// ---------------------------------------------------------------------------
// Events & Start
// ---------------------------------------------------------------------------

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadPlayer(tagInput.value);
});

moreBattlesBtn.addEventListener("click", () => {
  visibleBattles += BATTLES_PER_PAGE;
  renderBattleLog();
});

const tagFromUrl = new URLSearchParams(location.search).get("tag");
if (tagFromUrl) {
  loadPlayer(tagFromUrl);
}