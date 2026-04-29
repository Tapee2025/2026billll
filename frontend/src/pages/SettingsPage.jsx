import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { fetchSettings, saveSettings, resetSettings } from "@/lib/api";

function NumberInput({ value, onChange, testId, step = 0.1, suffix = "cm" }) {
  return (
    <div className="relative">
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="pr-9 mono"
        data-testid={testId}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        {suffix}
      </span>
    </div>
  );
}

function SingleFieldRow({ fieldKey, cfg, onChange }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end py-3 border-b border-border/60"
      data-testid={`single-row-${fieldKey}`}
    >
      <div className="md:col-span-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Field
        </Label>
        <div className="mt-1.5 text-sm font-medium">{cfg.label}</div>
        <div className="text-[10px] text-muted-foreground mono">{fieldKey}</div>
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase tracking-wide">Top</Label>
        <NumberInput
          value={cfg.top}
          onChange={(v) => onChange({ ...cfg, top: v })}
          testId={`top-${fieldKey}`}
        />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase tracking-wide">Left</Label>
        <NumberInput
          value={cfg.left}
          onChange={(v) => onChange({ ...cfg, left: v })}
          testId={`left-${fieldKey}`}
        />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs uppercase tracking-wide">Font Size</Label>
        <NumberInput
          value={cfg.font_size}
          onChange={(v) => onChange({ ...cfg, font_size: v })}
          step={0.5}
          suffix="pt"
          testId={`fs-${fieldKey}`}
        />
      </div>
      <div className="md:col-span-3 flex items-center gap-2 pb-2">
        <Switch
          checked={!!cfg.bold}
          onCheckedChange={(v) => onChange({ ...cfg, bold: v })}
          data-testid={`bold-${fieldKey}`}
        />
        <Label className="text-sm">Bold (typewriter)</Label>
      </div>
    </div>
  );
}

