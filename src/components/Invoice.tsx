import { useState } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
import logo from '../assets/favicon.jpeg';
import qrCode from '../assets/QR.jpeg';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discountedUnitPrice?: number;
  subtotal: number;
  discountedSubtotal?: number;
  batchNumber: string;
  warranty?: {
    duration: number;
    unit: 'days' | 'months' | 'years';
    type?: string;
  };
}

export interface InvoiceData {
  saleNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  serviceCharge?: number;
  paymentMethod: string;
  cashierName?: string;
}

interface InvoiceProps {
  invoiceData: InvoiceData;
  onClose: () => void;
}

export function Invoice({ invoiceData, onClose }: InvoiceProps) {
  const [showDiscount, setShowDiscount] = useState(false);

  // Calculate dynamic height for thermal printer
  // Base height (header, padding, totals, footer) is roughly 130mm
  // Each item takes approximately 10-15mm
  const printHeight = 130 + invoiceData.items.reduce((acc, item) => {
    let itemH = 12; // Increased base height per item
    if (item.name.length > 30) itemH += 8; // Extra line for long name
    if (item.name.length > 60) itemH += 8; // Another extra line
    if (item.batchNumber) itemH += 4;
    if (item.warranty && item.warranty.duration > 0) itemH += 4;
    return acc + itemH;
  }, 0) + (showDiscount && invoiceData.discount > 0 ? 5 : 0) + (invoiceData.tax > 0 ? 5 : 0);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    let message = `🧾 *INVOICE: ${invoiceData.saleNumber}*\n`;
    message += `📅 Date: ${invoiceData.date}\n\n`;

    message += `🏢 *Gasith Motors*\n`;
    message += `📞 +94 77 6600 285/+94 47 2103 738\n\n`;

    if (invoiceData.customerName) {
      message += `👤 Customer: ${invoiceData.customerName}\n`;
      if (invoiceData.customerPhone) {
        message += `📱 Phone: ${invoiceData.customerPhone}\n`;
      }
      message += `\n`;
    }

    message += `*ITEMS*\n`;
    message += `--------------------------------\n`;

    invoiceData.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} ${item.batchNumber ? `(Batch: ${item.batchNumber})` : ''}\n`;
      if (item.warranty && item.warranty.duration > 0) {
        message += `   Warranty: ${item.warranty.duration} ${item.warranty.unit} ${item.warranty.type ? `(${item.warranty.type})` : ''}\n`;
      }
      const printUnitPrice = !showDiscount && item.discountedUnitPrice !== undefined ? item.discountedUnitPrice : item.unitPrice;
      const printSubtotal = !showDiscount && item.discountedSubtotal !== undefined ? item.discountedSubtotal : item.subtotal;
      message += `   ${item.quantity} x ${printUnitPrice.toFixed(2)} = LKR ${printSubtotal.toFixed(2)}\n\n`;
    });

    message += `--------------------------------\n`;

    // Summary details (Subtotal, Discount, Tax)
    if (invoiceData.discount > 0 || invoiceData.tax > 0 || (invoiceData.serviceCharge && invoiceData.serviceCharge > 0)) {
      const displaySubtotal = !showDiscount ? (invoiceData.subtotal - invoiceData.discount) : invoiceData.subtotal;
      message += `Subtotal: LKR ${displaySubtotal.toFixed(2)}\n`;
      if (showDiscount && invoiceData.discount > 0) message += `Discount: -LKR ${invoiceData.discount.toFixed(2)}\n`;
      if (invoiceData.tax > 0) message += `Tax: LKR ${invoiceData.tax.toFixed(2)}\n`;
      if (invoiceData.serviceCharge && invoiceData.serviceCharge > 0) message += `Service Charge: LKR ${invoiceData.serviceCharge.toFixed(2)}\n`;
      message += `\n`;
    }

    // Grand Total
    message += `💰 *TOTAL: LKR ${invoiceData.total.toFixed(2)}*\n`;
    message += `--------------------------------\n\n`;

    // Payment details
    message += `💳 Payment: ${invoiceData.paymentMethod.toUpperCase()}\n`;
    if (invoiceData.paymentMethod !== 'credit') {
      message += `💵 Paid: LKR ${invoiceData.paidAmount.toFixed(2)}\n`;
      if (invoiceData.changeAmount > 0) {
        message += `🔄 Change: LKR ${invoiceData.changeAmount.toFixed(2)}\n`;
      }
    }

    if (invoiceData.cashierName) {
      message += `\nServed by: ${invoiceData.cashierName}`;
    }

    message += `\n\nThank you for your business! 🙏`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between no-print">
            <h2 className="text-xl font-bold text-slate-900">Invoice</h2>
            <div className="flex items-center gap-4">
              {invoiceData.discount > 0 && (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDiscount}
                    onChange={(e) => setShowDiscount(e.target.checked)}
                    className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                  />
                  Show Discount
                </label>
              )}
              <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  <Share2 className="w-4 h-4" />
                  WhatsApp
                </button>
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
          </div>

          <div className="p-6 print:p-0" id="invoice-content">
            <div className="invoice-wrapper">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="flex justify-center mb-2">
                  <img src={logo} alt="Gasith Motors" className="h-16 w-16 object-cover rounded-lg print:h-12 print:w-12" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-1 print:text-lg">Gasith Motors</h1>
                <p className="text-sm text-slate-600 print:text-xs">Auto Parts & Accessories</p>
                <p className="text-xs text-slate-500 mt-1 print:text-[10px]">No: 80, Beliatta Rd, Walasmulla</p>
                <p className="text-xs text-slate-500 print:text-[10px]">Tel: +94 77 6600 285/+94 47 2103 738</p>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Invoice Info */}
              <div className="space-y-2 mb-4 text-sm print:text-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Invoice:</span>
                  <span className="font-bold text-slate-900">{invoiceData.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Date/Time:</span>
                  <span className="font-bold text-slate-900">{invoiceData.date}</span>
                </div>
                {invoiceData.customerName && (
                  <div className="flex justify-between print:hidden">
                    <span className="font-medium text-slate-600">Customer:</span>
                    <span className="font-bold text-slate-900">{invoiceData.customerName}</span>
                  </div>
                )}
                {invoiceData.customerPhone && (
                  <div className="flex justify-between print:hidden">
                    <span className="font-medium text-slate-600">Phone:</span>
                    <span className="font-bold text-slate-900">{invoiceData.customerPhone}</span>
                  </div>
                )}
                {invoiceData.cashierName && (
                  <div className="flex justify-between print:hidden">
                    <span className="font-medium text-slate-600">Cashier:</span>
                    <span className="font-bold text-slate-900">{invoiceData.cashierName}</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Items */}
              <div className="mb-4">
                <div className="space-y-3">
                  {invoiceData.items.map((item, index) => (
                    <div key={index} className="invoice-item text-sm print:text-xs">
                      <div className="flex justify-between font-medium text-slate-900 mb-1">
                        <span className="flex-1 truncate-print">{index + 1}. {item.name}</span>
                      </div>
                      {item.batchNumber && (
                        <div className="text-xs text-slate-500 pl-4 print:hidden">
                          Batch: {item.batchNumber}
                        </div>
                      )}
                      {item.warranty && item.warranty.duration > 0 && (
                        <div className="text-xs font-medium text-blue-600 pl-4 print:text-[10px]">
                          Warranty: {item.warranty.duration} {item.warranty.unit}
                          {item.warranty.type ? ` (${item.warranty.type})` : ''}
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600 mt-1">
                        <span className="pl-4">
                          {item.quantity} x LKR {(!showDiscount && item.discountedUnitPrice !== undefined ? item.discountedUnitPrice : item.unitPrice).toFixed(2)}
                        </span>
                        <span className="font-medium text-slate-900">
                          LKR {(!showDiscount && item.discountedSubtotal !== undefined ? item.discountedSubtotal : item.subtotal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Summary */}
              <div className="space-y-2 text-sm print:text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium text-slate-900">
                    LKR {(!showDiscount ? (invoiceData.subtotal - invoiceData.discount) : invoiceData.subtotal).toFixed(2)}
                  </span>
                </div>
                {showDiscount && invoiceData.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Discount:</span>
                    <span className="font-medium text-slate-900">
                      -LKR {invoiceData.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                {invoiceData.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-medium text-slate-900">
                      LKR {invoiceData.tax.toFixed(2)}
                    </span>
                  </div>
                )}
                {invoiceData.serviceCharge !== undefined && invoiceData.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Service Charge:</span>
                    <span className="font-medium text-slate-900">
                      LKR {invoiceData.serviceCharge.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-slate-900 my-3"></div>

              {/* Total */}
              <div className="flex justify-between text-lg font-bold mb-4 print:text-base">
                <span className="text-slate-900">TOTAL:</span>
                <span className="text-slate-900">LKR {invoiceData.total.toFixed(2)}</span>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Payment Info */}
              <div className="space-y-2 text-sm print:text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment Method:</span>
                  <span className="font-medium text-slate-900 uppercase">
                    {invoiceData.paymentMethod}
                  </span>
                </div>
                {invoiceData.paymentMethod !== 'credit' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Paid:</span>
                      <span className="font-medium text-slate-900">
                        LKR {invoiceData.paidAmount.toFixed(2)}
                      </span>
                    </div>
                    {invoiceData.changeAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Change:</span>
                        <span className="font-medium text-green-600">
                          LKR {invoiceData.changeAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Footer */}
              <div className="text-center pt-2 space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 print:text-xs">Review us on Google</p>
                  <img src={qrCode} alt="QR Code" className="h-24 w-24 object-contain print:h-20 print:w-20" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 print:text-xs">Thank you for your business!</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-slate-400 font-medium">System Powered by <span className="font-bold border-b border-slate-300">Lunor Labs</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Print Styles for 80mm Thermal Printer */
        @page {
          size: 80mm ${printHeight}mm;
          margin: 0;
        }

        @media print {
          /* Reset html and body with 0 height to prevent extra pages from background content */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            height: ${printHeight}mm !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }

          /* Hide text and set height to 0 for all elements to collapse page */
          body * {
            visibility: hidden;
            height: 0;
          }

          /* Reset the modal wrapper positioning */
          .fixed, .absolute, .relative {
            position: static !important;
            height: auto !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Show invoice content and all children */
          #invoice-content,
          #invoice-content * {
            visibility: visible !important;
            height: auto; /* Restore height for invoice elements */
          }

          /* Position invoice content */
          #invoice-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm 5mm !important; /* Proper padding for 80mm paper */
            background: white !important;
            box-sizing: border-box !important;
            font-size: 12px !important;
          }

          /* Explicitly hide the modal backdrop functionality */
          .fixed.inset-0 {
             position: absolute !important;
             top: 0 !important;
             left: 0 !important;
             display: block !important;
             background: transparent !important;
             z-index: auto !important;
          }

          /* Hide UI elements */
          .no-print,
          .sticky,
          button {
            display: none !important;
            visibility: hidden !important;
          }

          /* Invoice wrapper */
          .invoice-wrapper {
            display: block !important;
            visibility: visible !important;
            font-size: 12px !important;
          }

          /* Truncate long names in print to save space */
          /* Allow item names to wrap to full lines in print */
          .truncate-print {
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
          }

          /* Explicitly hide batch and other info if needed */
          .print-hide {
            display: none !important;
          }

          /* Prevent items from splitting across pages/cuts */
          .invoice-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
          }

          /* Optimize fonts for thermal printing */
          .print\\:text-lg {
            font-size: 1.1rem !important;
            font-weight: 700 !important;
          }

          .print\\:text-base {
            font-size: 0.95rem !important;
            font-weight: 700 !important;
          }

          .print\\:text-xs {
            font-size: 0.75rem !important;
          }

          .print\\:text-\\[10px\\] {
            font-size: 10px !important;
          }

          /* Image optimization */
          .print\\:h-12 {
            height: 3rem !important;
          }

          .print\\:w-12 {
            width: 3rem !important;
          }

          img {
            max-width: 100% !important;
            height: auto !important;
          }

          /* Ensure borders print */
          .border-slate-300,
          .border-slate-900 {
            border-color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure text prints clearly */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Remove any background colors */
          .bg-slate-50,
          .bg-slate-100 {
            background-color: transparent !important;
          }

          /* Ensure proper text wrapping */
          * {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }

          /* Remove shadows and rounded corners for print */
          .rounded-xl,
          .rounded-lg,
          .shadow-xl {
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          /* Compact spacing for thermal */
          .mb-4 {
            margin-bottom: 0.5rem !important;
          }

          .mb-3 {
            margin-bottom: 0.4rem !important;
          }

          .my-3 {
            margin-top: 0.4rem !important;
            margin-bottom: 0.4rem !important;
          }

          .space-y-2 > * + * {
            margin-top: 0.35rem !important;
          }

          .space-y-3 > * + * {
            margin-top: 0.5rem !important;
          }
        }

        /* Screen view styles */
        @media screen {
          .invoice-wrapper {
            max-width: 80mm;
            margin: 0 auto;
          }
        }
      `}</style>
    </>
  );
}