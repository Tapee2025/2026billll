// Full-page GST tax invoice generator (browser-side, jsPDF).
//
// The company letterhead (logo + address) is PRE-PRINTED on the physical
// paper. This module leaves a blank band of `letterhead_cm` at the very top
// and draws the ENTIRE rest of the invoice to match the company's reference
// bill, so it prints onto blank letterhead paper.
//
// All coordinates are in centimetres from the top-left of A4 (21 × 29.7 cm).

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { rupeesToWords, fmt } from "./numberToWords";

const PAGE_W = 21.0;
const ML = 0.6; // left margin
const MR = 20.4; // right edge
const BASE_LETTERHEAD = 4.0;

export async function generatePdfBlob(settings, data) {
  const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "portrait" });
  const company = settings.company || {};
  const gstPct = Number(settings.calculation?.gst_percent) || 18;
  const halfPct = (gstPct / 2).toFixed(2);
  const S = (Number(settings.letterhead_cm) || BASE_LETTERHEAD) - BASE_LETTERHEAD;
  const F = data.fields || {};
  const T = data.totals || {};

  // ---- drawing helpers (all apply the letterhead shift S) ----
  const rect = (x, y, w, h, style = "S") => doc.rect(x, y + S, w, h, style);
  const line = (x1, y1, x2, y2) => doc.line(x1, y1 + S, x2, y2 + S);
  const setFont = (bold, size) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };
  const text = (str, x, y, opts = {}) => {
    if (str === null || str === undefined) str = "";
    doc.text(String(str), x, y + S, opts);
  };
  const kv = (label, value, x, y, valueX, size = 8) => {
    setFont(true, size);
    text(label, x, y);
    setFont(false, size);
    text(value == null ? "" : value, valueX, y);
  };

  doc.setLineWidth(0.02);
  doc.setDrawColor(0);

  // ===== Title (above the box) =====
  setFont(true, 13);
  doc.text("TAX INVOICE", PAGE_W / 2, 4.35 + S, { align: "center", charSpace: 0.06 });
  setFont(false, 8);
  text("Original", MR - 0.1, 4.35, { align: "right" });

  const FT = 4.7; // main box top
  const FB = 28.7; // main box bottom
  rect(ML, FT, MR - ML, FB - FT);

  // ===== GSTIN / PAN / MSME (full width, tall spacing) =====
  const gstinLine = 7.5;
  kv("GSTIN No. :", company.gstin, ML + 0.2, 5.35, 3.1, 9);
  kv("PAN No. :", company.pan, ML + 0.2, 6.15, 3.1, 9);
  kv("MSME No. :", company.msme, ML + 0.2, 6.95, 3.1, 9);
  line(ML, gstinLine, MR, gstinLine);

  // ===== middle divider (party + address + transport) =====
  const MIDX = 10.5;
  const transportLine = 15.2;
  line(MIDX, gstinLine, MIDX, transportLine);

  // ---- Place of supply / P.O.  |  Invoice no / date ----
  const partyLine = 9.15;
  kv("PLACE OF SUPPLY :", company.place_of_supply, ML + 0.2, 7.9, 4.0);
  kv("P.O. NO. :", F.po_no, ML + 0.2, 8.35, 4.0);
  kv("P.O. DATE :", F.po_date, ML + 0.2, 8.8, 4.0);
  kv("INVOICE NO. :", F.invoice_no, MIDX + 0.2, 7.95, 13.4);
  kv("INVOICE DATE :", F.invoice_date, MIDX + 0.2, 8.5, 13.4);
  line(ML, partyLine, MR, partyLine);

  // ---- Bill To / Ship To ----
  const billShipLine = 12.5;
  setFont(true, 8.5);
  text("DETAILS OF BILL TO", ML + 0.2, 9.5);
  text("DETAILS OF SHIP TO", MIDX + 0.2, 9.5);
  line(ML, 9.7, MR, 9.7);
  const drawAddress = (str, x, maxW) => {
    if (!str) return;
    setFont(false, 8.5);
    let y = 10.15;
    String(str)
      .split("\n")
      .forEach((raw) => {
        doc.splitTextToSize(raw, maxW).forEach((ln) => {
          if (y > 12.4) return;
          text(ln, x, y);
          y += 0.42;
        });
      });
  };
  drawAddress(data.bill_to, ML + 0.2, MIDX - ML - 0.4);
  drawAddress(data.ship_to, MIDX + 0.2, MR - MIDX - 0.4);
  line(ML, billShipLine, MR, billShipLine);

  // ---- State code / PAN ----
  const statePanLine = 13.6;
  kv("STATE CODE :", company.state_code, ML + 0.2, 12.9, 3.6);
  kv("PAN No. :", F.pan_no_left, ML + 0.2, 13.35, 3.6);
  kv("STATE CODE :", company.state_code, MIDX + 0.2, 12.9, 13.4);
  kv("PAN No. :", F.pan_no_right, MIDX + 0.2, 13.35, 13.4);
  line(ML, statePanLine, MR, statePanLine);

  // ---- Transport ----
  kv("WEEK NO :", F.week_no, ML + 0.2, 13.95, 3.6);
  kv("MODE OF TRANSPORT :", F.mode_of_transport, ML + 0.2, 14.4, 4.8);
  kv("FREIGHT :", F.freight, ML + 0.2, 14.85, 3.6);
  kv("TRANSPORTER NAME :", F.transporter_name, MIDX + 0.2, 13.95, 14.1);
  kv("L.R. NO. :", F.lr_no, MIDX + 0.2, 14.4, 13.4);
  kv("VEHICLE NO. :", F.vehicle_no, MIDX + 0.2, 14.85, 13.4);
  line(ML, transportLine, MR, transportLine);

  // ===== Line items table (HSN sits UNDER the product name) =====
  const cols = [
    { key: "sr", label: "SrNo", x: ML, w: 0.9, align: "center" },
    { key: "product", label: "Product Name", x: 1.5, w: 6.2, align: "left" },
    { key: "uom", label: "U.O.M.", x: 7.7, w: 1.3, align: "center" },
    { key: "mt", label: "MT", x: 9.0, w: 1.4, align: "right" },
    { key: "no_of_bags", label: "No. Of Bags", x: 10.4, w: 1.9, align: "right" },
    { key: "rate_per_mt", label: "Rate Per MT", x: 12.3, w: 1.9, align: "right" },
    { key: "cur", label: "Currency", x: 14.2, w: 1.3, align: "center" },
    { key: "amount", label: "Amount", x: 15.5, w: MR - 15.5, align: "right" },
  ];
  const tableHeaderLine = 15.85;
  const tableBottom = 19.0;
  const cxOf = (c) =>
    c.align === "center"
      ? c.x + c.w / 2
      : c.align === "right"
      ? c.x + c.w - 0.12
      : c.x + 0.12;

  setFont(true, 7.5);
  cols.forEach((c) => text(c.label, cxOf(c), 15.55, { align: c.align }));
  cols.slice(1).forEach((c) => line(c.x, transportLine, c.x, tableBottom));
  line(ML, tableHeaderLine, MR, tableHeaderLine);

  const rows = data.line_items || [];
  const rowH = 0.62;
  rows.forEach((r, i) => {
    const y = tableHeaderLine + i * rowH + 0.4;
    if (y > tableBottom) return;
    setFont(false, 8);
    cols.forEach((c) => {
      let val;
      if (c.key === "sr") val = r.sr ?? i + 1;
      else if (c.key === "uom") val = "MT";
      else if (c.key === "cur") val = "INR";
      else val = r[c.key] || "";
      if (val === "" || val == null) return;
      text(val, cxOf(c), y, { align: c.align });
    });
    if (r.product) {
      setFont(false, 6);
      doc.setTextColor(80);
      text(`HSN ${company.hsn || ""}`, 1.5 + 0.12, y + 0.3);
      doc.setTextColor(0);
    }
  });
  line(ML, tableBottom, MR, tableBottom);

  // ===== Bottom region: 3 columns (Bank | Party+QR | Totals) =====
  const AX2 = 7.7; // col A / col B divider
  const CX = 13.6; // col B / col C divider (totals)
  const driverLine = 20.55;
  const BRB = 23.1; // bottom region bottom
  line(AX2, tableBottom, AX2, BRB);
  line(CX, tableBottom, CX, BRB);

  // -- Col A: driver / eway, then bank --
  kv("DRIVER MOBILE :", F.driver_mobile, ML + 0.2, 19.35, 3.3);
  kv("EWAY BILL NO :", F.eway_bill_no, ML + 0.2, 19.8, 3.3);
  kv("VALID TILL :", F.eway_valid_till, ML + 0.2, 20.25, 3.3);
  line(ML, driverLine, CX, driverLine);
  kv("BANK NAME :", company.bank_name, ML + 0.2, 20.9, 3.0);
  kv("A/C NO. :", company.account_no, ML + 0.2, 21.35, 3.0);
  kv("IFSC CODE :", company.ifsc, ML + 0.2, 21.8, 3.0);
  kv("BRANCH :", company.branch, ML + 0.2, 22.25, 3.0);
  kv("A/C TYPE :", company.account_type, ML + 0.2, 22.7, 3.0);

  // -- Col B: party / region / destination, then QR --
  kv("PARTY CODE :", F.tpca_code, AX2 + 0.15, 19.35, 10.0);
  kv("REGION :", F.region, AX2 + 0.15, 19.8, 10.0);
  kv("DESTINATION :", F.destination, AX2 + 0.15, 20.25, 10.0);
  setFont(true, 8);
  text("SCAN UPI QR :", AX2 + 0.15, 20.9);
  const qrCx = (AX2 + CX) / 2;
  if (company.upi_id) {
    const amt = Number(T.grand || 0).toFixed(2);
    const upi = `upi://pay?pa=${encodeURIComponent(
      company.upi_id
    )}&pn=${encodeURIComponent(company.name || "")}&cu=INR${
      Number(amt) > 0 ? `&am=${amt}` : ""
    }`;
    try {
      const dataUrl = await QRCode.toDataURL(upi, { margin: 0, width: 220 });
      doc.addImage(dataUrl, "PNG", qrCx - 0.75, 21.05 + S, 1.5, 1.5);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("QR generation failed", e);
    }
    setFont(false, 6);
    text(company.upi_id, qrCx, 22.9, { align: "center" });
  }

  // -- Col C: totals stack --
  const totLabelX = CX + 0.15;
  const totAmtX = MR - 0.15;
  const totPctX = 16.9;
  doc.setFillColor(232, 232, 232);
  rect(CX, 19.0, MR - CX, 0.55, "F"); // Sub Total band
  setFont(false, 8);
  text("Sub Total", totLabelX, 19.4);
  text(fmt(T.sub_total || 0), totAmtX, 19.4, { align: "right" });
  text("Taxable Amount", totLabelX, 19.95);
  text(fmt(T.taxable || 0), totAmtX, 19.95, { align: "right" });
  text("Central Tax", totLabelX, 20.45);
  text(`${halfPct}%`, totPctX, 20.45, { align: "right" });
  text(fmt(T.central || 0), totAmtX, 20.45, { align: "right" });
  text("State/UT Tax", totLabelX, 20.95);
  text(`${halfPct}%`, totPctX, 20.95, { align: "right" });
  text(fmt(T.state || 0), totAmtX, 20.95, { align: "right" });
  doc.setFillColor(232, 232, 232);
  rect(CX, 22.35, MR - CX, 0.6, "F"); // Grand Total band
  setFont(true, 9.5);
  text("Grand Total", totLabelX, 22.78);
  text(fmt(T.grand || 0), totAmtX, 22.78, { align: "right" });
  line(ML, BRB, MR, BRB);

  // ===== Amount in words (full width): TOTAL GST then BILL AMOUNT =====
  const wordsLine = 24.3;
  kv("TOTAL GST :", rupeesToWords(T.gst || 0), ML + 0.2, 23.55, ML + 3.0, 8);
  kv("BILL AMOUNT :", rupeesToWords(T.grand || 0), ML + 0.2, 23.98, ML + 3.0, 8);
  line(ML, wordsLine, MR, wordsLine);

  // ===== Terms (left) + Signature (right) =====
  const SPLITX = 13.6;
  line(SPLITX, wordsLine, SPLITX, FB);
  setFont(true, 8);
  text("Terms & Condition :", ML + 0.2, 24.65);
  setFont(false, 8);
  let ty = 25.1;
  (company.terms || []).forEach((t, i) => {
    doc.splitTextToSize(`${i + 1}. ${t}`, SPLITX - ML - 0.4).forEach((ln) => {
      if (ty > FB - 0.2) return;
      text(ln, ML + 0.2, ty);
      ty += 0.42;
    });
  });

  const sigCx = (SPLITX + MR) / 2;
  setFont(true, 8);
  text(`For, ${company.name || ""}`, sigCx, 24.75, { align: "center" });
  setFont(false, 8);
  text("(Authorised Signatory)", sigCx, 28.4, { align: "center" });

  return doc.output("blob");
}