function BoxFieldRow({ fieldKey, cfg, onChange }) {
  return (
    <div
      className="space-y-3 py-3 border-b border-border/60"
      data-testid={`box-row-${fieldKey}`}
    >
      <div className="text-sm font-semibold">{cfg.label}</div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs uppercase">Top</Label>
          <NumberInput
            value={cfg.top}
            onChange={(v) => onChange({ ...cfg, top: v })}
            testId={`box-top-${fieldKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase">Left</Label>
          <NumberInput
            value={cfg.left}
            onChange={(v) => onChange({ ...cfg, left: v })}
            testId={`box-left-${fieldKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase">Width</Label>
          <NumberInput
            value={cfg.width}
            onChange={(v) => onChange({ ...cfg, width: v })}
            testId={`box-w-${fieldKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase">Height</Label>
          <NumberInput
            value={cfg.height}
            onChange={(v) => onChange({ ...cfg, height: v })}
            testId={`box-h-${fieldKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase">Line Gap</Label>
          <NumberInput
            value={cfg.line_height}
            onChange={(v) => onChange({ ...cfg, line_height: v })}
            testId={`box-lh-${fieldKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase">Font Size</Label>
          <NumberInput
            value={cfg.font_size}
            onChange={(v) => onChange({ ...cfg, font_size: v })}
            step={0.5}
            suffix="pt"
            testId={`box-fs-${fieldKey}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={!!cfg.bold}
          onCheckedChange={(v) => onChange({ ...cfg, bold: v })}
          data-testid={`box-bold-${fieldKey}`}
        />
        <Label className="text-sm">Bold</Label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSettings();
        setSettings(s);
      } catch (e) {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateSingle = (key, newCfg) => {
    setSettings((prev) => ({
      ...prev,
      single_fields: { ...prev.single_fields, [key]: newCfg },
    }));
  };

  const updateBox = (key, newCfg) => {
    setSettings((prev) => ({
      ...prev,
      box_fields: { ...prev.box_fields, [key]: newCfg },
    }));
  };

  const updateLineItems = (patch) => {
    setSettings((prev) => ({
      ...prev,
      line_items: { ...prev.line_items, ...patch },
    }));
  };

  const updateColumn = (colKey, patch) => {
    setSettings((prev) => ({
      ...prev,
      line_items: {
        ...prev.line_items,
        columns: {
          ...prev.line_items.columns,
          [colKey]: { ...prev.line_items.columns[colKey], ...patch },
        },
      },
    }));
  };

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
      const fresh = await resetSettings();
      setSettings(fresh);
      toast.success("Reset to default measurements");
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

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Print Field Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            All measurements are in <span className="mono">cm</span> on A4
            paper (21 × 29.7 cm). <strong>Top</strong> = distance from top edge
            of paper. <strong>Left</strong> = distance from left edge. Adjust
            these to align with your pre-printed invoice exactly.
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
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="btn-save-settings"
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

      <Card>
        <CardHeader>
          <CardTitle>Single-Line Fields</CardTitle>
          <CardDescription>
            Each field has Top (cm) and Left (cm) coordinates. Default values
            pre-filled — adjust as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(settings.single_fields).map(([key, cfg]) => (
            <SingleFieldRow
              key={key}
              fieldKey={key}
              cfg={cfg}
              onChange={(c) => updateSingle(key, c)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address Boxes (Bill To / Ship To)</CardTitle>
          <CardDescription>
            Multi-line text boxes. Width/Height define the printable area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(settings.box_fields).map(([key, cfg]) => (
            <BoxFieldRow
              key={key}
              fieldKey={key}
              cfg={cfg}
              onChange={(c) => updateBox(key, c)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Line Items</CardTitle>
          <CardDescription>
            Set the position of the first row, the spacing between rows, and
            the left position of each column.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs uppercase">First Row Top</Label>
              <NumberInput
                value={settings.line_items.first_row_top}
                onChange={(v) => updateLineItems({ first_row_top: v })}
                testId="li-first-row-top"
              />
            </div>
            <div>
              <Label className="text-xs uppercase">Row Height</Label>
              <NumberInput
                value={settings.line_items.row_height}
                onChange={(v) => updateLineItems({ row_height: v })}
                testId="li-row-height"
              />
            </div>
            <div>
              <Label className="text-xs uppercase">Max Rows</Label>
              <Input
                type="number"
                value={settings.line_items.max_rows}
                onChange={(e) =>
                  updateLineItems({
                    max_rows: parseInt(e.target.value) || 1,
                  })
                }
                className="mono"
                data-testid="li-max-rows"
              />
            </div>
            <div>
              <Label className="text-xs uppercase">Font Size</Label>
              <NumberInput
                value={settings.line_items.font_size}
                onChange={(v) => updateLineItems({ font_size: v })}
                step={0.5}
                suffix="pt"
                testId="li-font-size"
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="text-sm font-semibold">
              Column Positions (per row)
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Left</strong> = horizontal position. <strong>Top
              Offset</strong> = vertical adjustment relative to row baseline
              (use negative values for fields like Product Name that print
              above the HSN code).
            </div>
            {Object.entries(settings.line_items.columns).map(([key, col]) => (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                data-testid={`col-row-${key}`}
              >
                <div className="md:col-span-4 text-sm font-medium">
                  {col.label}
                  <span className="text-[10px] text-muted-foreground mono ml-2">
                    {key}
                  </span>
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs uppercase">Left</Label>
                  <NumberInput
                    value={col.left}
                    onChange={(v) => updateColumn(key, { left: v })}
                    testId={`col-left-${key}`}
                  />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs uppercase">Top Offset</Label>
                  <NumberInput
                    value={col.top_offset ?? 0}
                    onChange={(v) =>
                      updateColumn(key, { top_offset: v })
                    }
                    testId={`col-topoff-${key}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="calc-card">
        <CardHeader>
          <CardTitle>Calculation Rules</CardTitle>
          <CardDescription>
            Used to auto-calculate MT, Rate per MT, Amount and GST. Defaults: 1
            MT = 20 bags · 18% GST (split equally between Central and State).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase">Bags per MT</Label>
              <NumberInput
                value={settings.calculation?.bags_per_mt ?? 20}
                onChange={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    calculation: {
                      ...(prev.calculation || {}),
                      bags_per_mt: v,
                    },
                  }))
                }
                step={1}
                suffix="bags"
                testId="calc-bags-per-mt"
              />
            </div>
            <div>
              <Label className="text-xs uppercase">
                Total GST % (CGST + SGST)
              </Label>
              <NumberInput
                value={settings.calculation?.gst_percent ?? 18}
                onChange={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    calculation: {
                      ...(prev.calculation || {}),
                      gst_percent: v,
                    },
                  }))
                }
                step={0.5}
                suffix="%"
                testId="calc-gst-percent"
              />
            </div>
          </div>
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
