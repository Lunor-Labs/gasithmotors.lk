import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, Search, Edit, Truck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        const { error } = await supabase.from('suppliers').insert({
          name: formData.name,
          contact_person: formData.contact_person || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          notes: formData.notes || null,
        });

        if (error) throw error;
      } else if (selectedSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update({
            name: formData.name,
            contact_person: formData.contact_person || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            notes: formData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedSupplier.id);

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      loadSuppliers();
    } catch (error: any) {
      alert(error.message);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setSelectedSupplier(null);
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openEditModal(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setModalMode('edit');
    setShowModal(true);
  }

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact_person && supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
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
          <h2 className="text-2xl font-bold text-slate-900">Suppliers</h2>
          <p className="text-slate-600 mt-1">Manage your suppliers and vendors</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            <Plus className="w-5 h-5" />
            Add Supplier
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg">
                  <Truck className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{supplier.name}</h3>
                  {supplier.contact_person && (
                    <p className="text-sm text-slate-500">{supplier.contact_person}</p>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => openEditModal(supplier)}
                  className="p-1 hover:bg-slate-100 rounded transition"
                >
                  <Edit className="w-4 h-4 text-slate-600" />
                </button>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {supplier.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Phone:</span>
                  <span>{supplier.phone}</span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Email:</span>
                  <span>{supplier.email}</span>
                </div>
              )}
              {supplier.address && (
                <div className="flex items-start gap-2 text-slate-600">
                  <span className="font-medium">Address:</span>
                  <span>{supplier.address}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name <span className="text-red-500">*</span>
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
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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

                <div className="md:col-span-2">
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
                  {modalMode === 'add' ? 'Add Supplier' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
