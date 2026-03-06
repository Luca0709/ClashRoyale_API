async function loadLeaderboard(){

  const res = await fetch("/leaderboard");
  const players = await res.json();

  renderLeaderboard(players);

}

function renderLeaderboard(players){

  const container = document.getElementById("leaderboardTable");

  container.innerHTML = "";

  players.forEach(p => {
    console.log(p);
    const row = document.createElement("div");

    row.className = "leaderboard-row";

    row.innerHTML = `

      <div class="rank">
        #${p.rank}
      </div>

      <div class="flag">
        <img src="https://flagcdn.com/w40/${p.countryCode?.toLowerCase()}.png">
      </div>

      <div class="player-cell">

        <div class="player-name">
          ${p.name}
        </div>

        <div class="player-clan">
          ${p.clan?.name ?? "—"}
        </div>

      </div>

      <button class="view-btn" onclick="openPlayer('${p.tag.replace("#","")}')">
        View
      </button>

      <div class="medals">
        ${p.eloRating}
      </div>

    `;

    container.appendChild(row);

  });

}

function openPlayer(tag){

  window.location.href = `/?tag=${tag}`;

}

loadLeaderboard();