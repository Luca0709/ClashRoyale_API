let currentRegion = "global";

async function loadLeaderboard(region = "global") {
  try {
    currentRegion = region;

    const res = await fetch(`/leaderboard?region=${encodeURIComponent(region)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Fehler beim Laden");
    }

    renderLeaderboard(data);
    updateFilterLabel(region);
  } catch (err) {
    console.error(err);

    const container = document.getElementById("leaderboardTable");
    container.innerHTML = `<div class="error-box">Fehler: ${err.message}</div>`;
  }
}

function renderLeaderboard(players) {
  const container = document.getElementById("leaderboardTable");
  container.innerHTML = "";

  players.forEach(p => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";

    row.innerHTML = `
      <div class="rank">#${p.rank}</div>

      <div class="flag">
        ${
          p.countryCode
            ? `<img src="https://flagcdn.com/w40/${p.countryCode.toLowerCase()}.png" alt="${p.countryCode}">`
            : ""
        }
      </div>

      <div class="player-cell">
        <div class="player-name">${p.name}</div>
        <div class="player-clan">${p.clan?.name ?? "—"}</div>
      </div>

      <button class="view-btn" onclick="openPlayer('${p.tag.replace("#", "")}')">
        View
      </button>

      <div class="medals">${p.eloRating ?? "—"}</div>
    `;

    container.appendChild(row);
  });
}

function openPlayer(tag) {
  window.location.href = `/?tag=${tag}`;
}

function toggleLeaderboardDropdown() {
  const dropdown = document.getElementById("leaderboardDropdown");
  dropdown.classList.toggle("show");
}

function selectRegion(region) {
  const dropdown = document.getElementById("leaderboardDropdown");
  dropdown.classList.remove("show");
  loadLeaderboard(region);
}

function updateFilterLabel(region) {
  const btnLabel = document.getElementById("selectedRegion");

  const labels = {
    global: "Global",
    "österreich": "Österreich",
    deutschland: "Deutschland",
    amerika: "Amerika"
  };

  btnLabel.textContent = labels[region] || "Global";
}

document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".leaderboard-filter");
  const dropdown = document.getElementById("leaderboardDropdown");

  if (!wrapper.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

loadLeaderboard();