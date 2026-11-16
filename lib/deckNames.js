// Einfache automatische Decknamen, z. B. "2.6 Hog Cycle" oder "4.1 Golem Beatdown".
// Erste Version – lässt sich später um Archetypen wie "Splashyard" erweitern.

// Reihenfolge = Priorität: Die erste gefundene Win-Condition gibt den Namen.
const WIN_CONDITIONS = [
  ["Lava Hound", "Lava"],
  ["Golem", "Golem"],
  ["Electro Giant", "E-Giant"],
  ["Elixir Golem", "Elixir Golem"],
  ["Goblin Giant", "Goblin Giant"],
  ["Royal Giant", "Royal Giant"],
  ["Giant", "Giant"],
  ["Mega Knight", "Mega Knight"],
  ["P.E.K.K.A", "Pekka"],
  ["Three Musketeers", "3M"],
  ["X-Bow", "X-Bow"],
  ["Mortar", "Mortar"],
  ["Graveyard", "Graveyard"],
  ["Balloon", "Balloon"],
  ["Hog Rider", "Hog"],
  ["Royal Hogs", "Royal Hogs"],
  ["Ram Rider", "Ram Rider"],
  ["Battle Ram", "Ram"],
  ["Goblin Drill", "Drill"],
  ["Sparky", "Sparky"],
  ["Wall Breakers", "Wall Breakers"],
  ["Goblin Barrel", "Log Bait"],
  ["Skeleton Barrel", "Skelly Barrel"],
  ["Miner", "Miner"]
];

// Bei diesen Archetypen passt kein "Cycle"/"Beatdown"-Zusatz
const NO_STYLE = new Set(["Log Bait", "LavaLoon", "X-Bow", "Mortar"]);

/**
 * @param cards Karten mit { name, form }
 * @param avgElixir durchschnittliche Elixierkosten
 */
export function buildDeckName(cards, avgElixir) {
  const names = new Set(cards.map((card) => card.name));

  let label = WIN_CONDITIONS.find(([cardName]) => names.has(cardName))?.[1];
  if (names.has("Lava Hound") && names.has("Balloon")) label = "LavaLoon";

  // Keine klassische Win-Condition: nach Held oder Evo benennen
  if (!label) {
    const special = cards.find((card) => card.form === "hero") ?? cards.find((card) => card.form === "evo");
    label = special ? special.name : "Control";
  }

  let style = "";
  if (!NO_STYLE.has(label) && avgElixir != null) {
    if (avgElixir <= 3.0) style = "Cycle";
    else if (avgElixir >= 4.0) style = "Beatdown";
  }

  const elixir = avgElixir != null ? avgElixir.toFixed(1) : "";
  return [elixir, label, style].filter(Boolean).join(" ");
}