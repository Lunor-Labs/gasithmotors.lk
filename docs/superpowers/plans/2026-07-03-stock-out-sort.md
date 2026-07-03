# Stock Out Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort the Products page "Out of Stock" filter so the most recently depleted product appears first, using a new `stock_depleted_at` timestamp stamped the moment a product's stock hits zero.

**Architecture:** Add a nullable `stock_depleted_at` column to `products`. Stamp it from `InventoryService` (covers online sales, returns, and manual adjustments) and from the existing offline-optimistic write path in `POS.tsx` (covers offline sales before they sync), and again during offline-sale replay in `SalesService.syncOfflineSale` (so the server-side value matches once synced). Sort the `out_of_stock` filter in `useProducts.ts` by this field, descending, falling back to today's SKU order for ties and untracked products.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres) as the backend, Dexie (IndexedDB) as the offline cache, Vitest for tests.

## Global Constraints

- `stock_depleted_at` is nullable with no default — absence means "never tracked as depleted," not an error.
- Only the `out_of_stock` stock filter's sort order changes. The `all` and `low_stock` filters, and the base SKU natural-sort algorithm (`localeCompare` with `{ numeric: true, sensitivity: 'base' }`), are unchanged and must be reused as the fallback/tiebreaker.
- No new sort-order UI control is being added.
- Full design context: `docs/superpowers/specs/2026-07-03-stock-out-sort-design.md`.

---

### Task 1: Add `stock_depleted_at` column to products

