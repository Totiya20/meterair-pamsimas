import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, FileText, Loader2, Plus, Search, Share2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { MONTHS, rupiah } from "@/lib/billing";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/arrears")({
  head: () => ({
    meta: [
      { title: "Laporan Tunggakan — MeterAir Pamsimas" },
      { name: "description", content: "Catat dan pantau tunggakan tagihan pelanggan Pamsimas per bulan." },
      { property: "og:title", content: "Laporan Tunggakan — MeterAir Pamsimas" },
      { property: "og:description", content: "Catat dan pantau tunggakan tagihan pelanggan Pamsimas per bulan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArrearsPage,
});

type ArrearRow = {
  id: string;
  customer_id: string;
  month: number;
  year: number;
  amount: number;
  paid: boolean;
  notes: string | null;
  customers: { name: string; customer_code: string } | null;
};

function ArrearsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const now = new Date();

  const [customerId, setCustomerId] = useState<string>("");
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [filterCustomerId, setFilterCustomerId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 3, y - 2, y - 1, y, y + 1];
  }, [now]);

  const customers = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, customer_code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const arrears = useQuery({
    queryKey: ["arrears"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arrears")
        .select("id, customer_id, month, year, amount, paid, notes, customers(name, customer_code)")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ArrearRow[];
    },
  });

  const addArrear = useMutation({
    mutationFn: async () => {
      const nominal = Number(amount);
      if (!customerId) throw new Error("Pilih pelanggan dulu.");
      if (!Number.isFinite(nominal) || nominal <= 0) throw new Error("Nominal tunggakan tidak valid.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("arrears").upsert(
        {
          customer_id: customerId,
          month,
          year,
          amount: nominal,
          notes: notes.trim() || null,
          created_by: u.user?.id ?? null,
        },
        { onConflict: "customer_id,month,year" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tunggakan tersimpan.");
      setAmount("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["arrears"] });
      qc.invalidateQueries({ queryKey: ["arrears-total"] });
      qc.invalidateQueries({ queryKey: ["arrears-by-customer"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan."),
  });

  /** Centang "Lunas" = status diubah menjadi lunas, data TETAP tersimpan di tabel. */
  const settleArrear = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("arrears").update({ paid: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tunggakan ditandai LUNAS.");
      qc.invalidateQueries({ queryKey: ["arrears"] });
      qc.invalidateQueries({ queryKey: ["arrears-total"] });
      qc.invalidateQueries({ queryKey: ["arrears-by-customer"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui."),
  });

  const removeArrear = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("arrears").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entri tunggakan dihapus.");
      qc.invalidateQueries({ queryKey: ["arrears"] });
      qc.invalidateQueries({ queryKey: ["arrears-total"] });
      qc.invalidateQueries({ queryKey: ["arrears-by-customer"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus."),
  });

  const allRows = arrears.data ?? [];
  const scoped = useMemo(
    () => (filterCustomerId === "all" ? allRows : allRows.filter((r) => r.customer_id === filterCustomerId)),
    [allRows, filterCustomerId],
  );
  /** Daftar aktif = entri yang belum lunas (perilaku lama dipertahankan). */
  const rows = useMemo(() => scoped.filter((r) => !r.paid), [scoped]);
  const totalBelum = rows.reduce((s, r) => s + Number(r.amount), 0);
  const totalDibayar = scoped.filter((r) => r.paid).reduce((s, r) => s + Number(r.amount), 0);

  const filteredCustomers = useMemo(() => {
    const list = customers.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.customer_code.toLowerCase().includes(q),
    );
  }, [customers.data, search]);

  const selectedCustomer = (customers.data ?? []).find((c) => c.id === filterCustomerId);
  const scopeLabel = selectedCustomer
    ? `${selectedCustomer.customer_code} — ${selectedCustomer.name}`
    : "Semua pelanggan";

  /** Rekap per bulan & tahun (menghormati filter pelanggan aktif). */
  type MonthRow = {
    key: string;
    month: number;
    year: number;
    total: number;
    dibayar: number;
    belum: number;
    items: ArrearRow[];
  };
  const monthly = useMemo<MonthRow[]>(() => {
    const map = new Map<string, MonthRow>();
    for (const r of scoped) {
      const key = `${r.year}-${r.month}`;
      const m =
        map.get(key) ?? { key, month: r.month, year: r.year, total: 0, dibayar: 0, belum: 0, items: [] };
      const amt = Number(r.amount);
      m.total += amt;
      if (r.paid) m.dibayar += amt;
      else m.belum += amt;
      m.items.push(r);
      map.set(key, m);
    }
    return Array.from(map.values()).sort((a, b) => b.year - a.year || b.month - a.month);
  }, [scoped]);

  async function shareReport(g: { name: string; code: string; items: ArrearRow[]; belum: number }) {
    const sorted = [...g.items].sort((a, b) => a.year - b.year || a.month - b.month);
    const lines = sorted.map((r) => `- ${MONTHS[r.month - 1]} ${r.year}: ${rupiah(Number(r.amount))}`);
    const text = [
      "*LAPORAN TUNGGAKAN METERAN AIR*",
      "",
      `Nama Pelanggan: ${g.name}`,
      `ID Pelanggan: ${g.code}`,
      `Bulan Tunggakan (${sorted.length} bulan):`,
      ...lines,
      "",
      `Total Tunggakan: ${rupiah(g.belum)}`,
      "",
      "Mohon segera melakukan pembayaran. Terima kasih.",
      "_Pamsimas Mangun Tirta_",
    ].join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Laporan Tunggakan Meteran Air", text });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Laporan disalin ke papan klip. Tempel di WhatsApp/SMS.");
    } catch {
      toast.error("Gagal menyalin laporan.");
    }
  }



  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; code: string; items: ArrearRow[]; belum: number }>();
    for (const r of rows) {
      const g = map.get(r.customer_id) ?? {
        name: r.customers?.name ?? "-",
        code: r.customers?.customer_code ?? "-",
        items: [],
        belum: 0,
      };
      g.items.push(r);
      if (!r.paid) g.belum += Number(r.amount);
      map.set(r.customer_id, g);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  const fileSlug = selectedCustomer ? selectedCustomer.customer_code.toLowerCase() : "semua";

  function exportPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN TUNGGAKAN PAMSIMAS", 105, 14, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(scopeLabel, 105, 20, { align: "center" });
    doc.text(
      `Total Tunggakan: ${rupiah(totalBelum)}  |  Dibayar: ${rupiah(totalDibayar)}  |  Entri aktif: ${rows.length}`,
      105,
      26,
      { align: "center" },
    );

    autoTable(doc, {
      startY: 32,
      head: [["No", "Bulan & Tahun", "Total Tunggakan", "Dibayar", "Belum Dibayar", "Status"]],
      body: monthly.map((m, i) => [
        i + 1,
        `${MONTHS[m.month - 1]} ${m.year}`,
        rupiah(m.total),
        m.dibayar > 0 ? rupiah(m.dibayar) : "-",
        m.belum > 0 ? rupiah(m.belum) : "-",
        m.belum === 0 ? "LUNAS" : "BELUM LUNAS",
      ]),
      foot: [[
        "",
        "TOTAL",
        rupiah(monthly.reduce((s, m) => s + m.total, 0)),
        rupiah(totalDibayar),
        rupiah(totalBelum),
        "",
      ]],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [14, 116, 144], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: "bold" },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    doc.save(`tunggakan-pamsimas-${fileSlug}.pdf`);
  }

  function exportExcel() {
    const aoa: (string | number)[][] = [
      ["LAPORAN TUNGGAKAN PAMSIMAS"],
      [scopeLabel],
      [`Total Tunggakan: ${rupiah(totalBelum)}`],
      [`Dibayar: ${rupiah(totalDibayar)}`],
      [],
      ["No", "Bulan", "Tahun", "Total Tunggakan", "Dibayar", "Belum Dibayar", "Status"],
      ...monthly.map((m, i) => [
        i + 1,
        MONTHS[m.month - 1],
        m.year,
        m.total,
        m.dibayar,
        m.belum,
        m.belum === 0 ? "LUNAS" : "BELUM LUNAS",
      ]),
      [
        "",
        "TOTAL",
        "",
        monthly.reduce((s, m) => s + m.total, 0),
        totalDibayar,
        totalBelum,
        "",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    ];
    const lastRow = 6 + monthly.length;
    for (let r = 6; r <= lastRow; r++) {
      for (const c of [3, 4, 5]) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "number") cell.z = '"Rp"#,##0';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tunggakan");
    XLSX.writeFile(wb, `tunggakan-pamsimas-${fileSlug}.xlsx`);
  }

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Laporan Tunggakan</h1>
        <p className="text-xs text-slate-500">Catat tunggakan pelanggan per bulan & tandai saat lunas.</p>
      </div>

      <Card className="p-3 mb-3">
        <label className="text-xs font-medium text-slate-600">Cari / pilih pelanggan</label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik nama atau kode pelanggan…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={filterCustomerId} onValueChange={setFilterCustomerId}>
          <SelectTrigger className="mt-2 h-9">
            <SelectValue placeholder="Semua pelanggan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua pelanggan</SelectItem>
            {filteredCustomers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.customer_code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={exportPdf}
            disabled={monthly.length === 0}
            className="flex-1 bg-sky-600 hover:bg-sky-700"
          >
            <FileText className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={monthly.length === 0} className="flex-1">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Card className="p-3 bg-rose-50 border-rose-200">
          <div className="text-[11px] text-rose-700">Total Tunggakan</div>
          <div className="text-base font-bold text-rose-800">{rupiah(totalBelum)}</div>
        </Card>
        <Card className="p-3 bg-slate-50 border-slate-200">
          <div className="text-[11px] text-slate-600">Entri Aktif</div>
          <div className="text-base font-bold text-slate-800">{rows.length} Tunggakan Aktif</div>
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

      <Card className="p-0 mb-4 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
          Rincian per bulan — {scopeLabel}
        </div>
        {monthly.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">Belum ada data tunggakan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2 font-medium">Bulan & Tahun</th>
                  <th className="px-2 py-2 font-medium text-right">Total</th>
                  <th className="px-2 py-2 font-medium text-right">Dibayar</th>
                  <th className="px-2 py-2 font-medium text-right">Belum</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthly.map((m) => (
                  <tr key={m.key}>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {MONTHS[m.month - 1]} {m.year}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{rupiah(m.total)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{rupiah(m.dibayar)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-rose-700">{rupiah(m.belum)}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.belum === 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {m.belum === 0 ? "Lunas" : "Belum Lunas"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {m.belum > 0 ? (
                        <Checkbox
                          checked={false}
                          disabled={settleArrear.isPending}
                          onCheckedChange={(v) => {
                            if (!v) return;
                            const unpaid = m.items.filter((r) => !r.paid);
                            if (
                              confirm(
                                `Tandai tunggakan ${MONTHS[m.month - 1]} ${m.year} sebesar ${rupiah(m.belum)} sebagai LUNAS? Data tetap tersimpan di tabel.`,
                              )
                            ) {
                              unpaid.forEach((r) => settleArrear.mutate(r.id));
                            }
                          }}
                          aria-label="Tandai lunas"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>


      <Card className="p-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
          <Plus className="h-3.5 w-3.5" /> Tambah tunggakan
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Pelanggan</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Pilih pelanggan" />
              </SelectTrigger>
              <SelectContent>
                {(customers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.customer_code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Bulan</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
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
          <div>
            <label className="text-xs font-medium text-slate-600">Nominal tunggakan (Rp)</label>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="contoh: 75000"
              className="mt-1 h-9 tabular-nums"
              maxLength={12}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Keterangan (opsional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="catatan singkat"
              className="mt-1 h-9"
              maxLength={200}
            />
          </div>
          <Button
            onClick={() => addArrear.mutate()}
            disabled={addArrear.isPending}
            className="w-full bg-sky-600 hover:bg-sky-700"
          >
            {addArrear.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wallet className="h-4 w-4 mr-1" />}
            Simpan tunggakan
          </Button>
          <p className="text-[11px] text-slate-500">
            Jika pelanggan & periode yang sama sudah ada, nominalnya akan diperbarui.
          </p>
        </div>
      </Card>

      <div className="space-y-2.5">
        {arrears.isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        )}
        {!arrears.isLoading && grouped.length === 0 && (
          <Card className="p-5 text-center text-sm text-slate-500">Belum ada data tunggakan.</Card>
        )}
        {grouped.map(([cid, g]) => (
          <Card key={cid} className="p-0 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{g.name}</div>
                <div className="text-[10px] text-slate-500">{g.code} · {g.items.length} bulan</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-sm font-bold ${g.belum > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {g.belum > 0 ? rupiah(g.belum) : "Lunas"}
                </div>
                {g.belum > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 border-sky-200 text-sky-700 hover:bg-sky-50"
                    onClick={() => shareReport(g)}
                    aria-label="Kirim laporan tunggakan"
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1" /> Kirim
                  </Button>
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {g.items.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-900">
                      {MONTHS[r.month - 1]} {r.year}
                    </div>
                    <div className="text-[11px] tabular-nums text-slate-500">
                      {rupiah(Number(r.amount))}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700">
                    Belum
                  </span>
                  <Checkbox
                    checked={false}
                    disabled={settleArrear.isPending}
                    onCheckedChange={(v) => {
                      if (!v) return;
                      if (
                        confirm(
                          `Tandai tunggakan ${MONTHS[r.month - 1]} ${r.year} sebesar ${rupiah(Number(r.amount))} sebagai LUNAS? Entri akan dihapus dari daftar tunggakan.`,
                        )
                      ) {
                        settleArrear.mutate(r.id);
                      }
                    }}
                    aria-label="Tandai lunas"
                  />
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm("Hapus entri tunggakan ini secara permanen?")) removeArrear.mutate(r.id);
                      }}
                      aria-label="Hapus tunggakan"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
