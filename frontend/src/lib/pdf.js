// Browser-side PDF generation using jsPDF.
// Replaces the previous FastAPI/reportlab endpoint so the app can run
// fully on Netlify with no backend.

import { jsPDF } from "jspdf";

function calibrationFactors(cal, device) {
  if (!cal) return { vScale: 1, hScale: 1, vOffset: 0, hOffset: 0, rotationDeg: 0 };
  const profile =
    cal[device] ||
    cal.desktop ||
    (cal.vertical_set !== undefined ? cal : null);
  if (!profile) return { vScale: 1, hScale: 1, vOffset: 0, hOffset: 0, rotationDeg: 0 };
  const vSet = Number(profile.vertical_set) || 1;
  const vAct = Number(profile.vertical_actual) || 1;
  const hSet = Number(profile.horizontal_set) || 1;
  const hAct = Number(profile.horizontal_actual) || 1;
  return {
    vScale: vAct ? vSet / vAct : 1,
    hScale: hAct ? hSet / hAct : 1,
    vOffset: Number(profile.vertical_offset) || 0,
    hOffset: Number(profile.horizontal_offset) || 0,
    rotationDeg: Number(profile.rotation_deg) || 0,
  };
}

// Apply scale + offset, then a SHEAR to compensate for printer/preview skew.
//
// Positive rotation_deg means: "I observe text tilting UP toward the right
// edge of the page" (i.e., right-side text appears HIGHER on the printed page).
// Compensation: draw right-side text LOWER in the PDF (larger top_cm) so it
// lands level after the printer's distortion.
//
// We use a shear (y_pdf = y + x*tan(theta)) instead of a full 2D rotation
// because (a) it has the correct sign, (b) it's invariant under choice of
// pivot for typical small angles, and (c) it leaves x positions unchanged
// which prevents any horizontal drift. For angles under ~5° the visual
// difference vs. true rotation is imperceptible.
function applyCalibration(topCm, leftCm, cal) {
  const t = topCm * cal.vScale + cal.vOffset;
  const l = leftCm * cal.hScale + cal.hOffset;
  if (!cal.rotationDeg) return { left: l, top: t };
  const tan = Math.tan((cal.rotationDeg * Math.PI) / 180);
  return {
    left: l,
    top: t + l * tan,
  };
}

function setFontFor(doc, bold) {
  // jsPDF ships with Courier-Bold built in — perfect typewriter look.
  doc.setFont("Courier", bold ? "bold" : "normal");
}

function drawText(doc, text, topCm, leftCm, fontSize, bold, cal) {
  if (text === null || text === undefined || text === "") return;
  setFontFor(doc, bold);
  doc.setFontSize(fontSize || 11);
  const { left, top } = applyCalibration(topCm, leftCm, cal);
  // jsPDF angle: positive = CCW. We rotate glyphs CW by rotationDeg → -angle.
  const opts = cal.rotationDeg ? { angle: -cal.rotationDeg } : undefined;
  doc.text(String(text), left, top, opts);
}

function drawBoxText(doc, text, cfg, cal) {
  if (!text) return;
  const fontSize = cfg.font_size || 11;
  const bold = cfg.bold !== false;
  const lineHeight = cfg.line_height || 0.5;
  setFontFor(doc, bold);
  doc.setFontSize(fontSize);
  const opts = cal.rotationDeg ? { angle: -cal.rotationDeg } : undefined;

  const lines = String(text).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lineTopRaw = cfg.top + i * lineHeight;
    if (lineTopRaw - cfg.top > cfg.height) break;
    const { left, top } = applyCalibration(lineTopRaw, cfg.left, cal);
    doc.text(lines[i], left, top, opts);
  }
}

/**
 * @param {object} settings - full settings object (with calibration, line_items, etc.)
 * @param {object} data - { single_values, bill_to, ship_to, line_items: [...] }
 * @param {string} device - "desktop" | "iphone" (auto-detected by caller)
 * @returns {Blob} PDF blob
 */
export function generatePdfBlob(settings, data, device = "desktop") {
  const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "portrait" });
  const cal = calibrationFactors(settings.calibration, device);

  const singleFields = settings.single_fields || {};
  const boxFields = settings.box_fields || {};
  const lineItemsCfg = settings.line_items || {};

  // Single-line fields
  Object.entries(data.single_values || {}).forEach(([key, value]) => {
    const cfg = singleFields[key];
    if (!cfg) return;
    drawText(
      doc,
      value,
      cfg.top,
      cfg.left,
      cfg.font_size,
      cfg.bold,
      cal
    );
  });

  // Address boxes
  if (boxFields.bill_to && data.bill_to) {
    drawBoxText(doc, data.bill_to, boxFields.bill_to, cal);
  }
  if (boxFields.ship_to && data.ship_to) {
    drawBoxText(doc, data.ship_to, boxFields.ship_to, cal);
  }

  // Line items
  const rows = data.line_items || [];
  if (lineItemsCfg && rows.length) {
    const firstRowTop = lineItemsCfg.first_row_top ?? 17.5;
    const rowHeight = lineItemsCfg.row_height ?? 0.6;
    const fontSize = lineItemsCfg.font_size ?? 11;
    const bold = lineItemsCfg.bold !== false;
    const columns = lineItemsCfg.columns || {};
    rows.forEach((row, idx) => {
      const rowTop = firstRowTop + idx * rowHeight;
      Object.entries(columns).forEach(([colKey, colCfg]) => {
        const value = row[colKey] || "";
        if (!value) return;
        const topOffset = colCfg.top_offset || 0;
        drawText(
          doc,
          value,
          rowTop + topOffset,
          colCfg.left,
          fontSize,
          bold,
          cal
        );
      });
    });
  }

  return doc.output("blob");
}
