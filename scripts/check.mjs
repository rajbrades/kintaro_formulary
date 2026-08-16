// ==========================================================================
// KINTARO FORMULARY — Validator (plain Node, zero dependencies)
// ==========================================================================
// Validates formulary.csv: header order, controlled vocabulary, rx_required,
// numeric prices, and exact-duplicate rows; warns on unknown tags and reports
// SKU / price coverage. Exits non-zero on any failure (warnings do not fail).
//
//   node scripts/check.mjs      (or: npm run check)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

import {
  FORMULARY_CATEGORIES,
  FORM_TYPES,
  PHARMACIES,
  WHOLESALE_BASES,
  SUGGESTED_TAGS,
  EXPECTED_HEADER,
  parseCsv,
} from "../lib/vocab.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = join(ROOT, "formulary.csv");

function main() {
  if (!existsSync(CSV_PATH)) {
    console.log(`[check] ${CSV_PATH} not found — nothing to check.`);
    process.exit(0);
  }
  const records = parseCsv(readFileSync(CSV_PATH, "utf8"));
  if (records.length === 0) {
    console.error("[check] FAIL — empty file");
    process.exit(1);
  }
  if (JSON.stringify(records[0]) !== JSON.stringify(EXPECTED_HEADER)) {
    console.error("[check] FAIL — header mismatch");
    console.error(`  expected: ${EXPECTED_HEADER.join(",")}`);
    console.error(`  actual:   ${records[0].join(",")}`);
    process.exit(1);
  }

  const catSet = new Set(FORMULARY_CATEGORIES);
  const formSet = new Set(FORM_TYPES);
  const pharmSet = new Set(PHARMACIES);
  const tagSet = new Set(SUGGESTED_TAGS);
  const basisSet = new Set(WHOLESALE_BASES);

  const failures = [];
  const unknownTags = new Set();
  const seen = new Map();
  const perCat = new Map();
  let skuCount = 0;
  let priceCount = 0;

  const body = records.slice(1);
  body.forEach((r, idx) => {
    const line = idx + 2;
    if (r.length !== EXPECTED_HEADER.length) {
      failures.push(`line ${line}: ${r.length} columns (expected ${EXPECTED_HEADER.length})`);
      return;
    }
    const [category, product_name, , strength, form, pkg, pharmacy, sku, wholesale_cost, wholesale_basis, , rx, tags] = r;
    if (!product_name) failures.push(`line ${line}: product_name empty`);
    if (!catSet.has(category)) failures.push(`line ${line}: unknown category "${category}"`);
    if (!formSet.has(form)) failures.push(`line ${line}: unknown form "${form}"`);
    if (!pharmSet.has(pharmacy)) failures.push(`line ${line}: unknown pharmacy "${pharmacy}"`);
    if (rx !== "yes" && rx !== "no") failures.push(`line ${line}: rx_required "${rx}" must be yes/no`);
    if (wholesale_cost && !Number.isFinite(Number(wholesale_cost))) {
      failures.push(`line ${line}: non-numeric wholesale_cost "${wholesale_cost}"`);
    }
    if (!basisSet.has(wholesale_basis)) failures.push(`line ${line}: invalid wholesale_basis "${wholesale_basis}"`);
    if (wholesale_cost && wholesale_basis === "unknown") failures.push(`line ${line}: priced row cannot have unknown wholesale_basis`);
    const key = [product_name, strength, form, pkg, pharmacy, wholesale_cost].join("¦");
    if (seen.has(key)) failures.push(`line ${line}: duplicate of line ${seen.get(key)} (${product_name} ${strength})`);
    else seen.set(key, line);
    for (const t of tags.split("|").filter(Boolean)) if (!tagSet.has(t)) unknownTags.add(t);
    if (sku) skuCount++;
    if (wholesale_cost) priceCount++;
    perCat.set(category, (perCat.get(category) ?? 0) + 1);
  });

  console.log(`── ${basename(CSV_PATH)} ──`);
  console.log(`  Rows: ${body.length}`);
  for (const c of FORMULARY_CATEGORIES) {
    const n = perCat.get(c) ?? 0;
    if (n > 0) console.log(`    ${c}: ${n}`);
  }
  const total = body.length || 1;
  console.log(`  SKU coverage:   ${skuCount}/${body.length} (${Math.round((100 * skuCount) / total)}%)`);
  console.log(`  Price coverage: ${priceCount}/${body.length} (${Math.round((100 * priceCount) / total)}%)`);
  if (unknownTags.size) console.log(`  [warn] unknown tags (not in SUGGESTED_TAGS): ${[...unknownTags].sort().join(", ")}`);
  console.log("");

  if (failures.length) {
    console.error(`[check] FAILED — ${failures.length} issue(s):`);
    for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
    if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
    process.exit(1);
  }
  console.log("[check] PASS");
}

main();
