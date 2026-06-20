import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, QrCode as QrIcon, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/qr-print")({
  head: () => ({ meta: [{ title: "Cetak QR — MeterAir Pamsimas" }] }),
  component: QrPrintPage,
});

type Cust = { id: string; customer_code: string; name: string; address: string };

function QrPrintPage() {
  const customers = useQuery({
    queryKey: ["customers", "for-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_code, name, address")
        .order("customer_code");
      if (error) throw error;
      return (data ?? []) as Cust[];
    },
  });

  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!customers.data) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const c of customers.data) {
        out[c.id] = await QRCode.toDataURL(`meterair:${c.customer_code}`, {
          margin: 1,
          width: 320,
        });
      }
      if (!cancelled) setQrs(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [customers.data]);

  const triggerDownload = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderCard = async (c: Cust): Promise<string> => {
    // 600x720 stiker per pelanggan
    const W = 600;
    const H = 720;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // border
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.setLineDash([]);

    // QR
    const qrDataUrl = await QRCode.toDataURL(`meterair:${c.customer_code}`, {
      margin: 1,
      width: 520,
    });
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise((res) => (qrImg.onload = res));
    ctx.drawImage(qrImg, 40, 40, 520, 520);

    // text
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
    ctx.fillText(c.customer_code, W / 2, 605);

    ctx.fillStyle = "#334155";
    ctx.font = "26px system-ui, -apple-system, sans-serif";
    ctx.fillText(truncate(c.name, 32), W / 2, 645);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "22px system-ui, -apple-system, sans-serif";
    ctx.fillText(truncate(c.address, 38), W / 2, 680);

    return canvas.toDataURL("image/png");
  };

  const saveOne = async (c: Cust) => {
    try {
      setSavingId(c.id);
      const png = await renderCard(c);
      triggerDownload(png, `QR-${c.customer_code}-${slug(c.name)}.png`);
      toast.success("QR disimpan ke galeri / Download");
    } catch (e) {
      toast.error("Gagal menyimpan QR");
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    if (!customers.data?.length) return;
    try {
      setSavingAll(true);
      // Composite grid 3 kolom
      const cols = 3;
      const cardW = 600;
      const cardH = 720;
      const gap = 24;
      const pad = 32;
      const rows = Math.ceil(customers.data.length / cols);
      const W = pad * 2 + cols * cardW + (cols - 1) * gap;
      const H = pad * 2 + rows * cardH + (rows - 1) * gap;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < customers.data.length; i++) {
        const c = customers.data[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = pad + col * (cardW + gap);
        const y = pad + row * (cardH + gap);

        const cardDataUrl = await renderCard(c);
        const img = new Image();
        img.src = cardDataUrl;
        await new Promise((res) => (img.onload = res));
        ctx.drawImage(img, x, y, cardW, cardH);
      }

      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), "image/png"),
      );
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `QR-Pamsimas-${new Date().toISOString().slice(0, 10)}.png`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${customers.data.length} QR disimpan ke galeri / Download`);
    } catch (e) {
      toast.error("Gagal menyimpan semua QR");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 6mm !important; }
          .print-card { break-inside: avoid; box-shadow: none !important; border: 1px dashed #cbd5e1 !important; }
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
          .save-btn { display: none !important; }
        }
      `}</style>

      <div className="px-5 pt-2 space-y-4 pb-8">
        <header className="no-print pt-2 space-y-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Simpan / Cetak QR
            </h1>
            <p className="text-xs text-slate-500">
              {customers.data?.length ?? 0} pelanggan — simpan ke galeri HP atau cetak A4.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveAll}
              disabled={!customers.data?.length || savingAll}
              className="flex-1"
            >
              {savingAll ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Simpan semua
            </Button>
            <Button
              onClick={() => window.print()}
              disabled={!customers.data?.length}
              variant="outline"
            >
              <Printer className="h-4 w-4 mr-1" /> Cetak
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Di Android/iOS, file akan masuk ke folder <b>Download</b>. Buka aplikasi
            Galeri/Foto lalu pindahkan/ simpan ke album bila perlu.
          </p>
        </header>

        {customers.isLoading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        )}

        {customers.data && customers.data.length === 0 && (
          <Card className="p-8 text-center space-y-2">
            <QrIcon className="h-10 w-10 mx-auto text-slate-300" />
            <p className="text-sm text-slate-500">Tambahkan pelanggan dulu untuk membuat QR.</p>
          </Card>
        )}

        <div className="print-grid grid grid-cols-2 gap-3">
          {customers.data?.map((c) => (
            <div
              key={c.id}
              className="print-card bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center"
            >
              {qrs[c.id] ? (
                <img src={qrs[c.id]} alt={c.customer_code} className="w-full aspect-square" />
              ) : (
                <div className="w-full aspect-square bg-slate-100 animate-pulse rounded" />
              )}
              <div className="mt-1.5 text-[11px] font-bold tracking-wide text-slate-900">
                {c.customer_code}
              </div>
              <div className="text-[10px] text-slate-600 truncate">{c.name}</div>
              <div className="text-[9px] text-slate-400 truncate">{c.address}</div>
              <Button
                size="sm"
                variant="ghost"
                className="save-btn mt-1.5 h-7 w-full text-[11px]"
                onClick={() => saveOne(c)}
                disabled={savingId === c.id}
              >
                {savingId === c.id ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <ImageIcon className="h-3 w-3 mr-1" />
                )}
                Simpan
              </Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}
