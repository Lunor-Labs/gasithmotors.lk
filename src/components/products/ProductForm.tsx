import { PRODUCT_UNITS } from '../../utils/constants';

interface ProductFormData {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  reorder_level: number;
  image_url: string;
  // Initial stock fields
  initial_quantity?: number;
  cost_price?: number;
  selling_price?: number;
  supplier_id?: string;
}

interface ProductFormProps {
  formData: ProductFormData;
  onChange: (data: ProductFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  mode: 'add' | 'edit';
  scanningBarcode: boolean;
  onStartBarcodeScanning: () => void;
  suppliers: any[];
}

export function ProductForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  mode,
  scanningBarcode,
  onStartBarcodeScanning,
  suppliers,
}: ProductFormProps) {
  return (
    <form onSubmit={onSubmit} className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            SKU <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.sku}
            onChange={(e) => onChange({ ...formData, sku: e.target.value })}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Barcode
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => onChange({ ...formData, barcode: e.target.value })}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              placeholder={scanningBarcode ? 'Scan barcode...' : ''}
            />
            <button
              type="button"
              onClick={onStartBarcodeScanning}
              className={`px-4 py-2 rounded-lg transition ${scanningBarcode
                ? 'bg-green-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              {scanningBarcode ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Image URL
          </label>
          <input
            type="url"
            value={formData.image_url}
            onChange={(e) => onChange({ ...formData, image_url: e.target.value })}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
          />
          {formData.image_url && (
            <div className="mt-2">
              <img
                src={formData.image_url}
                alt="Product preview"
                className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Category
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) => onChange({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            placeholder="e.g., Engine Parts, Filters, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Unit
          </label>
          <select
            value={formData.unit}
            onChange={(e) => onChange({ ...formData, unit: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
          >
            {PRODUCT_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reorder Level
          </label>
          <input
            type="number"
            value={formData.reorder_level}
            onChange={(e) => onChange({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
            min="0"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {mode === 'add' && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <h4 className="text-lg font-bold text-slate-900 mb-4">Initial Stock Intake (Optional)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Supplier
              </label>
              <select
                value={formData.supplier_id || ''}
                onChange={(e) => onChange({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Initial Quantity
              </label>
              <input
                type="number"
                value={formData.initial_quantity || ''}
                onChange={(e) => onChange({ ...formData, initial_quantity: parseInt(e.target.value) || 0 })}
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cost Price (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_price || ''}
                onChange={(e) => onChange({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                min="0"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Selling Price (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.selling_price || ''}
                onChange={(e) => onChange({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                min="0"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 italic">
            * Filling this section will automatically create the first stock batch for this product.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          {mode === 'add' ? 'Add Product' : 'Update Product'}
        </button>
      </div>
    </form>
  );
}
