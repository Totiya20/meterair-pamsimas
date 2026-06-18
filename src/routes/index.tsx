import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { readWaterMeter } from "@/lib/read-meter.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Camera, Droplets, Loader2, RotateCcw, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MeterAir — Baca Meter Air dengan Kamera" },
      {
        name: "description",
        content:
          "Foto meteran air, biar AI yang baca angkanya. Hitung otomatis biaya pemakaian Rp 4.000/m³.",
      },
      { property: "og:title", content: "MeterAir — Baca Meter Air dengan Kamera" },
      {
        property: "og:description",
        content: "Foto meter air, AI baca angkanya, biaya pemakaian langsung dihitung.",
      },
    ],
  }),
  component: Index,
});

const TARIF = 4000;

type AiResult = { reading: number | null; confidence?: string; notes?: string };

function Index() {
  const fileRef = useRef<HTMLInputElement>(null);
  const readMeter = useServerFn(readWaterMeter);

  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);

  function onPick() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setResult(null);
      setLoading(true);
      try {
        const r = (await readMeter({ data: { imageDataUrl: dataUrl } })) as AiResult;
        setResult(r);
        if (r.reading == null) {
          toast.error("Angka meter tidak terbaca. Coba foto lebih jelas.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal membaca meter.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function reset() {
    setPreview(null);
    setResult(null);
  }

  const reading = result?.reading;
  const cost = reading != null ? reading * TARIF : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/30">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">MeterAir</h1>
            <p className="text-xs text-slate-500">Foto → AI baca → biaya otomatis</p>
          </div>
        </div>
      </header>

      <main className="px-5 pb-24 space-y-4">
        {/* Camera / preview */}
        <Card className="overflow-hidden border-slate-200">
          {!preview ? (
            <button
              onClick={onPick}
              className="flex w-full flex-col items-center justify-center gap-3 px-6 py-14 text-center hover:bg-sky-50/50 transition"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30">
                <Camera className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Foto meteran air</p>
                <p className="mt-1 text-xs text-slate-500">
                  Arahkan kamera ke angka meter, pastikan jelas & terang.
                </p>
              </div>
            </button>
          ) : (
            <div className="relative">
              <img src={preview} alt="Foto meter" className="w-full aspect-[4/3] object-cover" />
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-white backdrop-blur-sm">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <p className="text-sm font-medium">AI sedang membaca angka…</p>
                </div>
              )}
              <button
                onClick={reset}
                className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Foto ulang
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

        {/* Result */}
        {result && !loading && (
          <Card className="p-5 border-slate-200 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Bacaan meter
              </Label>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-slate-900">
                  {reading != null ? reading : "—"}
                </span>
                <span className="text-base text-slate-500">m³</span>
                {result.confidence && (
                  <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                    {result.confidence}
                  </span>
                )}
              </div>
              {result.notes && (
                <p className="mt-2 text-xs text-slate-500">{result.notes}</p>
              )}
            </div>

            {cost != null && (
              <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 p-5 text-white shadow-lg shadow-sky-500/20">
                <div className="flex items-center gap-2 text-sky-100 text-xs font-medium uppercase tracking-wide">
                  <Receipt className="h-3.5 w-3.5" />
                  Estimasi biaya
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    Rp {cost.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-sky-50 border-t border-white/15 pt-3">
                  <span>Volume terbaca</span>
                  <span className="font-semibold tabular-nums">
                    {reading?.toLocaleString("id-ID")} m³
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-sky-100">
                  <span>Tarif</span>
                  <span>Rp {TARIF.toLocaleString("id-ID")} / m³</span>
                </div>
              </div>
            )}

            {reading != null && (
              <Button variant="outline" className="w-full" onClick={reset}>
                Baca meter lain
              </Button>
            )}
          </Card>
        )}

        {!preview && (
          <p className="text-center text-xs text-slate-400 pt-2">
            Tip: pastikan angka pada meter terlihat jelas & tidak buram.
          </p>
        )}
      </main>
    </div>
  );
}
