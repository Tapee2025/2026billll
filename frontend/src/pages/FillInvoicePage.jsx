import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Plus,
  Trash2,
  FileText,
  Printer,
  ExternalLink,
} from "lucide-react";
import { fetchSettings } from "@/lib/settings";
import { generatePdfBlob } from "@/lib/pdf";
import { detectDevice, DEVICE_LABELS } from "@/lib/device";
import { rupeesToWords, fmt } from "@/lib/numberToWords";

const EMPTY_ROW = { product: "", no_of_bags: "", price_per_bag: "" };

const SINGLE_GROUPS = [
  {
    title: "Header",
    description: "Fields printed at the top of the invoice",
    fields: ["po_no", "po_date", "invoice_no", "invoice_date"],
  },
  {
    title: "PAN Numbers",
    description: "PAN under STATE CODE on both sides",
    fields: ["pan_no_left", "pan_no_right"],
  },
  {
    title: "Transport",
    description: "Week No / Mode / Freight / Transporter / L.R. / Vehicle",
    fields: [
      "week_no",
      "mode_of_transport",
      "freight",
      "transporter_name",
      "lr_no",
      "vehicle_no",
    ],
  },
  {
    title: "Bottom Block",
    description: "Driver, EWAY, TPCA, Region, Destination",
    fields: [
      "driver_mobile",
      "eway_bill_no",
      "tpca_code",
      "region",
      "destination",
    ],
  },
];

const AUTO_TOTAL_KEYS = [
  "sub_total",
  "taxable_amount",
  "central_tax",
  "state_tax",
  "total_gst",
  "grand_total",
  "bill_amount",
];

function computeRow(bags, price, bagsPerMt, gstPct) {
  const b = parseFloat(bags) || 0;
  const p = parseFloat(price) || 0;
  if (!b || !p) {
    return { mt: 0, ratePerMt: 0, taxable: 0, total: 0, central: 0, state: 0 };
  }
  const total = b * p; 
  const factor = 1 + gstPct / 100;
  const taxable = total / factor;
  const tax = total - taxable;
  const central = tax / 2;
  const state = tax / 2;
  const mt = b / bagsPerMt;
  const ratePerMt = mt > 0 ? taxable / mt : 0;
  return { mt, ratePerMt, taxable, total, central, state };
}

