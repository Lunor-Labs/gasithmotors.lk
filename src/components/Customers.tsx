import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Edit, Users, CreditCard } from 'lucide-react';

type Customer = Database['public']['Tables']['customers']['Row'];

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
          </div>
        ))}
      </div>

      {showModal && (
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
      )}
    </div>
  );
}
