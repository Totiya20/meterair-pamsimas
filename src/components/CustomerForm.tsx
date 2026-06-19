import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

export type CustomerFormValues = {
  customer_code: string;
  name: string;
  address: string;
  phone: string;
  meter_id: string;
  last_reading: string;
  tariff: string;
  notes: string;
};

type Props = {
  initial?: Partial<CustomerFormValues>;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: CustomerFormValues) => void;
};

export function CustomerForm({ initial, submitting, submitLabel = "Simpan", onSubmit }: Props) {
  const [v, setV] = useState<CustomerFormValues>({
    customer_code: initial?.customer_code ?? "",
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    meter_id: initial?.meter_id ?? "",
    last_reading: initial?.last_reading ?? "0",
    tariff: initial?.tariff ?? "4000",
    notes: initial?.notes ?? "",
  });

  function field<K extends keyof CustomerFormValues>(k: K, val: CustomerFormValues[K]) {
    setV((s) => ({ ...s, [k]: val }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="code">Kode pelanggan *</Label>
        <Input
          id="code"
          value={v.customer_code}
          onChange={(e) => field("customer_code", e.target.value.toUpperCase())}
          placeholder="PDAM-001"
          required
        />
        <p className="text-[11px] text-slate-500">Akan dijadikan QR code untuk ditempel di meteran.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nama pelanggan *</Label>
        <Input id="name" value={v.name} onChange={(e) => field("name", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Alamat *</Label>
        <Input id="address" value={v.address} onChange={(e) => field("address", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">No. HP *</Label>
        <Input id="phone" value={v.phone} onChange={(e) => field("phone", e.target.value)} placeholder="08…" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="meter">No. meteran</Label>
          <Input id="meter" value={v.meter_id} onChange={(e) => field("meter_id", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Bacaan awal</Label>
          <Input
            id="last"
            type="number"
            min={0}
            value={v.last_reading}
            onChange={(e) => field("last_reading", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tariff">Tarif (Rp/m³)</Label>
        <Input
          id="tariff"
          type="number"
          min={0}
          value={v.tariff}
          onChange={(e) => field("tariff", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Catatan</Label>
        <Input id="notes" value={v.notes} onChange={(e) => field("notes", e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {submitLabel}
      </Button>
    </form>
  );
}
