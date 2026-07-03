import { describe, it, expect } from 'vitest';
import { ProductRepository } from './ProductRepository';
import type { DatabaseAdapter, QueryOptions, Transaction } from './base/DatabaseAdapter';

/**
 * Simulates Postgres's real pagination behavior: when an ORDER BY has ties
 * (same received_date) and no unique tiebreaker, separate query executions
 * are not guaranteed to resolve ties the same way. This adapter reproduces
 * that by flipping tie order on alternating calls for the same query shape,
 * unless the orderBy fully disambiguates ties (includes `id`).
 */
class TieBreakSimulatingAdapter implements DatabaseAdapter {
  private callCounts = new Map<string, number>();

  constructor(
    private products: Array<{ id: string; sku: string; active: boolean }>,
    private batches: Array<{ id: string; product_id: string; received_date: string; current_quantity: number }>
  ) {}

  async query<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    const offset = options.offset || 0;
    const limit = options.limit ?? Number.MAX_SAFE_INTEGER;

    if (table === 'products') {
      return this.products.slice(offset, offset + limit) as unknown as T[];
    }

    if (table === 'product_batches') {
      const orderFields = (options.orderBy || []).map((o) => o.field);
      const hasIdTiebreak = orderFields.includes('id');

      const key = orderFields.join(',');
      const callNum = (this.callCounts.get(key) || 0) + 1;
      this.callCounts.set(key, callNum);

      const sorted = [...this.batches].sort((a, b) => {
        const dateCmp = b.received_date.localeCompare(a.received_date);
        if (dateCmp !== 0) return dateCmp;
        if (hasIdTiebreak) return a.id.localeCompare(b.id);
        const tieDirection = callNum % 2 === 1 ? 1 : -1;
        return tieDirection * a.id.localeCompare(b.id);
      });

      return sorted.slice(offset, offset + limit) as unknown as T[];
    }

    return [];
  }

  async insert<T>(): Promise<T> {
    throw new Error('not implemented');
  }
  async update<T>(): Promise<T> {
    throw new Error('not implemented');
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

function buildFixture() {
  const products = [{ id: 'p1', sku: 'SKU-TEST', active: true }];
  // 1200 batches, all sharing one received_date, for a single product.
  // Total exceeds the repository's 1000-row chunk size, so fetching them
  // requires two separate paginated requests.
  // Distinct quantities per batch: if pagination drops some batches and
  // duplicates others, the sum will differ from the true total instead of
  // accidentally cancelling out (which a uniform quantity would mask).
  const batches = Array.from({ length: 1200 }, (_, i) => ({
    id: `b${String(i).padStart(4, '0')}`,
    product_id: 'p1',
    received_date: '2026-01-31',
    current_quantity: i + 1,
  }));
  return { products, batches };
}

describe('ProductRepository.findAllWithStock', () => {
  it('includes every batch even when many share received_date and total exceeds the chunk size', async () => {
    const { products, batches } = buildFixture();
    const adapter = new TieBreakSimulatingAdapter(products, batches);
    const repo = new ProductRepository(adapter);

    const result = await repo.findAllWithStock();

    const expectedTotal = batches.reduce((sum, b) => sum + b.current_quantity, 0);
    expect(result).toHaveLength(1);
    expect(result[0].total_stock).toBe(expectedTotal);
  });
});
