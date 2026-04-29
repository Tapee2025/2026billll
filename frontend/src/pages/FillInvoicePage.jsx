import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { fetchSettings, generatePdf } from "@/lib/api";

const EMPTY_ROW = { mt: "", no_of_bags: "", rate_per_mt: "", amount: "" };

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
  {
    title: "Totals",
    description: "Tax & total amount fields",
    fields: [
      "sub_total",
      "taxable_amount",
      "central_tax",
      "state_tax",
      "total_gst",
      "grand_total",
      "bill_amount",
    ],
  },
];

export default function FillInvoicePage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [singleValues, setSingleValues] = useState({});
  const [billTo, setBillTo] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [sameAsBillTo, setSameAsBillTo] = useState(false);
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);

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

  const singleFieldLabels = useMemo(() => {
    const map = {};
    if (settings) {
      Object.entries(settings.single_fields).forEach(([k, v]) => {
        map[k] = v.label || k;
      });
    }
    return map;
  }, [settings]);

  const handleSingleChange = (key, value) => {
    setSingleValues((prev) => ({ ...prev, [key]: value }));
  };

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
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const finalShipTo = sameAsBillTo ? billTo : shipTo;
      const data = {
        single_values: singleValues,
        bill_to: billTo,
        ship_to: finalShipTo,
        line_items: rows.filter(
          (r) => r.mt || r.no_of_bags || r.rate_per_mt || r.amount
        ),
      };
      const blob = await generatePdf(data);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const invoiceNo = singleValues.invoice_no || "overlay";
      a.download = `invoice_${invoiceNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF generated. Print this on your pre-printed A4 invoice.");
    } catch (e) {
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
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
          Enter the fields below. The app will generate an A4 PDF with only the
          field text positioned correctly — print it on your pre-printed
          invoice paper.
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
                <Label htmlFor={`f-${key}`} className="text-xs uppercase tracking-wide">
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
            Multi-line addresses. Press Enter for new line. Tick the box if both
            are the same.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bill_to" className="text-xs uppercase tracking-wide">
                Details of Bill To
              </Label>
              <Textarea
                id="bill_to"
                data-testid="input-bill_to"
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                rows={5}
                className="mono"
                placeholder={"M/s ABC Traders\nMain Road, Rajkot\nGSTIN: ..."}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship_to" className="text-xs uppercase tracking-wide">
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
              HSN/Product is pre-printed. Fill MT, Bags, Rate and Amount per row.
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
                  <th className="py-2 pr-2 w-10 text-xs font-semibold uppercase">#</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">MT</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">No. of Bags</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">Rate Per MT</th>
                  <th className="py-2 px-2 text-xs font-semibold uppercase">Amount</th>
                  <th className="py-2 pl-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} data-testid={`row-${idx}`} className="border-b border-border/60">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-1 px-1">
                      <Input
                        data-testid={`row-${idx}-mt`}
                        className="mono h-9"
                        value={r.mt}
                        onChange={(e) => handleRowChange(idx, "mt", e.target.value)}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        data-testid={`row-${idx}-bags`}
                        className="mono h-9"
                        value={r.no_of_bags}
                        onChange={(e) => handleRowChange(idx, "no_of_bags", e.target.value)}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        data-testid={`row-${idx}-rate`}
                        className="mono h-9"
                        value={r.rate_per_mt}
                        onChange={(e) => handleRowChange(idx, "rate_per_mt", e.target.value)}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        data-testid={`row-${idx}-amount`}
                        className="mono h-9"
                        value={r.amount}
                        onChange={(e) => handleRowChange(idx, "amount", e.target.value)}
                      />
                    </td>
                    <td className="py-1 pl-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(idx)}
                        data-testid={`row-${idx}-remove`}
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-end gap-3 sticky bottom-4 z-10">
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
            <Download className="w-4 h-4 mr-2" />
          )}
          Generate &amp; Download PDF
        </Button>
      </div>
    </div>
  );
}
