# Kintaro Formulary

A categorized, per-pharmacy catalog of compounded medications, maintained as a
single CSV and compiled to a browsable page + a review snapshot. No build
toolchain required — it runs on plain Node (`node scripts/build.mjs`), zero
dependencies.

**Source of truth:** [`formulary.csv`](formulary.csv). Edit the CSV, validate,
rebuild — everything downstream regenerates.

Origin: seeded from three telehealth pharmacy price sheets
(`TeleLaunch_Pharmacy_Pricing.xlsx`, tabs *V Pharm*, *Peptides*, *S Pharm*) and
expanded with `Official VCO Peptide Pricing Catalog 2026.xlsx`, **551 products**
categorized into 9 clinical categories.

## Quick start

```bash
npm run check              # validate the CSV and pricing model
npm run build              # regenerate FORMULARY.md, index.html, formulary.json
open index.html            # browse (category tabs, search, pharmacy filter, sortable prices)
```

Or with npm: `npm run check` / `npm run build`.

`open index.html` is a static, read-only view. To **remove** products from the
browser (which rewrites `formulary.csv` and rebuilds), run the local edit server
instead:

```bash
node scripts/serve.mjs     # then open http://localhost:8000
```

Or with npm: `npm run serve`. Deletion is **off by default**: click **Delete: off**
in the toolbar, enter the password (`1542`, or set `DELETE_PASSWORD=... npm run
serve`), and a × appears on each row. Removing a product moves it to
`archived.csv` (recoverable) and rebuilds; **Undo last removal** restores the
most recent one.

## Files

| File | Role |
|---|---|
| `formulary.csv` | **Source of truth** — hand-edited. |
| `lib/vocab.mjs` | Controlled category / form / pharmacy / tag vocabulary + CSV parser (single source of truth, imported by both scripts). |
| `scripts/check.mjs` | Validator — vocabulary, prices, duplicates, coverage. |
| `lib/pricing.mjs` | Shared cost-covering retail model and 30/60/120/180-day estimates. |
| `scripts/check-pricing.mjs` | Small assertion-based regression check for pricing calculations. |
| `scripts/build.mjs` | Generator — emits the three artifacts below. |
| `scripts/serve.mjs` | Local edit server — serves the viewer and writes password-gated removals to `formulary.csv`, archiving them to `archived.csv` (rebuilds automatically). |
| `archived.csv` | *Generated on first removal* — soft-delete log of removed rows; **Undo** pops the last one back. |
| `FORMULARY.md` | *Generated* — category-grouped markdown snapshot for review. |
| `index.html` | *Generated* — self-contained interactive viewer. |
| `formulary.json` | *Generated* — data export for any other consumer. |

Generated files are checked in for convenience; regenerate rather than edit them.

## Categories

Single primary category per product; secondary clinical use goes in the `tags`
column (no duplicate rows). Full breakdown in [`FORMULARY.md`](FORMULARY.md).

`Sexual Wellness` · `Hair Restoration` · `Peptide Therapy` · `Weight Management` ·
`Hormone Therapy` · `Dermatology` · `Wellness / Longevity` · `Supplies & Fees` ·
`Unknown / Uncategorized`

## Schema (`formulary.csv`)

| Column | Required | Notes |
|---|---|---|
| `category` | yes | One value from the category vocabulary. |
| `product_name` | yes | Display name. |
| `active_ingredients` | optional | Free string for combos; may be blank. |
| `strength` | optional | e.g. `20mg`, `1MG/ML`, `1.25mg/5mg per ml`. |
| `form` | yes | `capsule`·`tablet`·`troche`·`cream`·`gel`·`lotion`·`solution`·`injectable`·`nasal-spray`·`patch`·`supply`·`other`. |
| `package` | optional | e.g. `30mLTube`, `5mL`, `4 Patches`. |
| `pharmacy` | yes | `V Pharm`·`Peptides Supplier`·`S Pharm`·`VCO`. |
| `sku` | optional | Supplier SKU; blank when "available upon request". |
| `wholesale_cost` | optional | Pharmacy cost from the source sheet (numeric). See caveat. |
| `wholesale_basis` | yes | `per_unit` · `per_30_day` · `per_package` · `unknown`; controls how product cost is calculated. |
| `retail_price` | optional | Manual final retail override; generated suggested prices are calculated separately. |
| `rx_required` | yes | `yes` / `no`. |
| `tags` | optional | Pipe-separated secondary-use tags (see `lib/vocab.mjs`). Use `review` to flag rows needing a human decision. |
| `notes` | optional | Free text: `form inferred`, ship restrictions, review reasons, etc. |

