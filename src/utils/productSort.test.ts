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
