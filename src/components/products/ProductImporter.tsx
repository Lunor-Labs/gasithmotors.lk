import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Download, AlertCircle, Check, X, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProductImporterProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface CSVRow {
    product_name: string;
    sku: string;
    barcode?: string;
    category?: string;
    supplier_name: string;
    cost_price: string;
    markup_percentage: string;
    quantity: string;
    batch_number?: string;
    expiry_date?: string;
    reorder_level?: string;
    unit?: string;
    image_url?: string;
}

interface ImportStats {
    total: number;
    success: number;
    failed: number;
    errors: string[];
}

export function ProductImporter({ onClose, onSuccess }: ProductImporterProps) {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [successCount, setSuccessCount] = useState(0);
    const [previewData, setPreviewData] = useState<CSVRow[]>([]);
    const [stats, setStats] = useState<ImportStats>({ total: 0, success: 0, failed: 0, errors: [] });
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = () => {
        const headers = [
            'product_name', 'sku', 'barcode', 'category', 'supplier_name',
            'cost_price', 'markup_percentage', 'quantity', 'batch_number', 'expiry_date',
            'reorder_level', 'unit', 'image_url'
        ];
        const sampleData = [
            'Engine Oil 4L,OIL-4L,12345678,Lubricants,Shell Lanka,4500,22,10,BATCH001,2025-12-31,5,bottle,https://example.com/oil.jpg'
        ];

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + sampleData.join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "inventory_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFile(file);
            parseCSV(file);
        }
    };

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setPreviewData(results.data as CSVRow[]);
                setStep('preview');
            },
            error: (error) => {
                alert('Error parsing CSV: ' + error.message);
            }
        });
    };

    const processImport = async () => {
        setImporting(true);
        setStep('importing');
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // 1. Extract and Process Suppliers
        const uniqueSuppliers = new Set(previewData.map(row => row.supplier_name?.trim()).filter(Boolean));
        const supplierMap = new Map<string, string>(); // Name -> ID

        for (const supplierName of uniqueSuppliers) {
            try {
                // Check if exists
                const { data: existing } = await supabase
                    .from('suppliers')
                    .select('id')
                    .eq('name', supplierName)
                    .single() as any;

                if (existing) {
                    supplierMap.set(supplierName, existing.id);
                } else {
                    // Create new
                    const { data: newSupplier, error } = await supabase
                        .from('suppliers')
                        .insert({ name: supplierName, active: true } as any)
                        .select('id')
                        .single() as any;

                    if (error) throw error;
                    if (newSupplier) supplierMap.set(supplierName, newSupplier.id);
                }
            } catch (err: any) {
                errors.push(`Failed to process supplier '${supplierName}': ${err.message}`);
            }
        }

        // 2. Process Products and Batches
        for (const row of previewData) {
            try {
                // Validation
                if (!row.product_name || !row.sku || !row.cost_price || !row.markup_percentage) {
                    throw new Error(`Missing required fields for SKU: ${row.sku || 'Unknown'}`);
                }

                const supplierId = supplierMap.get(row.supplier_name?.trim());
                if (!supplierId) {
                    throw new Error(`Supplier '${row.supplier_name}' not found or failed to create`);
                }

                const cleanSku = row.sku.trim();

                // Check Product
                let productId = '';
                const { data: existingProduct } = await supabase
                    .from('products')
                    .select('id')
                    .eq('sku', cleanSku)
                    .single() as any;

                if (existingProduct) {
                    productId = existingProduct.id;
                } else {
                    // Create Product
                    const { data: newProduct, error: prodError } = await supabase
                        .from('products')
                        .insert({
                            sku: cleanSku,
                            name: row.product_name.trim(),
                            barcode: row.barcode || null,
                            category: row.category || 'Uncategorized',
                            description: `Imported via CSV`,
                            unit: row.unit || 'piece',
                            reorder_level: parseInt(row.reorder_level || '0') || 5,
                            image_url: row.image_url || null,
                            active: true
                        } as any)
                        .select('id')
                        .single() as any;

                    if (prodError) throw prodError;
                    productId = newProduct.id;
                }

                // Create Batch
                const qty = parseInt(row.quantity || '0');
                const costPrice = parseFloat(row.cost_price);
                const markup = parseFloat(row.markup_percentage);
                const sellingPrice = costPrice * (1 + markup / 100);

                if (qty > 0) {
                    const { error: batchError } = await supabase
                        .from('product_batches')
                        .insert({
                            product_id: productId,
                            supplier_id: supplierId,
                            batch_number: row.batch_number || `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            cost_price: costPrice,
                            selling_price: Math.round(sellingPrice * 100) / 100, // Round to 2 decimals
                            initial_quantity: qty,
                            current_quantity: qty,
                            received_date: new Date().toISOString(),
                            expiry_date: row.expiry_date || null
                        } as any);

                    if (batchError) throw batchError;
                }

                successCount++;
            } catch (err: any) {
                failedCount++;
                errors.push(`Row ${row.sku}: ${err.message}`);
            }
        }

        setStats({
            total: previewData.length,
            success: successCount,
            failed: failedCount,
            errors
        });
        setImporting(false);
        setStep('complete');
        if (successCount > 0) {
            onSuccess();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Import Inventory
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-blue-700">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-semibold mb-1">Before you start:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Download the template to see the required format.</li>
                                        <li>Make sure SKU is unique for new products.</li>
                                        <li>Existing suppliers will be matched by name.</li>
                                    </ul>
                                </div>
                            </div>

                            <div
                                className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                />
                                <Upload className="w-12 h-12 text-slate-400 mb-3" />
                                <p className="font-medium text-slate-900">Click to upload CSV</p>
                                <p className="text-sm text-slate-500 mt-1">or drag and drop here</p>
                            </div>

                            <button
                                onClick={handleDownloadTemplate}
                                className="w-full flex items-center justify-center gap-2 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
                            >
                                <Download className="w-4 h-4" />
                                Download CSV Template
                            </button>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-medium text-slate-900">Preview: {previewData.length} rows found</p>
                                <button onClick={() => setStep('upload')} className="text-sm text-slate-500 hover:text-slate-700">
                                    Change File
                                </button>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left border-b">SKU</th>
                                            <th className="px-4 py-2 text-left border-b">Product</th>
                                            <th className="px-4 py-2 text-left border-b">Supplier</th>
                                            <th className="px-4 py-2 text-right border-b">Cost</th>
                                            <th className="px-4 py-2 text-right border-b">Markup %</th>
                                            <th className="px-4 py-2 text-right border-b">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="px-4 py-2">{row.sku}</td>
                                                <td className="px-4 py-2 truncate max-w-[150px]">{row.product_name}</td>
                                                <td className="px-4 py-2">{row.supplier_name}</td>
                                                <td className="px-4 py-2 text-right">{row.cost_price}</td>
                                                <td className="px-4 py-2 text-right">{row.markup_percentage}%</td>
                                                <td className="px-4 py-2 text-right">{row.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {previewData.length > 5 && (
                                    <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t">
                                        +{previewData.length - 5} more rows...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                            <p className="text-lg font-medium text-slate-900">Importing Data...</p>
                            <p className="text-slate-500">Processing products and stock levels.</p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Import Complete</h3>
                                <p className="text-slate-600 mt-1">
                                    Successfully imported {stats.success} of {stats.total} items.
                                </p>
                            </div>

                            {stats.failed > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="font-bold text-red-800 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {stats.failed} Errors Occurred
                                    </p>
                                    <ul className="text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                                        {stats.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                    {step !== 'importing' && step !== 'complete' && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                        >
                            Cancel
                        </button>
                    )}

                    {step === 'preview' && (
                        <button
                            onClick={processImport}
                            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition"
                        >
                            Import {previewData.length} Items
                        </button>
                    )}

                    {step === 'complete' && (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
