/**
 * THERMAL RECEIPT PRINT CSS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PAPER WIDTH MISMATCH HANDLING
 * ─────────────────────────────────────────────────────────────────────────────
 * Printer driver (CUPS/PPD) is configured for : 4 inches = 101.6 mm
 * Physical paper roll loaded                  : 3.15 inches = 80 mm
 *
 * The print head is 101.6 mm wide. The 80 mm paper sits flush to the LEFT
 * edge of the print head. So:
 *   • @page width MUST be 101.6 mm  ← what the driver sends to the head
 *   • Receipt content MUST be        ← within the left 80 mm of the page
 *     ≤76 mm wide and left-aligned     so it lands on physical paper
 *   • The right 21.6 mm of the page ← unused (no paper there)
 *
 * @page height is patched by JS after measuring actual content height so
 * the thermal cutter fires exactly after the last printed line.
 *
 * KEY PRINCIPLE: Use ONLY physical units (mm, pt) for ALL sizes.
 * Browsers scale px-based content to fit the page — physical units are immune.
 *
 * FONT WEIGHT / ANTI-ALIASING
 * ─────────────────────────────────────────────────────────────────────────────
 * Thermal heads are binary (dot on or off). Anti-aliased grey pixels don't
 * heat the paper enough → text looks faint. We:
 *   1. Disable ALL font smoothing  (-webkit-font-smoothing: none)
 *   2. Use font-weight ≥ 600 as the minimum so strokes are thick enough.
 */

export const RECEIPT_PRINT_CSS = `
  @page {
    /* Width = driver's configured paper width (4 in), NOT the roll width.
       JS will override height with the exact measured content height. */
    size: 101.6mm auto;
    margin: 0mm;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: none;
    font-smooth: never;
  }

  html {
    /* Must match @page width so the browser doesn't apply fit-to-page scaling */
    width: 101.6mm;
    font-size: 9.5pt;
  }

  body {
    width: 101.6mm;
    background: #fff;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5pt;
    font-weight: 600;   /* minimum weight for clear thermal output */
    line-height: 1.45;
    color: #000;
  }

  #receipt {
    /*
     * 76 mm = comfortably within the 80 mm physical paper.
     * margin-left: 0 = left-aligned so content falls on physical paper.
     * The right ~25 mm of the 101.6 mm @page overhangs the paper edge and
     * is simply not printed (no paper there to receive the dots).
     */
    width: 76mm;
    margin-left: 0;
    margin-right: auto;
    padding: 3mm 2mm 5mm;
  }

  /* ── Header ── */
  .center { text-align: center; }

  .logo {
    display: block;
    width: 11mm;
    height: 11mm;
    object-fit: cover;
    border-radius: 1mm;
    margin: 0 auto 1mm;
  }

  .store-name {
    font-size: 13pt;
    font-weight: 800;
    letter-spacing: 0.2mm;
  }

  .store-sub  { font-size: 8.5pt; font-weight: 600; }
  .store-addr { font-size: 8pt;   font-weight: 600; color: #111; }

  /* ── Dividers ── */
  .dash {
    border: none;
    border-top: 0.3mm dashed #555;
    margin: 1.2mm 0;
  }
  .solid {
    border: none;
    border-top: 0.5mm solid #000;
    margin: 1.2mm 0;
  }

  /* ── Two-column rows ── */
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1mm;
    margin-bottom: 0.6mm;
    font-size: 9.5pt;
  }

  .total-row {
    font-size: 12pt;
    font-weight: 900;
  }

  /* ── Items ── */
  .item {
    margin-bottom: 1.5mm;
  }

  .item-name {
    font-weight: 800;
    font-size: 9.5pt;
    word-break: break-word;
    white-space: normal;
  }

  .warranty {
    font-size: 8pt;
    font-weight: 600;
    padding-left: 3mm;
  }

  .item-price {
    padding-left: 3mm;
    font-size: 9.5pt;
  }

  /* ── Footer ── */
  .footer { margin-top: 1mm; }

  .qr {
    display: block;
    width: 22mm;
    height: 22mm;
    object-fit: contain;
    margin: 1.5mm auto;
  }

  .thank  { font-size: 8.5pt; font-weight: 600; margin-top: 1.5mm; }
  .google { font-size: 8.5pt; font-weight: 800; margin-bottom: 0.8mm; }
  .power  { font-size: 6pt;   font-weight: 600; color: #333; margin-top: 1mm; }
`;

/**
 * Inline JS injected into the popup window.
 *
 * After all images load it:
 *   1. Waits two animation frames + 80 ms for layout/font metrics to settle.
 *   2. Measures the exact rendered height of #receipt (CSS px → mm).
 *   3. Injects a precise @page rule that overrides the CUPS driver paper size.
 *   4. Calls window.print() then closes the popup on afterprint.
 *
 * This ensures:
 *   • No font scaling regardless of item count.
 *   • The thermal cutter fires immediately after the last printed line.
 */
export const RECEIPT_PRINT_JS = `
  function measureAndPrint() {
    var receipt = document.getElementById('receipt');
    var heightPx = receipt.getBoundingClientRect().height;
    // 1 CSS px = 25.4/96 mm at standard screen dpi; +10 mm cutter buffer.
    var heightMm = Math.ceil(heightPx * 25.4 / 96) + 10;

    var old = document.getElementById('dynamic-page-style');
    if (old) old.parentNode.removeChild(old);

    var style = document.createElement('style');
    style.id = 'dynamic-page-style';
    // Width = 101.6mm (4 in) matches CUPS configured width.
    // Height = measured content height — tells the cutter exactly where to fire.
    style.textContent = '@page { size: 101.6mm ' + heightMm + 'mm; margin: 0mm; }';
    document.head.appendChild(style);

    window.focus();
    window.print();
    window.addEventListener('afterprint', function () { window.close(); });
  }

  function doPrint() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(measureAndPrint, 80);
      });
    });
  }

  var images = document.querySelectorAll('img');
  var pending = images.length;

  function onImageSettled() {
    pending -= 1;
    if (pending <= 0) doPrint();
  }

  if (pending === 0) {
    doPrint();
  } else {
    images.forEach(function (img) {
      if (img.complete) {
        onImageSettled();
      } else {
        img.addEventListener('load',  onImageSettled);
        img.addEventListener('error', onImageSettled);
      }
    });
  }
`;
