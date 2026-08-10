import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Pencil, Trash2, Loader2, History, MapPin, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerForm, type CustomerFormValues } from "@/components/CustomerForm";
import { useIsAdmin } from "@/hooks/useIsAdmin";


export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({ meta: [{ title: "Detail Pelanggan — MeterAir Pamsimas" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = useParams({ from: "/_authenticated/customers/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const customer = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const readings = useQuery({
    queryKey: ["readings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function update(v: CustomerFormValues) {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          customer_code: v.customer_code.trim(),
          name: v.name.trim(),
          address: v.address.trim(),
          phone: v.phone.trim(),
          meter_id: v.meter_id.trim() || null,
          last_reading: Number(v.last_reading) || 0,
          tariff: Number(v.tariff) || 4000,
          notes: v.notes.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Tersimpan.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!confirm("Hapus pelanggan ini? Riwayat pembacaan ikut terhapus.")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pelanggan dihapus.");
    navigate({ to: "/customers" });
  }

  if (customer.isLoading) {
    return (
      <div className="px-5 pt-6 flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }
  if (!customer.data) {
    return <div className="px-5 pt-6 text-sm text-slate-500">Pelanggan tidak ditemukan.</div>;
  }

  const c = customer.data;

  if (editing) {
    return (
      <div className="px-5 pt-2 space-y-4">
        <header className="pt-2">
          <button
            onClick={() => setEditing(false)}
            className="inline-flex items-center text-xs text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Batal
          </button>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Ubah pelanggan</h1>
        </header>
        <Card className="p-5">
          <CustomerForm
            initial={{
              customer_code: c.customer_code,
              name: c.name,
              address: c.address,
              phone: c.phone,
              meter_id: c.meter_id ?? "",
              last_reading: String(c.last_reading),
              tariff: String(c.tariff),
              notes: c.notes ?? "",
            }}
            onSubmit={update}
            submitting={submitting}
            submitLabel="Simpan perubahan"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2 space-y-4">
      <header className="pt-2">
        <Link to="/customers" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Kembali
        </Link>
      </header>

      <Card className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
          {c.customer_code}
        </div>
        <h1 className="mt-0.5 text-lg font-bold text-slate-900 flex items-center gap-1.5">
          <User className="h-4 w-4 text-slate-400" /> {c.name}
        </h1>
        <p className="mt-2 text-sm text-slate-600 flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" /> {c.address}
        </p>
        <p className="mt-1 text-sm text-slate-600 flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-slate-400" /> {c.phone}
        </p>
        {c.meter_id && (
          <p className="mt-1 text-xs text-slate-500">No. meteran: {c.meter_id}</p>
        )}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] uppercase text-slate-400">Bacaan terakhir</p>
            <p className="font-bold tabular-nums text-slate-900">
              {Number(c.last_reading).toLocaleString("id-ID")} m³
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-400">Tarif</p>
            <p className="font-bold tabular-nums text-slate-900">
              Rp {Number(c.tariff).toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button asChild>
          <Link to="/scan" search={{ customer: c.customer_code }}>
            <Camera className="h-4 w-4 mr-1" /> Catat
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Ubah
        </Button>
        <Button variant="outline" onClick={remove} className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4 mr-1" /> Hapus
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
          <History className="h-4 w-4 text-slate-400" /> Riwayat pembacaan
        </div>
        {readings.isLoading && <p className="text-xs text-slate-500">Memuat…</p>}
        {readings.data && readings.data.length === 0 && (
          <p className="text-xs text-slate-500">Belum ada riwayat.</p>
        )}
        <div className="space-y-2">
          {readings.data?.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 tabular-nums">
                  {Number(r.current_reading).toLocaleString("id-ID")} m³
                </p>
                <p className="text-[11px] text-slate-500">
                  {new Date(r.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  • +{Number(r.usage).toLocaleString("id-ID")} m³
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-sky-600">
                Rp {Number(r.cost).toLocaleString("id-ID")}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
