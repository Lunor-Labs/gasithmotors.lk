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
