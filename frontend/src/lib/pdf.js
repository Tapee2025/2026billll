// Full-page GST tax invoice generator (browser-side, jsPDF).
//
// The company letterhead (logo + address) is PRE-PRINTED on the physical
// paper. This module leaves a blank band of `letterhead_cm` at the very top
// and draws the ENTIRE rest of the invoice — borders, boxes, the line-item
// table, tax totals, bank details, a live UPI QR code and the signature
// block — matching the reference bill, so it prints onto blank letterhead
// paper.
//
// All coordinates are in centimetres from the top-left of A4 (21 × 29.7 cm).

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { rupeesToWords, fmt } from "./numberToWords";

const PAGE_W = 21.0;
const ML = 0.6; // left margin
const MR = 20.4; // right edge

// Reference vertical layout assumes a 4.0 cm letterhead. If the user changes
// letterhead_cm we shift every y-coordinate by the difference.
const BASE_LETTERHEAD = 4.0;

export async function generatePdfBlob(settings, data) {
  const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "portrait" });
  const company = settings.company || {};
  const gstPct = Number(settings.calculation?.gst_percent) || 18;
  const halfPct = (gstPct / 2).toFixed(2);
  const S = (Number(settings.letterhead_cm) || BASE_LETTERHEAD) - BASE_LETTERHEAD;

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
  // "LABEL :  value" on one line, value at a fixed column
  const kv = (label, value, x, y, valueX, size = 8) => {
    setFont(true, size);
    text(label, x, y);
    setFont(false, size);
    text(value == null ? "" : value, valueX, y);
  };

  doc.setLineWidth(0.02);
  doc.setDrawColor(0);

  const FT = 4.15; // frame top (absolute; S shifts it)
  const FB = 28.7; // frame bottom

  // ===== Outer frame =====
  rect(ML, FT, MR - ML, FB - FT);

  // ===== Title band =====
  const titleLine = 4.8;
  setFont(true, 13);
  text("TAX INVOICE", PAGE_W / 2, 4.58, { align: "center" });
  setFont(false, 8);
  text("Original", MR - 0.15, 4.5, { align: "right" });
  line(ML, titleLine, MR, titleLine);

  // ===== GSTIN / PAN / MSME band =====
  const gstinLine = 6.0;
  kv("GSTIN No. :", company.gstin, ML + 0.15, 5.15, 3.2, 9);
  kv("PAN No. :", company.pan, ML + 0.15, 5.5, 3.2, 9);
  kv("MSME No. :", company.msme, ML + 0.15, 5.85, 3.2, 9);
  line(ML, gstinLine, MR, gstinLine);

  // ===== middle vertical divider (party + boxes + transport) =====
  const MIDX = 10.5;
  const partyHeaderLine = 7.1;
  const billShipLine = 10.0;
  const transportLine = 12.1;
  line(MIDX, gstinLine, MIDX, transportLine);

  // ---- Left: place of supply / P.O. ; Right: invoice no / date ----
  const F = data.fields || {};
  kv("PLACE OF SUPPLY :", company.place_of_supply, ML + 0.15, 6.35, 4.0);
  kv("P.O. NO. :", F.po_no, ML + 0.15, 6.7, 4.0);
  kv("P.O. DATE :", F.po_date, ML + 0.15, 7.05, 4.0);
  kv("INVOICE NO. :", F.invoice_no, MIDX + 0.2, 6.35, 13.4);
  kv("INVOICE DATE :", F.invoice_date, MIDX + 0.2, 6.7, 13.4);
  line(ML, partyHeaderLine, MR, partyHeaderLine);

  // ---- Bill To / Ship To boxes ----
  setFont(true, 8.5);
  text("DETAILS OF BILL TO", ML + 0.15, 7.42);
  text("DETAILS OF SHIP TO", MIDX + 0.2, 7.42);
  line(ML, 7.6, MIDX, 7.6);
  line(MIDX, 7.6, MR, 7.6);

  const drawAddress = (str, x, maxW) => {
    if (!str) return;
    setFont(false, 8.5);
    let y = 7.95;
    String(str)
      .split("\n")
      .forEach((raw) => {
        doc.splitTextToSize(raw, maxW).forEach((ln) => {
          if (y > 9.9) return;
          text(ln, x, y);
          y += 0.4;
        });
      });
  };
  drawAddress(data.bill_to, ML + 0.15, MIDX - ML - 0.3);
  drawAddress(data.ship_to, MIDX + 0.2, MR - MIDX - 0.4);
  line(ML, billShipLine, MR, billShipLine);

  // ---- State code / PAN / transport ----
  kv("STATE CODE :", company.state_code, ML + 0.15, 10.35, 3.6);
  kv("PAN No. :", F.pan_no_left, ML + 0.15, 10.75, 3.6);
  kv("WEEK NO :", F.week_no, ML + 0.15, 11.15, 3.6);
  kv("MODE OF TRANSPORT :", F.mode_of_transport, ML + 0.15, 11.55, 4.8);
  kv("FREIGHT :", F.freight, ML + 0.15, 11.95, 3.6);

  kv("STATE CODE :", company.state_code, MIDX + 0.2, 10.35, 13.4);
  kv("PAN No. :", F.pan_no_right, MIDX + 0.2, 10.75, 13.4);
  kv("TRANSPORTER NAME :", F.transporter_name, MIDX + 0.2, 11.15, 14.0);
  kv("L.R. NO. :", F.lr_no, MIDX + 0.2, 11.55, 13.4);
  kv("VEHICLE NO. :", F.vehicle_no, MIDX + 0.2, 11.95, 13.4);
  line(ML, transportLine, MR, transportLine);

  // ===== Line items table =====
  const cols = [
    { key: "sr", label: "Sr\nNo", x: ML, w: 0.8, align: "center" },
    { key: "product", label: "Product Name", x: 1.4, w: 5.0, align: "left" },
    { key: "hsn", label: "HSN", x: 6.4, w: 1.6, align: "center" },
    { key: "uom", label: "U.O.M", x: 8.0, w: 0.9, align: "center" },
    { key: "mt", label: "MT", x: 8.9, w: 1.1, align: "right" },
    { key: "no_of_bags", label: "No. of\nBags", x: 10.0, w: 1.5, align: "right" },
    { key: "rate_per_mt", label: "Rate\nPer MT", x: 11.5, w: 2.2, align: "right" },
    { key: "cur", label: "Cur", x: 13.7, w: 1.0, align: "center" },
    { key: "amount", label: "Amount", x: 14.7, w: MR - 14.7, align: "right" },
  ];
  const tableHeaderTop = 12.1;
  const tableHeaderLine = 12.65;
  const tableBottom = 16.65;

  doc.setFillColor(230, 230, 230);
  rect(ML, tableHeaderTop, MR - ML, tableHeaderLine - tableHeaderTop, "F");
  setFont(true, 7);
  const cxOf = (c) =>
    c.align === "center"
      ? c.x + c.w / 2
      : c.align === "right"
      ? c.x + c.w - 0.1
      : c.x + 0.1;
  cols.forEach((c) => {
    const cx = cxOf(c);
    c.label.split("\n").forEach((p, i) =>
      text(p, cx, 12.34 + i * 0.28, { align: c.align })
    );
  });
  cols.slice(1).forEach((c) => line(c.x, tableHeaderTop, c.x, tableBottom));
  line(ML, tableHeaderLine, MR, tableHeaderLine);

  const rows = data.line_items || [];
  const rowH = 0.5;
  rows.forEach((r, i) => {
    const y = tableHeaderLine + i * rowH + 0.33;
    if (y > tableBottom) return;
    setFont(false, 8);
    cols.forEach((c) => {
      let val;
      if (c.key === "sr") val = r.sr ?? i + 1;
      else if (c.key === "uom") val = "MT";
      else if (c.key === "cur") val = "INR";
      else if (c.key === "hsn") val = company.hsn || "";
      else val = r[c.key] || "";
      if (val === "" || val == null) return;
      text(val, cxOf(c), y, { align: c.align });
    });
  });
  line(ML, tableBottom, MR, tableBottom);

  // ===== Amount in words (full width) =====
  const T = data.totals || {};
  const amountWordsLine = 17.75;
  kv(
    "BILL AMOUNT :",
    rupeesToWords(T.grand || 0),
    ML + 0.15,
    17.05,
    ML + 3.3,
    8
  );
  kv("TOTAL GST :", rupeesToWords(T.gst || 0), ML + 0.15, 17.45, ML + 3.3, 8);
  line(ML, amountWordsLine, MR, amountWordsLine);

  // ===== Bottom split =====
  const BSPLIT = 12.5;
  line(BSPLIT, amountWordsLine, BSPLIT, FB);

  // ---- Left bottom: transport + bank + terms ----
  kv("DRIVER MOBILE :", F.driver_mobile, ML + 0.15, 18.1, 3.7);
  kv("EWAY BILL NO :", F.eway_bill_no, ML + 0.15, 18.5, 3.7);
  kv("VALID TILL :", F.eway_valid_till, ML + 0.15, 18.9, 3.7);
  line(ML, 19.15, BSPLIT, 19.15);

  setFont(true, 8.5);
  text("BANK DETAILS", ML + 0.15, 19.5);
  kv("BANK NAME :", company.bank_name, ML + 0.15, 19.9, 3.3);
  kv("A/C NO. :", company.account_no, ML + 0.15, 20.3, 3.3);
  kv("IFSC CODE :", company.ifsc, ML + 0.15, 20.7, 3.3);
  kv("BRANCH :", company.branch, ML + 0.15, 21.1, 3.3);
  kv("A/C TYPE :", company.account_type, ML + 0.15, 21.5, 3.3);
  line(ML, 21.8, BSPLIT, 21.8);

  setFont(true, 8);
  text("Terms & Condition :", ML + 0.15, 22.15);
  setFont(false, 7);
  let ty = 22.55;
  (company.terms || []).forEach((t, i) => {
    doc.splitTextToSize(`${i + 1}. ${t}`, BSPLIT - ML - 0.3).forEach((ln) => {
      if (ty > FB - 0.15) return;
      text(ln, ML + 0.15, ty);
      ty += 0.34;
    });
  });

  // ---- Right bottom: party / totals / QR / signature ----
  kv("PARTY CODE :", F.tpca_code, BSPLIT + 0.2, 18.1, 15.0);
  kv("REGION :", F.region, BSPLIT + 0.2, 18.5, 15.0);
  kv("DESTINATION :", F.destination, BSPLIT + 0.2, 18.9, 15.0);
  line(BSPLIT, 19.15, MR, 19.15);

  const totalRow = (label, value, y, bold = false) => {
    setFont(bold, bold ? 9 : 8);
    text(label, BSPLIT + 0.2, y);
    text(fmt(value || 0), MR - 0.15, y, { align: "right" });
  };
  totalRow("Sub Total", T.sub_total, 19.5);
  totalRow("Taxable Amount", T.taxable, 19.9);
  totalRow(`Central Tax ${halfPct}%`, T.central, 20.3);
  totalRow(`State/UT Tax ${halfPct}%`, T.state, 20.7);
  totalRow("Total GST", T.gst, 21.1);
  doc.setFillColor(230, 230, 230);
  rect(BSPLIT, 21.25, MR - BSPLIT, 0.5, "F");
  totalRow("Grand Total", T.grand, 21.6, true);
  line(BSPLIT, 21.85, MR, 21.85);

  // QR code (live UPI, encodes the bill amount)
  const qrCenterX = BSPLIT + 0.2 + (MR - BSPLIT - 0.2) / 2;
  setFont(true, 8);
  text("SCAN UPI QR", qrCenterX, 22.25, { align: "center" });
  if (company.upi_id) {
    const amt = Number(T.grand || 0).toFixed(2);
    const upi = `upi://pay?pa=${encodeURIComponent(
      company.upi_id
    )}&pn=${encodeURIComponent(company.name || "")}&cu=INR${
      Number(amt) > 0 ? `&am=${amt}` : ""
    }`;
    try {
      const dataUrl = await QRCode.toDataURL(upi, { margin: 0, width: 240 });
      doc.addImage(dataUrl, "PNG", qrCenterX - 1.1, 22.45 + S, 2.2, 2.2);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("QR generation failed", e);
    }
    setFont(false, 6.5);
    text(company.upi_id, qrCenterX, 25.05, { align: "center" });
  }

  // Signature block
  setFont(true, 8.5);
  text(`For, ${company.name || ""}`, MR - 0.15, 25.7, { align: "right" });
  setFont(false, 8);
  text("(Authorised Signatory)", MR - 0.15, 28.3, { align: "right" });

  return doc.output("blob");
}
