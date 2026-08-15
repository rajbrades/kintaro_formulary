# Kintaro Formulary

A categorized, per-pharmacy catalog of compounded medications, maintained as a
single CSV and compiled to a browsable page + a review snapshot. No build
toolchain required — it runs on plain Node (`node scripts/build.mjs`), zero
dependencies.

**Source of truth:** [`formulary.csv`](formulary.csv). Edit the CSV, validate,
rebuild — everything downstream regenerates.

Origin: seeded from three telehealth pharmacy price sheets
(`TeleLaunch_Pharmacy_Pricing.xlsx`, tabs *V Pharm*, *Peptides*, *S Pharm*),
**410 products** categorized into 9 clinical categories.

## Quick start

```bash
node scripts/check.mjs     # validate the CSV
node scripts/build.mjs     # regenerate FORMULARY.md, index.html, formulary.json
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
| `pharmacy` | yes | `V Pharm`·`Peptides Supplier`·`S Pharm`. |
| `sku` | optional | Supplier SKU; blank when "available upon request". |
| `wholesale_cost` | optional | Pharmacy cost from the source sheet (numeric). See caveat. |
| `retail_price` | optional | **Left blank** — fill to layer your own margin. |
| `rx_required` | yes | `yes` / `no`. |
| `tags` | optional | Pipe-separated secondary-use tags (see `lib/vocab.mjs`). Use `review` to flag rows needing a human decision. |
| `notes` | optional | Free text: `form inferred`, ship restrictions, review reasons, etc. |

**Price caveat:** `wholesale_cost` is verbatim from each pharmacy's sheet and the
**basis differs** — V Pharm oral prices are per-unit (per pill); creams/vials/kits
are per-package. `strength` + `package` give the basis.

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
- **6 rows are tagged `review`** (Spironolactone × 4, Estriol+tretinoin,
  Dihexa/Tesofensine) — ambiguous primary category, listed at the top of
  `FORMULARY.md`.
- The source workbook's *Example of Profits* tab is a margin model and is
  intentionally **not** part of the drug list; the blank `retail_price` column is
  where margin belongs.
