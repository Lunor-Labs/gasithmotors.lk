# Stock Out list: sort by most recently depleted

## Goal

On the Products page, when filtered to "Out of Stock", show the item that most
recently ran out of stock at the top, instead of today's alphabetical-by-SKU
order.

## Background / why this approach

The obvious signal — "when was this product last sold" — isn't usable: sales
are never cached locally (only a transient `offline_sales` sync queue exists,
and entries are deleted once synced), and this app is offline-first, so any
sort that depends on a live query to Supabase would break (silently fall back
to SKU order) whenever the device is offline.

Instead we add a `stock_depleted_at` timestamp directly on `products`. It's
stamped at the exact moment a product's total stock across all its batches
hits zero, in the same code paths that already mutate stock — both the
online path and the existing offline-optimistic path in `POS.tsx`. Because it
lives on the product row, it syncs down to the local IndexedDB `products`
table the same way every other product field already does, so it works
offline with no extra queries.

## Data model change

New migration `supabase/migrations/<timestamp>_add_stock_depleted_at_to_products.sql`,
following the existing idempotent-guard style used by
`20260124025440_add_image_url_to_products.sql`:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'stock_depleted_at'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_depleted_at timestamptz;
  END IF;
END $$;
```

Nullable, no default. `null` means "never gone out of stock" (or not tracked
yet — see Rollout below).

Update generated types to match:
- `src/lib/database.types.ts` — add `stock_depleted_at: string | null` to
  `products.Row`, and `stock_depleted_at?: string | null` to `Insert`/`Update`.
- No changes needed in `src/types/index.ts` — `Product`, `ProductWithStock`,
  and `ProductWithBatches` all derive from the `products` Row type, so the
  field flows through automatically.

## Where the field gets set

A product's stock can hit zero via three flows. All three funnel through
`InventoryService` (`src/services/InventoryService.ts`), which already
fetches the affected batch (including its `product_id`) before updating it —
so no extra query is needed to know which product to check.

Add one private-turned-shared helper:

```ts
async checkAndMarkDepletion(productId: string): Promise<void> {
  const batches = await this.adapter.query<ProductBatch>('product_batches', {
    where: [{ field: 'product_id', operator: '=', value: productId }],
  });
  const totalStock = batches.reduce((sum, b) => sum + b.current_quantity, 0);
  if (totalStock === 0) {
    await this.adapter.update('products', productId, {
      stock_depleted_at: new Date().toISOString(),
    });
  }
}
```

Call it after the existing `updateStock` call in each of `deductStock`,
`addStock`, and `adjustStock` (`InventoryService.ts:48`, `:85`, `:128`),
passing `batch.product_id` from the batch already fetched in each loop.
(`addStock`/`adjustStock` rarely land exactly on zero, but it's cheap and
keeps all three stock-mutating paths consistent — no special-casing needed.)

This covers: online sales (`SalesService.createSale` →
`InventoryService.deductStock`), returns/restocks, and manual stock
adjustments.

### Offline sale path (`src/components/POS.tsx:622-638`)

This path already writes decremented batch quantities straight into the local
Dexie `products` record as an optimization, before the sale has synced to
Supabase. Extend it: after computing `updatedBatches`, sum their
`current_quantity`; if the total is `0`, include
`stock_depleted_at: new Date().toISOString()` in the same
`db.products.update(...)` call. This makes the sort correct immediately,
even with no connectivity.

### Offline sale sync (`src/services/SalesService.ts:625-659`)

When the queued sale is replayed to Supabase, it must set the same field
server-side, or the next down-sync (`useProducts.ts`'s `syncProducts`) will
overwrite the optimistic local value with `null`. Today's payload
(`POS.tsx:606-609`) only carries `{ id, newQuantity }` per batch — add
`product_id` to each entry (already known client-side as `item.product.id`).
Then in `syncOfflineSale`, after `productRepo.updateStock(b.id, b.newQuantity)`,
call `inventoryRepo.checkAndMarkDepletion(b.product_id)` (requires making that
method public — `SalesService` already holds an `InventoryService` instance
via its constructor).

## Where it's read / sorted

`src/hooks/useProducts.ts:172-174` — the `out_of_stock` branch currently does:

```ts
allFiltered.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));
```

Change to sort by `stock_depleted_at` descending, falling back to the
existing SKU sort for ties and for products with no value:

```ts
allFiltered.sort((a, b) => {
  if (stockFilter === 'out_of_stock') {
    const aTime = a.stock_depleted_at ? new Date(a.stock_depleted_at).getTime() : null;
    const bTime = b.stock_depleted_at ? new Date(b.stock_depleted_at).getTime() : null;
    if (aTime !== null && bTime !== null && aTime !== bTime) return bTime - aTime;
    if (aTime !== null && bTime === null) return -1;
    if (aTime === null && bTime !== null) return 1;
  }
  return a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' });
});
```

The `all` / `low_stock` filters and the unfiltered product list are
unaffected — they keep today's pure SKU sort.

## Edge cases

- **Products already out of stock before this ships**: they have no
  `stock_depleted_at` yet, so they sort to the bottom (by SKU) until the next
  time their stock changes (e.g. a restock followed by a sale that re-depletes
  them). This is a one-time transitional gap, not something we backfill.
- **Restock then deplete again**: the field is simply overwritten with the
  newer timestamp — always reflects the most recent zero-out, not the first.
- **Restocked above zero**: `stock_depleted_at` is left as-is (not cleared).
  Harmless — the product no longer matches the `out_of_stock` filter at all
  while its stock is positive, so the stale timestamp is invisible until it
  depletes again, at which point it's overwritten anyway.
- **Manual item / non-batch sale lines**: unaffected — manual items are
  excluded from stock deduction entirely (`SalesService.ts:111-112`).

## Out of scope

- The Dashboard "Stock Out" stat card (`src/components/Dashboard.tsx`) only
  shows a count and navigates into the filtered Products page — no list
  ordering to change there.
- No new sort-order UI control is being added; this changes the fixed default
  order of the existing `out_of_stock` filter view only.
- `low_stock` filter ordering is unchanged.

## Testing plan

- Unit-level: exercise the new `useProducts.ts` comparator with a mix of
  products (some with `stock_depleted_at`, some without, some tied) and
  confirm ordering.
- Manual: sell a product's last unit online → confirm it jumps to the top of
  Out of Stock. Go offline, sell another product's last unit → confirm it
  jumps to the top locally before syncing, then stays there after the
  background sync completes (i.e. the Supabase-side value matches).
- Manual: adjust a product's stock down to 0 via the manual stock-adjustment
  flow → confirm it also jumps to the top.
