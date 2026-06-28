import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { Plus, Truck, Edit2, PackageOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SupplierForm } from './suppliers/SupplierForm';
import { supplierService } from '../services';
import { Modal, SearchBar, LoadingSpinner, EmptyState, Pagination } from './ui';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export function Suppliers() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
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

  const totalPages = Math.ceil(filteredSuppliers.length / PAGE_SIZE);
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function handleSearch(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

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
        onChange={handleSearch}
        placeholder="Search suppliers by name or contact person..."
      />

      {filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No suppliers found"
          description={searchTerm ? `No suppliers match "${searchTerm}"` : "You haven't added any suppliers yet."}
          action={!searchTerm && isAdmin ? { label: 'Add Your First Supplier', onClick: openAddModal } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg shrink-0">
                          <Truck className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{supplier.name}</p>
                          {supplier.contact_person && (
                            <p className="text-xs text-slate-500">{supplier.contact_person}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {supplier.phone || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {supplier.email || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">
                      {supplier.address ? (
                        <span className="line-clamp-2">{supplier.address}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600 hover:text-slate-900"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredSuppliers.length)}–{Math.min(currentPage * PAGE_SIZE, filteredSuppliers.length)} of {filteredSuppliers.length} suppliers
            </p>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
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