**Files:**
- Create: `supabase/migrations/20260703120000_add_stock_depleted_at_to_products.sql`
- Modify: `src/lib/database.types.ts:79-122` (the `products` table's `Row`, `Insert`, and `Update` shapes)

**Interfaces:**
- Produces: `Product.stock_depleted_at: string | null` (flows automatically into `ProductWithStock` and `ProductWithBatches`, since both extend `Product` in `src/types/index.ts:25-34` — no edit needed there).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260703120000_add_stock_depleted_at_to_products.sql`:

```sql
/*
  # Track when a product's stock last reached zero

  1. Changes
    - Add `stock_depleted_at` column to `products` table
      - `stock_depleted_at` (timestamptz, nullable) - set the moment a
        product's total stock across all batches reaches zero; used to
        sort the "Out of Stock" list by most recently depleted first.

  2. Notes
    - Nullable with no default: null means the product has never been
      tracked as depleted (either it has never hit zero since this column
      was added, or it was already at zero before this migration ran).
    - Overwritten (not append-only): if a product is restocked and later
      depletes again, this always reflects the most recent zero-out.
*/

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

- [ ] **Step 2: Update the generated types**

In `src/lib/database.types.ts`, the `products` entry currently reads (lines 79-122):

```ts
      products: {
        Row: {
          id: string
          sku: string
          barcode: string | null
          name: string
          description: string | null
          category: string | null
          unit: string
          reorder_level: number
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          barcode?: string | null
          name: string
          description?: string | null
          category?: string | null
          unit?: string
          reorder_level?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          barcode?: string | null
          name?: string
          description?: string | null
          category?: string | null
          unit?: string
          reorder_level?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
```

Add `stock_depleted_at` to all three shapes:

```ts
      products: {
        Row: {
          id: string
          sku: string
          barcode: string | null
          name: string
          description: string | null
          category: string | null
          unit: string
          reorder_level: number
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
          stock_depleted_at: string | null
        }
        Insert: {
          id?: string
          sku: string
          barcode?: string | null
          name: string
          description?: string | null
          category?: string | null
          unit?: string
          reorder_level?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          stock_depleted_at?: string | null
        }
        Update: {
          id?: string
          sku?: string
          barcode?: string | null
          name?: string
          description?: string | null
          category?: string | null
          unit?: string
          reorder_level?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
          stock_depleted_at?: string | null
        }
      }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors (this is a purely additive, optional field — nothing currently constructs a `products` `Insert`/`Update` object that would need updating).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260703120000_add_stock_depleted_at_to_products.sql src/lib/database.types.ts
git commit -m "feat: add stock_depleted_at column to products"
```

---

### Task 2: Stamp depletion in InventoryService

**Files:**
- Modify: `src/services/InventoryService.ts:24-144` (`deductStock`, `addStock`, `adjustStock`)
- Test: `src/services/InventoryService.test.ts`

**Interfaces:**
- Consumes: `Product.stock_depleted_at` (Task 1). `ProductRepository` (existing), `DatabaseAdapter` (existing).
- Produces: `InventoryService.checkAndMarkDepletion(productId: string): Promise<void>` — public method, called by Task 5's `SalesService.syncOfflineSale`.

- [ ] **Step 1: Write the failing tests**

Create `src/services/InventoryService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { InventoryService } from './InventoryService';
import { ProductRepository } from '../repositories/ProductRepository';
import type { DatabaseAdapter, QueryOptions, Transaction } from '../repositories/base/DatabaseAdapter';
import type { ProductBatch } from '../types';

class FakeAdapter implements DatabaseAdapter {
  batches: ProductBatch[];
  productUpdates: Array<{ id: string; data: any }> = [];

  constructor(batches: ProductBatch[]) {
    this.batches = batches;
  }

  async query<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    if (table === 'product_batches') {
      const where = options.where || [];
      let results = this.batches;
      for (const clause of where) {
        results = results.filter((b: any) => b[clause.field] === clause.value);
      }
      return results as unknown as T[];
    }
    return [];
  }

  async insert<T>(): Promise<T> {
    throw new Error('not implemented');
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    if (table === 'product_batches') {
      const batch = this.batches.find(b => b.id === id);
      if (batch) Object.assign(batch, data);
      return batch as unknown as T;
    }
    if (table === 'products') {
      this.productUpdates.push({ id, data });
      return data as unknown as T;
    }
    throw new Error(`unexpected update on ${table}`);
  }

  async delete(): Promise<void> {
    throw new Error('not implemented');
  }
  async raw<T>(): Promise<T[]> {
    throw new Error('not implemented');
  }
  async beginTransaction(): Promise<Transaction> {
    throw new Error('not implemented');
  }
}

function makeBatch(overrides: Partial<ProductBatch>): ProductBatch {
  return {
    id: 'b1',
    product_id: 'p1',
    batch_number: 'BATCH-1',
    purchase_order_id: null,
    supplier_id: 's1',
    cost_price: 10,
    selling_price: 20,
    markup_percentage: 100,
    initial_quantity: 5,
    current_quantity: 5,
    received_date: '2026-01-01',
    expiry_date: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ProductBatch;
}

describe('InventoryService depletion tracking', () => {
  it('deductStock sets stock_depleted_at when the last batch reaches zero', async () => {
    const batch = makeBatch({ id: 'b1', product_id: 'p1', current_quantity: 3 });
    const adapter = new FakeAdapter([batch]);
    const productRepo = new ProductRepository(adapter);
    const inventory = new InventoryService(productRepo, adapter);

    await inventory.deductStock([{ batch_id: 'b1', quantity: 3 }]);

    expect(adapter.productUpdates).toHaveLength(1);
    expect(adapter.productUpdates[0].id).toBe('p1');
    expect(adapter.productUpdates[0].data.stock_depleted_at).toBeTypeOf('string');
  });

  it('deductStock does not touch the product when other batches still have stock', async () => {
    const batches = [
      makeBatch({ id: 'b1', product_id: 'p1', current_quantity: 3 }),
      makeBatch({ id: 'b2', product_id: 'p1', current_quantity: 2 }),
    ];
    const adapter = new FakeAdapter(batches);
    const productRepo = new ProductRepository(adapter);
    const inventory = new InventoryService(productRepo, adapter);

    await inventory.deductStock([{ batch_id: 'b1', quantity: 3 }]);

    expect(adapter.productUpdates).toHaveLength(0);
  });

  it('adjustStock sets stock_depleted_at when manually zeroed out', async () => {
    const batch = makeBatch({ id: 'b1', product_id: 'p1', current_quantity: 5 });
    const adapter = new FakeAdapter([batch]);
    const productRepo = new ProductRepository(adapter);
    const inventory = new InventoryService(productRepo, adapter);

    await inventory.adjustStock([{ batchId: 'b1', quantity: 0, reason: 'adjustment' }]);

    expect(adapter.productUpdates).toHaveLength(1);
    expect(adapter.productUpdates[0].id).toBe('p1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/InventoryService.test.ts`
Expected: FAIL — `adapter.productUpdates` is empty in all three tests, since nothing writes to `products` yet.

- [ ] **Step 3: Implement `checkAndMarkDepletion` and wire it in**

In `src/services/InventoryService.ts`, add this method to the `InventoryService` class (after `deductStock`, before `addStock`):

```ts
    /**
     * If a product's total stock across all its batches has reached zero,
     * stamp `stock_depleted_at` with the current time. Called after any
     * stock mutation so the "Out of Stock" list can be sorted by most
     * recent depletion.
     */
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

Then call it after each stock mutation. In `deductStock`, change:

```ts
                // Deduct stock
                const newQuantity = batch.current_quantity - item.quantity;
                await this.productRepo.updateStock(item.batch_id, newQuantity);
```

to:

```ts
                // Deduct stock
                const newQuantity = batch.current_quantity - item.quantity;
                await this.productRepo.updateStock(item.batch_id, newQuantity);
                await this.checkAndMarkDepletion(batch.product_id);
```

In `addStock`, change:

```ts
                // Add stock
                const newQuantity = batch.current_quantity + item.quantity;
                await this.productRepo.updateStock(item.batch_id, newQuantity);
```

to:

```ts
                // Add stock
                const newQuantity = batch.current_quantity + item.quantity;
                await this.productRepo.updateStock(item.batch_id, newQuantity);
                await this.checkAndMarkDepletion(batch.product_id);
```

In `adjustStock`, change:

```ts
                // Update stock
                await this.productRepo.updateStock(adjustment.batchId, adjustment.quantity);
```

to:

```ts
                // Update stock
                await this.productRepo.updateStock(adjustment.batchId, adjustment.quantity);
                await this.checkAndMarkDepletion(batch.product_id);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/InventoryService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/InventoryService.ts src/services/InventoryService.test.ts
git commit -m "feat: mark products depleted when stock reaches zero"
```

---

### Task 3: Sort the Out of Stock filter by most recent depletion

**Files:**
- Create: `src/utils/productSort.ts`
- Test: `src/utils/productSort.test.ts`
- Modify: `src/hooks/useProducts.ts:1-7` (imports), `:170-175` (sort logic)

**Interfaces:**
- Consumes: `Product.stock_depleted_at` (Task 1).
- Produces: `compareOutOfStock(a: StockSortable, b: StockSortable): number` — used by `useProducts.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/productSort.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compareOutOfStock } from './productSort';

