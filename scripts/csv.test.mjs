// Self-check for the CSV write-back / archive / undo logic.
// Run: node scripts/csv.test.mjs
import assert from "node:assert/strict";
import { removeFormularyRow, appendRow, popLastRow, parseCsv, EXPECTED_HEADER } from "../lib/vocab.mjs";

const csv =
  [
    EXPECTED_HEADER.join(","),
    'Hair Restoration,"Minoxidil, Fin",fin+min,5mg,capsule,30ct,V Pharm,SKU1,1.23,per_unit,,yes,,note',
    "Sexual Wellness,Tadalafil,,20mg,tablet,10ct,S Pharm,SKU2,2.00,per_unit,,yes,,",
  ].join("\n") + "\n";

const target = {
  category: "Hair Restoration",
  product_name: "Minoxidil, Fin",
  active_ingredients: "fin+min",
  strength: "5mg",
  form: "capsule",
  package: "30ct",
  pharmacy: "V Pharm",
  sku: "SKU1",
  wholesale_cost: "1.23",
  wholesale_basis: "per_unit",
  retail_price: "",
  rx_required: "yes",
  tags: "",
  notes: "note",
};

// --- remove ---
const { csv: out, row } = removeFormularyRow(csv, target);
const recs = parseCsv(out);
assert.equal(recs.length, 2, "header + 1 remaining data row");
assert.equal(recs[1][1], "Tadalafil", "the correct row was removed");
assert.equal(row.product_name, "Minoxidil, Fin", "removed row is returned intact");
assert.throws(() => removeFormularyRow(out, target), /no matching row/, "removing again misses");

// --- archive round-trip (soft delete) ---
const archive = appendRow("", row);
const popped = popLastRow(archive);
assert.equal(popped.row.sku, "SKU1", "popped row matches what was archived");
assert.equal(parseCsv(popped.csv).length, 1, "archive holds only the header after pop");
assert.throws(() => popLastRow(popped.csv), /nothing to undo/, "empty archive cannot be undone");

// --- undo restores into the formulary ---
const restored = appendRow(out, popped.row);
assert.equal(parseCsv(restored).length, 3, "row restored into formulary");

console.log("ok - remove / archive / undo round-trip");
