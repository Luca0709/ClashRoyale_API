// Muss als ERSTES importiert werden: Imports werden vor dem restlichen Code
// ausgeführt, und die anderen Module lesen process.env schon beim Laden.

// Lokal: Variablen aus .env laden (Node >= 20.12). Auf Render kommen sie aus dem Dashboard.
try {
  process.loadEnvFile();
} catch {
  // keine .env vorhanden – ist auf dem Server normal
}