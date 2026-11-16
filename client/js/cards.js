// Kartenanzeige für Spielerprofil und Meta-Decks.
import { escapeHtml } from "./utils.js";

// Sonderformen im Deck: Evolutionen liegen in Slot 1 oder 3, Helden und Champions in Slot 2 oder 3.
const EVO_SLOTS = [0, 2];
const HERO_SLOTS = [1, 2];

const CARD_FORMS = {
  evo: { badge: "EVO", label: "Evolution" },
  hero: { badge: "HELD", label: "Held" },
  champion: { badge: "CHAMP", label: "Champion" }
};

/**
 * Ermittelt die Form einer Karte im Deck.
 * evolutionLevel 1 = Evolution, 2 = Held, fehlt = normale Karte.
 * Die Slot-Prüfung verhindert, dass eine Karte mit freigeschalteter Evo
 * auf einem normalen Platz fälschlich markiert wird.
 */
export function getCardForm(card, slot) {
  const level = card.evolutionLevel ?? 0;

  if (card.rarity === "champion") return "champion";
  if (level === 2 && HERO_SLOTS.includes(slot) && card.iconUrls?.heroMedium) return "hero";
  if (level >= 1 && EVO_SLOTS.includes(slot) && card.iconUrls?.evolutionMedium) return "evo";
  return "normal";
}

function getCardImage(card, form) {
  const icons = card.iconUrls ?? {};
  if (form === "hero" && icons.heroMedium) return icons.heroMedium;
  if (form === "evo" && icons.evolutionMedium) return icons.evolutionMedium;
  return icons.medium ?? "";
}

/**
 * Zeigt ein Deck als Kartenraster.
 * Hat eine Karte schon ein "form"-Feld (Meta-Decks), wird es direkt verwendet.
 */
export function deckHtml(cards, size) {
  const items = cards.map((card, slot) => {
    const form = card.form ?? getCardForm(card, slot);
    const info = CARD_FORMS[form];
    const title = info ? `${card.name} (${info.label})` : card.name;
    const image = getCardImage(card, form);
    const normalImage = card.iconUrls?.medium ?? "";

    // Falls das Evo-/Helden-Bild nicht lädt, wird auf das normale Bild gewechselt
    const fallback = image !== normalImage ? `data-fallback-src="${escapeHtml(normalImage)}"` : "";

    return `
      <div class="deck-card deck-card-${form}">
        <img src="${escapeHtml(image)}" ${fallback}
             alt="${escapeHtml(title)}" title="${escapeHtml(title)}" loading="lazy">
        ${info ? `<span class="card-badge card-badge-${form}">${info.badge}</span>` : ""}
      </div>
    `;
  }).join("");

  return `<div class="deck deck-${size}">${items}</div>`;
}