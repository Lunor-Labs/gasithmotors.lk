import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ProductWithStock } from '../types';

export function useProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery: string = ''
) {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);

      // Calculate range for pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('active', true);

      // Apply search filter if provided
      if (searchQuery) {
        // search by name, sku, or barcode
        query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`);
      }

      // Apply sorting and pagination
      const { data: productsData, error: productsError, count } = await query
        .order('name')
        .range(from, to);

      if (productsError) throw productsError;

      setTotalCount(count || 0);

      const productsWithStock = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: batches } = await supabase
            .from('product_batches')
            .select('*, supplier:supplier_id(name)')
            .eq('product_id', product.id)
            .order('received_date', { ascending: false });

          const total_stock = batches?.reduce((sum, batch) => sum + batch.current_quantity, 0) || 0;

          return {
            ...product,
            batches: batches || [],
            total_stock,
          };
        })
      );

      setProducts(productsWithStock);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMessage);
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [page, pageSize, searchQuery]);

  return {
    products,
    loading,
    error,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    refetch: loadProducts,
  };
}
