import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronRight, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({ meta: [{ title: "Pelanggan — MeterAir Pamsimas" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
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
    </div>
  );
}
