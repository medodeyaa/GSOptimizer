// gen-games.mjs ──────────────────────────────────────────────────────────────
// Trims the bulky archive2 backloggd dump into a compact, app-bundleable CSV of
// PC games that the runtime parser (src/data/games/gamesParser.ts) turns into
// fully-scored GameDefinitions.
//
//   archive2/backloggd_games.csv  ->  src/data/games/games.csv
//
// The source dump is ~27 MB and carries a long Summary column plus dozens of
// non-PC platforms. We keep only Windows-PC titles and only the columns the
// heuristic spec model actually needs:
//
//   Title, Year, Developers, Genres, Plays
//
// Plays drives the dropdown ordering (most-played first); Genres + Year + the
// developer/franchise → engine map drive the estimated performance specs.
//
// Run:  node scripts/gen-games.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "archive2", "backloggd_games.csv");
const OUT = join(ROOT, "src", "data", "games", "games.csv");

// ─── Quote-aware CSV parser (handles "" escapes and newlines in fields) ───────
function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); field = ""; row = [];
    } else if (c === "\r") {
      // ignore — handled by \n
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function csvField(s) {
  const v = s ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function parseYear(s) {
  const m = (s || "").match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : "";
}

// Strip Python-list quoting:  "['FromSoftware', 'Bandai Namco']" -> "FromSoftware; Bandai Namco"
function parseList(s) {
  if (!s) return "";
  return [...s.matchAll(/'([^']*)'|"([^"]*)"/g)]
    .map((m) => (m[1] ?? m[2] ?? "").trim())
    .filter(Boolean)
    .join("; ");
}

function playsToNumber(s) {
  const m = (s || "").trim().toUpperCase().match(/([\d.]+)\s*([KM]?)/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  if (m[2] === "K") return Math.round(v * 1000);
  if (m[2] === "M") return Math.round(v * 1e6);
  return Math.round(v);
}

// ─── Main ────────────────────────────────────────────────────────────────────
const text = readFileSync(SRC, "utf8");
const rows = parseCSV(text);
const header = rows[0];

// Resolve column indices by name (robust to ordering changes).
const col = (name) => header.indexOf(name);
const iTitle = col("Title");
const iDate = col("Release_Date");
const iDev = col("Developers");
const iPlat = col("Platforms");
const iGenre = col("Genres");
const iPlays = col("Plays");

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const collected = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length <= iPlays) continue;

  const title = (r[iTitle] || "").trim();
  if (!title) continue;

  const platforms = r[iPlat] || "";
  if (!platforms.includes("Windows PC")) continue; // PC games only

  collected.push({
    title,
    year: parseYear(r[iDate]),
    developers: parseList(r[iDev]),
    genres: parseList(r[iGenre]),
    plays: playsToNumber(r[iPlays]),
  });
}

// Most-played first → keeps the better-known variant when we dedupe, and
// surfaces well-known titles at the top of the picker.
collected.sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title));

// Drop true duplicates (same title + same year = the same game listed twice),
// keeping the most-played copy.
const seenExact = new Set();
const out = [];
for (const g of collected) {
  const key = norm(g.title) + "|" + g.year;
  if (seenExact.has(key)) continue;
  seenExact.add(key);
  out.push(g);
}

// Distinct games that share a name (remakes / yearly franchises like
// "Star Wars: Battlefront II" 2005 vs 2017) get the year appended so every
// display label stays unique.
const nameCounts = new Map();
for (const g of out) nameCounts.set(norm(g.title), (nameCounts.get(norm(g.title)) ?? 0) + 1);
for (const g of out) {
  if (nameCounts.get(norm(g.title)) > 1 && g.year) g.title = `${g.title} (${g.year})`;
}

const lines = ["Title,Year,Developers,Genres,Plays"];
for (const g of out) {
  lines.push(
    [csvField(g.title), csvField(g.year), csvField(g.developers), csvField(g.genres), g.plays].join(",")
  );
}

writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${out.length} PC games -> ${OUT}`);
console.log(`Output size: ${(Buffer.byteLength(lines.join("\n")) / 1024 / 1024).toFixed(2)} MB`);
