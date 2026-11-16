// Karten, Kartenformen und Deck-Schlüssel (serverseitig).

// Evolutionen liegen in Slot 1 oder 3, Helden und Champions in Slot 2 oder 3 (0-basiert).
const EVO_SLOTS = [0, 2];
const HERO_SLOTS = [1, 2];

const FORM_SUFFIX = { evo: "e", hero: "h" };
const SUFFIX_FORM = { e: "evo", h: "hero" };

/** evolutionLevel 1 = Evolution, 2 = Held – aber nur auf den passenden Slots. */
export function getCardForm(card, slot) {
  const level = card.evolutionLevel ?? 0;

  if (level === 2 && HERO_SLOTS.includes(slot)) return "hero";
  if (level >= 1 && EVO_SLOTS.includes(slot)) return "evo";
  return null;
}

/**
 * Eindeutiger Schlüssel eines Decks, z. B. "26000018h-26000043e-28000008e-…".
 * Karten werden sortiert, damit die Reihenfolge im Deck keine Rolle spielt.
 * Die Form (Evo/Held) gehört dazu: Hog mit und ohne Evo sind verschiedene Decks.
 */
export function deckKey(cards) {
  return cards
    .map((card, slot) => `${card.id}${FORM_SUFFIX[getCardForm(card, slot)] ?? ""}`)
    .sort()
    .join("-");
}

/** "26000043e" → { id: 26000043, form: "evo" } */
export function parseCardToken(token) {
  const match = /^(\d+)([eh]?)$/.exec(token);
  return { id: Number(match[1]), form: SUFFIX_FORM[match[2]] ?? null };
}

/**
 * Bringt die Karten in eine gültige Slot-Reihenfolge, damit Evo und Held
 * beim Kopieren ins Spiel auf dem richtigen Platz landen:
 * Slot 1 = Evo, Slot 2 = Held/Champion, Slot 3 = zweite Evo oder zweiter Held, dann der Rest.
 */
export function arrangeSlots(cards) {
  const evos = cards.filter((c) => c.form === "evo");
  const specials = cards.filter((c) => c.form === "hero" || c.form === "champion");
  const rest = cards
    .filter((c) => !evos.includes(c) && !specials.includes(c))
    .sort((a, b) => (a.elixirCost ?? 0) - (b.elixirCost ?? 0));

  const slots = [evos.shift(), specials.shift(), evos.shift() ?? specials.shift()];

  // Was keinen Spezial-Slot bekommen hat, wird wie eine normale Karte behandelt
  rest.push(...evos, ...specials);

  return [...slots.map((card) => card ?? rest.shift()), ...rest].filter(Boolean);
}

/** Kompakte Kartendaten für das Frontend. Fehlende Evo-/Helden-Bilder werden abgeleitet. */
export function cardInfo(card) {
  const icons = card.iconUrls ?? {};

  return {
    name: card.name,
    elixirCost: card.elixirCost ?? null,
    rarity: card.rarity,
    iconUrls: {
      medium: icons.medium,
      evolutionMedium: icons.evolutionMedium ?? icons.medium?.replace("/cards/", "/cardevolutions/"),
      heroMedium: icons.heroMedium ?? icons.medium?.replace("/cards/", "/cardheroes/")
    }
  };
}