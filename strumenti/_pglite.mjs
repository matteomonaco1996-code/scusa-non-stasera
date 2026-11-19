// Trova PGlite (il Postgres in memoria delle prove del database) dov'è stato installato:
// accanto a questi file, nella cartella prove/ (cd prove && npm install) o nella cartella da cui si lancia.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const qui = path.dirname(fileURLToPath(import.meta.url));
let file = null;
for (const base of [qui, path.join(qui, "..", "prove"), process.cwd()]) {
  const dir = path.join(base, "node_modules", "@electric-sql", "pglite");
  if (!fs.existsSync(path.join(dir, "package.json"))) continue;
  const pk = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let voce = pk.exports && pk.exports["."] ? pk.exports["."].import || pk.exports["."] : pk.module || pk.main;
  if (voce && typeof voce === "object") voce = voce.default || voce.import;
  file = path.join(dir, typeof voce === "string" ? voce : "dist/index.js");
  break;
}
if (!file) { console.error("Manca PGlite. Si installa così:  cd prove && npm install"); process.exit(2); }
export const { PGlite } = await import(pathToFileURL(file).href);
