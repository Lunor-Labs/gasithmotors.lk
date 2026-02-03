import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Eye, FileText, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface POWithDetails extends PurchaseOrder {
  supplier: Supplier | null;
  items: (PurchaseOrderItem & { product: Product | null })[];
}

interface POLineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
}

export function PurchaseOrders() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [orders, setOrders] = useState<POWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view'>('add');
  const [selectedPO, setSelectedPO] = useState<POWithDetails | null>(null);
  const [formData, setFormData] = useState({
    po_number: '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [directReceive, setDirectReceive] = useState(false);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    quantity: 1,
    cost_price: 0,
    selling_price: 0,
  });
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [ordersRes, productsRes, suppliersRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('order_date', { ascending: false }),
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('suppliers').select('*').eq('active', true).order('name'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (productsRes.error) throw productsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      const ordersWithDetails = await Promise.all(
        (ordersRes.data || []).map(async (order) => {
          const [supplierRes, itemsRes] = await Promise.all([
            supabase.from('suppliers').select('*').eq('id', order.supplier_id).maybeSingle(),
            supabase.from('purchase_order_items').select('*').eq('purchase_order_id', order.id),
          ]);

          const itemsWithProducts = await Promise.all(
            (itemsRes.data || []).map(async (item) => {
              const { data: product } = await supabase
                .from('products')
                .select('*')
                .eq('id', item.product_id)
                .maybeSingle();
              return { ...item, product };
            })
          );

          return {
            ...order,
            supplier: supplierRes.data,
            items: itemsWithProducts,
          };
        })
      );

      setOrders(ordersWithDetails);
      setProducts(productsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (lineItems.length === 0) {
      alert('Please add at least one item to the purchase order');
      return;
    }

    try {
      const total_amount = lineItems.reduce(
        (sum, item) => sum + item.quantity * item.cost_price,
        0
      );

      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: formData.po_number,
          supplier_id: formData.supplier_id,
          order_date: formData.order_date,
          total_amount,
          notes: formData.notes || null,
          created_by: profile?.id || null,
          status: 'pending',
        })
        .select()
        .single();

      if (poError) throw poError;

      const itemsToInsert = lineItems.map((item) => ({
        purchase_order_id: poData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        cost_price: item.cost_price,
        selling_price: item.selling_price,
        subtotal: item.quantity * item.cost_price,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      if (directReceive) {
        // Automatically mark as received
        await supabase
          .from('purchase_orders')
          .update({
            status: 'received',
            received_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', poData.id);

        for (const item of lineItems) {
          const batchNumber = `${poData.po_number}-${item.product_id.substring(0, 8)}`;
          const markup = item.cost_price > 0 ? ((item.selling_price - item.cost_price) / item.cost_price) * 100 : 0;
          await supabase.from('product_batches').insert({
            product_id: item.product_id,
            batch_number: batchNumber,
            purchase_order_id: poData.id,
            supplier_id: formData.supplier_id,
            cost_price: item.cost_price,
            markup_percentage: Math.round(markup * 100) / 100,
            selling_price: item.selling_price,
            initial_quantity: item.quantity,
            current_quantity: item.quantity,
            received_date: new Date().toISOString().split('T')[0],
          } as any);
        }
        alert('Stock received directly and PO completed!');
      } else {
        alert('Purchase order created successfully!');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function markAsReceived(po: POWithDetails) {
    if (!confirm('Mark this purchase order as received? This will create new product batches.')) {
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'received',
          received_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', po.id);

      if (updateError) throw updateError;

      for (const item of po.items) {
        const batchNumber = `${po.po_number}-${item.product_id.substring(0, 8)}`;
        const markup = item.cost_price > 0 ? ((item.selling_price - item.cost_price) / item.cost_price) * 100 : 0;

        const { error: batchError } = await supabase.from('product_batches').insert({
          product_id: item.product_id,
          batch_number: batchNumber,
          purchase_order_id: po.id,
          supplier_id: po.supplier_id,
          cost_price: item.cost_price,
          markup_percentage: Math.round(markup * 100) / 100,
          selling_price: item.selling_price,
          initial_quantity: item.quantity,
          current_quantity: item.quantity,
          received_date: new Date().toISOString().split('T')[0],
        } as any);

        if (batchError) throw batchError;
      }

      loadData();
      alert('Purchase order received successfully! Product batches have been created.');
    } catch (error: any) {
      alert(error.message);
    }
  }

  function resetForm() {
    setFormData({
      po_number: '',
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setLineItems([]);
    setCurrentItem({
      product_id: '',
      quantity: 1,
      cost_price: 0,
      selling_price: 0,
    });
  }

  function addLineItem() {
    if (!currentItem.product_id || currentItem.quantity <= 0) {
      alert('Please select a product and enter a valid quantity');
      return;
    }

    const product = products.find((p) => p.id === currentItem.product_id);
    if (!product) return;

    if (lineItems.some((item) => item.product_id === currentItem.product_id)) {
      alert('Product already added. Please edit the existing item.');
      return;
    }

    setLineItems([
      ...lineItems,
      {
        product_id: currentItem.product_id,
        product_name: product.name,
        quantity: currentItem.quantity,
        cost_price: currentItem.cost_price,
        selling_price: currentItem.selling_price,
      },
    ]);

    setCurrentItem({
      product_id: '',
      quantity: 1,
      cost_price: 0,
      selling_price: 0,
    });
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  async function handleSupplierSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: supplierFormData.name,
          contact_person: supplierFormData.contact_person || null,
          phone: supplierFormData.phone || null,
          email: supplierFormData.email || null,
          address: supplierFormData.address || null,
        })
        .select()
        .single();

      if (error) throw error;

      setShowSupplierModal(false);
      setSupplierFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
      });
      loadData();
      setFormData({ ...formData, supplier_id: data.id });
    } catch (error: any) {
      alert(error.message);
    }
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openViewModal(po: POWithDetails) {
    setSelectedPO(po);
    setModalMode('view');
    setShowModal(true);
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Purchase Orders</h2>
          <p className="text-slate-600 mt-1">Manage stock receiving from suppliers</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            <Plus className="w-5 h-5" />
            Create PO
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Order Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{order.po_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {order.supplier?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{order.order_date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    LKR {order.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'received'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(order)}
                        className="p-1 hover:bg-slate-100 rounded transition"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                      </button>
                      {isAdmin && order.status === 'pending' && (
                        <button
                          onClick={() => markAsReceived(order)}
                          className="p-1 hover:bg-green-50 rounded transition"
                          title="Mark as received"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'Create Purchase Order' : 'Purchase Order Details'}
              </h3>
            </div>

            {modalMode === 'view' && selectedPO ? (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-slate-500">PO Number</p>
                    <p className="font-medium text-slate-900">{selectedPO.po_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Supplier</p>
                    <p className="font-medium text-slate-900">{selectedPO.supplier?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Order Date</p>
                    <p className="font-medium text-slate-900">{selectedPO.order_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    <p className="font-medium text-slate-900">{selectedPO.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Amount</p>
                    <p className="font-medium text-slate-900">LKR {selectedPO.total_amount.toFixed(2)}</p>
                  </div>
                  {selectedPO.received_date && (
                    <div>
                      <p className="text-sm text-slate-500">Received Date</p>
                      <p className="font-medium text-slate-900">{selectedPO.received_date}</p>
                    </div>
                  )}
                </div>

                <h4 className="font-bold text-slate-900 mb-3">Items</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Cost Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Selling Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedPO.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-slate-900">{item.product?.name}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">LKR {item.cost_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">LKR {item.selling_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900">
                            LKR {item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      PO Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.po_number}
                      onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      placeholder="PO-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.supplier_id}
                        onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                        required
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      >
                        <option value="">Select supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowSupplierModal(true)}
                        className="px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                        title="Add new supplier"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Order Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.order_date}
                      onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6 mb-6">
                  <h4 className="font-bold text-slate-900 mb-4">Add Items</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Product <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={currentItem.product_id}
                        onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="e.g., 10"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 0 })}
                        min="1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Cost Price ($) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 25.00"
                        value={currentItem.cost_price}
                        onChange={(e) => setCurrentItem({ ...currentItem, cost_price: parseFloat(e.target.value) || 0 })}
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Selling Price ($) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 35.00"
                        value={currentItem.selling_price}
                        onChange={(e) => setCurrentItem({ ...currentItem, selling_price: parseFloat(e.target.value) || 0 })}
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item to Order
                  </button>
                </div>

                {lineItems.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-bold text-slate-900 mb-3">Order Items</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Quantity</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Cost Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Selling Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Subtotal</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {lineItems.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-slate-900">{item.product_name}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">LKR {item.cost_price.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">LKR {item.selling_price.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-medium text-slate-900">
                                LKR {(item.quantity * item.cost_price).toFixed(2)}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(index)}
                                  className="p-1 hover:bg-red-50 rounded transition"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-right mt-3">
                      <p className="text-lg font-bold text-slate-900">
                        Total: LKR {lineItems.reduce((sum, item) => sum + item.quantity * item.cost_price, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="checkbox"
                    id="directReceive"
                    checked={directReceive}
                    onChange={(e) => setDirectReceive(e.target.checked)}
                    className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                  />
                  <label htmlFor="directReceive" className="text-sm font-medium text-slate-700">
                    Direct Stock Intake (Mark as already received)
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                  >
                    {directReceive ? 'Create & Receive Stock' : 'Create Purchase Order'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Add New Supplier</h3>
            </div>

            <form onSubmit={handleSupplierSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierFormData.name}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={supplierFormData.contact_person}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    placeholder="Enter contact person"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={supplierFormData.address}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    placeholder="Enter address"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
