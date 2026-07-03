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
