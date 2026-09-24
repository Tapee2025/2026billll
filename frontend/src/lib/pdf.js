// Overlays invoice data onto the EXACT customer-supplied template PDF.
//
// The template (public/template/tax_invoice_template.pdf) already contains the
// letterhead, all borders/labels and the constant values (GSTIN, bank, product,
// tax %, QR, terms). We only draw the VARIABLE data into the blank fields, so the
// output is a pixel-perfect match of the reference bill.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { amountWords, fmt } from "./numberToWords";

const PAGE_H = 841.5; // A4 template height in points

let _templateBytes = null;
async function loadTemplate() {
  if (_templateBytes) return _templateBytes.slice(0);
  const url = `${process.env.PUBLIC_URL || ""}/template/tax_invoice_template.pdf`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Template PDF not found");
  _templateBytes = await res.arrayBuffer();
  return _templateBytes.slice(0);
}

export async function generatePdfBlob(settings, data) {
  const bytes = await loadTemplate();
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  // Blank out the pre-printed letterhead band AND the baked "TAX INVOICE"/
  // "Original" title (both are redrawn 2mm lower below), so the invoice prints
  // cleanly on the customer's own letterhead paper without touching its design.
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 124,
    width: page.getWidth(),
    height: 124,
    color: white,
  });

  // Redraw the title shifted 2mm (~5.7pt) down.
  const TITLE_SHIFT = 5.7;
  {
    const t = "TAX INVOICE";
    const w = fontBold.widthOfTextAtSize(t, 10);
    const cx = (263.2 + 338.3) / 2;
    page.drawText(t, {
      x: cx - w / 2,
      y: PAGE_H - (120.8 + TITLE_SHIFT),
      size: 10,
      font: fontBold,
      color: black,
    });
    const o = "Original";
    const ow = fontBold.widthOfTextAtSize(o, 8);
    page.drawText(o, {
      x: 564.7 - ow,
      y: PAGE_H - (119.0 + TITLE_SHIFT),
      size: 8,
      font: fontBold,
      color: black,
    });
  }

  // draw text; `yt` is the baseline distance from the TOP of the page (matches
  // the coordinates extracted from the template labels).
  const draw = (text, x, yt, opts = {}) => {
    if (text === null || text === undefined || text === "") return;
    const size = opts.size || 9;
    const s = String(text);
    let xx = x;
    if (opts.align === "right") xx = x - font.widthOfTextAtSize(s, size);
    else if (opts.align === "center")
      xx = x - font.widthOfTextAtSize(s, size) / 2;
    page.drawText(s, { x: xx, y: PAGE_H - yt, size, font, color: black });
  };

  const F = data.fields || {};

  // ---- Header (right column) ----
  draw(F.invoice_no, 408, 265.8);
  draw(F.invoice_date, 408, 286.8);
  // ---- Header (left column) ----
  draw(F.po_date, 137, 289.5);

  // ---- Bill To / Ship To address boxes (multi-line) ----
  const drawBlock = (txt, x, yt0) => {
    if (!txt) return;
    String(txt)
      .split("\n")
      .slice(0, 6)
      .forEach((line, i) => draw(line.trim(), x, yt0 + i * 11.5, { size: 9 }));
  };
  drawBlock(data.bill_to, 31, 318);
  drawBlock(data.ship_to, 299, 318);

  // ---- State code / PAN row ----
  draw(F.pan_no_left, 139, 409.5);
  draw(F.pan_no_right, 408, 409.5);

  // ---- Transport ----
  draw(F.week_no, 139, 427.8);
  draw(F.vehicle_no, 408, 455.9);

  // ---- Bottom transport block ----
  draw(F.eway_bill_no, 116, 585.8);
  draw(F.eway_valid_till, 116, 595.8, { size: 8 });
  draw(F.region, 294, 583.3);
  draw(F.destination, 298, 598.4);

  // ---- Un-bold the baked "NA" next to PARTY CODE: cover it and redraw normal ----
  page.drawRectangle({
    x: 299,
    y: PAGE_H - 570,
    width: 24,
    height: 13,
    color: white,
  });
  draw("NA", 301.8, 567.9, { size: 9 });

  // ---- Line items ----
  // Row 0 aligns with the template's baked product/UOM/currency; only the
  // numeric columns are filled. Extra rows (rare) also print product + UOM.
  const items = data.line_items || [];
  items.forEach((r, i) => {
    const yt = 486.5 + i * 17;
    if (i > 0) {
      draw(r.sr, 44, yt, { align: "center" });
      draw(r.product, 63, yt);
      draw("MT", 241, yt);
    }
    draw(r.mt, 321, yt, { align: "right" });
    draw(r.no_of_bags, 393, yt, { align: "right" });
    draw(r.rate_per_mt, 456, yt, { align: "right" });
    draw(r.amount, 563, yt, { align: "right" });
  });

  // ---- Totals (right column, right-aligned under Amount) ----
  const T = data.totals || {};
  const money = (v) => (v ? fmt(v, 2) : "");
  draw(money(T.sub_total), 563, 552.3, { align: "right" });
  draw(money(T.taxable), 563, 568.1, { align: "right" });
  draw(money(T.central), 563, 581.4, { align: "right" });
  draw(money(T.state), 563, 592.7, { align: "right" });
  draw(money(T.grand), 563, 670.6, { align: "right", size: 10 });

  // ---- Amount in words ----
  if (T.gst) draw(amountWords(T.gst), 116, 685.8, { size: 8 });
  if (T.grand) draw(amountWords(T.grand), 116, 701.6, { size: 8 });

  const out = await pdf.save();
  return new Blob([out], { type: "application/pdf" });
}
