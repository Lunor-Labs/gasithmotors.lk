import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';
import { Plus } from 'lucide-react';

interface ProductDetailsViewProps {
  product: ProductWithStock;
  onClose: () => void;
  onUpdate?: () => void;
  defaultShowAddStock?: boolean;
}

export function ProductDetailsView({ product, onClose, onUpdate, defaultShowAddStock = false }: ProductDetailsViewProps) {
  const [showAddStock, setShowAddStock] = useState(defaultShowAddStock);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stockFormData, setStockFormData] = useState({
    supplier_id: '',
    quantity: 0,
    cost_price: 0,
    selling_price: 0,
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id, name').eq('active', true).order('name');
    setSuppliers(data || []);
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    try {
      const batchNumber = `ADD-${product.sku}-${new Date().getTime().toString().slice(-4)}`;
      const { error } = await supabase.from('product_batches').insert({
        product_id: product.id,
        batch_number: batchNumber,
        supplier_id: stockFormData.supplier_id,
        cost_price: stockFormData.cost_price,
        selling_price: stockFormData.selling_price,
        initial_quantity: stockFormData.quantity,
        current_quantity: stockFormData.quantity,
        received_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      alert('Stock added successfully!');
      setShowAddStock(false);
      setStockFormData({
        supplier_id: '',
        quantity: 0,
        cost_price: 0,
        selling_price: 0,
      });
      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message);
    }
  }

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
          <p className="font-medium text-slate-900 font-bold text-lg text-emerald-600">{product.total_stock}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Unit</p>
          <p className="font-medium text-slate-900">{product.unit}</p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-slate-900">Stock Batches ({product.batches.length})</h4>
          <button
            onClick={() => setShowAddStock(!showAddStock)}
            className="flex items-center gap-1 text-sm font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <Plus className="w-4 h-4" />
            {showAddStock ? 'Cancel' : 'Add Stock'}
          </button>
        </div>

        {showAddStock && (
          <form onSubmit={handleAddStock} className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                <select
                  required
                  value={stockFormData.supplier_id}
                  onChange={(e) => setStockFormData({ ...stockFormData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={stockFormData.quantity || ''}
                  onChange={(e) => setStockFormData({ ...stockFormData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cost (LKR)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={stockFormData.cost_price || ''}
                  onChange={(e) => setStockFormData({ ...stockFormData, cost_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Selling (LKR)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={stockFormData.selling_price || ''}
                  onChange={(e) => setStockFormData({ ...stockFormData, selling_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition"
                >
                  Confirm Stock Intake
                </button>
              </div>
            </div>
          </form>
        )}

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
            </div>
          ))}
          {product.batches.length === 0 && !showAddStock && (
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
