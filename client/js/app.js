async function loadPlayer() {
  const tag = document.getElementById("tagInput").value.replace("#","");
  const res = await fetch(`/player/${tag}`);
  const data = await res.json();

  renderPlayerInfo(data);
  renderProgress(data);
  renderBattleStats(data);
  renderExtra(data);
  renderRaw(data);

  const battles = await loadBattles(tag);
  renderBattleLog(battles);
}

function renderPlayerInfo(p) {
  document.getElementById("playerInfo").innerHTML = `
    <p><strong>🤴Name:</strong> ${p.name}</p>
    <p><strong>🎟Tag:</strong> ${p.tag}</p>
    <p><strong>⭐️Level:</strong> ${p.expLevel}</p>
    <p><strong>🏛️Clan:</strong> ${p.clan?.name ?? "Kein Clan"}</p>
  `;
}

function renderProgress(p) {
  document.getElementById("progressInfo").innerHTML = `
    <p><strong> 🏆Trophäen:</strong> ${p.trophies}</p>
    <p><strong>🎖Best:</strong> ${p.bestTrophies}</p>
    <p><strong>🏰Arena:</strong> ${p.arena?.name}</p>
  `;
}

function renderBattleStats(p) {
  document.getElementById("battleStats").innerHTML = `
    <p><strong>📈Wins:</strong> ${p.wins}</p>
    <p><strong>📉Losses:</strong> ${p.losses}</p>
    <p><strong>👑3-Crown Wins:</strong> ${p.threeCrownWins}</p>
    <p><strong>Win-Percentage:</strong> ${(p.wins / p.battleCount *100).toFixed(2)}%</p>
  `;
}

function renderExtra(p) {
  document.getElementById("extraInfo").innerHTML = `
    <p><strong>🔝Favorite Card:</strong> ${p.currentFavouriteCard?.name ?? "—"}</p>
  `;
}

function renderRaw(data) {
  const el = document.getElementById("rawData");
  el.textContent = JSON.stringify(data, null, 2) || "not available";
}

async function loadBattles(tag) {
  const res = await fetch(`/player/${tag}/battles`);
  return await res.json();
}

function renderBattleLog(battles) {
  const container = document.getElementById("battleLog");
  container.innerHTML = "";

  battles.slice(0, 5).forEach(battle => {
    const team = battle.team[0];
    const opponent = battle.opponent[0];

    const won = team.crowns > opponent.crowns;
    const resultText = won ? "✅ Sieg" : "❌ Niederlage";

    const renderDeck = (cards) =>
      cards.map(card => `
        <img 
          src="${card.iconUrls?.medium}" 
          alt="${card.name}" 
          title="${card.name}"
        />
      `).join("");

    container.innerHTML += `
      <div class="battle-box">
        <div class="player">
          <div class="player-header">
            <strong>${team.name}</strong>
            <span class="clan">${team.clan?.name ?? "—"}</span>
          </div>

          <div class="deck">${renderDeck(team.cards)}</div>
          <div>
            <p>Elixir Leaked: ${team.elixirLeaked}</p> 
            <p>🏆Trophies: ${team.trophyChange}</p>
          </div>
        </div>

        <div class="battle-center">
          <div class="score">${team.crowns} : ${opponent.crowns}</div>
          <div class="result ${won ? "win" : "loss"}">
            ${resultText}
          </div>
        </div>

        <div class="player">
          <div class="player-header">
            <strong>${opponent.name}</strong>
            <span class="clan">${opponent.clan?.name ?? "—"}</span>
          </div>

          <div class="deck">${renderDeck(opponent.cards)}</div>
          <div>
            <p>Elixir Leaked: ${opponent.elixirLeaked}</p> 
            <p>🏆Trophies: ${opponent.trophyChange}</p>
          </div>
        </div>
      </div>
    `;
  });
}

const params = new URLSearchParams(window.location.search);
const tagFromUrl = params.get("tag");

if (tagFromUrl) {
  document.getElementById("tagInput").value = tagFromUrl;
  loadPlayer();
}