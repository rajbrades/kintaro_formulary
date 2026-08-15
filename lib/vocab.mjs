// ==========================================================================
// KINTARO FORMULARY — Controlled Vocabulary (single source of truth)
// ==========================================================================
// Imported by both scripts/build.mjs and scripts/check.mjs so the vocabulary
// is defined exactly once. The README documents the same values in prose for
// review — keep it in sync when you edit this file.

/** Primary clinical category. Every formulary row has exactly one. */
export const FORMULARY_CATEGORIES = [
  "Sexual Wellness",
  "Hair Restoration",
  "Peptide Therapy",
  "Weight Management",
  "Hormone Therapy",
  "Dermatology",
  "Wellness / Longevity",
  "Supplies & Fees",
  "Unknown / Uncategorized",
];

/** Dosage form / delivery. `supply` and `other` cover non-drug rows. */
export const FORM_TYPES = [
  "capsule",
  "tablet",
  "troche", // troche / RDT / ODT / sublingual — dissolvable oral
  "cream",
  "gel",
  "lotion",
  "solution", // scalp solutions / suspensions
  "injectable", // vials, IM / SQ
  "nasal-spray",
  "patch",
  "supply", // syringe kits, etc.
  "other", // fees, shipping, unclassifiable
];

/** Source supplier. A single product can appear once per pharmacy. */
export const PHARMACIES = ["V Pharm", "Peptides Supplier", "S Pharm"];

/**
 * Suggested secondary-use tags (pipe-separated in the CSV `tags` column).
 * Not an enforced enum — the checker only warns on unknown tags, so new tags
 * can be introduced without a code change. `review` marks rows whose primary
 * category a human should confirm.
 */
export const SUGGESTED_TAGS = [
  "peptide",
  "glp-1",
  "amylin",
  "men's-sexual-health",
  "fertility",
  "aromatase-inhibitor",
  "anabolic",
  "lipotropic",
  "injectable",
  "metabolic",
  "weight",
  "review",
];

export const EXPECTED_HEADER = [
  "category",
  "product_name",
  "active_ingredients",
  "strength",
  "form",
  "package",
  "pharmacy",
  "sku",
  "wholesale_cost",
  "retail_price",
  "rx_required",
  "tags",
  "notes",
];

// ── shared RFC 4180 parser (quoted fields with embedded commas/newlines) ──
export function parseCsv(text) {
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      record.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((c) => c !== "")) records.push(record);
      record = [];
      continue;
    }
    field += ch;
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((c) => c !== "")) records.push(record);
  }
  return records;
}

/** Parse + validate the CSV into row objects. Throws on schema violations. */
export function loadRows(text) {
  const records = parseCsv(text);
  if (records.length === 0) throw new Error("empty file");
  const header = records[0];
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADER)) {
    throw new Error(`header mismatch\n  expected: ${EXPECTED_HEADER.join(",")}\n  actual:   ${header.join(",")}`);
  }
  const catSet = new Set(FORMULARY_CATEGORIES);
  const formSet = new Set(FORM_TYPES);
  const pharmSet = new Set(PHARMACIES);
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const r = records[i];
    const line = i + 1;
    if (r.length !== EXPECTED_HEADER.length) {
      throw new Error(`line ${line}: ${r.length} columns (expected ${EXPECTED_HEADER.length})`);
    }
    const row = {};
    EXPECTED_HEADER.forEach((k, j) => (row[k] = r[j]));
    if (!row.product_name) throw new Error(`line ${line}: product_name empty`);
    if (!catSet.has(row.category)) throw new Error(`line ${line}: unknown category "${row.category}"`);
    if (!formSet.has(row.form)) throw new Error(`line ${line}: unknown form "${row.form}"`);
    if (!pharmSet.has(row.pharmacy)) throw new Error(`line ${line}: unknown pharmacy "${row.pharmacy}"`);
    if (row.rx_required !== "yes" && row.rx_required !== "no") {
      throw new Error(`line ${line}: rx_required "${row.rx_required}" must be yes/no`);
    }
    if (row.wholesale_cost && !Number.isFinite(Number(row.wholesale_cost))) {
      throw new Error(`line ${line}: non-numeric wholesale_cost "${row.wholesale_cost}"`);
    }
    rows.push(row);
  }
  return rows;
}
