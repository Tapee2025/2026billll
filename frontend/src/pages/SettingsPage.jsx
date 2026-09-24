import React, { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { fetchSettings, saveSettings, resetSettings } from "@/lib/settings";

const COMPANY_FIELDS = [
  { key: "name", label: "Company Name", full: true },
  { key: "gstin", label: "GSTIN No." },
  { key: "pan", label: "Company PAN" },
  { key: "place_of_supply", label: "Place of Supply" },
  { key: "state_code", label: "State Code" },
  { key: "hsn", label: "Product HSN Code" },
];

const BANK_FIELDS = [
  { key: "bank_name", label: "Bank Name" },
  { key: "account_no", label: "A/C No." },
  { key: "ifsc", label: "IFSC Code" },
  { key: "branch", label: "Branch" },
  { key: "account_type", label: "A/C Type" },
  { key: "upi_id", label: "UPI ID (for payment QR)" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setSettings(await fetchSettings());
      } catch (e) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setCompany = (key, value) =>
    setSettings((p) => ({ ...p, company: { ...p.company, [key]: value } }));

  const setCalc = (key, value) =>
    setSettings((p) => ({
      ...p,
      calculation: { ...p.calculation, [key]: value },
    }));

  const setTerm = (idx, value) =>
    setSettings((p) => {
      const terms = [...(p.company.terms || [])];
      terms[idx] = value;
      return { ...p, company: { ...p.company, terms } };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      setSettings(await resetSettings());
      toast.success("Reset to defaults");
    } catch (e) {
      toast.error("Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const c = settings.company || {};

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Company &amp; Invoice Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            These fixed details are printed on every invoice. Verify them once
            (especially the GSTIN and bank details) — they are stored securely
            in the cloud and reused automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            data-testid="btn-reset-settings"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-settings">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <Card data-testid="company-card">
        <CardHeader>
          <CardTitle className="text-lg">Company Details</CardTitle>
          <CardDescription>
            GSTIN, PAN and place of supply printed in the header block.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPANY_FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.full ? "md:col-span-2" : ""}`}>
              <Label className="text-xs uppercase tracking-wide">{f.label}</Label>
              <Input
                data-testid={`company-${f.key}`}
                className="mono"
                value={c[f.key] || ""}
                onChange={(e) => setCompany(f.key, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="bank-card">
        <CardHeader>
          <CardTitle className="text-lg">Bank &amp; Payment Details</CardTitle>
          <CardDescription>
            Printed in the bank block. The UPI ID is encoded into the payment
            QR code (with the bill amount) on every invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BANK_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">{f.label}</Label>
              <Input
                data-testid={`company-${f.key}`}
                className="mono"
                value={c[f.key] || ""}
                onChange={(e) => setCompany(f.key, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="print-card">
        <CardHeader>
          <CardTitle className="text-lg">Print &amp; Calculation</CardTitle>
          <CardDescription>
            Letterhead height (blank top band), bags-to-MT conversion and GST
            rate. Cement (HSN 252329) is <strong>28%</strong> (14% CGST + 14%
            SGST).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">
              Letterhead Height (cm)
            </Label>
            <Input
              type="number"
              step="0.1"
              data-testid="setting-letterhead"
              className="mono"
              value={settings.letterhead_cm ?? 4}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  letterhead_cm: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Bags per MT</Label>
            <Input
              type="number"
              step="1"
              data-testid="setting-bags-per-mt"
              className="mono"
              value={settings.calculation?.bags_per_mt ?? 20}
              onChange={(e) => setCalc("bags_per_mt", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">
              Total GST % (CGST + SGST)
            </Label>
            <Input
              type="number"
              step="0.5"
              data-testid="setting-gst-percent"
              className="mono"
              value={settings.calculation?.gst_percent ?? 28}
              onChange={(e) => setCalc("gst_percent", parseFloat(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="terms-card">
        <CardHeader>
          <CardTitle className="text-lg">Terms &amp; Conditions</CardTitle>
          <CardDescription>Printed at the bottom-left of the invoice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(c.terms || []).map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mono text-sm text-muted-foreground pt-2 w-5">
                {i + 1}.
              </span>
              <Textarea
                data-testid={`term-${i}`}
                rows={2}
                className="text-sm"
                value={t}
                onChange={(e) => setTerm(i, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 sticky bottom-4 z-10">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          data-testid="btn-reset-settings-bottom"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saving}
          data-testid="btn-save-settings-bottom"
          className="shadow-lg"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
