import "./layout.js";
import { escapeHtml, fetchJson, cleanTag, formatNumber, statusBox, flagHtml } from "./utils.js";

const STORAGE_KEY = "leaderboardRegion";
const GLOBAL = { id: "global", name: "Global", countryCode: null };

const dropdown = document.getElementById("regionDropdown");
const regionButton = document.getElementById("regionButton");
const regionPanel = document.getElementById("regionPanel");
const regionSearch = document.getElementById("regionSearch");
const regionList = document.getElementById("regionList");
const table = document.getElementById("leaderboardTable");
const subtitle = document.getElementById("leaderboardSubtitle");

let locations = null; // wird beim ersten Öffnen des Dropdowns geladen
let selectedRegion = loadSavedRegion();
let latestRequest = 0;


// ---------------------------------------------------------------------------
// Rangliste
// ---------------------------------------------------------------------------

async function loadLeaderboard() {
  const requestId = ++latestRequest;
  updateRegionButton();
  table.innerHTML = statusBox("loading", "Rangliste wird geladen …");

  try {
    const players = await fetchJson(`/api/leaderboard?region=${encodeURIComponent(selectedRegion.id)}`);
    if (requestId === latestRequest) renderLeaderboard(players);
  } catch (err) {
    if (requestId === latestRequest) table.innerHTML = statusBox("error", err.message);
  }
}

function renderLeaderboard(players) {
  if (!players.length) {
    table.innerHTML = statusBox("empty", "Für diese Region gibt es keine Einträge.");
    return;
  }

  table.innerHTML = players.map((p) => `
    <a class="lb-row" href="/?tag=${encodeURIComponent(cleanTag(p.tag))}">
      <span class="rank ${p.rank <= 3 ? `rank-${p.rank}` : ""}">${p.rank}</span>
      <span class="lb-player">
        <span class="lb-name">${escapeHtml(p.name)}</span>
        <span class="lb-clan">${escapeHtml(p.clan?.name ?? "Kein Clan")}</span>
      </span>
      <span class="lb-level">${p.expLevel ?? "—"}</span>
      <span class="lb-medals">🏅 ${formatNumber(p.eloRating)}</span>
      <span class="btn btn-ghost btn-sm lb-action">Profil</span>
    </a>
  `).join("");
}


// ---------------------------------------------------------------------------
// Region-Dropdown
// ---------------------------------------------------------------------------

function loadSavedRegion() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? GLOBAL;
  } catch {
    return GLOBAL;
  }
}

function updateRegionButton() {
  document.getElementById("regionIcon").innerHTML = flagHtml(selectedRegion.countryCode);
  document.getElementById("regionName").textContent = selectedRegion.name;
  subtitle.textContent = `Top 100 · Path of Legends · ${selectedRegion.name}`;
}

async function openDropdown() {
  regionPanel.hidden = false;
  regionButton.setAttribute("aria-expanded", "true");
  regionSearch.value = "";
  regionSearch.focus();

  if (!locations) {
    regionList.innerHTML = `<li class="dropdown-info"><span class="spinner"></span>Regionen werden geladen …</li>`;
    try {
      locations = await fetchJson("/api/locations");
    } catch (err) {
      regionList.innerHTML = `<li class="dropdown-info text-danger">${escapeHtml(err.message)}</li>`;
      return;
    }
  }

  renderRegionOptions();
}

function closeDropdown() {
  regionPanel.hidden = true;
  regionButton.setAttribute("aria-expanded", "false");
}

function getFilteredRegions() {
  const query = regionSearch.value.trim().toLowerCase();
  return [GLOBAL, ...(locations ?? [])].filter((loc) => loc.name.toLowerCase().includes(query));
}

function renderRegionOptions() {
  const regions = getFilteredRegions();

  if (!regions.length) {
    regionList.innerHTML = `<li class="dropdown-info">Keine Region gefunden.</li>`;
    return;
  }

  regionList.innerHTML = regions.map((loc) => {
    const selected = String(loc.id) === String(selectedRegion.id);
    return `
      <li>
        <button type="button" class="dropdown-option ${selected ? "selected" : ""}"
                data-id="${loc.id}" role="option" aria-selected="${selected}">
          ${flagHtml(loc.countryCode)}<span>${escapeHtml(loc.name)}</span>
        </button>
      </li>
    `;
  }).join("");
}

function selectRegion(id) {
  const region = [GLOBAL, ...(locations ?? [])].find((loc) => String(loc.id) === String(id));
  if (!region) return;

  selectedRegion = region;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
  } catch {
    // ohne localStorage wird die Auswahl eben nicht gemerkt
  }

  closeDropdown();
  loadLeaderboard();
}


// ---------------------------------------------------------------------------
// Events & Start
// ---------------------------------------------------------------------------

regionButton.addEventListener("click", () => {
  regionPanel.hidden ? openDropdown() : closeDropdown();
});

regionSearch.addEventListener("input", renderRegionOptions);

regionSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const first = getFilteredRegions()[0];
    if (first) selectRegion(first.id);
  }
});

regionList.addEventListener("click", (e) => {
  const option = e.target.closest(".dropdown-option");
  if (option) selectRegion(option.dataset.id);
});

document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target)) closeDropdown();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDropdown();
});

loadLeaderboard();