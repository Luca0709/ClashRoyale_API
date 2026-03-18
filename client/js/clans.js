async function loadClans() {
  const input = document.getElementById("clanInput");
  const clanName = input.value.trim();
  const results = document.getElementById("clanResults");

  if (!clanName) {
    results.innerHTML = `<div class="error-box">Bitte gib einen Clan-Namen ein.</div>`;
    return;
  }

  try {
    results.innerHTML = `<div class="loading-box">Suche läuft...</div>`;

    const res = await fetch(`/clans?name=${encodeURIComponent(clanName)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Fehler bei der Clansuche");
    }

    renderClans(data);
  } catch (err) {
    console.error(err);
    results.innerHTML = `<div class="error-box">Fehler: ${err.message}</div>`;
  }
}

function renderClans(clans) {
  const container = document.getElementById("clanResults");
  container.innerHTML = "";

  if (!clans.length) {
    container.innerHTML = `<div class="empty-box">Keine Clans gefunden.</div>`;
    return;
  }

  clans.forEach(clan => {
    const row = document.createElement("div");
    row.className = "clan-row";

    row.innerHTML = `
      <div class="clan-badge">
        ${
          clan.badgeId
            ? `<img src="https://cdn.royaleapi.com/static/img/badges/${clan.badgeId}.png" alt="Clan Badge">`
            : `<div class="clan-badge-placeholder">🏰</div>`
        }
      </div>

      <div class="clan-main">
        <div class="clan-name">${clan.name}</div>
        <div class="clan-tag">${clan.tag}</div>
      </div>

      <div class="clan-stat">
        <span>👥 Mitglieder</span>
        <strong>${clan.members ?? "—"}/50</strong>
      </div>

      <div class="clan-stat">
        <span>🏆 Trophäen</span>
        <strong>${clan.clanScore ?? "—"}</strong>
      </div>

      <div class="clan-stat">
        <span>📍 Region</span>
        <strong>${clan.location?.name ?? "—"}</strong>
      </div>

      <div class="clan-stat">
        <span>📨 Typ</span>
        <strong>${clan.type ?? "—"}</strong>
      </div>
    `;

    container.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("clanInput");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      loadClans();
    }
  });
});