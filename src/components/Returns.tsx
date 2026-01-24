import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Eye, RotateCcw, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Return = Database['public']['Tables']['returns']['Row'];
type ReturnItem = Database['public']['Tables']['return_items']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface ReturnWithDetails extends Return {
  customer: Customer | null;
  items: (ReturnItem & { product: Product | null })[];
}

export function Returns() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [returns, setReturns] = useState<ReturnWithDetails[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view'>('add');
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithDetails | null>(null);
  const [formData, setFormData] = useState({
    sale_id: '',
    customer_id: '',
    refund_method: 'cash' as 'cash' | 'credit_note' | 'exchange',
    reason: '',
    total_amount: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [returnsRes, salesRes, customersRes] = await Promise.all([
        supabase.from('returns').select('*').order('return_date', { ascending: false }),
        supabase.from('sales').select('*').order('sale_date', { ascending: false }).limit(100),
        supabase.from('customers').select('*').eq('active', true).order('name'),
      ]);

      if (returnsRes.error) throw returnsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (customersRes.error) throw customersRes.error;

      const returnsWithDetails = await Promise.all(
        (returnsRes.data || []).map(async (returnRecord) => {
          const [customerRes, itemsRes] = await Promise.all([
            returnRecord.customer_id
              ? supabase.from('customers').select('*').eq('id', returnRecord.customer_id).maybeSingle()
              : Promise.resolve({ data: null }),
            supabase.from('return_items').select('*').eq('return_id', returnRecord.id),
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
            ...returnRecord,
            customer: customerRes.data,
            items: itemsWithProducts,
          };
        })
      );

      setReturns(returnsWithDetails);
      setSales(salesRes.data || []);
      setCustomers(customersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const returnNumber = `RET-${Date.now()}`;

      const { data: returnData, error: returnError } = await supabase
        .from('returns')
        .insert({
          return_number: returnNumber,
          sale_id: formData.sale_id || null,
          customer_id: formData.customer_id || null,
          total_amount: formData.total_amount,
          refund_method: formData.refund_method,
          reason: formData.reason || null,
          status: 'pending',
          processed_by: profile?.id || null,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      alert(`Return created successfully!\nReturn Number: ${returnNumber}`);
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function approveReturn(returnRecord: ReturnWithDetails) {
    if (!confirm('Approve this return? Stock will be restored and refund will be processed.')) {
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('returns')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', returnRecord.id);

      if (updateError) throw updateError;

      for (const item of returnRecord.items) {
        const { error: batchError } = await supabase
          .from('product_batches')
          .update({
            current_quantity: supabase.sql`current_quantity + ${item.quantity}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.batch_id);

        if (batchError) throw batchError;
      }

      if (returnRecord.customer_id && returnRecord.refund_method === 'credit_note') {
        const { data: customer } = await supabase
          .from('customers')
          .select('current_credit')
          .eq('id', returnRecord.customer_id)
          .single();

        if (customer) {
          const { error: customerError } = await supabase
            .from('customers')
            .update({
              current_credit: Math.max(0, customer.current_credit - returnRecord.total_amount),
              updated_at: new Date().toISOString(),
            })
            .eq('id', returnRecord.customer_id);

          if (customerError) throw customerError;
        }
      }

      loadData();
      alert('Return approved successfully!');
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function rejectReturn(returnRecord: ReturnWithDetails) {
    if (!confirm('Reject this return?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('returns')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', returnRecord.id);

      if (error) throw error;

      loadData();
      alert('Return rejected.');
    } catch (error: any) {
      alert(error.message);
    }
  }

  function resetForm() {
    setFormData({
      sale_id: '',
      customer_id: '',
      refund_method: 'cash',
      reason: '',
      total_amount: 0,
    });
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openViewModal(returnRecord: ReturnWithDetails) {
    setSelectedReturn(returnRecord);
    setModalMode('view');
    setShowModal(true);
  }

  const filteredReturns = returns.filter(
    (ret) =>
      ret.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold text-slate-900">Returns & Refunds</h2>
          <p className="text-slate-600 mt-1">Manage product returns and refunds</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          <Plus className="w-5 h-5" />
          New Return
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search returns..."
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
                  Return Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Method
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
              {filteredReturns.map((returnRecord) => (
                <tr key={returnRecord.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{returnRecord.return_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {returnRecord.customer?.name || 'Walk-in'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(returnRecord.return_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    LKR {returnRecord.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{returnRecord.refund_method}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        returnRecord.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : returnRecord.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {returnRecord.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(returnRecord)}
                        className="p-1 hover:bg-slate-100 rounded transition"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                      </button>
                      {isAdmin && returnRecord.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approveReturn(returnRecord)}
                            className="p-1 hover:bg-green-50 rounded transition"
                            title="Approve return"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={() => rejectReturn(returnRecord)}
                            className="p-1 hover:bg-red-50 rounded transition"
                            title="Reject return"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'New Return' : 'Return Details'}
              </h3>
            </div>

            {modalMode === 'view' && selectedReturn ? (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-slate-500">Return Number</p>
                    <p className="font-medium text-slate-900">{selectedReturn.return_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Customer</p>
                    <p className="font-medium text-slate-900">{selectedReturn.customer?.name || 'Walk-in'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date</p>
                    <p className="font-medium text-slate-900">
                      {new Date(selectedReturn.return_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    <p className="font-medium text-slate-900">{selectedReturn.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Refund Method</p>
                    <p className="font-medium text-slate-900">{selectedReturn.refund_method}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Amount</p>
                    <p className="font-medium text-slate-900">LKR {selectedReturn.total_amount.toFixed(2)}</p>
                  </div>
                  {selectedReturn.reason && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500">Reason</p>
                      <p className="font-medium text-slate-900">{selectedReturn.reason}</p>
                    </div>
                  )}
                </div>

                {selectedReturn.items.length > 0 && (
                  <>
                    <h4 className="font-bold text-slate-900 mb-3">Items</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Quantity</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Unit Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedReturn.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm text-slate-900">{item.product?.name}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-slate-600">LKR {item.unit_price.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-medium text-slate-900">
                                LKR {item.subtotal.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

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
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Related Sale (Optional)
                    </label>
                    <select
                      value={formData.sale_id}
                      onChange={(e) => setFormData({ ...formData, sale_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    >
                      <option value="">No related sale</option>
                      {sales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.sale_number} - LKR {sale.total_amount.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Customer (Optional)
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    >
                      <option value="">Walk-in Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Return Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total_amount}
                      onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                      required
                      min="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Refund Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.refund_method}
                      onChange={(e) => setFormData({ ...formData, refund_method: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    >
                      <option value="cash">Cash</option>
                      <option value="credit_note">Credit Note</option>
                      <option value="exchange">Exchange</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason
                    </label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      placeholder="Reason for return..."
                    />
                  </div>
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
                    Create Return
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