export default function FillInvoicePage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // ————————————————————————————————————————————————————————————————
  // INITIAL STATE WITH CUSTOM REQUESTED DEFAULTS
  // ————————————————————————————————————————————————————————————————
  const [singleValues, setSingleValues] = useState({
    invoice_date: "21-05-2026",
    po_date: "21-05-2026",
    invoice_no: "",
    po_no: "SELF",
    pan_no_left: "",
    pan_no_right: "",
    mode_of_transport: "ROAD",
    freight: "TO PAY",
    transporter_name: "SELF",
    lr_no: "NA",
    driver_mobile: "NA",
    tpca_code: "00",
  });
  // ————————————————————————————————————————————————————————————————

  const [billTo, setBillTo] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [sameAsBillTo, setSameAsBillTo] = useState(false);
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSettings();
        setSettings(s);
      } catch (e) {
        toast.error("Failed to load field settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const bagsPerMt = settings?.calculation?.bags_per_mt ?? 20;
  const gstPct = settings?.calculation?.gst_percent ?? 18;

  const computedRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        ...computeRow(r.no_of_bags, r.price_per_bag, bagsPerMt, gstPct),
      })),
    [rows, bagsPerMt, gstPct]
  );

  const totals = useMemo(() => {
    return computedRows.reduce(
      (acc, c) => ({
        subTotal: acc.subTotal + c.taxable,
        taxable: acc.taxable + c.taxable,
        central: acc.central + c.central,
        state: acc.state + c.state,
        grand: acc.grand + c.total,
      }),
      { subTotal: 0, taxable: 0, central: 0, state: 0, grand: 0 }
    );
  }, [computedRows]);

  const singleFieldLabels = useMemo(() => {
    const map = {};
    if (settings) {
      Object.entries(settings.single_fields).forEach(([k, v]) => {
        map[k] = v.label || k;
      });
    }
    return map;
  }, [settings]);

  // ————————————————————————————————————————————————————————————————
  // DYNAMIC HANDLING FOR TRACKING MATCHED FIELDS
  // ————————————————————————————————————————————————————————————————
  const handleSingleChange = (key, value) => {
    setSingleValues((prev) => {
      const next = { ...prev, [key]: value };
      
      // Mirror Invoice Date to PO Date
      if (key === "invoice_date") {
        next.po_date = value;
      }
      
      // Mirror PAN No Bill To (pan_no_left) to PAN No Ship To (pan_no_right)
      if (key === "pan_no_left") {
        next.pan_no_right = value;
      }
      
      return next;
    });
  };
  // ————————————————————————————————————————————————————————————————

  const handleRowChange = (idx, key, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const addRow = () => {
    const max = settings?.line_items?.max_rows ?? 8;
    if (rows.length >= max) {
      toast.warning(`Maximum ${max} rows allowed`);
      return;
    }
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  };

  const removeRow = (idx) => {
    setRows((prev) =>
      prev.length === 1 ? [{ ...EMPTY_ROW }] : prev.filter((_, i) => i !== idx)
    );
  };

  const buildPayload = () => {
    const finalShipTo = sameAsBillTo ? billTo : shipTo;

    const lineItemsForPdf = computedRows
      .filter((r) => r.product || r.no_of_bags || r.price_per_bag)
      .map((r) => ({
        product: (r.product || "").toUpperCase(),
        mt: r.mt ? fmt(r.mt, 2) : "",
        no_of_bags: r.no_of_bags ? String(parseInt(r.no_of_bags) || r.no_of_bags) : "",
        rate_per_mt: r.ratePerMt ? fmt(r.ratePerMt, 2) : "",
        amount: r.taxable ? fmt(r.taxable, 2) : "",
      }));

    const autoTotals = {
      sub_total: totals.subTotal ? fmt(totals.subTotal, 2) : "",
      taxable_amount: totals.taxable ? fmt(totals.taxable, 2) : "",
      central_tax: totals.central ? fmt(totals.central, 2) : "",
      state_tax: totals.state ? fmt(totals.state, 2) : "",
      total_gst: totals.central + totals.state
        ? rupeesToWords(totals.central + totals.state)
        : "",
      grand_total: totals.grand ? fmt(totals.grand, 2) : "",
      bill_amount: totals.grand ? rupeesToWords(totals.grand) : "",
    };

    const merged = { ...singleValues };
    for (const k of AUTO_TOTAL_KEYS) merged[k] = autoTotals[k];

    return {
      single_values: merged,
      bill_to: billTo,
      ship_to: finalShipTo,
      line_items: lineItemsForPdf,
    };
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const device = detectDevice();
      const blob = generatePdfBlob(settings, buildPayload(), device);
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
      const url = window.URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  const activeDevice = detectDevice();

  const downloadFile = () => {
    if (!previewBlob) return;
    const invoiceNo = singleValues.invoice_no || "overlay";
    const url = window.URL.createObjectURL(previewBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_${invoiceNo}.pdf`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      window.URL.revokeObjectURL(url);
    }, 1000);
    toast.success("Download started");
  };

  const openInNewTab = () => {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const printPdf = () => {
    if (!previewUrl) return;
    const iframe = document.getElementById("pdf-preview-iframe");
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch (_) {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="fill-invoice-page">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Fill Invoice</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the fields below. The app generates an A4 PDF with only the
          field text positioned correctly — print it on your pre-printed
          invoice paper. <strong>Tax & totals are auto-calculated</strong>.
        </p>
      </div>

      {SINGLE_GROUPS.map((group) => (
        <Card key={group.title} data-testid={`group-${group.title}`}>
          <CardHeader>
            <CardTitle className="text-lg">{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.fields.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label
                  htmlFor={`f-${key}`}
                  className="text-xs uppercase tracking-wide"
                >
                  {singleFieldLabels[key] || key}
                </Label>
                <Input
                  id={`f-${key}`}
                  data-testid={`input-${key}`}
                  value={singleValues[key] || ""}
                  onChange={(e) => handleSingleChange(key, e.target.value)}
                  className="mono"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card data-testid="group-addresses">
        <CardHeader>
          <CardTitle className="text-lg">Bill To / Ship To</CardTitle>
          <CardDescription>
            Multi-line addresses. Press Enter for new line. Tick the box if
            both are the same.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="bill_to"
                className="text-xs uppercase tracking-wide"
              >
                Details of Bill To
              </Label>
              <Textarea
                id="bill_to"
                data-testid="input-bill_to"
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                rows={5}
                className="mono"
                placeholder={
                  "M/s ABC Traders\nMain Road, Rajkot\nGSTIN: ..."
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="ship_to"
                className="text-xs uppercase tracking-wide"
              >
                Details of Ship To
              </Label>
              <Textarea
                id="ship_to"
                data-testid="input-ship_to"
                value={sameAsBillTo ? billTo : shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                rows={5}
                disabled={sameAsBillTo}
                className="mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="same-as-bill"
              data-testid="checkbox-same-as-bill"
              checked={sameAsBillTo}
              onCheckedChange={(v) => setSameAsBillTo(Boolean(v))}
            />
            <Label htmlFor="same-as-bill" className="cursor-pointer">
              Ship To same as Bill To (no need to fill again)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="group-line-items">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Product Line Items</CardTitle>
            <CardDescription>
              Enter <strong>Product</strong>, <strong>No. of Bags</strong> and{" "}
              <strong>Price/Bag (incl. GST)</strong>. MT, Rate/MT and Amount
              are computed automatically using {bagsPerMt} bags = 1 MT and{" "}
              {gstPct}% GST.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            data-testid="btn-add-row"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Row
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-2 w-8 text-xs font-semibold uppercase">#</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">Product</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">Bags</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">
                    Price/Bag (₹)
                  </th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
                    MT
                  </th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
                    Rate/MT (₹)
                  </th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
                    Amount (₹)
                  </th>
                  <th className="py-2 pl-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const c = computedRows[idx];
                  return (
                    <tr
                      key={idx}
                      data-testid={`row-${idx}`}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 pr-2 text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          data-testid={`row-${idx}-product`}
                          className="mono h-9 uppercase"
                          value={r.product}
                          placeholder="OPC / PPC"
                          onChange={(e) =>
                            handleRowChange(idx, "product", e.target.value)
                          }
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          data-testid={`row-${idx}-bags`}
                          type="number"
                          className="mono h-9"
                          value={r.no_of_bags}
                          onChange={(e) =>
                            handleRowChange(idx, "no_of_bags", e.target.value)
                          }
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          data-testid={`row-${idx}-price`}
                          type="number"
                          step="0.01"
                          className="mono h-9"
                          value={r.price_per_bag}
                          onChange={(e) =>
                            handleRowChange(
                              idx,
                              "price_per_bag",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="py-1 px-1 mono text-muted-foreground" data-testid={`row-${idx}-mt`}>
                        {c.mt ? fmt(c.mt, 2) : "—"}
                      </td>
                      <td className="py-1 px-1 mono text-muted-foreground" data-testid={`row-${idx}-rate`}>
                        {c.ratePerMt ? fmt(c.ratePerMt, 2) : "—"}
                      </td>
                      <td className="py-1 px-1 mono text-muted-foreground" data-testid={`row-${idx}-amount`}>
                        {c.taxable ? fmt(c.taxable, 2) : "—"}
                      </td>
                      <td className="py-1 pl-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(idx)}
                          data-testid={`row-${idx}-remove`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="group-totals">
        <CardHeader>
          <CardTitle className="text-lg">Totals (Auto-Calculated)</CardTitle>
          <CardDescription>
            Read-only. These will be printed in the totals area of the invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mono text-sm">
            <div className="flex justify-between border-b border-border/60 py-2">
              <span className="text-muted-foreground">Sub Total</span>
              <span data-testid="total-sub_total">
                ₹ {fmt(totals.subTotal)}
              </span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-2">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span data-testid="total-taxable">₹ {fmt(totals.taxable)}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-2">
              <span className="text-muted-foreground">
                Central Tax ({(gstPct / 2).toFixed(1)}%)
              </span>
              <span data-testid="total-central">₹ {fmt(totals.central)}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-2">
              <span className="text-muted-foreground">
                State Tax ({(gstPct / 2).toFixed(1)}%)
              </span>
              <span data-testid="total-state">₹ {fmt(totals.state)}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-2 md:col-span-2 font-bold">
              <span>Grand Total</span>
              <span data-testid="total-grand">₹ {fmt(totals.grand)}</span>
            </div>
            <div className="md:col-span-2 py-2">
              <div className="text-xs text-muted-foreground mb-1">
                Total GST (in words)
              </div>
              <div data-testid="total-gst-words" className="text-sm">
                {totals.central + totals.state
                  ? rupeesToWords(totals.central + totals.state)
                  : "—"}
              </div>
            </div>
            <div className="md:col-span-2 py-2">
              <div className="text-xs text-muted-foreground mb-1">
                Bill Amount (in words)
              </div>
              <div data-testid="bill-amount-words" className="text-sm">
                {totals.grand ? rupeesToWords(totals.grand) : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between gap-3 sticky bottom-4 z-10 flex-wrap">
        <div className="text-xs text-muted-foreground bg-card border border-border rounded-md px-3 py-2 shadow-sm" data-testid="active-device">
          Active calibration profile:{" "}
          <span className="font-semibold text-foreground">
            {DEVICE_LABELS[activeDevice]}
          </span>{" "}
          (auto-detected)
        </div>
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={generating}
          data-testid="btn-generate-pdf"
          className="shadow-lg"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Generate Print Preview
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="max-w-5xl w-[95vw] h-[90vh] flex flex-col"
          data-testid="preview-dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Print Preview — A4 Overlay
            </DialogTitle>
            <DialogDescription>
              {activeDevice === "iphone" ? (
                <>
                  <strong>iPhone tip:</strong> tap{" "}
                  <strong>Open in New Tab</strong> below → then tap{" "}
                  <strong>Share → Print</strong>. In the iOS Print panel,
                  pinch the preview thumbnail to zoom; if alignment is off,
                  calibrate the iPhone profile in Settings.
                </>
              ) : (
                <>
                  This is exactly what will print onto your pre-printed
                  invoice paper. Click <strong>Print</strong> to send directly
                  to your printer, or <strong>Download</strong> to save the
                  PDF file. In the print dialog set Scale = 100% (Actual
                  Size).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-secondary rounded-md overflow-hidden">
            {previewUrl ? (
              <iframe
                id="pdf-preview-iframe"
                title="invoice-preview"
                src={previewUrl}
                className="w-full h-full border-0"
                data-testid="preview-iframe"
              />
            ) : null}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={openInNewTab}
              data-testid="btn-open-new-tab"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              onClick={downloadFile}
              data-testid="btn-download-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={printPdf} data-testid="btn-print-pdf">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
