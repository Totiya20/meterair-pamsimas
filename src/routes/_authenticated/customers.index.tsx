import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Search, ChevronRight, Users, Printer, Download } from "lucide-react";
import { createCustomerDirectoryPdf, saveReportPdf } from "@/lib/report-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({ meta: [
    { title: "Pelanggan — MeterAir Pamsimas" },
    { name: "description", content: "Daftar pelanggan Pamsimas, identitas, kontak, dan bacaan meter terakhir." },
    { property: "og:title", content: "Pelanggan — MeterAir Pamsimas" },
    { property: "og:description", content: "Daftar pelanggan Pamsimas, identitas, kontak, dan bacaan meter terakhir." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_code, name, address, phone, last_reading")
        .order("customer_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (customers.data ?? []).filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.customer_code.toLowerCase().includes(s) ||
      c.name.toLowerCase().includes(s) ||
      c.address.toLowerCase().includes(s) ||
      c.phone.includes(s)
    );
  });

  const report = (
    <>
      <h2 className="text-center text-lg font-bold text-foreground">LAPORAN DAFTAR PELANGGAN</h2>
      <p className="text-center text-sm text-muted-foreground">MeterAir Pamsimas — Pamsimas Mangun Tirta</p>
      <div className="my-4 text-xs text-foreground">
        <p>Tanggal cetak: {printDate}</p>
        <p>Total: {filtered.length} pelanggan</p>
        {q.trim() && <p className="break-words">Pencarian: {q.trim()}</p>}
      </div>
      <table className="customer-list-report-table w-full table-fixed border-collapse text-xs text-foreground">
        <colgroup><col className="w-[6%]" /><col className="w-[16%]" /><col className="w-[22%]" /><col className="w-[26%]" /><col className="w-[17%]" /><col className="w-[13%]" /></colgroup>
        <thead className="bg-muted">
          <tr>{["No", "Kode", "Nama Pelanggan", "Alamat", "No. HP", "Meter Terakhir (m³)"].map((label) => <th key={label} className="break-words border border-border p-2 text-left font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody>
          {filtered.map((c, i) => (
            <tr key={c.id}>
              <td className="border border-border p-2 align-top">{i + 1}</td>
              <td className="break-words border border-border p-2 align-top">{c.customer_code}</td>
              <td className="break-words border border-border p-2 align-top">{c.name}</td>
              <td className="break-words border border-border p-2 align-top">{c.address || "—"}</td>
              <td className="break-words border border-border p-2 align-top">{c.phone || "—"}</td>
              <td className="border border-border p-2 text-right align-top tabular-nums">{Number(c.last_reading).toLocaleString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  return (
    <div className="px-5 pt-2 space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Pelanggan</h1>
          <p className="text-xs text-slate-500">{customers.data?.length ?? 0} terdaftar</p>
        </div>
        <Button asChild size="sm">
          <Link to="/customers/new">
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </Link>
        </Button>
      </header>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kode, nama, alamat, HP…"
          className="pl-9"
        />
      </div>

      <Button variant="outline" className="w-full" disabled={customers.isFetching || customers.isError || filtered.length === 0} onClick={() => {
        setPrintDate(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }));
        setPrintOpen(true);
      }}>
        <Printer className="mr-2 h-4 w-4" /> {q.trim() ? "Cetak hasil pencarian" : "Cetak daftar pelanggan"}
      </Button>

      {customers.isLoading && <p className="text-sm text-slate-500">Memuat…</p>}

      {customers.data && filtered.length === 0 && (
        <Card className="p-8 text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-slate-300" />
          <p className="text-sm text-slate-500">
            {q ? "Tidak ada hasil." : "Belum ada pelanggan. Tambah pelanggan pertama."}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="block">
            <Card className="p-3.5 flex items-center gap-3 hover:bg-sky-50/50 transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 text-xs font-bold tabular-nums shrink-0">
                {c.customer_code.slice(-3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
                    {c.customer_code}
                  </span>
                </div>
                <p className="font-medium text-slate-900 truncate">{c.name}</p>
                <p className="text-xs text-slate-500 truncate">{c.address}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400 uppercase">Terakhir</p>
                <p className="text-sm font-semibold tabular-nums text-slate-700">
                  {Number(c.last_reading).toLocaleString("id-ID")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Card>
          </Link>
        ))}
      </div>
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-lg p-4">
          <DialogTitle className="pr-8">Cetak daftar pelanggan</DialogTitle>
          <DialogDescription>{filtered.length} pelanggan{q.trim() ? " sesuai pencarian" : " terdaftar"}</DialogDescription>
          <div className="overflow-x-auto"><div className="min-w-[680px]">{report}</div></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex-1" disabled={customers.isFetching || customers.isError || filtered.length === 0} onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
            <Button className="flex-1" disabled={customers.isFetching || customers.isError || filtered.length === 0} onClick={() => {
              try {
                const blob = createCustomerDirectoryPdf(filtered, printDate, q);
                void saveReportPdf(blob, `daftar-pelanggan-pamsimas${q.trim() ? "-pencarian" : ""}.pdf`).catch(() => toast.error("Gagal menyimpan PDF. Silakan coba lagi."));
              } catch { toast.error("Gagal membuat PDF. Silakan coba lagi."); }
            }}>
              <Download className="mr-2 h-4 w-4" /> Unduh PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {printOpen && typeof document !== "undefined" && createPortal(
        <article id="customer-list-print" aria-hidden="true">{report}</article>, document.body,
      )}
    </div>
  );
}
