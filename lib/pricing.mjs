export const PRICING_MODEL = Object.freeze({
  consults: Object.freeze({
    async: 35,
    syncNonControlled: 45,
    syncControlled: 55,
  }),
  shipping: Object.freeze({
    standard: Object.freeze({ cost: 35, retail: 35 }),
    twoDay: Object.freeze({ cost: 15, retail: 20 }),
    overnight: Object.freeze({ cost: 25, retail: 35 }),
  }),
  glp1ProcessingFee: 25,
  medicalBranchRate: 0.025,
  merchantRate: 0.03,
  daysPerMonth: 30,
  supplyMonths: Object.freeze([1, 2, 4, 6]),
});

const PER_UNIT_FORMS = new Set(["capsule", "tablet", "troche"]);

export function isTestosterone(row) {
  return /^(testosterone|trt\b)/i.test(row.product_name.trim());
}

export function includesColdShipping(row) {
  return row.form === "injectable" && /^(tirzepatide|semaglutide)\b/i.test(row.product_name.trim());
}

export function orderFulfillment(row, shippingMethod = "standard") {
  if (!(shippingMethod in PRICING_MODEL.shipping)) throw new RangeError(`Unknown shipping method: ${shippingMethod}`);
  const cold = includesColdShipping(row);
  const shipping = PRICING_MODEL.shipping[cold ? "overnight" : shippingMethod];
  return {
    shippingMethod: cold ? "coldOvernight" : shippingMethod,
    shippingCost: shipping.cost,
    shippingRetail: shipping.retail,
    processingFee: cold ? PRICING_MODEL.glp1ProcessingFee : 0,
    suppliesIncluded: cold,
  };
}

export function monthlyProductCost(row) {
  const wholesale = Number(row.wholesale_cost);
  if (!Number.isFinite(wholesale) || row.wholesale_cost === "" || row.category === "Supplies & Fees") return null;
  const perUnit = row.pharmacy === "V Pharm" && PER_UNIT_FORMS.has(row.form) && !row.package;
  return {
    amount: wholesale * (perUnit ? PRICING_MODEL.daysPerMonth : 1),
    basis: perUnit ? "30 units / month" : "1 package / month",
  };
}

export function suggestedRetail(productCost, months, consultCost, fulfillmentRetail = PRICING_MODEL.shipping.standard.retail) {
  const feeRate = PRICING_MODEL.medicalBranchRate + PRICING_MODEL.merchantRate;
  const orderCost = productCost * months + consultCost + fulfillmentRetail;
  return Math.ceil(orderCost / (1 - feeRate));
}

export function enrichPricing(row) {
  const product = monthlyProductCost(row);
  if (!product) return { ...row, pricing: null };

  const controlled = isTestosterone(row);
  const consults = controlled
    ? { controlled: PRICING_MODEL.consults.syncControlled }
    : {
        async: PRICING_MODEL.consults.async,
        sync: PRICING_MODEL.consults.syncNonControlled,
      };
  const standard = orderFulfillment(row, "standard");
  const twoDay = orderFulfillment(row, "twoDay");
  const overnight = orderFulfillment(row, "overnight");
  const plans = {};
  for (const [consult, cost] of Object.entries(consults)) {
    plans[consult] = Object.fromEntries(
      PRICING_MODEL.supplyMonths.map((months) => [
        months,
        {
          days_supply: months * PRICING_MODEL.daysPerMonth,
          product_cost: Number((product.amount * months).toFixed(2)),
          suggested_retail: suggestedRetail(product.amount, months, cost, standard.shippingRetail + standard.processingFee),
          two_day_suggested_retail: suggestedRetail(product.amount, months, cost, twoDay.shippingRetail + twoDay.processingFee),
          overnight_suggested_retail: suggestedRetail(product.amount, months, cost, overnight.shippingRetail + overnight.processingFee),
        },
      ])
    );
  }

  return {
    ...row,
    pricing: {
      consult_type: controlled ? "Synchronous · controlled" : "Asynchronous · non-controlled",
      product_cost_basis: product.basis,
      fulfillment: {
        shipping_method: standard.shippingMethod,
        shipping_cost: standard.shippingCost,
        shipping_retail: standard.shippingRetail,
        processing_fee: standard.processingFee,
        syringes_and_alcohol_pads_included: standard.suppliesIncluded,
      },
      plans,
    },
  };
}

export function defaultPlan(row, months = 1) {
  if (!row.pricing) return null;
  return row.pricing.plans[isTestosterone(row) ? "controlled" : "async"][months];
}
