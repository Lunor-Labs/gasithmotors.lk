import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Barcode, Plus, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProductWithBatches, Customer, ReferralAgent, CartItem } from '../types';
import { Invoice } from './Invoice';
import { ProductGrid } from './pos/ProductGrid';
import { CartItemsList } from './pos/CartItemsList';

export function POS() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [referralAgents, setReferralAgents] = useState<ReferralAgent[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedReferralAgent, setSelectedReferralAgent] = useState<ReferralAgent | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithBatches | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | 'mixed'>('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 0,
  });
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    commission_rate: 0,
  });
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showBatchModal || showCustomerModal || showAgentModal || showInvoice) return;

      if (e.key === 'Enter' && barcodeBuffer) {
        searchProductByBarcode(barcodeBuffer);
        setBarcodeBuffer('');
        return;
      }

      if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);

        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }

        barcodeTimeoutRef.current = setTimeout(() => {
          setBarcodeBuffer('');
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [barcodeBuffer, showBatchModal, showCustomerModal, showAgentModal, showInvoice]);

  async function loadData() {
    try {
      const [productsRes, customersRes, agentsRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('referral_agents').select('*').eq('active', true).order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;
      if (agentsRes.error) throw agentsRes.error;

      const productsWithBatches = await Promise.all(
        (productsRes.data || []).map(async (product) => {
          const { data: batches } = await supabase
            .from('product_batches')
            .select('*')
            .eq('product_id', product.id)
            .gt('current_quantity', 0)
            .order('received_date');

          return {
            ...product,
            batches: batches || [],
          };
        })
      );

      setProducts(productsWithBatches);
      setCustomers(customersRes.data || []);
      setReferralAgents(agentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  function searchProductByBarcode(barcode: string) {
    const product = products.find((p) => p.barcode === barcode);
    if (product) {
      handleProductSelect(product);
    } else {
      alert('Product not found with this barcode');
    }
  }

  function handleProductSelect(product: ProductWithBatches) {
    if (product.batches.length === 0) {
      alert('No stock available for this product');
      return;
    }

    if (product.batches.length === 1) {
      addToCart(product, product.batches[0], 1);
    } else {
      setSelectedProduct(product);
      setShowBatchModal(true);
    }
  }

  function addToCart(product: ProductWithBatches, batch: any, quantity: number) {
    const existingItemIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.batch.id === batch.id
    );

    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      const newQuantity = newCart[existingItemIndex].quantity + quantity;

      if (newQuantity > batch.current_quantity) {
        alert(`Only ${batch.current_quantity} units available`);
        return;
      }

      newCart[existingItemIndex].quantity = newQuantity;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product,
          batch,
          quantity,
          price: batch.selling_price,
          original_price: batch.selling_price,
        },
      ]);
    }

    setShowBatchModal(false);
    setSelectedProduct(null);
  }

  function updateCartItemQuantity(index: number, delta: number) {
    const newCart = [...cart];
    const newQuantity = newCart[index].quantity + delta;

    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    if (newQuantity > newCart[index].batch.current_quantity) {
      alert(`Only ${newCart[index].batch.current_quantity} units available`);
      return;
    }

    newCart[index].quantity = newQuantity;
    setCart(newCart);
  }

  function updateCartItemPrice(index: number, newPrice: number) {
    const newCart = [...cart];
    newCart[index].price = newPrice;
    setCart(newCart);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
    setSelectedCustomer(null);
    setSelectedReferralAgent(null);
    setPaidAmount(0);
    setPaymentMethod('cash');
  }

  // Calculations
  const grossSubtotal = cart.reduce((sum, item) => sum + item.original_price * item.quantity, 0);
  const effectiveSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemLevelDiscount = grossSubtotal - effectiveSubtotal;

  // discountAmount is no longer used for global discount, simplifying math
  const taxBase = effectiveSubtotal;
  const taxAmount = taxBase * (taxRate / 100);
  const total = taxBase + taxAmount;
  const changeAmount = paidAmount - total;


  async function handleCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: customerFormData.name,
          phone: customerFormData.phone || null,
          email: customerFormData.email || null,
          address: customerFormData.address || null,
          credit_limit: customerFormData.credit_limit,
        })
        .select()
        .single();

      if (error) throw error;

      setShowCustomerModal(false);
      setCustomerFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: 0,
      });
      loadData();
      setSelectedCustomer(data);
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleAgentSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from('referral_agents')
        .insert({
          name: agentFormData.name,
          phone: agentFormData.phone || null,
          email: agentFormData.email || null,
          address: agentFormData.address || null,
          commission_rate: agentFormData.commission_rate,
        })
        .select()
        .single();

      if (error) throw error;

      setShowAgentModal(false);
      setAgentFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        commission_rate: 0,
      });
      loadData();
      setSelectedReferralAgent(data);
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function completeSale() {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomer) {
      alert('Please select a customer for credit sales');
      return;
    }

    if (paymentMethod === 'credit' && selectedCustomer) {
      const newCredit = selectedCustomer.current_credit + total;
      if (newCredit > selectedCustomer.credit_limit) {
        alert('Customer credit limit exceeded');
        return;
      }
    }

    if (paymentMethod !== 'credit' && paidAmount < total) {
      alert('Paid amount is less than total');
      return;
    }

    setProcessing(true);

    try {
      const saleNumber = `SALE-${Date.now()}`;
      const actualPaidAmount = paymentMethod === 'credit' ? 0 : paidAmount;
      const status = paymentMethod === 'credit' ? 'credit' : 'completed';

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          customer_id: selectedCustomer?.id || null,
          referral_agent_id: selectedReferralAgent?.id || null,
          user_id: profile?.id,
          sale_date: new Date().toISOString(),
          subtotal: effectiveSubtotal, // Using effective subtotal (after item discounts)
          discount_amount: discountAmount, // Only global discount
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: total,
          payment_method: paymentMethod,
          paid_amount: actualPaidAmount,
          status,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = cart.map((item) => ({
        sale_id: saleData.id,
        product_id: item.product.id,
        batch_id: item.batch.id,
        quantity: item.quantity,
        unit_price: item.price, // Use modified price
        subtotal: item.price * item.quantity,
        total_price: item.price * item.quantity,
        cost_price: item.batch.cost_price,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        const newQuantity = item.batch.current_quantity - item.quantity;
        const { error: batchError } = await supabase
          .from('product_batches')
          .update({ current_quantity: newQuantity })
          .eq('id', item.batch.id);

        if (batchError) throw batchError;
      }

      if (paymentMethod === 'credit' && selectedCustomer) {
        const { error: creditError } = await supabase
          .from('customers')
          .update({ current_credit: selectedCustomer.current_credit + total })
          .eq('id', selectedCustomer.id);

        if (creditError) throw creditError;
      }

      if (selectedReferralAgent) {
        const commissionAmount = total * (selectedReferralAgent.commission_rate / 100);
        const { error: commissionError } = await supabase.from('referral_commissions').insert({
          referral_agent_id: selectedReferralAgent.id,
          sale_id: saleData.id,
          commission_amount: commissionAmount,
          commission_rate: selectedReferralAgent.commission_rate,
          sale_amount: total,
        });

        if (commissionError) throw commissionError;
      }

      setInvoiceData({
        saleNumber,
        date: new Date().toLocaleDateString(),
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone,
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.price,
          subtotal: item.price * item.quantity,
          batchNumber: item.batch.batch_number,
        })),
        subtotal: effectiveSubtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paidAmount: actualPaidAmount,
        changeAmount,
        paymentMethod,
        cashierName: profile?.full_name || 'Cashier',
      });

      setShowInvoice(true);
      clearCart();
      loadData();
    } catch (error: any) {
      alert(`Error completing sale: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, SKU, or scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-slate-900"
              autoFocus
            />
            <Barcode className={`w-5 h-5 ${barcodeBuffer ? 'text-green-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          {barcodeBuffer && (
            <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
              <Barcode className="w-3 h-3" />
              Scanning barcode...
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Products</h3>
          <ProductGrid products={filteredProducts} onAddToCart={handleProductSelect} />
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Sale Details</h3>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer (Optional)</label>
              <div className="flex gap-2">
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find((c) => c.id === e.target.value);
                    setSelectedCustomer(customer || null);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                  title="Add new customer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Referral Agent (Optional)
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedReferralAgent?.id || ''}
                  onChange={(e) => {
                    const agent = referralAgents.find((a) => a.id === e.target.value);
                    setSelectedReferralAgent(agent || null);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                >
                  <option value="">None</option>
                  {referralAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.commission_rate}%)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAgentModal(true)}
                  className="px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                  title="Add new referral agent"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={taxRate === 0 ? '' : taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            {paymentMethod !== 'credit' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paid Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paidAmount === 0 ? '' : paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-medium text-slate-900">LKR {grossSubtotal.toFixed(2)}</span>
            </div>
            {itemLevelDiscount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span className="">Item Discounts:</span>
                <span className="font-medium">-LKR {itemLevelDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tax ({taxRate}%):</span>
              <span className="font-medium text-slate-900">LKR {taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold border-t border-slate-200 pt-2">
              <span className="text-slate-900">Total:</span>
              <span className="text-slate-900">LKR {total.toFixed(2)}</span>
            </div>
            {paymentMethod !== 'credit' && paidAmount >= total && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Change:</span>
                <span className="font-medium text-green-600">LKR {changeAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-slate-900">Cart ({cart.length})</h4>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto -mx-2 px-2">
              <CartItemsList
                items={cart}
                onUpdateQuantity={updateCartItemQuantity}
                onUpdatePrice={updateCartItemPrice}
                onRemoveItem={removeFromCart}
              />
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={completeSale}
              disabled={cart.length === 0 || processing}
              className="w-full py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {processing ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>

      {showBatchModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Select Batch</h3>
              <button
                onClick={() => {
                  setShowBatchModal(false);
                  setSelectedProduct(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {selectedProduct.batches.map((batch) => (
                  <div
                    key={batch.id}
                    onClick={() => addToCart(selectedProduct, batch, 1)}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-slate-900">Batch: {batch.batch_number}</p>
                        <p className="text-sm text-slate-500">
                          Received: {new Date(batch.received_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">LKR {batch.selling_price.toFixed(2)}</p>
                        <p className="text-sm text-slate-500">{batch.current_quantity} available</p>
                      </div>
                    </div>
                    {batch.expiry_date && (
                      <p className="text-sm text-slate-500">
                        Expires: {new Date(batch.expiry_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Add Customer</h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerFormData.name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <textarea
                    value={customerFormData.address}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customerFormData.credit_limit}
                    onChange={(e) =>
                      setCustomerFormData({ ...customerFormData, credit_limit: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAgentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Add Referral Agent</h3>
              <button
                onClick={() => setShowAgentModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAgentSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={agentFormData.name}
                    onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={agentFormData.phone}
                    onChange={(e) => setAgentFormData({ ...agentFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={agentFormData.email}
                    onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <textarea
                    value={agentFormData.address}
                    onChange={(e) => setAgentFormData({ ...agentFormData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Commission Rate (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={agentFormData.commission_rate}
                    onChange={(e) =>
                      setAgentFormData({ ...agentFormData, commission_rate: parseFloat(e.target.value) || 0 })
                    }
                    required
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Add Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoice && invoiceData && (
        <Invoice invoiceData={invoiceData} onClose={() => setShowInvoice(false)} />
      )}
    </div>
  );
}
