import "./layout.js";
import {
  escapeHtml, fetchJson, cleanTag, formatNumber, parseCrDate, timeAgo,
  statusBox, flagHtml, clanBadgeHtml
} from "./utils.js";

const MAX_MEMBERS = 50;

const TYPE_LABELS = {
  open: "Offen",
  inviteOnly: "Auf Einladung",
  closed: "Geschlossen"
};

const ROLE_LABELS = {
  leader: "Anführer",
  coLeader: "Vize",
  elder: "Ältester",
  member: "Mitglied"
};

const MEMBER_SORTS = {
  rank: { label: "Rang", compare: (a, b) => a.clanRank - b.clanRank },
  trophies: { label: "Trophäen", compare: (a, b) => b.trophies - a.trophies },
  donations: { label: "Spenden", compare: (a, b) => b.donations - a.donations },
  lastSeen: { label: "Zuletzt online", compare: (a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "") }
};

const form = document.getElementById("clanForm");
const clanInput = document.getElementById("clanInput");
const regionSelect = document.getElementById("regionSelect");
const statusEl = document.getElementById("clanStatus");
const resultsEl = document.getElementById("clanResults");
const dialog = document.getElementById("clanDialog");
const dialogBody = document.getElementById("clanDialogBody");

let lastSearch = { name: "", region: "" };
let currentClan = null;
let memberSort = "rank";
let latestSearch = 0;
let latestClanRequest = 0;


// ---------------------------------------------------------------------------
// URL-Zustand: ?name=…&region=…&tag=… (damit "Zurück" und Links funktionieren)
// ---------------------------------------------------------------------------

function updateUrl({ tag = null, push = false } = {}) {
  const params = new URLSearchParams();
  if (lastSearch.name) params.set("name", lastSearch.name);
  if (lastSearch.region) params.set("region", lastSearch.region);
  if (tag) params.set("tag", tag);

  const url = params.size ? `?${params}` : location.pathname;
  const state = tag ? { clanTag: tag } : null;

  push ? history.pushState(state, "", url) : history.replaceState(state, "", url);
}

function clanUrl(tag) {
  const params = new URLSearchParams({ tag });
  return `/clans.html?${params}`;
}


// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

async function searchClans(name, region, { updateHistory = true } = {}) {
  if (name.length < 3) {
    statusEl.innerHTML = statusBox("error", "Bitte mindestens 3 Zeichen eingeben.");
    return;
  }

  const requestId = ++latestSearch;
  lastSearch = { name, region };
  if (updateHistory) updateUrl();

  statusEl.innerHTML = statusBox("loading", "Clans werden gesucht …");
  resultsEl.innerHTML = "";

  const params = new URLSearchParams({ name });
  if (region) params.set("locationId", region);

  try {
    const clans = await fetchJson(`/api/clans?${params}`);
    if (requestId !== latestSearch) return;

    statusEl.innerHTML = clans.length
      ? `<p class="result-count">${clans.length} Clan${clans.length === 1 ? "" : "s"} gefunden</p>`
      : statusBox("empty", "Keine Clans gefunden.");

    resultsEl.innerHTML = clans.map(clanCardHtml).join("");
  } catch (err) {
    if (requestId === latestSearch) statusEl.innerHTML = statusBox("error", err.message);
  }
}

