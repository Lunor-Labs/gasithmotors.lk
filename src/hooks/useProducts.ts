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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  // Sync Products from Supabase to IndexedDB
  const syncProducts = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      setSyncStatus('syncing');

      const CHUNK_SIZE = 1000;

      // 1. Fetch all active products in chunks
      let allProducts: any[] = [];
      let hasMoreProducts = true;
      let fromProduct = 0;

      while (hasMoreProducts) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .range(fromProduct, fromProduct + CHUNK_SIZE - 1);

        if (productsError) throw productsError;
        const products = productsData || [];
        allProducts = [...allProducts, ...products];

        if (products.length < CHUNK_SIZE) {
          hasMoreProducts = false;
        } else {
          fromProduct += CHUNK_SIZE;
        }
      }

      // 2. Fetch all batches in chunks
      let allBatches: any[] = [];
      let hasMoreBatches = true;
      let fromBatch = 0;

      while (hasMoreBatches) {
        const { data: batchesData, error: batchesError } = await (supabase
          .from('product_batches') as any)
          .select('*, supplier:suppliers(name)')
          .range(fromBatch, fromBatch + CHUNK_SIZE - 1);

        if (batchesError) throw batchesError;
        const batches = (batchesData || []) as any[];
        allBatches = [...allBatches, ...batches];

        if (batches.length < CHUNK_SIZE) {
          hasMoreBatches = false;
        } else {
          fromBatch += CHUNK_SIZE;
        }
      }

      // 3. Merge Batches into Products
      const productsWithBatches: ProductWithBatches[] = allProducts.map(product => {
        const productBatches = allBatches
          .filter(b => b.product_id === product.id)
          .sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime());

        const totalStock = productBatches.reduce((sum, b) => sum + (b.current_quantity || 0), 0);

        return {
          ...product,
          batches: productBatches,
          total_stock: totalStock,
        };
      });

      // 4. Update IndexedDB - Clear first to remove any inactive products
      await db.products.clear();
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
    const checkInitialLoad = async () => {
      const count = await db.products.count();
      if (count === 0) {
        setLoading(true);
      }
      await syncProducts();
      setLoading(false);
    };
    checkInitialLoad();
  }, [syncProducts]);

  // Query Local Database
  const queryResult = useLiveQuery(async () => {
    try {
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
                (typeof p.barcode === 'string' && p.barcode.includes(query))
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
