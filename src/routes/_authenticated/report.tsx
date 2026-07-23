import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Laporan — MeterAir Pamsimas" },
      { name: "description", content: "Rekapitulasi pemakaian & tagihan pelanggan Pamsimas." },
    ],
  }),
  component: ReportPage,
});

type Row = {
  id: string;
  customer_id: string;
  usage: number;
  cost: number;
  paid: boolean;
  notes: string | null;
  created_at: string;
  customers: { name: string; tariff: number } | null;
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ReportPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(currentMonth());

  const { start, end } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const s = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const e = new Date(Date.UTC(y, m, 1)).toISOString();
    return { start: s, end: e };
  }, [month]);

  const { data, isLoading } = useQuery({
    queryKey: ["report", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("id, customer_id, usage, cost, paid, notes, created_at, customers(name, tariff)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("readings").update({ paid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report", month] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui."),
  });

  const rows = data ?? [];
  const totalKubik = rows.reduce((s, r) => s + Number(r.usage), 0);
  const totalHarga = rows.reduce((s, r) => s + Number(r.cost), 0);
  const totalDibayar = rows.filter((r) => r.paid).reduce((s, r) => s + Number(r.cost), 0);
  const totalBelum = totalHarga - totalDibayar;

  function exportCsv() {
    const header = ["No", "Pelanggan", "Kubikasi m3", "Harga", "Total", "Dibayar", "Belum Dibayar", "Ket"];
    const lines = rows.map((r, i) => {
      const tarif = r.customers?.tariff ?? 4000;
      return [
        i + 1,
        r.customers?.name ?? "-",
        r.usage,
        tarif,
        r.cost,
        r.paid ? r.cost : 0,
        r.paid ? 0 : r.cost,
        (r.notes ?? "").replace(/[\r\n,]/g, " "),
      ].join(",");
    });
    lines.push(["", "TOTAL", totalKubik, "", totalHarga, totalDibayar, totalBelum, ""].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-pamsimas-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Laporan Rekapitulasi</h1>
          <p className="text-xs text-slate-500">Ringkasan pemakaian & tagihan per bulan.</p>
        </div>
      </div>

      <Card className="p-3 mb-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600">Bulan</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Card className="p-3">
          <div className="text-[11px] text-slate-500">Total Tagihan</div>
          <div className="text-base font-bold text-slate-900">{rupiah(totalHarga)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-slate-500">Total Kubikasi</div>
          <div className="text-base font-bold text-slate-900">{totalKubik.toFixed(2)} m³</div>
        </Card>
        <Card className="p-3 bg-emerald-50 border-emerald-200">
          <div className="text-[11px] text-emerald-700">Dibayar</div>
          <div className="text-base font-bold text-emerald-800">{rupiah(totalDibayar)}</div>
        </Card>
        <Card className="p-3 bg-rose-50 border-rose-200">
          <div className="text-[11px] text-rose-700">Belum Dibayar</div>
          <div className="text-base font-bold text-rose-800">{rupiah(totalBelum)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-2 text-left border-b border-slate-200">No</th>
                <th className="p-2 text-left border-b border-slate-200">Pelanggan</th>
                <th className="p-2 text-right border-b border-slate-200">Kubikasi m³</th>
                <th className="p-2 text-right border-b border-slate-200">Harga</th>
                <th className="p-2 text-right border-b border-slate-200">Total</th>
                <th className="p-2 text-right border-b border-slate-200">Dibayar</th>
                <th className="p-2 text-right border-b border-slate-200">Belum</th>
                <th className="p-2 text-center border-b border-slate-200">Ket</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat...
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Belum ada data pada bulan ini.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const tarif = r.customers?.tariff ?? 4000;
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-2 text-slate-600">{i + 1}</td>
                    <td className="p-2 font-medium text-slate-900 whitespace-nowrap">
                      {r.customers?.name ?? "-"}
                    </td>
                    <td className="p-2 text-right tabular-nums">{Number(r.usage).toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums text-slate-600">{rupiah(tarif)}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{rupiah(Number(r.cost))}</td>
                    <td className="p-2 text-right tabular-nums text-emerald-700">
                      {r.paid ? rupiah(Number(r.cost)) : "-"}
                    </td>
                    <td className="p-2 text-right tabular-nums text-rose-700">
                      {r.paid ? "-" : rupiah(Number(r.cost))}
                    </td>
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={r.paid}
                        disabled={togglePaid.isPending}
                        onCheckedChange={(v) => togglePaid.mutate({ id: r.id, paid: Boolean(v) })}
                        aria-label="Tandai dibayar"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 font-bold text-slate-900">
                <tr>
                  <td className="p-2" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="p-2 text-right tabular-nums">{totalKubik.toFixed(2)}</td>
                  <td className="p-2"></td>
                  <td className="p-2 text-right tabular-nums">{rupiah(totalHarga)}</td>
                  <td className="p-2 text-right tabular-nums text-emerald-700">{rupiah(totalDibayar)}</td>
                  <td className="p-2 text-right tabular-nums text-rose-700">{rupiah(totalBelum)}</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-slate-500 mt-2 mb-6">
        Centang kolom Ket untuk menandai tagihan sudah dibayar. Total otomatis diperbarui.
      </p>
    </div>
  );
}
