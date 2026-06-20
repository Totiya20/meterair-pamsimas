import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, QrCode as QrIcon } from "lucide-react";

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

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 6mm !important; }
          .print-card { break-inside: avoid; box-shadow: none !important; border: 1px dashed #cbd5e1 !important; }
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
        }
      `}</style>

      <div className="px-5 pt-2 space-y-4">
        <header className="no-print pt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Cetak stiker QR</h1>
            <p className="text-xs text-slate-500">
              {customers.data?.length ?? 0} pelanggan — print di kertas stiker A4.
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={!customers.data?.length}>
            <Printer className="h-4 w-4 mr-1" /> Cetak
          </Button>
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
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
