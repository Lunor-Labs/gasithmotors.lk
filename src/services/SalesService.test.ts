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
