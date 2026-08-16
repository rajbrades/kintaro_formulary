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
export const PHARMACIES = ["V Pharm", "Peptides Supplier", "S Pharm", "VCO"];

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

/** Serialize records (array of string arrays) back to RFC-4180 CSV text. */
export function serializeCsv(records) {
  const esc = (v) => {
    v = v ?? "";
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return records.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

/**
 * Remove the first data record whose columns all equal `target` (an object
 * keyed by EXPECTED_HEADER) from raw formulary CSV `text`. Returns the new CSV
 * text plus the removed row (object); throws if no row matches. Re-validates
 * the result via loadRows so a malformed write can never reach disk.
 */
export function removeFormularyRow(text, target) {
  const records = parseCsv(text);
  const header = records[0];
  const col = {};
  header.forEach((k, i) => (col[k] = i));
  let hit = -1;
  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (EXPECTED_HEADER.every((k) => (rec[col[k]] ?? "") === (target[k] ?? ""))) {
      hit = i;
      break;
    }
  }
  if (hit === -1) throw new Error("no matching row");
  const removed = records.splice(hit, 1)[0];
  const csv = serializeCsv(records);
  loadRows(csv); // validate before returning
  const row = {};
  EXPECTED_HEADER.forEach((k, i) => (row[k] = removed[i] ?? ""));
  return { csv, row };
}

/**
 * Append a row (object keyed by EXPECTED_HEADER) to an archive CSV `text`
 * (may be empty — a header row is created). Returns the new CSV text.
 */
export function appendRow(text, row) {
  const records = text.trim() ? parseCsv(text) : [EXPECTED_HEADER.slice()];
  if (JSON.stringify(records[0]) !== JSON.stringify(EXPECTED_HEADER)) {
    throw new Error("archive header mismatch");
  }
  records.push(EXPECTED_HEADER.map((k) => row[k] ?? ""));
  return serializeCsv(records);
}

/**
 * Pop the most recently appended row off an archive CSV `text`. Returns the
 * new CSV text plus the popped row (object); throws if the archive is empty.
 */
export function popLastRow(text) {
  const records = text.trim() ? parseCsv(text) : [EXPECTED_HEADER.slice()];
  if (records.length <= 1) throw new Error("nothing to undo");
  const removed = records.pop();
  const row = {};
  EXPECTED_HEADER.forEach((k, i) => (row[k] = removed[i] ?? ""));
  return { csv: serializeCsv(records), row };
}

/** Categories used in the competitor-blends research tab. */
export const BLEND_CATEGORIES = [
  "Hair Restoration",
  "Sexual Wellness",
];

export const BLEND_HEADER = [
  "category",
  "competitor",
  "product_name",
  "format",
  "ingredients",
  "retail_price",
  "supply",
  "differentiator",
];

/** Parse blends.csv into row objects. Throws on schema violations. */
export function loadBlends(text) {
  const records = parseCsv(text);
  if (records.length === 0) throw new Error("blends.csv is empty");
  const header = records[0];
  if (JSON.stringify(header) !== JSON.stringify(BLEND_HEADER)) {
    throw new Error(`blends header mismatch\n  expected: ${BLEND_HEADER.join(",")}\n  actual:   ${header.join(",")}`);
  }
  const catSet = new Set(BLEND_CATEGORIES);
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const r = records[i];
    const line = i + 1;
    if (r.length !== BLEND_HEADER.length) {
      throw new Error(`blends line ${line}: ${r.length} columns (expected ${BLEND_HEADER.length})`);
    }
    const row = {};
    BLEND_HEADER.forEach((k, j) => (row[k] = r[j]));
    if (!row.product_name) throw new Error(`blends line ${line}: product_name empty`);
    if (!catSet.has(row.category)) throw new Error(`blends line ${line}: unknown category "${row.category}"`);
    rows.push(row);
  }
  return rows;
}

/** Categories used in the competitor-blends research tab. */
