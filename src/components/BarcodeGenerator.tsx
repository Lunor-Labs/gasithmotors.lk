import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer } from 'lucide-react';

interface BarcodeGeneratorProps {
  barcode: string;
  productName: string;
  sku: string;
  price?: number;
  onClose: () => void;
}

export function BarcodeGenerator({ barcode, productName, sku, price, onClose }: BarcodeGeneratorProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && barcode) {
      try {
        JsBarcode(barcodeRef.current, barcode, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [barcode]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl print:hidden">
            <h2 className="text-xl font-bold text-slate-900">Product Barcode</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6" id="barcode-content">
            <div className="barcode-print bg-white border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">{productName}</h3>
              <p className="text-sm text-slate-600 mb-4">SKU: {sku}</p>
              <div className="flex justify-center mb-4">
                <svg ref={barcodeRef} className="max-w-full"></svg>
              </div>
              {price && (
                <p className="text-xl font-bold text-slate-900">LKR {price.toFixed(2)}</p>
              )}
            </div>
            <p className="text-xs text-slate-500 text-center mt-4 print:hidden">
              Print this barcode and paste it on the product
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            visibility: hidden;
            background-color: white;
          }
          #barcode-content {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            margin: 0;
            padding: 20px;
            background-color: white;
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          #barcode-content * {
            visibility: visible;
          }
          .barcode-print {
            border: 2px solid #000 !important;
            padding: 40px !important;
            width: auto !important;
            max-width: 400px;
            margin: 0 auto;
            text-align: center;
          }
          .print\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
