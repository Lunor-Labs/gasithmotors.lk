import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { Plus, Truck, Edit2, PackageOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SupplierForm } from './suppliers/SupplierForm';
import { supplierService } from '../services';
import { Modal, SearchBar, LoadingSpinner, EmptyState } from './ui';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export function Suppliers() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
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
      const data = await supplierService.getActiveSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: typeof formData) {
    try {
      if (modalMode === 'add') {
        await supplierService.createSupplier({
          name: data.name,
          contact_person: data.contact_person || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
        });
      } else if (selectedSupplier) {
        await supplierService.updateSupplier(selectedSupplier.id, {
          name: data.name,
          contact_person: data.contact_person || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
        });
      }

      setShowModal(false);
      resetForm();
      loadSuppliers();
      showToast(modalMode === 'add' ? 'Supplier added successfully!' : 'Supplier updated successfully!', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
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
    return <LoadingSpinner message="Loading suppliers..." />;
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

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search suppliers by name or contact person..."
      />

      {filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No suppliers found"
          description={searchTerm ? `No suppliers match "${searchTerm}"` : "You haven't added any suppliers yet."}
          action={!searchTerm ? { label: 'Add Your First Supplier', onClick: openAddModal } : undefined}
        />
      ) : (
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
                    <Edit2 className="w-4 h-4 text-slate-600" />
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
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
        size="2xl"
      >
        <SupplierForm
          mode={modalMode}
          initialData={selectedSupplier ? {
            name: selectedSupplier.name,
            contact_person: selectedSupplier.contact_person || '',
            phone: selectedSupplier.phone || '',
            email: selectedSupplier.email || '',
            address: selectedSupplier.address || '',
            notes: selectedSupplier.notes || '',
          } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </div>
  );
}