function clanCardHtml(clan) {
  const tag = cleanTag(clan.tag);
  const members = clan.members ?? 0;

  return `
    <a class="clan-card" href="${clanUrl(tag)}" data-tag="${escapeHtml(tag)}">
      <div class="clan-card-head">
        ${clanBadgeHtml(clan, "badge badge-md")}
        <div class="clan-card-title">
          <h3>${escapeHtml(clan.name)}</h3>
          <span class="tag">${escapeHtml(clan.tag)}</span>
        </div>
        <span class="chip chip-${escapeHtml(clan.type)}">${TYPE_LABELS[clan.type] ?? "—"}</span>
      </div>

      <div class="clan-card-stats">
        <div><span>Trophäen</span><strong>🏆 ${formatNumber(clan.clanScore)}</strong></div>
        <div><span>Kriegstrophäen</span><strong>⚔️ ${formatNumber(clan.clanWarTrophies)}</strong></div>
        <div><span>Benötigt</span><strong>${formatNumber(clan.requiredTrophies)}</strong></div>
        <div><span>Region</span><strong class="with-flag">${flagHtml(clan.location?.countryCode)} ${escapeHtml(clan.location?.name ?? "—")}</strong></div>
      </div>

      <div class="clan-card-foot">
        <div class="members-info">
          <span>👥 ${members}/${MAX_MEMBERS} Mitglieder</span>
          <div class="progress progress-sm"><div class="progress-fill" style="width: ${(members / MAX_MEMBERS) * 100}%"></div></div>
        </div>
        <span class="clan-card-cta">Details →</span>
      </div>
    </a>
  `;
}

async function loadRegions() {
  try {
    const locations = await fetchJson("/api/locations");
    regionSelect.insertAdjacentHTML("beforeend", locations.map((loc) =>
      `<option value="${loc.id}">${escapeHtml(loc.name)}</option>`
    ).join(""));
    regionSelect.value = lastSearch.region;
  } catch {
    // Regionen sind optional – die Suche funktioniert auch ohne
  }
}


// ---------------------------------------------------------------------------
// Clan-Details (Dialog)
// ---------------------------------------------------------------------------

async function openClan(tag, { push = true } = {}) {
  if (push) updateUrl({ tag, push: true });

  const requestId = ++latestClanRequest;
  dialogBody.innerHTML = statusBox("loading", "Clan wird geladen …");
  if (!dialog.open) dialog.showModal();

  try {
    const clan = await fetchJson(`/api/clans/${encodeURIComponent(tag)}`);
    if (requestId !== latestClanRequest) return;

    currentClan = clan;
    memberSort = "rank";
    renderClanDetails();
  } catch (err) {
    if (requestId === latestClanRequest) dialogBody.innerHTML = statusBox("error", err.message);
  }
}

function renderClanDetails() {
  const clan = currentClan;

  dialogBody.innerHTML = `
    <header class="clan-detail-head">
      ${clanBadgeHtml(clan, "badge badge-lg")}
      <div>
        <h2 class="clan-detail-name">${escapeHtml(clan.name)}</h2>
        <div class="hero-meta">
          <span class="tag">${escapeHtml(clan.tag)}</span>
          <span class="chip chip-${escapeHtml(clan.type)}">${TYPE_LABELS[clan.type] ?? "—"}</span>
          <span class="chip with-flag">${flagHtml(clan.location?.countryCode)} ${escapeHtml(clan.location?.name ?? "—")}</span>
        </div>
      </div>
    </header>

    ${clan.description ? `<p class="clan-description">${escapeHtml(clan.description)}</p>` : ""}

    <div class="stat-grid">
      ${statTile("🏆", "Trophäen", formatNumber(clan.clanScore))}
      ${statTile("⚔️", "Kriegstrophäen", formatNumber(clan.clanWarTrophies))}
      ${statTile("👥", "Mitglieder", `${clan.members ?? 0}/${MAX_MEMBERS}`)}
      ${statTile("🎁", "Spenden / Woche", formatNumber(clan.donationsPerWeek))}
      ${statTile("🎯", "Benötigte Trophäen", formatNumber(clan.requiredTrophies))}
    </div>

    <section class="members">
      <div class="members-toolbar">
        <h3 class="card-title">Mitglieder</h3>
        <div class="segmented" id="memberSort">
          ${Object.entries(MEMBER_SORTS).map(([key, sort]) => `
            <button type="button" data-sort="${key}" class="${key === memberSort ? "active" : ""}">${sort.label}</button>
          `).join("")}
        </div>
      </div>
      <div class="member-list" id="memberList"></div>
    </section>
  `;

  renderMembers();
}

