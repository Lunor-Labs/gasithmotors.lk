import { useState, useEffect, useCallback } from 'react';
import { ProductWithBatches } from '../types';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { productService } from '../services';
import { logger } from '../lib/logger';
import { expandSearchTerm } from '../utils/searchUtils';

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
        // Expand search term to include synonyms
        const expandedTerms = expandSearchTerm(query);

        switch (searchType) {
          case 'sku':
            collection = db.products.filter(p => p.sku.toLowerCase() === query);
            break;
          case 'barcode':
            collection = db.products.where('barcode').equals(query);
            break;
          case 'name':
            collection = db.products.filter(p => {
              // Check if ANY of the expanded terms match the product name
              return expandedTerms.some(term => {
                // Multi-word check for each expanded term
                const words = term.split(/\s+/);
                const match = words.every(word => p.name.toLowerCase().includes(word));
                if (match) return true;

                // Fallback: Space-insensitive check
                const normalizedName = p.name.toLowerCase().replace(/\s+/g, '');
                const normalizedTerm = term.replace(/\s+/g, '');
                return normalizedName.includes(normalizedTerm);
              });
            });
            break;
          case 'all':
          default:
            collection = db.products.filter(p => {
              // Check synonyms against name
              const nameMatch = expandedTerms.some(term => {
                const words = term.split(/\s+/);
                return words.every(word => p.name.toLowerCase().includes(word));
              });

              if (nameMatch) return true;

              return p.sku.toLowerCase() === query ||
                (typeof p.barcode === 'string' && p.barcode.includes(query)) ||
                // Fallback: Space-insensitive normalization check
                p.name.toLowerCase().replace(/\s+/g, '').includes(query.replace(/\s+/g, ''));
            });
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
