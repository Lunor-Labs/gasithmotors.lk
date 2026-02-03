import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { Product, ProductBatch, ProductWithStock } from '../types';

/**
 * Repository for Product-related database operations
 */
export class ProductRepository extends BaseRepository<Product> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'products');
    }

    /**
     * Find all products with their stock batches
     */
    async findAllWithStock(): Promise<ProductWithStock[]> {
        // This requires a complex join - we'll use the adapter's query method
        // For now, we'll fetch products and batches separately
        const products = await this.findAll({ active: true });

        const productsWithStock = await Promise.all(
            products.map(async (product) => {
                const batches = await this.findBatchesByProductId(product.id);
                const total_stock = batches.reduce((sum, batch) => sum + batch.current_quantity, 0);

                return {
                    ...product,
                    batches,
                    total_stock,
                } as ProductWithStock;
            })
        );

        return productsWithStock;
    }

    /**
     * Find a product with its batches
     */
    async findByIdWithStock(id: string): Promise<ProductWithStock | null> {
        const product = await this.findById(id);
        if (!product) return null;

        const batches = await this.findBatchesByProductId(id);
        const total_stock = batches.reduce((sum, batch) => sum + batch.current_quantity, 0);

        return {
            ...product,
            batches,
            total_stock,
        } as ProductWithStock;
    }

    /**
     * Find product by SKU
     */
    async findBySku(sku: string): Promise<Product | null> {
        const results = await this.query({
            where: [{ field: 'sku', operator: '=', value: sku }],
            limit: 1,
        });

        return results[0] || null;
    }

    /**
     * Find product by barcode
     */
    async findByBarcode(barcode: string): Promise<Product | null> {
        const results = await this.query({
            where: [{ field: 'barcode', operator: '=', value: barcode }],
            limit: 1,
        });

        return results[0] || null;
    }

    /**
     * Search products by name
     */
    async searchByName(searchTerm: string): Promise<Product[]> {
        return this.query({
            where: [
                { field: 'name', operator: 'like', value: searchTerm },
                { field: 'active', operator: '=', value: true },
            ],
        });
    }

    /**
     * Find batches for a product
     */
    private async findBatchesByProductId(productId: string): Promise<ProductBatch[]> {
        return this.adapter.query<ProductBatch>('product_batches', {
            where: [{ field: 'product_id', operator: '=', value: productId }],
            orderBy: [{ field: 'received_date', direction: 'desc' }],
        });
    }

    /**
     * Get low stock products
     */
    async findLowStock(threshold: number = 10): Promise<ProductWithStock[]> {
        const allProducts = await this.findAllWithStock();
        return allProducts.filter(p => p.total_stock <= threshold);
    }

    /**
     * Update product stock (via batch)
     */
    async updateStock(batchId: string, quantity: number): Promise<void> {
        await this.adapter.update('product_batches', batchId, {
            current_quantity: quantity,
        });
    }
}
