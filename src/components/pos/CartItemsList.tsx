import { Plus, Minus, Trash2 } from 'lucide-react';
import { CartItem } from '../../types';
import { ProductImage } from '../ProductImage';

interface CartItemsListProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, change: number) => void;
  onRemoveItem: (index: number) => void;
}

export function CartItemsList({ items, onUpdateQuantity, onRemoveItem }: CartItemsListProps) {
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
        <div key={index} className="border border-slate-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="flex items-start gap-3 flex-1">
              <ProductImage
                imageUrl={item.product.image_url}
                alt={item.product.name}
                size="sm"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{item.product.name}</p>
                <p className="text-xs text-slate-500">
                  Batch: {item.batch.batch_number} • LKR {item.batch.selling_price.toFixed(2)} each
                </p>
              </div>
            </div>
            <button
              onClick={() => onRemoveItem(index)}
              className="p-1 hover:bg-red-50 rounded transition"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
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
            <p className="font-bold text-slate-900">
              LKR {(item.batch.selling_price * item.quantity).toFixed(2)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