describe('compareOutOfStock', () => {
  it('puts the most recently depleted product first', () => {
    const older = { sku: 'A-001', stock_depleted_at: '2026-07-01T00:00:00.000Z' };
    const newer = { sku: 'A-002', stock_depleted_at: '2026-07-02T00:00:00.000Z' };

    expect([older, newer].sort(compareOutOfStock)).toEqual([newer, older]);
  });

  it('puts products with no depletion timestamp after dated ones', () => {
    const dated = { sku: 'B-001', stock_depleted_at: '2026-07-01T00:00:00.000Z' };
    const undated = { sku: 'A-999', stock_depleted_at: null };

    expect([undated, dated].sort(compareOutOfStock)).toEqual([dated, undated]);
  });

  it('falls back to natural SKU order among undated products', () => {
    const a = { sku: 'A-2', stock_depleted_at: null };
    const b = { sku: 'A-10', stock_depleted_at: null };

    expect([b, a].sort(compareOutOfStock)).toEqual([a, b]);
  });

  it('falls back to SKU order for products depleted at the exact same time', () => {
    const a = { sku: 'A-2', stock_depleted_at: '2026-07-01T00:00:00.000Z' };
    const b = { sku: 'A-10', stock_depleted_at: '2026-07-01T00:00:00.000Z' };

    expect([b, a].sort(compareOutOfStock)).toEqual([a, b]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/productSort.test.ts`
Expected: FAIL with "Cannot find module './productSort'"

- [ ] **Step 3: Implement the comparator**

Create `src/utils/productSort.ts`:

```ts
export interface StockSortable {
  sku: string;
  stock_depleted_at?: string | null;
}

/**
 * Comparator for the "Out of Stock" filter: most recently depleted first.
 * Products with no depletion timestamp (never tracked, or already out of
 * stock before this feature shipped) fall to the bottom, ordered by SKU.
 */
export function compareOutOfStock(a: StockSortable, b: StockSortable): number {
  const aTime = a.stock_depleted_at ? new Date(a.stock_depleted_at).getTime() : null;
  const bTime = b.stock_depleted_at ? new Date(b.stock_depleted_at).getTime() : null;

  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return bTime - aTime;
  }
  if (aTime !== null && bTime === null) return -1;
  if (aTime === null && bTime !== null) return 1;

  return a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/productSort.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire the comparator into `useProducts.ts`**

Add the import near the top of `src/hooks/useProducts.ts` (after the existing `expandSearchTerm` import):

```ts
import { expandSearchTerm } from '../utils/searchUtils';
import { compareOutOfStock } from '../utils/productSort';
```

Change the filtered-path sort (currently lines 170-175):

```ts
      } else {
        // Filtered path: Fetch all filtered items and sort in memory natural order
        const allFiltered = await collection.toArray();
        allFiltered.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));
        data = allFiltered.slice(offset, offset + pageSize);
      }
```

to:

```ts
      } else {
        // Filtered path: Fetch all filtered items and sort in memory
        const allFiltered = await collection.toArray();
        if (stockFilter === 'out_of_stock') {
          allFiltered.sort(compareOutOfStock);
        } else {
          allFiltered.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));
        }
        data = allFiltered.slice(offset, offset + pageSize);
      }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors

- [ ] **Step 7: Commit**

```bash
git add src/utils/productSort.ts src/utils/productSort.test.ts src/hooks/useProducts.ts
git commit -m "feat: sort Out of Stock list by most recently depleted"
```

---

### Task 4: Fix and extend the offline-optimistic stock write in POS.tsx

**Files:**
- Create: `src/utils/offlineStock.ts`
- Test: `src/utils/offlineStock.test.ts`
- Modify: `src/components/POS.tsx` (import near top; the "Optimization" block around lines 629-638)

**Interfaces:**
- Consumes: `ProductWithBatches`, `ProductBatch` (existing types, extended by Task 1).
- Produces: `applyOfflineDeduction(product, batchId, quantity): OfflineDeductionResult` — used by `POS.tsx`.

**Context:** The existing offline-sale block in `POS.tsx` updates only the `batches` field on the local Dexie product record — it never recomputes `total_stock`. Since `useProducts.ts`'s `out_of_stock` filter checks `total_stock === 0` (not the batches array), a product sold to zero while offline currently won't show up in the Out of Stock list at all until the next full sync. This task fixes that alongside adding the new timestamp, since both require the same "sum the updated batches" computation.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/offlineStock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyOfflineDeduction } from './offlineStock';
import type { ProductBatch, ProductWithBatches } from '../types';

function makeBatch(overrides: Partial<ProductBatch>): ProductBatch {
  return {
    id: 'b1',
    product_id: 'p1',
    batch_number: 'BATCH-1',
    purchase_order_id: null,
    supplier_id: 's1',
    cost_price: 10,
    selling_price: 20,
    markup_percentage: 100,
    initial_quantity: 5,
    current_quantity: 5,
    received_date: '2026-01-01',
    expiry_date: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ProductBatch;
}

function makeProduct(batches: ProductBatch[]): ProductWithBatches {
  return {
    id: 'p1',
    sku: 'SKU-1',
    barcode: null,
    name: 'Test Product',
    description: null,
    category: null,
    unit: 'pcs',
    reorder_level: 2,
    image_url: null,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    stock_depleted_at: null,
    batches,
    total_stock: batches.reduce((sum, b) => sum + b.current_quantity, 0),
  } as ProductWithBatches;
}

describe('applyOfflineDeduction', () => {
  it('recomputes total_stock and stamps stock_depleted_at when it reaches zero', () => {
    const product = makeProduct([makeBatch({ id: 'b1', current_quantity: 2 })]);

    const result = applyOfflineDeduction(product, 'b1', 2);

    expect(result.batches[0].current_quantity).toBe(0);
    expect(result.total_stock).toBe(0);
    expect(result.stock_depleted_at).toBeTypeOf('string');
  });

  it('leaves stock_depleted_at unset when other batches still have stock', () => {
    const product = makeProduct([
      makeBatch({ id: 'b1', current_quantity: 2 }),
      makeBatch({ id: 'b2', current_quantity: 3 }),
    ]);

    const result = applyOfflineDeduction(product, 'b1', 2);

    expect(result.total_stock).toBe(3);
    expect(result.stock_depleted_at).toBeUndefined();
  });

  it('only mutates the targeted batch', () => {
    const product = makeProduct([
      makeBatch({ id: 'b1', current_quantity: 2 }),
      makeBatch({ id: 'b2', current_quantity: 3 }),
    ]);

    const result = applyOfflineDeduction(product, 'b1', 2);

    expect(result.batches[1].current_quantity).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/offlineStock.test.ts`
Expected: FAIL with "Cannot find module './offlineStock'"

- [ ] **Step 3: Implement `applyOfflineDeduction`**

Create `src/utils/offlineStock.ts`:

```ts
import { ProductBatch, ProductWithBatches } from '../types';

export interface OfflineDeductionResult {
  batches: ProductBatch[];
  total_stock: number;
  stock_depleted_at?: string;
}

/**
 * Computes the local (offline) stock update for a single sold batch.
 * Used to optimistically update IndexedDB before an offline sale has
 * synced to the server, so the UI reflects the new stock level and,
 * if it reached zero, when that happened.
 */
export function applyOfflineDeduction(
  product: ProductWithBatches,
  batchId: string,
  quantity: number
): OfflineDeductionResult {
  const batches = product.batches.map(b =>
    b.id === batchId ? { ...b, current_quantity: b.current_quantity - quantity } : b
  );
  const total_stock = batches.reduce((sum, b) => sum + b.current_quantity, 0);

  const result: OfflineDeductionResult = { batches, total_stock };
  if (total_stock === 0) {
    result.stock_depleted_at = new Date().toISOString();
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/offlineStock.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire it into `POS.tsx`**

Add the import near the other utility imports at the top of `src/components/POS.tsx`:

```ts
import { applyOfflineDeduction } from '../utils/offlineStock';
```

Change the optimization block:

```ts
        // Optimization: Deduct stock from local IndexedDB immediately so offline search shows updated stock
        for (const item of cart.filter(i => !i.isManual)) {
          const product = await db.products.get(item.product.id);
          if (product) {
            const updatedBatches = product.batches.map(b =>
              b.id === item.batch.id ? { ...b, current_quantity: b.current_quantity - item.quantity } : b
            );
            await db.products.update(item.product.id, { batches: updatedBatches });
          }
        }
```

to:

```ts
        // Optimization: Deduct stock from local IndexedDB immediately so offline search shows updated stock
        for (const item of cart.filter(i => !i.isManual)) {
          const product = await db.products.get(item.product.id);
          if (product) {
            const update = applyOfflineDeduction(product, item.batch.id, item.quantity);
            await db.products.update(item.product.id, update);
          }
        }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors

- [ ] **Step 7: Commit**

```bash
git add src/utils/offlineStock.ts src/utils/offlineStock.test.ts src/components/POS.tsx
git commit -m "fix: recompute total_stock and mark depletion on offline sales"
```

---

### Task 5: Persist depletion server-side when an offline sale syncs

**Files:**
- Modify: `src/components/POS.tsx` (the offline sale payload, around lines 606-609)
- Modify: `src/services/SalesService.ts:625-659` (`syncOfflineSale`)
- Test: `src/services/SalesService.test.ts`

**Interfaces:**
- Consumes: `InventoryService.checkAndMarkDepletion` (Task 2, already public).
- Produces: nothing new consumed by later tasks — this is the last task.

**Context:** Today's offline-sale payload only carries `{ id, newQuantity }` per batch (`POS.tsx`), so `syncOfflineSale` has no way to know which product a batch belongs to. Without this, the depletion timestamp set locally in Task 4 would get silently overwritten by `null` the next time `useProducts.ts`'s `syncProducts` pulls fresh product rows down from Supabase.

- [ ] **Step 1: Write the failing test**

Create `src/services/SalesService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SalesService } from './SalesService';
import { SaleRepository } from '../repositories/SaleRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { InventoryService } from './InventoryService';
import type { DatabaseAdapter, QueryOptions, Transaction } from '../repositories/base/DatabaseAdapter';
import type { ProductBatch } from '../types';

class FakeAdapter implements DatabaseAdapter {
  batches: ProductBatch[];
  productUpdates: Array<{ id: string; data: any }> = [];

  constructor(batches: ProductBatch[]) {
    this.batches = batches;
  }

  async query<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    if (table === 'product_batches') {
      const where = options.where || [];
      let results = this.batches;
      for (const clause of where) {
        results = results.filter((b: any) => b[clause.field] === clause.value);
      }
      return results as unknown as T[];
    }
    return [];
  }

  async insert<T>(_table: string, data: Partial<T>): Promise<T> {
    return { id: 'generated-id', ...data } as unknown as T;
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    if (table === 'product_batches') {
      const batch = this.batches.find(b => b.id === id);
      if (batch) Object.assign(batch, data);
      return batch as unknown as T;
    }
    if (table === 'products') {
      this.productUpdates.push({ id, data });
      return data as unknown as T;
    }
    throw new Error(`unexpected update on ${table}`);
  }

  async delete(): Promise<void> {
    throw new Error('not implemented');
  }
  async raw<T>(): Promise<T[]> {
    throw new Error('not implemented');
  }
  async beginTransaction(): Promise<Transaction> {
    throw new Error('not implemented');
  }
}

function makeBatch(overrides: Partial<ProductBatch>): ProductBatch {
  return {
    id: 'b1',
    product_id: 'p1',
    batch_number: 'BATCH-1',
    purchase_order_id: null,
    supplier_id: 's1',
    cost_price: 10,
    selling_price: 20,
    markup_percentage: 100,
    initial_quantity: 5,
    current_quantity: 5,
    received_date: '2026-01-01',
    expiry_date: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ProductBatch;
}

describe('SalesService.syncOfflineSale', () => {
  it('marks the product depleted when the synced batch quantity reaches zero', async () => {
    const batch = makeBatch({ id: 'b1', product_id: 'p1', current_quantity: 2 });
    const adapter = new FakeAdapter([batch]);
    const saleRepo = new SaleRepository(adapter);
    const customerRepo = new CustomerRepository(adapter);
    const productRepo = new ProductRepository(adapter);
    const inventory = new InventoryService(productRepo, adapter);
    const salesService = new SalesService(saleRepo, customerRepo, productRepo, inventory);

    await salesService.syncOfflineSale({
      sale: { sale_number: 'SALE-OFFLINE-1', total_amount: 100, paid_amount: 100 },
      items: [],
      batches: [{ id: 'b1', product_id: 'p1', newQuantity: 0 }],
      customerCredit: null,
      commission: null,
    });

    expect(batch.current_quantity).toBe(0);
    expect(adapter.productUpdates).toHaveLength(1);
    expect(adapter.productUpdates[0].id).toBe('p1');
    expect(adapter.productUpdates[0].data.stock_depleted_at).toBeTypeOf('string');
  });

  it('does not mark depletion when the synced batch still has stock', async () => {
    const batch = makeBatch({ id: 'b1', product_id: 'p1', current_quantity: 5 });
    const adapter = new FakeAdapter([batch]);
    const saleRepo = new SaleRepository(adapter);
    const customerRepo = new CustomerRepository(adapter);
    const productRepo = new ProductRepository(adapter);
    const inventory = new InventoryService(productRepo, adapter);
    const salesService = new SalesService(saleRepo, customerRepo, productRepo, inventory);

    await salesService.syncOfflineSale({
      sale: { sale_number: 'SALE-OFFLINE-2', total_amount: 50, paid_amount: 50 },
      items: [],
      batches: [{ id: 'b1', product_id: 'p1', newQuantity: 3 }],
      customerCredit: null,
      commission: null,
    });

    expect(adapter.productUpdates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/SalesService.test.ts`
Expected: FAIL — both tests expect a `products` update; nothing writes to `products` yet since `syncOfflineSale` doesn't call `checkAndMarkDepletion`.

- [ ] **Step 3: Add `product_id` to the offline sale payload in `POS.tsx`**

Change:

```ts
          batches: cart.filter(i => !i.isManual).map(item => ({
            id: item.batch.id,
            newQuantity: item.batch.current_quantity - item.quantity
          })),
```

to:

```ts
          batches: cart.filter(i => !i.isManual).map(item => ({
            id: item.batch.id,
            product_id: item.product.id,
            newQuantity: item.batch.current_quantity - item.quantity
          })),
```

- [ ] **Step 4: Call `checkAndMarkDepletion` during sync in `SalesService.ts`**

Change:

```ts
            // 2. Update Batches (Stock)
            if (batches && Array.isArray(batches)) {
                for (const b of batches) {
                    await this.productRepo.updateStock(b.id, b.newQuantity);
                }
            }
```

to:

```ts
            // 2. Update Batches (Stock)
            if (batches && Array.isArray(batches)) {
                for (const b of batches) {
                    await this.productRepo.updateStock(b.id, b.newQuantity);
                    if (b.product_id) {
                        await this.inventoryRepo.checkAndMarkDepletion(b.product_id);
                    }
                }
            }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/SalesService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test`
Expected: all tests pass, including the pre-existing `ProductRepository.test.ts` and the new files from Tasks 2-5.

Run: `npm run typecheck`
Expected: passes with no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/POS.tsx src/services/SalesService.ts src/services/SalesService.test.ts
git commit -m "feat: persist stock depletion timestamp when offline sales sync"
```
