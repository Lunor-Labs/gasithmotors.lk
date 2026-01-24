import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ProductWithStock } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

      if (productsError) throw productsError;

      const productsWithStock = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: batches } = await supabase
            .from('product_batches')
            .select('*')
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
  }, []);

  return {
    products,
    loading,
    error,
    refetch: loadProducts,
  };
}
