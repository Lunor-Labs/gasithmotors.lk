import { Plus, Minus, Trash2, Tag } from 'lucide-react';
import { CartItem } from '../../types';
import { ProductImage } from '../ProductImage';

interface CartItemsListProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, change: number) => void;
  onUpdatePrice?: (index: number, newPrice: number) => void;
  onUpdateWarranty?: (index: number, warranty: { duration: number; unit: 'days' | 'months' | 'years'; type: string }) => void;
  onRemoveItem: (index: number) => void;
}

export function CartItemsList({ items, onUpdateQuantity, onUpdatePrice, onUpdateWarranty, onRemoveItem }: CartItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className={`border rounded-lg p-4 ${item.isManual ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="flex items-start gap-3 flex-1">
              {item.isManual ? (
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-4 h-4 text-amber-600" />
                </div>
              ) : (
                <ProductImage
                  imageUrl={item.product.image_url}
                  alt={item.product.name}
                  size="sm"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium text-slate-900">
                    {item.isManual ? item.manualDescription : item.product.name}
                  </p>
                  {item.isManual && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Manual
                    </span>
                  )}
                </div>
                {!item.isManual && (
                  <p className="text-xs text-slate-500">
                    Batch: {item.batch.batch_number} • LKR {item.batch.selling_price.toFixed(2)} each
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => onRemoveItem(index)}
              className="p-1 hover:bg-red-50 rounded transition"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>

          {/* Warranty Section — only for regular product items */}
          {!item.isManual && (
            <div className="mb-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100/50">
              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1 px-1">Warranty Info</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.warranty_duration || ''}
                  onChange={(e) => onUpdateWarranty && onUpdateWarranty(index, {
                    duration: parseInt(e.target.value) || 0,
                    unit: item.warranty_unit || 'months',
                    type: item.warranty_type || ''
                  })}
                  className="w-14 px-1 py-1 border border-blue-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <select
                  value={item.warranty_unit || 'months'}
                  onChange={(e) => onUpdateWarranty && onUpdateWarranty(index, {
                    duration: item.warranty_duration || 0,
                    unit: e.target.value as any,
                    type: item.warranty_type || ''
                  })}
                  className="w-20 px-1 py-1 border border-blue-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
                <input
                  type="text"
                  placeholder="Type (e.g. Shop)"
                  value={item.warranty_type || ''}
                  onChange={(e) => onUpdateWarranty && onUpdateWarranty(index, {
                    duration: item.warranty_duration || 0,
                    unit: item.warranty_unit || 'months',
                    type: e.target.value
                  })}
                  className="flex-1 min-w-0 px-2 py-1 border border-blue-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateQuantity(index, -1)}
                className="p-1 bg-slate-100 hover:bg-slate-200 rounded transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(index, 1)}
                className="p-1 bg-slate-100 hover:bg-slate-200 rounded transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-slate-600 text-xs">Unit:</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => onUpdatePrice && onUpdatePrice(index, parseFloat(e.target.value) || 0)}
                  className="w-20 text-right px-1 py-0.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>
              {item.price < item.original_price && (
                <p className="text-xs text-slate-400 line-through text-right mt-0.5">
                  LKR {item.original_price.toFixed(2)}
                </p>
              )}
              <p className="font-bold text-slate-900 mt-0.5">
                LKR {(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