**Price caveat:** `wholesale_cost` is verbatim from each pharmacy's sheet and its
basis is explicit in `wholesale_basis`. `per_unit` is multiplied by 30 for a
30-day plan; `per_30_day` is already the full 30-day product cost; and
`per_package` uses one package per month as a visible assumption. Rows without a
confirmed price use `unknown` and do not receive a suggested retail price.

## Suggested retail model

The generated viewer, JSON, and Markdown snapshot include cost-covering retail
estimates for one-time 30-day, 60-day, 120-day, and 180-day supplies. The model
uses:

- $35 asynchronous provider consult for non-controlled medications by default;
  the viewer can switch these rows to the $45 synchronous consult.
- $55 synchronous provider consult for Testosterone rows.
- Generated suggestions default to $35 standard shipping per order.
- Optional scenarios retain two-day shipping at $15 cost / $20 retail and overnight shipping at $25 cost / $35 retail.
- Injectable Tirzepatide and Semaglutide orders default to cold overnight shipping at $25 Kintaro cost and $35 retail; syringes and alcohol pads are included, plus a $25 processing fee per order.
- 2.5% medical-branch fee plus 3% merchant fee on the full transaction.
- Product cost scaled from each row's explicit `wholesale_basis`; dosage form no
  longer determines whether a quote is per-unit or a complete 30-day supply.

The formula is `ceil((consult + fulfillment + product cost) / (1 - 0.025 - 0.03))`, where fulfillment is the applicable retail shipping charge plus any Tirzepatide/Semaglutide processing fee. Shipping cost and retail charge are tracked separately.
These are operational estimates, not clinical dispensing instructions, and do
not include a medication margin; optional shipping retail may exceed shipping
cost. Confirm package duration and prescribed quantity
before using a suggestion as a final patient price.

## Maintaining it (living document)

1. Edit `formulary.csv` (spreadsheet or text editor; quote fields containing commas).
2. `node scripts/check.mjs` — fix any failures.
3. `node scripts/build.mjs` — regenerate the snapshot, viewer, and JSON.
4. Commit the CSV **and** the regenerated files together.

> **The × button:** opened as a plain file it only *dismisses* a row in that
> browser (localStorage). Served via `node scripts/serve.mjs`, deletion is off
> until you unlock it with the password; then × moves the product to
> `archived.csv` and rebuilds, and **Undo last removal** restores it. The
> password is a light gate for a localhost tool, not real auth — don't expose
> the server to a network.

**Add a category / form / pharmacy:** add it to `lib/vocab.mjs` (one place), then
use it in the CSV. **Add a product:** add a CSV row.

## Notes on the seed data

- **~36 rows carry a `form inferred` note** where the source sheet didn't state a
  dosage form; it was inferred from the SKU (e.g. `…CAP`, `…TROCHE`, `…CREA`).
- **23 rows are tagged `review`** — the original 6 ambiguous rows plus 17 VCO
  rows with `TBD`/blank prices or source price-verification notes.
- The VCO import preserves its source category and description in `notes`. Its
  ambiguous `Pill/Tablet/Capsule` form is normalized to `capsule`, and `Spray`
  is normalized to `nasal-spray`; both decisions are noted on affected rows.
- The source workbook's *Example of Profits* tab is not part of the drug list.
  The generated suggested prices cover the configured inputs only; use
  `retail_price` when a reviewed final price or added margin is available.
