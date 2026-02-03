import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Edit, Users, CreditCard, CheckCircle, Clock, AlertCircle, Eye, FileText, X } from 'lucide-react';
import { Invoice, InvoiceData } from './Invoice';

type Customer = Database['public']['Tables']['customers']['Row'];

interface CreditSale {
  id: string;
  sale_number: string;
  sale_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'credit' | 'partial' | 'completed';
  notes: string | null;
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  cashier_id: string;
  user_id: string;
}

type SaleDetailItem = Database['public']['Tables']['sale_items']['Row'] & {
  product?: { name: string; sku: string } | null;
  batch?: { batch_number: string } | null;
};

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 0,
    notes: '',
  });

  // Credit Management State
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [loadingCreditSales, setLoadingCreditSales] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<{ [key: string]: string }>({});

  // Sale Detail Modal State (Same as SalesHistory)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<CreditSale | null>(null);
  const [saleDetailItems, setSaleDetailItems] = useState<SaleDetailItem[]>([]);
  const [loadingSaleItems, setLoadingSaleItems] = useState(false);
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        const { error } = await supabase.from('customers').insert({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          credit_limit: formData.credit_limit,
          notes: formData.notes || null,
        });

        if (error) throw error;
      } else if (selectedCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            credit_limit: formData.credit_limit,
            notes: formData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedCustomer.id);

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      loadCustomers();
    } catch (error: any) {
      alert(error.message);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      credit_limit: 0,
      notes: '',
    });
    setSelectedCustomer(null);
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openEditModal(customer: Customer) {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      credit_limit: customer.credit_limit,
      notes: customer.notes || '',
    });
    setModalMode('edit');
    setShowModal(true);
  }

  function openCreditModal(customer: Customer) {
    setSelectedCustomer(customer);
    setShowCreditModal(true);
    loadCreditSales(customer.id);
    setPaymentAmount({});
  }

  async function loadCreditSales(customerId: string) {
    setLoadingCreditSales(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .in('status', ['credit', 'partial'])
        .order('sale_date', { ascending: false });

      if (error) throw error;
      setCreditSales(data as CreditSale[]);
    } catch (error) {
      console.error('Error loading credit sales:', error);
    } finally {
      setLoadingCreditSales(false);
    }
  }

  async function handleCreditPayment(sale: CreditSale) {
    if (!selectedCustomer) return;

    const amountStr = paymentAmount[sale.id];
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const remaining = sale.total_amount - sale.paid_amount;
    if (amount > remaining) {
      alert(`Amount cannot exceed remaining balance of LKR ${remaining.toFixed(2)}`);
      return;
    }

    if (!confirm(`Confirm payment of LKR ${amount.toFixed(2)} for ${sale.sale_number}?`)) {
      return;
    }

    try {
      const newPaidAmount = sale.paid_amount + amount;
      const newStatus = newPaidAmount >= sale.total_amount ? 'completed' : 'partial';
      const newNotes = (sale.notes || '') + `\nPayment of LKR ${amount.toFixed(2)} received on ${new Date().toLocaleDateString()}`;

      // 1. Update Sale
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          notes: newNotes,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', sale.id);

      if (saleError) throw saleError;

      // 2. Update Customer Credit
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          current_credit: selectedCustomer.current_credit - amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCustomer.id);

      if (customerError) throw customerError;

      alert('Payment recorded successfully');

      // Refresh data
      loadCustomers();
      // Update selected customer local state to reflect new credit
      setSelectedCustomer({
        ...selectedCustomer,
        current_credit: selectedCustomer.current_credit - amount
      });
      loadCreditSales(selectedCustomer.id);

      // Clear input
      setPaymentAmount({ ...paymentAmount, [sale.id]: '' });

    } catch (error: any) {
      alert('Error processing payment: ' + error.message);
    }
  }

  async function openSaleDetails(sale: CreditSale) {
    setSelectedSaleDetail(sale);
    setShowSaleDetailModal(true);
    setLoadingSaleItems(true);

    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          product:products(name, sku),
          batch:product_batches(batch_number)
        `)
        .eq('sale_id', sale.id);

      if (error) throw error;

      // Transform data
      const formattedItems = (data as any[] || []).map(item => ({
        ...item,
        product: item.product ? (Array.isArray(item.product) ? item.product[0] : item.product) : null,
        batch: item.batch ? (Array.isArray(item.batch) ? item.batch[0] : item.batch) : null,
      })) as SaleDetailItem[];

      setSaleDetailItems(formattedItems);
    } catch (error) {
      console.error('Error loading sale items:', error);
      alert('Failed to load sale details');
    } finally {
      setLoadingSaleItems(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!selectedSaleDetail || !saleDetailItems.length) return;

    // Fetch cashier/user profile name if needed, or assume system for now as it's not joined in loadCreditSales
    // To match SalesHistory exactly, we might need a join in loadCreditSales too, 
    // but for now let's use the ID or a placeholder.
    // Actually, SalesHistory fetches cashier name. Let's try to get it here if possible or use 'System'.

    const data: InvoiceData = {
      saleNumber: selectedSaleDetail.sale_number,
      date: new Date(selectedSaleDetail.sale_date).toLocaleDateString(),
      customerName: selectedCustomer?.name || 'Walk-in Customer',
      customerPhone: selectedCustomer?.phone || undefined,
      items: saleDetailItems.map(item => ({
        name: item.product?.name || 'Unknown Item',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
        batchNumber: item.batch?.batch_number || '',
      })),
      subtotal: selectedSaleDetail.subtotal,
      discount: selectedSaleDetail.discount_amount,
      tax: selectedSaleDetail.tax_amount,
      total: selectedSaleDetail.total_amount,
      paidAmount: selectedSaleDetail.paid_amount,
      changeAmount: Math.max(0, selectedSaleDetail.paid_amount - selectedSaleDetail.total_amount),
      paymentMethod: selectedSaleDetail.payment_method || 'cash',
      cashierName: 'System', // Placeholder unless we join user_profiles
    };

    setInvoiceData(data);
    setShowInvoice(true);
  }

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchTerm))
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
          <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
          <p className="text-slate-600 mt-1">Manage customer accounts and credit</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg">
                  <Users className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{customer.name}</h3>
                  {customer.phone && (
                    <p className="text-sm text-slate-500">{customer.phone}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => openEditModal(customer)}
                className="p-1 hover:bg-slate-100 rounded transition"
              >
                <Edit className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="space-y-2 text-sm mb-4">
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Email:</span>
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2 text-slate-600">
                  <span className="font-medium">Address:</span>
                  <span>{customer.address}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Credit</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    LKR {customer.current_credit.toFixed(2)} / LKR {customer.credit_limit.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">Used / Limit</p>
                </div>
              </div>
            </div>
            {customer.current_credit > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openCreditModal(customer)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition border border-slate-200"
                >
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Manage Credit & Payments
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {
        showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-900">
                  {modalMode === 'add' ? 'Add Customer' : 'Edit Customer'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Credit Limit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) })}
                      min="0"
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
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
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
                    {modalMode === 'add' ? 'Add Customer' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      {/* Credit Management Modal */}
      {
        showCreditModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Manage Credit</h3>
                  <p className="text-slate-600">{selectedCustomer.name}</p>
                </div>
                <button
                  onClick={() => setShowCreditModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              <div className="p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Total Outstanding Credit</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">LKR {selectedCustomer.current_credit.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Credit Limit</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">LKR {selectedCustomer.credit_limit.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="font-semibold text-slate-900 mb-4">Outstanding Sales</h4>

                {loadingCreditSales ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                  </div>
                ) : creditSales.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-slate-900 font-medium">No outstanding credit sales</p>
                    <p className="text-slate-500 text-sm">This customer has no unpaid credit invoices.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {creditSales.map((sale) => {
                      const remaining = sale.total_amount - sale.paid_amount;
                      return (
                        <div key={sale.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-900">{sale.sale_number}</span>
                                <button
                                  onClick={() => openSaleDetails(sale)}
                                  className="p-1 hover:bg-slate-100 rounded-md transition text-blue-600"
                                  title="View Sale Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 uppercase">
                                  {sale.status}
                                </span>
                              </div>
                              <div className="text-sm text-slate-600 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  {new Date(sale.sale_date).toLocaleDateString()}
                                </div>
                                <div>Total: LKR {sale.total_amount.toFixed(2)}</div>
                                <div className="text-green-600">Paid: LKR {sale.paid_amount.toFixed(2)}</div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase font-semibold">Remaining Balance</p>
                                <p className="text-xl font-bold text-red-600">LKR {remaining.toFixed(2)}</p>
                              </div>

                              <div className="flex items-center gap-2 mt-2 w-full md:w-auto">
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-slate-500 text-sm">LKR</span>
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={paymentAmount[sale.id] || ''}
                                    onChange={(e) => setPaymentAmount({ ...paymentAmount, [sale.id]: e.target.value })}
                                    className="pl-10 pr-3 py-2 border border-slate-300 rounded-lg w-32 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                                  />
                                </div>
                                <button
                                  onClick={() => handleCreditPayment(sale)}
                                  disabled={!paymentAmount[sale.id]}
                                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                >
                                  Pay
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setShowCreditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Sale Details Modal */}
      {showSaleDetailModal && selectedSaleDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Sale Details: {selectedSaleDetail.sale_number}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {new Date(selectedSaleDetail.sale_date).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowSaleDetailModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Customer</p>
                  <p className="text-lg font-medium text-slate-900 mt-1">
                    {selectedCustomer?.name || 'Walk-in Customer'}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Payment Method</p>
                  <p className="text-lg font-medium text-slate-900 mt-1 capitalize">
                    {selectedSaleDetail.payment_method}
                  </p>
                </div>
              </div>

              <h4 className="font-bold text-slate-900 mb-4">Ordered Items</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">SKU</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Unit Price</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingSaleItems ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Loading items...
                        </td>
                      </tr>
                    ) : (
                      saleDetailItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                            {item.product?.name || 'Unknown Item'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {item.product?.sku}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">
                            {item.unit_price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900 text-right">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                            {item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-900">Total Amount:</td>
                      <td className="px-4 py-3 text-right text-slate-900">LKR {selectedSaleDetail.total_amount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between">
              <button
                onClick={handleGenerateInvoice}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
                disabled={loadingSaleItems}
              >
                <FileText className="w-4 h-4" />
                Print / Share Invoice
              </button>
              <button
                onClick={() => setShowSaleDetailModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Component */}
      {showInvoice && invoiceData && (
        <div className="z-[70] relative">
          <Invoice
            invoiceData={invoiceData}
            onClose={() => setShowInvoice(false)}
          />
        </div>
      )}
    </div >
  );
}
