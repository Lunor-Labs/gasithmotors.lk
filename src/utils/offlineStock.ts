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
