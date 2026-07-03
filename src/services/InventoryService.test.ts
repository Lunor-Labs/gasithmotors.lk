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
