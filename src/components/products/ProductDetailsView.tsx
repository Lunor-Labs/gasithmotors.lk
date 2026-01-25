import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';
import { Plus } from 'lucide-react';
import { SupplierForm } from '../suppliers/SupplierForm';

interface ProductDetailsViewProps {
  product: ProductWithStock;
  onClose: () => void;
  onUpdate?: () => void;
  defaultShowAddStock?: boolean;
}

export function ProductDetailsView({ product, onClose, onUpdate, defaultShowAddStock = false }: ProductDetailsViewProps) {
  const [showAddStock, setShowAddStock] = useState(defaultShowAddStock);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    supplier_id: '',
    quantity: 0,
    cost_price: 0,
    markup_percentage: 0,
    selling_price: 0,
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id, name').eq('active', true).order('name');
    setSuppliers(data || []);
  }

  const handleQuickAddSupplier = async (data: any) => {
    try {
      const { data: newSupplier, error } = await supabase
        .from('suppliers')
        .insert({
          name: data.name,
          contact_person: data.contact_person || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      await loadSuppliers();
      setStockFormData({ ...stockFormData, supplier_id: (newSupplier as any).id });
      setShowQuickAddSupplier(false);
    } catch (error: any) {
      alert('Error adding supplier: ' + error.message);
    }
  };

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    try {
      const batchNumber = `ADD-${product.sku}-${new Date().getTime().toString().slice(-4)}`;
      const { error } = await supabase.from('product_batches').insert({
        product_id: product.id,
        batch_number: batchNumber,
        supplier_id: stockFormData.supplier_id,
        cost_price: stockFormData.cost_price,
        markup_percentage: stockFormData.markup_percentage,
        selling_price: stockFormData.selling_price,
        initial_quantity: stockFormData.quantity,
        current_quantity: stockFormData.quantity,
        received_date: new Date().toISOString().split('T')[0],
      } as any);

      if (error) throw error;

      alert('Stock added successfully!');
      setShowAddStock(false);
      setStockFormData({
        supplier_id: '',
        quantity: 0,
        cost_price: 0,
        markup_percentage: 0,
        selling_price: 0,
      });
      if (onUpdate) onUpdate();
    } catch (error: any) {
      alert(error.message);
    }
  }

  return (
    <>
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
                  <div className="flex gap-2">
                    <select
                      required
                      value={stockFormData.supplier_id}
                      onChange={(e) => setStockFormData({ ...stockFormData, supplier_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddSupplier(true)}
                      className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                      title="Add new supplier"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
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
                    onChange={(e) => {
                      const cost = parseFloat(e.target.value) || 0;
                      const markup = stockFormData.markup_percentage || 0;
                      const selling = cost * (1 + markup / 100);
                      setStockFormData({ ...stockFormData, cost_price: cost, selling_price: parseFloat(selling.toFixed(2)) });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Markup (%)</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={stockFormData.markup_percentage || ''}
                    onChange={(e) => {
                      const markup = parseFloat(e.target.value) || 0;
                      const cost = stockFormData.cost_price || 0;
                      const selling = cost * (1 + markup / 100);
                      setStockFormData({ ...stockFormData, markup_percentage: markup, selling_price: parseFloat(selling.toFixed(2)) });
                    }}
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
                    onChange={(e) => {
                      const selling = parseFloat(e.target.value) || 0;
                      const cost = stockFormData.cost_price || 0;
                      const markup = cost > 0 ? ((selling - cost) / cost) * 100 : 0;
                      setStockFormData({ ...stockFormData, selling_price: selling, markup_percentage: parseFloat(markup.toFixed(2)) });
                    }}
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

      {showQuickAddSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 text-left font-normal">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Quick Add Supplier</h3>
            </div>
            <SupplierForm
              mode="add"
              onSubmit={handleQuickAddSupplier}
              onCancel={() => setShowQuickAddSupplier(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
