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
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
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
        .eq("paid", false)
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

  /** Centang "Lunas" = entri langsung dihapus dari daftar tunggakan. */
  const settleArrear = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("arrears").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tunggakan lunas & dihapus dari daftar.");
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

  const rows = arrears.data ?? [];
  const totalBelum = rows.reduce((s, r) => s + Number(r.amount), 0);


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

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Laporan Tunggakan</h1>
        <p className="text-xs text-slate-500">Catat tunggakan pelanggan per bulan & tandai saat lunas.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Card className="p-3 bg-rose-50 border-rose-200">
          <div className="text-[11px] text-rose-700">Total Tunggakan</div>
          <div className="text-base font-bold text-rose-800">{rupiah(totalBelum)}</div>
        </Card>
        <Card className="p-3 bg-slate-50 border-slate-200">
          <div className="text-[11px] text-slate-600">Entri Aktif</div>
          <div className="text-base font-bold text-slate-800">{rows.length} bulan</div>
        </Card>
      </div>

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
              <div className={`text-sm font-bold ${g.belum > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {g.belum > 0 ? rupiah(g.belum) : "Lunas"}
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.paid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {r.paid ? "Lunas" : "Belum"}
                  </span>
                  <Checkbox
                    checked={r.paid}
                    disabled={togglePaid.isPending}
                    onCheckedChange={(v) => togglePaid.mutate({ id: r.id, paid: Boolean(v) })}
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
