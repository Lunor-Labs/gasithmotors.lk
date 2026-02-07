import { useState, useEffect, useCallback } from 'react';
import { ProductWithBatches } from '../types';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { productService } from '../services';
import { logger } from '../lib/logger';

export type SearchType = 'all' | 'name' | 'sku' | 'barcode';
export type StockFilter = 'all' | 'low_stock' | 'out_of_stock';

/**
 * Hook for managing products with offline support
 * Uses ProductService for data access and IndexedDB for offline caching
 */
export function useProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery: string = '',
  searchType: SearchType = 'all',
  stockFilter: StockFilter = 'all'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  /**
   * Sync products from database to IndexedDB for offline use
   */
  const syncProducts = useCallback(async () => {
    if (!navigator.onLine) {
      logger.debug('Skipping sync - offline');
      return;
    }

    try {
      setSyncStatus('syncing');
      logger.info('Starting product sync');

      // Use ProductService to fetch all products
      const products = await productService.getAllProducts();

      // Convert to ProductWithBatches format for IndexedDB
      const productsWithBatches: ProductWithBatches[] = products.map(product => ({
        ...product,
        batches: product.batches || [],
        total_stock: product.total_stock || 0,
      }));

      // Update IndexedDB - clear first to remove inactive products
      await db.products.clear();
      await db.products.bulkPut(productsWithBatches);

      setSyncStatus('idle');
      logger.info('Product sync completed', { count: products.length });
    } catch (err) {
      logger.error('Product sync failed', err as Error);
      setSyncStatus('error');
      setError('Sync failed, but you can still use offline data.');
    }
  }, []);

  /**
   * Initial sync on mount
   */
  useEffect(() => {
    const checkInitialLoad = async () => {
      const count = await db.products.count();
      if (count === 0) {
        setLoading(true);
        logger.info('No cached products, performing initial sync');
      }
      await syncProducts();
      setLoading(false);
    };
    checkInitialLoad();
  }, [syncProducts]);

  /**
   * Query local IndexedDB with live updates
   */
  const queryResult = useLiveQuery(async () => {
    try {
      let collection = db.products.toCollection();

      // Apply search filters
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();

        switch (searchType) {
          case 'sku':
            collection = db.products.filter(p => p.sku.toLowerCase() === query);
            break;
          case 'barcode':
            collection = db.products.where('barcode').equals(query);
            break;
          case 'name':
            collection = db.products.filter(p => {
              const words = query.split(/\s+/);
              // Original multi-word AND search
              const multiWordMatch = words.every(word => p.name.toLowerCase().includes(word));
              if (multiWordMatch) return true;

              // Fallback: Space-insensitive normalization check
              const normalizedName = p.name.toLowerCase().replace(/\s+/g, '');
              const normalizedQuery = query.replace(/\s+/g, '');
              return normalizedName.includes(normalizedQuery);
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
                p.sku.toLowerCase() === query ||
                (typeof p.barcode === 'string' && p.barcode.includes(query)) ||
                // Fallback: Space-insensitive normalization check for single word
                p.name.toLowerCase().replace(/\s+/g, '').includes(query.replace(/\s+/g, ''))
              );
            }
            break;
        }
      }

      // Apply stock status filters
      if (stockFilter === 'low_stock') {
        collection = collection.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= (p.reorder_level || 0));
      } else if (stockFilter === 'out_of_stock') {
        collection = collection.filter(p => (p.total_stock || 0) === 0);
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
      logger.error('Local product query failed', err as Error);
      return { products: [], totalCount: 0 };
    }
  }, [page, pageSize, searchQuery, searchType, stockFilter]);

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
