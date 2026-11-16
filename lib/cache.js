/**
 * Sehr einfacher In-Memory-Cache. Spart API-Aufrufe und macht die Seite
 * auf dem Gratis-Server spürbar schneller. Fehler werden nicht gecacht.
 */
const cache = new Map();
const CACHE_MAX_ENTRIES = 500;

export async function cached(key, ttlSeconds, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value;
  }

  const value = await loader();

  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value); // ältesten Eintrag entfernen
  }
  cache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });

  return value;
}

export function clearCached(key) {
  cache.delete(key);
}