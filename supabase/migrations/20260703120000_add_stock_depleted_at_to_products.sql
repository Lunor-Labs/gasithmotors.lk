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
