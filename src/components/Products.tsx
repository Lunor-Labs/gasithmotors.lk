import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { ProductWithStock } from '../types';
import { BarcodeGenerator } from './BarcodeGenerator';
import { ProductTable } from './products/ProductTable';
import { ProductForm } from './products/ProductForm';
import { ProductDetailsView } from './products/ProductDetailsView';

export function Products() {
  const { isAdmin } = useAuth();
  const { products, loading, refetch } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
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
  });
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductWithStock | null>(null);
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [barcodeInputBuffer, setBarcodeInputBuffer] = useState('');
  const barcodeInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    });
    setSelectedProduct(null);
    setScanningBarcode(false);
    setBarcodeInputBuffer('');
  }

  function openAddModal() {
    resetForm();
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
    });
    setModalMode('edit');
    setShowModal(true);
  }

  function openViewModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setModalMode('view');
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
        const { error } = await supabase.from('products').insert([
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
        ]);

        if (error) throw error;
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
          })
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

  function handlePrintBarcode(product: ProductWithStock) {
    setBarcodeProduct(product);
    setShowBarcodeModal(true);
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Products</h2>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-900"
          />
        </div>
      </div>

      <ProductTable
        products={filteredProducts}
        onView={openViewModal}
        onEdit={openEditModal}
        onPrintBarcode={handlePrintBarcode}
        isAdmin={isAdmin}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                {modalMode === 'add' ? 'Add Product' : modalMode === 'edit' ? 'Edit Product' : 'Product Details'}
              </h3>
            </div>

            {modalMode === 'view' && selectedProduct ? (
              <ProductDetailsView product={selectedProduct} onClose={closeModal} />
            ) : (
              <ProductForm
                formData={formData}
                onChange={setFormData}
                onSubmit={handleSubmit}
                onCancel={closeModal}
                mode={modalMode}
                scanningBarcode={scanningBarcode}
                onStartBarcodeScanning={() => setScanningBarcode(true)}
              />
            )}
          </div>
        </div>
      )}

      {showBarcodeModal && barcodeProduct && (
        <BarcodeGenerator
          value={barcodeProduct.barcode || ''}
          productName={barcodeProduct.name}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
}
