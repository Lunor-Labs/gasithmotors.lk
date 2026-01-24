import { Plus } from 'lucide-react';
import { ProductWithBatches } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductGridProps {
  products: ProductWithBatches[];
  onAddToCart: (product: ProductWithBatches) => void;
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No products available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => {
        const totalStock = product.batches.reduce((sum, b) => sum + b.current_quantity, 0);
        const lowestPrice = product.batches.length > 0
          ? Math.min(...product.batches.map(b => b.selling_price))
          : 0;

        return (
          <div
            key={product.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition group"
          >
            <div className="aspect-square relative">
              <ProductImage
                imageUrl={product.image_url}
                alt={product.name}
                size="lg"
                className="w-full h-full"
              />
              <button
                onClick={() => onAddToCart(product)}
                disabled={totalStock === 0}
                className={`absolute bottom-2 right-2 p-2 rounded-full shadow-lg transition ${totalStock === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                  } opacity-0 group-hover:opacity-100`}
                title={totalStock === 0 ? 'Out of stock' : 'Add to cart'}
              >
                <Plus className="w-5 h-5" />
              </button>
              {totalStock === 0 && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="font-medium text-slate-900 text-sm mb-1 truncate" title={product.name}>
                {product.name}
              </h4>
              <p className="text-xs text-slate-500 mb-2 truncate">
                SKU: {product.sku}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  LKR {lowestPrice.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  Stock: {totalStock}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
