import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
  customers: { name: string; tariff: number; customer_code: string; address: string } | null;
};

const ABONEMEN = 5000;

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function ReportPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [monthNum, setMonthNum] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;

  const { start, end } = useMemo(() => {
    const s = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString();
    const e = new Date(Date.UTC(year, monthNum, 1)).toISOString();
    return { start: s, end: e };
  }, [year, monthNum]);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  const { data, isLoading } = useQuery({
    queryKey: ["report", monthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("id, customer_id, usage, cost, paid, notes, created_at, customers(name, tariff, customer_code, address)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const togglePaid = useMutation({
    mutationFn: async ({ ids, paid }: { ids: string[]; paid: boolean }) => {
      const { error } = await supabase.from("readings").update({ paid }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report", monthKey] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui."),
  });

  const rows = data ?? [];
  const totalKubik = rows.reduce((s, r) => s + Number(r.usage), 0);
  const totalAbonemen = rows.length * ABONEMEN;
  const totalHargaAir = rows.reduce((s, r) => s + Number(r.cost), 0);
  const totalHarga = totalHargaAir + totalAbonemen;
  const totalDibayar = rows.filter((r) => r.paid).reduce((s, r) => s + Number(r.cost) + ABONEMEN, 0);
  const totalBelum = totalHarga - totalDibayar;

  // Ringkasan per pelanggan (agregasi jika ada >1 pembacaan/bulan)
  type Summary = {
    customer_id: string;
    name: string;
    code: string;
    kubik: number;
    harga: number;
    abonemen: number;
    total: number;
    dibayar: number;
    belum: number;
    count: number;
    ids: string[];
  };
  const perCustomer = useMemo<Summary[]>(() => {
    const map = new Map<string, Summary>();
    for (const r of rows) {
      const key = r.customer_id;
      const existing = map.get(key);
      const total = Number(r.cost) + ABONEMEN;
      if (existing) {
        existing.kubik += Number(r.usage);
        existing.harga += Number(r.cost);
        existing.abonemen += ABONEMEN;
        existing.total += total;
        existing.dibayar += r.paid ? total : 0;
        existing.belum += r.paid ? 0 : total;
        existing.count += 1;
        existing.ids.push(r.id);
      } else {
        map.set(key, {
          customer_id: key,
          name: r.customers?.name ?? "-",
          code: r.customers?.customer_code ?? "-",
          kubik: Number(r.usage),
          harga: Number(r.cost),
          abonemen: ABONEMEN,
          total,
          dibayar: r.paid ? total : 0,
          belum: r.paid ? 0 : total,
          count: 1,
          ids: [r.id],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  function exportExcel() {
    const periode = `${MONTHS[monthNum - 1]} ${year}`;
    const header = ["No", "Kode", "Pelanggan", "Kubikasi (m³)", "Harga Air", "Abonemen", "Total", "Dibayar", "Belum Dibayar", "Status"];
    const body = perCustomer.map((r, i) => [
      i + 1, r.code, r.name, r.kubik, r.harga, r.abonemen, r.total, r.dibayar, r.belum,
      r.belum === 0 ? "LUNAS" : "BELUM",
    ]);
    const footer = ["", "", "TOTAL", totalKubik, totalHargaAir, totalAbonemen, totalHarga, totalDibayar, totalBelum, ""];

    const aoa: (string | number)[][] = [
      ["LAPORAN REKAPITULASI PAMSIMAS"],
      [`Periode: ${periode}`],
      [`Total Pelanggan: ${perCustomer.length}`],
      [],
      header,
      ...body,
      footer,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 32 }, { wch: 13 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 10 },
    ];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
    ];
    ws["!freeze"] = { xSplit: 0, ySplit: 5 };

    const lastRow = 5 + body.length;
    for (let r = 5; r <= lastRow; r++) {
      for (const c of [3]) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
      }
      for (const c of [4, 5, 6, 7, 8]) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number") cell.z = '"Rp"#,##0';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Laporan ${MONTHS[monthNum - 1]}`);
    XLSX.writeFile(wb, `laporan-pamsimas-${monthKey}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const periode = `${MONTHS[monthNum - 1]} ${year}`;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN REKAPITULASI PAMSIMAS", 148, 14, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${periode}`, 148, 20, { align: "center" });
    doc.text(`Total Pelanggan: ${perCustomer.length}`, 148, 25, { align: "center" });

    autoTable(doc, {
      startY: 30,
      head: [["No", "Kode", "Pelanggan", "Kubikasi (m3)", "Harga Air", "Abonemen", "Total", "Dibayar", "Belum"]],
      body: perCustomer.map((r, i) => [
        i + 1,
        r.code,
        r.name,
        r.kubik.toFixed(2),
        rupiah(r.harga),
        rupiah(r.abonemen),
        rupiah(r.total),
        r.dibayar > 0 ? rupiah(r.dibayar) : "-",
        r.belum > 0 ? rupiah(r.belum) : "-",
      ]),
      foot: [[
        "", "", "TOTAL",
        totalKubik.toFixed(2),
        rupiah(totalHargaAir),
        rupiah(totalAbonemen),
        rupiah(totalHarga),
        rupiah(totalDibayar),
        rupiah(totalBelum),
      ]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [14, 116, 144], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: "bold" },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 22 },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
    });

    doc.save(`laporan-pamsimas-${monthKey}.pdf`);
  }

  return (
    <div className="px-5 pt-4">
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Laporan Rekapitulasi</h1>
        <p className="text-xs text-slate-500">Ringkasan pemakaian & tagihan per pelanggan.</p>
      </div>

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Bulan</label>
            <Select value={String(monthNum)} onValueChange={(v) => setMonthNum(Number(v))}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Tahun</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={exportPdf} disabled={perCustomer.length === 0} className="flex-1 bg-sky-600 hover:bg-sky-700">
            <FileText className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={perCustomer.length === 0} className="flex-1">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
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
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-700">Ringkasan Per Pelanggan</div>
          <div className="text-[10px] text-slate-500">{perCustomer.length} pelanggan · {rows.length} pembacaan</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-2 text-left border-b border-slate-200">No</th>
                <th className="p-2 text-left border-b border-slate-200">Pelanggan</th>
                <th className="p-2 text-right border-b border-slate-200">m³</th>
                <th className="p-2 text-right border-b border-slate-200">Harga</th>
                <th className="p-2 text-right border-b border-slate-200">Abon.</th>
                <th className="p-2 text-right border-b border-slate-200">Total</th>
                <th className="p-2 text-center border-b border-slate-200">Lunas</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat...
                  </td>
                </tr>
              )}
              {!isLoading && perCustomer.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Belum ada data pada periode ini.
                  </td>
                </tr>
              )}
              {perCustomer.map((r, i) => {
                const fullyPaid = r.belum === 0 && r.total > 0;
                return (
                  <tr key={r.customer_id} className="border-b border-slate-100">
                    <td className="p-2 text-slate-600">{i + 1}</td>
                    <td className="p-2">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-[10px] text-slate-500">{r.code}{r.count > 1 ? ` · ${r.count}x` : ""}</div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.kubik.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums text-slate-600">{rupiah(r.harga)}</td>
                    <td className="p-2 text-right tabular-nums text-slate-600">{rupiah(r.abonemen)}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">
                      <div>{rupiah(r.total)}</div>
                      {r.belum > 0 ? (
                        <div className="text-[10px] font-normal text-rose-600">Sisa {rupiah(r.belum)}</div>
                      ) : (
                        <div className="text-[10px] font-normal text-emerald-600">Lunas</div>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={fullyPaid}
                        disabled={togglePaid.isPending}
                        onCheckedChange={(v) => togglePaid.mutate({ ids: r.ids, paid: Boolean(v) })}
                        aria-label="Tandai dibayar"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {perCustomer.length > 0 && (
              <tfoot className="bg-slate-50 font-bold text-slate-900">
                <tr>
                  <td className="p-2" colSpan={2}>TOTAL</td>
                  <td className="p-2 text-right tabular-nums">{totalKubik.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(totalHargaAir)}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(totalAbonemen)}</td>
                  <td className="p-2 text-right tabular-nums">{rupiah(totalHarga)}</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-slate-500 mt-2 mb-6">
        Centang kolom Lunas untuk menandai tagihan sudah dibayar. Untuk pelanggan dengan banyak pembacaan, tandai lunas via halaman pelanggan.
      </p>
    </div>
  );
}
