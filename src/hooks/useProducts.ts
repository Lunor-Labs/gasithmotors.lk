import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ProductWithBatches } from '../types';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export type SearchType = 'all' | 'name' | 'sku' | 'barcode';

export function useProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery: string = '',
  searchType: SearchType = 'all'
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  // Sync Products from Supabase to IndexedDB
  const syncProducts = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      setSyncStatus('syncing');

      // 1. Fetch all active products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true);

      if (productsError) throw productsError;
      const products = productsData || [];

      // 2. Fetch all batches that have stock or belong to active products
      const { data: batchesData, error: batchesError } = await supabase
        .from('product_batches')
        .select('*, supplier:suppliers(name)');

      if (batchesError) throw batchesError;
      const batches = (batchesData || []) as any[];

      // 3. Merge Batches into Products
      const productsWithBatches: ProductWithBatches[] = products.map(product => {
        const productBatches = batches
          .filter(b => b.product_id === product.id)
          .sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime());

        return {
          ...product,
          batches: productBatches,
        };
      });

      // 4. Update IndexedDB
      await db.products.bulkPut(productsWithBatches);

      setSyncStatus('idle');
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatus('error');
      setError('Sync failed, but you can still use offline data.');
    }
  }, []);

  // Initial Sync on Mount
  useEffect(() => {
    syncProducts();
  }, [syncProducts]);

  // Query Local Database
  const queryResult = useLiveQuery(async () => {
    try {
      setLoading(true);
      let collection = db.products.toCollection();

      // Apply Search Filters
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();

        switch (searchType) {
          case 'sku':
            collection = db.products.where('sku').startsWithIgnoreCase(query);
            break;
          case 'barcode':
            collection = db.products.where('barcode').equals(query);
            break;
          case 'name':
            collection = db.products.filter(p => {
              const words = query.split(/\s+/);
              return words.every(word => p.name.toLowerCase().includes(word));
            });
            break;
          case 'all':
          default:
            if (query.includes(' ')) {
              collection = db.products.filter(p => {
                const words = query.split(/\s+/);
                return words.every(word => p.name.toLowerCase().includes(word));
              });
            } else {
              collection = db.products.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.sku.toLowerCase().includes(query) ||
                (p.barcode && p.barcode.includes(query))
              );
            }
            break;
        }
      }

      // Pagination
      const count = await collection.count();
      const offset = (page - 1) * pageSize;
      const data = await collection
        .offset(offset)
        .limit(pageSize)
        .toArray();

      return { products: data, totalCount: count };
    } catch (err) {
      console.error('Local query failed:', err);
      return { products: [], totalCount: 0 };
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, searchType]);

  return {
    products: queryResult?.products || [],
    loading,
    error,
    totalCount: queryResult?.totalCount || 0,
    totalPages: Math.ceil((queryResult?.totalCount || 0) / pageSize),
    refetch: syncProducts,
    syncStatus
  };
}
