import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductDetailsViewProps {
  product: ProductWithStock;
  onClose: () => void;
}

export function ProductDetailsView({ product, onClose }: ProductDetailsViewProps) {
  return (
    <div className="p-6">
      {product.image_url && (
        <div className="mb-6 flex justify-center">
          <ProductImage
            imageUrl={product.image_url}
            alt={product.name}
            size="xl"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-slate-500">Product Name</p>
          <p className="font-medium text-slate-900">{product.name}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">SKU</p>
          <p className="font-medium text-slate-900">{product.sku}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Barcode</p>
          <p className="font-medium text-slate-900">{product.barcode || '-'}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Category</p>
          <p className="font-medium text-slate-900">{product.category || '-'}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Total Stock</p>
          <p className="font-medium text-slate-900">{product.total_stock}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Unit</p>
          <p className="font-medium text-slate-900">{product.unit}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Reorder Level</p>
          <p className="font-medium text-slate-900">{product.reorder_level}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Status</p>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              product.total_stock <= product.reorder_level
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {product.total_stock <= product.reorder_level ? 'Low Stock' : 'In Stock'}
          </span>
        </div>
        {product.description && (
          <div className="col-span-2">
            <p className="text-sm text-slate-500">Description</p>
            <p className="font-medium text-slate-900">{product.description}</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h4 className="font-semibold text-slate-900 mb-4">Stock Batches ({product.batches.length})</h4>
        <div className="space-y-3">
          {product.batches.map((batch) => (
            <div key={batch.id} className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-slate-900">Batch: {batch.batch_number}</p>
                  <p className="text-sm text-slate-500">
                    Received: {new Date(batch.received_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">{batch.current_quantity} units</p>
                  <p className="text-sm text-slate-500">
                    LKR {batch.selling_price.toFixed(2)}
                  </p>
                </div>
              </div>
              {batch.expiry_date && (
                <p className="text-sm text-slate-500">
                  Expires: {new Date(batch.expiry_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
          {product.batches.length === 0 && (
            <p className="text-slate-500 text-center py-4">No batches available</p>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-6 pt-6 border-t border-slate-200">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
