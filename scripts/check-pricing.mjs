import assert from "node:assert/strict";
import { enrichPricing, includesColdShipping, monthlyProductCost, orderFulfillment, suggestedRetail } from "../lib/pricing.mjs";

const oral = {
  category: "Hormone Therapy",
  product_name: "Anastrozole",
  form: "capsule",
  package: "",
  pharmacy: "V Pharm",
  wholesale_cost: "0.5",
};
const packaged = { ...oral, form: "cream", package: "30mLTube", wholesale_cost: "27.5" };
const vcoOral = { ...oral, package: "60 units", pharmacy: "VCO", wholesale_cost: "54.2" };
const testosterone = { ...oral, product_name: "Testosterone Cypionate", wholesale_cost: "0.88" };
const semaglutide = { ...packaged, product_name: "Semaglutide + B12", form: "injectable", package: "2mL", wholesale_cost: "55" };

assert.deepEqual(monthlyProductCost(oral), { amount: 15, basis: "30 units / month" });
assert.deepEqual(monthlyProductCost(packaged), { amount: 27.5, basis: "1 package / month" });
assert.deepEqual(monthlyProductCost(vcoOral), { amount: 54.2, basis: "1 package / month" });
assert.equal(suggestedRetail(15, 1, 35), 90);
assert.equal(suggestedRetail(15, 1, 35, 25), 80);
assert.equal(enrichPricing(oral).pricing.plans.async[2].suggested_retail, 106);
assert.equal(enrichPricing(oral).pricing.plans.async[1].two_day_suggested_retail, 69);
assert.equal(enrichPricing(oral).pricing.plans.async[1].overnight_suggested_retail, 80);
assert.equal(enrichPricing(oral).pricing.plans.sync[1].suggested_retail, 101);
assert.equal(enrichPricing(packaged).pricing.plans.async[2].suggested_retail, 133);
assert.equal(enrichPricing(testosterone).pricing.plans.controlled[1].suggested_retail, 124);
assert.equal(includesColdShipping(semaglutide), true);
assert.deepEqual(orderFulfillment(semaglutide), {
  shippingMethod: "coldOvernight",
  shippingCost: 0,
  processingFee: 25,
  suppliesIncluded: true,
});
assert.equal(enrichPricing(semaglutide).pricing.plans.async[1].suggested_retail, 122);
assert.equal(enrichPricing(semaglutide).pricing.plans.async[1].overnight_suggested_retail, 122);
assert.equal(includesColdShipping({ ...semaglutide, form: "troche" }), false);
assert.throws(() => orderFulfillment(oral, "sameDay"), /Unknown shipping method/);
assert.equal(enrichPricing({ ...oral, wholesale_cost: "" }).pricing, null);

console.log("[pricing] PASS");