function renderMembers() {
  const list = document.getElementById("memberList");
  const members = [...(currentClan.memberList ?? [])].sort(MEMBER_SORTS[memberSort].compare);

  if (!members.length) {
    list.innerHTML = statusBox("empty", "Dieser Clan hat keine Mitglieder.");
    return;
  }

  list.innerHTML = members.map((m) => `
    <a class="member-row" href="/?tag=${encodeURIComponent(cleanTag(m.tag))}" title="Profil von ${escapeHtml(m.name)} öffnen">
      <span class="member-rank">${m.clanRank}</span>
      <span class="member-main">
        <span class="member-name">${escapeHtml(m.name)}</span>
        <span class="role role-${escapeHtml(m.role)}">${ROLE_LABELS[m.role] ?? m.role}</span>
      </span>
      <span class="member-stat member-level" title="King Level">Lvl ${m.expLevel}</span>
      <span class="member-stat" title="Trophäen">🏆 ${formatNumber(m.trophies)}</span>
      <span class="member-stat" title="Spenden diese Woche">🎁 ${formatNumber(m.donations)}</span>
      <span class="member-seen" title="Zuletzt online">${timeAgo(parseCrDate(m.lastSeen))}</span>
    </a>
  `).join("");
}

function statTile(icon, label, value) {
  return `
    <div class="stat-tile">
      <span class="stat-label">${icon} ${label}</span>
      <strong class="stat-value">${value}</strong>
    </div>
  `;
}


// ---------------------------------------------------------------------------
// Events & Start
// ---------------------------------------------------------------------------

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = clanInput.value.trim();

  if (query.startsWith("#")) {
    openClan(cleanTag(query));
  } else {
    searchClans(query, regionSelect.value);
  }
});

// Klick auf Clan-Karte: Dialog öffnen (Strg/Mittelklick öffnet weiterhin einen neuen Tab)
resultsEl.addEventListener("click", (e) => {
  const card = e.target.closest(".clan-card");
  if (!card || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

  e.preventDefault();
  openClan(card.dataset.tag);
});

dialogBody.addEventListener("click", (e) => {
  const sortButton = e.target.closest("[data-sort]");
  if (!sortButton) return;

  memberSort = sortButton.dataset.sort;
  document.querySelectorAll("#memberSort button").forEach((btn) => {
    btn.classList.toggle("active", btn === sortButton);
  });
  renderMembers();
});

document.getElementById("closeClanDialog").addEventListener("click", () => dialog.close());

// Klick auf den abgedunkelten Hintergrund schließt den Dialog
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});

// Beim Schließen den Clan-Tag aus der URL entfernen
dialog.addEventListener("close", () => {
  latestClanRequest++;
  if (!new URLSearchParams(location.search).has("tag")) return;

  if (history.state?.clanTag) {
    history.back(); // Dialog wurde per Klick geöffnet → Verlaufseintrag zurücknehmen
  } else {
    updateUrl(); // Direktlink → Tag einfach entfernen
  }
});

// Browser-Zurück/Vor
window.addEventListener("popstate", () => {
  const tag = new URLSearchParams(location.search).get("tag");
  if (tag) {
    openClan(tag, { push: false });
  } else if (dialog.open) {
    dialog.close();
  }
});

const params = new URLSearchParams(location.search);
lastSearch = { name: params.get("name") ?? "", region: params.get("region") ?? "" };
clanInput.value = lastSearch.name;
loadRegions();

// Beim Seitenstart die URL nicht anfassen – sie enthält evtl. schon einen Clan-Tag
if (lastSearch.name) searchClans(lastSearch.name, lastSearch.region, { updateHistory: false });
if (params.get("tag")) openClan(cleanTag(params.get("tag")), { push: false });