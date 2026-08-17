import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRICING_MODEL, enrichPricing, includesColdShipping, monthlyProductCost, orderFulfillment, suggestedRetail } from "../lib/pricing.mjs";
import { loadRows } from "../lib/vocab.mjs";

const oral = {
  category: "Hormone Therapy",
  product_name: "Anastrozole",
  form: "capsule",
  package: "",
  pharmacy: "V Pharm",
  wholesale_cost: "0.5",
  wholesale_basis: "per_unit",
};
const packaged = { ...oral, form: "cream", package: "30mLTube", wholesale_cost: "27.5", wholesale_basis: "per_package" };
const vcoOral = { ...oral, package: "60 units", pharmacy: "VCO", wholesale_cost: "54.2", wholesale_basis: "per_package" };
const testosterone = { ...oral, product_name: "Testosterone Cypionate", wholesale_cost: "0.88" };
const trt = { ...oral, product_name: "TRT Injectable commercial", wholesale_cost: "20" };
const semaglutide = { ...packaged, product_name: "Semaglutide + B12", form: "injectable", package: "2mL", wholesale_cost: "55" };
const tirzepatideOdt = { ...oral, category: "Weight Management", product_name: "Tirzepatide Oral Dissolving Tablets", strength: "8MG", form: "troche", package: "30 troches", wholesale_cost: "156.25", wholesale_basis: "per_30_day" };

assert.deepEqual(monthlyProductCost(oral), { amount: 15, basis: "$0.5 / unit × 30" });
assert.deepEqual(monthlyProductCost(packaged), { amount: 27.5, basis: "30mLTube / month (assumed)" });
assert.deepEqual(monthlyProductCost(vcoOral), { amount: 54.2, basis: "60 units / month (assumed)" });
assert.deepEqual(monthlyProductCost(tirzepatideOdt), { amount: 156.25, basis: "30-day supply" });
assert.equal(enrichPricing(tirzepatideOdt).pricing.plans.async[1].suggested_retail, 219);
assert.equal(suggestedRetail(15, 1, 35), 69);
assert.deepEqual(orderFulfillment(oral), {
  shippingMethod: "standard",
  shippingCost: 15,
  shippingRetail: 15,
  processingFee: 0,
  suppliesIncluded: false,
});
assert.equal(enrichPricing(oral).pricing.plans.async[2].suggested_retail, 85);
assert.equal(enrichPricing(oral).pricing.plans.async[1].suggested_retail, 69);
assert.equal(enrichPricing(oral).pricing.plans.async[1].priority_suggested_retail, 80);
assert.equal(enrichPricing(oral).pricing.plans.sync[1].suggested_retail, 80);
assert.equal(enrichPricing(packaged).pricing.plans.async[2].suggested_retail, 112);
assert.equal(enrichPricing(testosterone).pricing.plans.controlled[1].suggested_retail, 103);
assert.ok(enrichPricing(trt).pricing.plans.controlled);
assert.equal(includesColdShipping(semaglutide), true);
assert.deepEqual(orderFulfillment(semaglutide), {
  shippingMethod: "coldOvernight",
  shippingCost: 20,
  shippingRetail: 25,
  processingFee: 25,
  suppliesIncluded: true,
});
assert.equal(enrichPricing(semaglutide).pricing.plans.async[1].suggested_retail, 149);
assert.equal(enrichPricing(semaglutide).pricing.plans.async[1].priority_suggested_retail, 149);
assert.equal(includesColdShipping({ ...semaglutide, form: "troche" }), false);
assert.throws(() => orderFulfillment(oral, "sameDay"), /Unknown shipping method/);
assert.equal(enrichPricing({ ...oral, wholesale_cost: "" }).pricing, null);

const rows = loadRows(readFileSync(new URL("../formulary.csv", import.meta.url), "utf8"));
const odt8 = rows.find((row) => row.sku === "TZT-ODT-8-VS");
assert.equal(odt8.package, "30 troches");
assert.equal(odt8.wholesale_basis, "per_30_day");
assert.equal(monthlyProductCost(odt8).amount, 156.25);
for (const [productName, method] of [["Standard Shipping (2-Day)", "standard"], ["Priority Shipping (Overnight)", "priority"]]) {
  const row = rows.find((candidate) => candidate.product_name === productName);
  assert.ok(row, `${productName} must be listed under Supplies & Fees`);
  assert.equal(row.category, "Supplies & Fees");
  assert.equal(Number(row.wholesale_cost), PRICING_MODEL.shipping[method].cost);
  assert.equal(Number(row.retail_price), PRICING_MODEL.shipping[method].retail);
}

console.log("[pricing] PASS");
