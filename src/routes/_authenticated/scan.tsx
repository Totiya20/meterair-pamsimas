import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { readWaterMeter } from "@/lib/read-meter.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, RotateCcw, Receipt, Save, QrCode, X, User, Phone, MapPin, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { ABONEMEN, computeBill } from "@/lib/billing";
import { QrScanner } from "@/components/QrScanner";
import { z } from "zod";

const searchSchema = z.object({ customer: z.string().optional() });

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Catat Meter — MeterAir Pamsimas" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ScanPage,
});

type Customer = {
  id: string;
  customer_code: string;
  name: string;
  address: string;
  phone: string;
  meter_id: string | null;
  last_reading: number;
  tariff: number;
};

type AiResult = { reading: number | null; confidence?: string; notes?: string };

function ScanPage() {
  const search = useSearch({ from: "/_authenticated/scan" });
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const readMeter = useServerFn(readWaterMeter);

  const [scanning, setScanning] = useState(!search.customer);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCust, setLoadingCust] = useState(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [overrideReading, setOverrideReading] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!search.customer) return;
    setLoadingCust(true);
    supabase
      .from("customers")
      .select("*")
      .eq("customer_code", search.customer)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Pelanggan tidak ditemukan: " + search.customer);
          navigate({ to: "/scan", search: {}, replace: true });
        } else {
          setCustomer(data as Customer);
          setScanning(false);
        }
      })
      .then(() => setLoadingCust(false));
  }, [search.customer, navigate]);

  function handleQrResult(text: string) {
    const code = text.includes("meterair:") ? text.split("meterair:")[1] : text.trim();
    navigate({ to: "/scan", search: { customer: code } });
    setScanning(false);
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setOverrideReading("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setResult(null);
      setAiLoading(true);
      try {
        const r = (await readMeter({ data: { imageDataUrl: dataUrl } })) as AiResult;
        setResult(r);
        if (r.reading != null) setOverrideReading(String(r.reading));
        else toast.error("Angka tidak terbaca. Coba foto lebih jelas atau isi manual.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal membaca meter.");
      } finally {
        setAiLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const finalReading = overrideReading !== "" ? Number(overrideReading) : null;
  const prev = customer?.last_reading ?? 0;
  const tariff = customer?.tariff ?? 4000;
  const rawUsage = finalReading != null && Number.isFinite(finalReading) ? finalReading - prev : null;
  const usage = rawUsage != null ? Math.max(0, rawUsage) : null;
  const cost = usage != null ? usage * tariff : null;
  const bill = usage != null ? computeBill(usage, tariff) : null;

  async function saveReading() {
    if (!customer || finalReading == null || !Number.isFinite(finalReading)) {
      toast.error("Belum ada angka bacaan.");
      return;
    }
    if (rawUsage != null && rawUsage < 0) {
      if (!confirm("Bacaan lebih kecil dari sebelumnya. Tetap simpan?")) return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("readings").insert({
        customer_id: customer.id,
        previous_reading: prev,
        current_reading: finalReading,
        usage: usage ?? 0,
        cost: cost ?? 0,
        notes: result?.notes ?? null,
        read_by: u.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Bacaan tersimpan.");
      navigate({ to: "/customers/$id", params: { id: customer.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingCust) {
    return (
      <div className="px-5 pt-6 flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat pelanggan…
      </div>
    );
  }

  return (
    <div className="px-5 pt-2 space-y-4">
      <header className="pt-2 pb-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Catat Meter</h1>
        <p className="text-xs text-slate-500">
          {customer ? "Pelanggan terpilih, foto meteran sekarang." : "Scan QR di meteran pelanggan."}
        </p>
      </header>

      {scanning && !customer && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <QrCode className="h-4 w-4 text-sky-600" />
            Arahkan kamera ke stiker QR
          </div>
          <QrScanner onResult={handleQrResult} onError={(e) => toast.error(e)} />
          <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
            Batal scan
          </Button>
        </Card>
      )}

      {!scanning && !customer && (
        <Card className="p-5 text-center space-y-3">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <QrCode className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Belum ada pelanggan terpilih</p>
            <p className="text-xs text-slate-500 mt-1">Scan QR atau pilih dari daftar.</p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setScanning(true)}>
              <QrCode className="h-4 w-4 mr-1" /> Scan QR
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/customers">Pilih pelanggan</Link>
            </Button>
          </div>
        </Card>
      )}

      {customer && (
        <>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
                  {customer.customer_code}
                </div>
                <div className="mt-0.5 font-semibold text-slate-900 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> {customer.name}
                </div>
                <div className="mt-1 text-xs text-slate-500 flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {customer.address}
                </div>
                <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </div>
              </div>
              <button
                onClick={() => {
                  setCustomer(null);
                  reset();
                  navigate({ to: "/scan", search: {}, replace: true });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Bacaan terakhir</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {Number(customer.last_reading).toLocaleString("id-ID")} m³
              </span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {!preview ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-3 px-6 py-12 text-center hover:bg-sky-50/50 transition"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30">
                  <Camera className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Foto meteran</p>
                  <p className="mt-1 text-xs text-slate-500">Pastikan angka jelas & terang.</p>
                </div>
              </button>
            ) : (
              <div className="relative">
                <img src={preview} alt="Foto meter" className="w-full aspect-[4/3] object-cover" />
                {aiLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-white backdrop-blur-sm">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <p className="text-sm font-medium">AI sedang membaca…</p>
                  </div>
                )}
                <button
                  onClick={reset}
                  className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Ulang
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFile}
            />
          </Card>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setPreview(null);
              setAiLoading(false);
              setOverrideReading("");
              setResult({ reading: null, notes: "Input manual oleh petugas" });
            }}
          >
            <Keyboard className="h-4 w-4 mr-2" />
            Input manual (angka tidak terbaca kamera)
          </Button>


          {result && !aiLoading && (
            <Card className="p-4 space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-500">
                  Bacaan saat ini
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number"
                    value={overrideReading}
                    onChange={(e) => setOverrideReading(e.target.value)}
                    className="text-2xl font-bold tabular-nums h-12"
                  />
                  <span className="text-base text-slate-500">m³</span>
                </div>
                {result.confidence ? (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Keyakinan AI: <span className="font-medium uppercase">{result.confidence}</span>
                    {result.notes && ` — ${result.notes}`}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Ketik angka meteran secara manual, lalu simpan.
                  </p>
                )}

              </div>

              {cost != null && (
                <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 p-5 text-white shadow-lg shadow-sky-500/20">
                  <div className="flex items-center gap-2 text-sky-100 text-xs font-medium uppercase tracking-wide">
                    <Receipt className="h-3.5 w-3.5" /> Tagihan bulan ini
                  </div>
                  <div className="mt-2 text-3xl font-bold tabular-nums">
                    Rp {(bill?.total ?? cost).toLocaleString("id-ID")}
                  </div>
                  {bill && bill.rule !== "normal" && (
                    <div className="mt-1 text-[11px] text-sky-100">
                      {bill.rule === "diskon"
                        ? `Harga air diskon 50% dari Rp ${bill.hargaAirNormal.toLocaleString("id-ID")} (pemakaian ≥ 50 m³) + abonemen`
                        : `Harga air dibatasi maksimal Rp 100.000 (dari Rp ${bill.hargaAirNormal.toLocaleString("id-ID")}) + abonemen`}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/15 space-y-1 text-sm text-sky-50">
                    <div className="flex justify-between">
                      <span>Pemakaian</span>
                      <span className="font-semibold tabular-nums">
                        {usage?.toLocaleString("id-ID")} m³
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-sky-100">
                      <span>{finalReading?.toLocaleString("id-ID")} − {prev.toLocaleString("id-ID")}</span>
                      <span>Tarif Rp {tariff.toLocaleString("id-ID")}/m³ + abonemen Rp {ABONEMEN.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>
              )}

              {rawUsage != null && rawUsage < 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                  Bacaan saat ini lebih kecil dari bacaan terakhir. Periksa foto atau angka manual.
                </div>
              )}

              <Button
                className="w-full"
                onClick={saveReading}
                disabled={saving || finalReading == null}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Simpan bacaan
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
