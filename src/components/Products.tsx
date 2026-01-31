import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProducts, SearchType } from '../hooks/useProducts';
import { ProductWithStock } from '../types';
import { BarcodeGenerator } from './BarcodeGenerator';
import { ProductTable } from './products/ProductTable';
import { ProductForm } from './products/ProductForm';
import { ProductDetailsView } from './products/ProductDetailsView';
import { ProductImporter } from './products/ProductImporter';
import { Upload, Filter } from 'lucide-react';

export function Products() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');

  const { products, loading, refetch, totalCount, totalPages } = useProducts(page, pageSize, debouncedSearch, searchType);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [showAddStockInView, setShowAddStockInView] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    category: '',
    unit: 'piece',
    reorder_level: 0,
    image_url: '',
    // Initial stock fields
    initial_quantity: 0,
    cost_price: 0,
    markup_percentage: 0,
    selling_price: 0,
    supplier_id: '',
  });
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductWithStock | null>(null);
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [barcodeInputBuffer, setBarcodeInputBuffer] = useState('');
  const barcodeInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reset to page 1 on search
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id, name').eq('active', true).order('name');
    setSuppliers(data || []);
  }

  useEffect(() => {
    if (!showModal || modalMode === 'view') return;

    const handleBarcodeInput = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        const targetElement = e.target as HTMLInputElement;
        if (targetElement.type !== 'text' || !targetElement.className.includes('border-slate-300')) {
          return;
        }
      }

      if (e.key === 'Enter' && barcodeInputBuffer.length > 3) {
        e.preventDefault();
        setFormData({ ...formData, barcode: barcodeInputBuffer });
        setBarcodeInputBuffer('');
        setScanningBarcode(false);
        return;
      }

      if (e.key.length === 1) {
        setScanningBarcode(true);
        setBarcodeInputBuffer((prev) => prev + e.key);

        if (barcodeInputTimeoutRef.current) {
          clearTimeout(barcodeInputTimeoutRef.current);
        }

        barcodeInputTimeoutRef.current = setTimeout(() => {
          setBarcodeInputBuffer('');
          setScanningBarcode(false);
        }, 100);
      }
    };

    window.addEventListener('keypress', handleBarcodeInput);
    return () => {
      window.removeEventListener('keypress', handleBarcodeInput);
      if (barcodeInputTimeoutRef.current) {
        clearTimeout(barcodeInputTimeoutRef.current);
      }
    };
  }, [showModal, modalMode, barcodeInputBuffer, formData]);

  function resetForm() {
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      description: '',
      category: '',
      unit: 'piece',
      reorder_level: 0,
      image_url: '',
      initial_quantity: 0,
      cost_price: 0,
      markup_percentage: 0,
      selling_price: 0,
      supplier_id: '',
    });
    setSelectedProduct(null);
    setScanningBarcode(false);
    setBarcodeInputBuffer('');
  }

  async function generateNextSKU() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('sku')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) return 'SKU-0001';

      const lastSku = (data[0] as any).sku;
      const match = lastSku.match(/(\d+)$/);

      if (!match) return `${lastSku}-0001`;

      const lastNumber = parseInt(match[0]);
      const nextNumber = lastNumber + 1;
      const numberPart = nextNumber.toString().padStart(match[0].length, '0');

      return lastSku.substring(0, lastSku.length - match[0].length) + numberPart;
    } catch (error) {
      console.error('Error generating SKU:', error);
      return '';
    }
  }

  async function openAddModal() {
    resetForm();
    const nextSku = await generateNextSKU();
    setFormData((prev) => ({ ...prev, sku: nextSku }));
    setModalMode('add');
    setShowModal(true);
  }

  function openEditModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setFormData({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      unit: product.unit,
      reorder_level: product.reorder_level,
      image_url: product.image_url || '',
      initial_quantity: 0,
      cost_price: 0,
      markup_percentage: 0,
      selling_price: 0,
      supplier_id: '',
    });
    setModalMode('edit');
    setShowModal(true);
  }

  function openViewModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setModalMode('view');
    setShowAddStockInView(false);
    setShowModal(true);
  }

  function openAddStockModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setModalMode('view');
    setShowAddStockInView(true);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([
            {
              sku: formData.sku,
              barcode: formData.barcode || null,
              name: formData.name,
              description: formData.description || null,
              category: formData.category || null,
              unit: formData.unit,
              reorder_level: formData.reorder_level,
              image_url: formData.image_url || null,
            },
          ] as any)
          .select()
          .single();

        if (error) throw error;

        // Create initial batch if stock info provided
        if (formData.initial_quantity > 0 && formData.supplier_id && newProduct) {
          const product = newProduct as any;
          const batchNumber = `INIT-${product.sku}-${new Date().getTime().toString().slice(-4)}`;
          const { error: batchError } = await supabase.from('product_batches').insert({
            product_id: product.id,
            batch_number: batchNumber,
            supplier_id: formData.supplier_id,
            cost_price: formData.cost_price,
            markup_percentage: formData.markup_percentage,
            selling_price: formData.selling_price,
            initial_quantity: formData.initial_quantity,
            current_quantity: formData.initial_quantity,
            received_date: new Date().toISOString().split('T')[0],
          } as any);

          if (batchError) throw batchError;
        }

        alert('Product added successfully!');
      } else if (modalMode === 'edit' && selectedProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            sku: formData.sku,
            barcode: formData.barcode || null,
            name: formData.name,
            description: formData.description || null,
            category: formData.category || null,
            unit: formData.unit,
            reorder_level: formData.reorder_level,
            image_url: formData.image_url || null,
          } as any)
          .eq('id', selectedProduct.id);

        if (error) throw error;
        alert('Product updated successfully!');
      }

      closeModal();
      refetch();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handlePrintBarcode(product: ProductWithStock) {
    if (!product.barcode) {
      const confirmAssign = window.confirm(`No barcode assigned. Would you like to generate one using SKU (${product.sku})?`);
      if (confirmAssign) {
        try {
          const { error } = await supabase
            .from('products')
            .update({ barcode: product.sku } as any)
            .eq('id', product.id);

          if (error) throw error;

          // Local update to avoid waiting for refetch to open modal
          const updatedProduct = { ...product, barcode: product.sku };
          setBarcodeProduct(updatedProduct);
          setShowBarcodeModal(true);
          refetch(); // Background refresh
          return;
        } catch (error: any) {
          alert('Failed to assign barcode: ' + error.message);
          return;
        }
      } else {
        return;
      }
    }
    setBarcodeProduct(product);
    setShowBarcodeModal(true);
  }

  if (loading && page === 1 && !searchTerm) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Products {totalCount > 0 && <span className="text-sm font-normal text-slate-500">({totalCount})</span>}
        </h2>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
          )}
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              <Plus className="w-5 h-5" />
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={
                searchType === 'name' ? "Search by name (e.g. 'Toyota Filter')..." :
                  searchType === 'sku' ? "Search by SKU..." :
                    searchType === 'barcode' ? "Scan barcode..." :
                      "Search by name, SKU, or barcode..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as SearchType)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="all">Smart Search</option>
                <option value="name">Name Only</option>
                <option value="sku">SKU Only</option>
                <option value="barcode">Barcode</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <Filter className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <ProductTable
          products={products}
          onView={openViewModal}
          onEdit={openEditModal}
          onAddStock={openAddStockModal}
          onPrintBarcode={handlePrintBarcode}
          isAdmin={isAdmin}
        />

        {/* Pagination Controls */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-600">
            Page {page} of {totalPages || 1}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'Add Product' : modalMode === 'edit' ? 'Edit Product' : 'Product Details'}
              </h3>
            </div>

            {modalMode === 'view' && selectedProduct ? (
              <ProductDetailsView
                product={selectedProduct}
                onClose={closeModal}
                onUpdate={refetch}
                defaultShowAddStock={showAddStockInView}
              />
            ) : (
              <ProductForm
                formData={formData}
                onChange={setFormData}
                onSubmit={handleSubmit}
                onCancel={closeModal}
                mode={modalMode}
                scanningBarcode={scanningBarcode}
                onStartBarcodeScanning={() => setScanningBarcode(true)}
                suppliers={suppliers}
                onSupplierAdded={loadSuppliers}
              />
            )}
          </div>
        </div>
      )}

      {showBarcodeModal && barcodeProduct && (
        <BarcodeGenerator
          barcode={barcodeProduct.barcode || ''}
          sku={barcodeProduct.sku}
          productName={barcodeProduct.name}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
      {showImportModal && (
        <ProductImporter
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
