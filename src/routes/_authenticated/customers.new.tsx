import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerForm, type CustomerFormValues } from "@/components/CustomerForm";

export const Route = createFileRoute("/_authenticated/customers/new")({
  head: () => ({ meta: [{ title: "Tambah Pelanggan — MeterAir Pamsimas" }] }),
  component: NewCustomer,
});

function NewCustomer() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function submit(v: CustomerFormValues) {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("customers")
        .insert({
          customer_code: v.customer_code.trim(),
          name: v.name.trim(),
          address: v.address.trim(),
          phone: v.phone.trim(),
          meter_id: v.meter_id.trim() || null,
          last_reading: Number(v.last_reading) || 0,
          tariff: Number(v.tariff) || 4000,
          notes: v.notes.trim() || null,
          created_by: u.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Pelanggan disimpan.");
      navigate({ to: "/customers/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-5 pt-2 space-y-4">
      <header className="pt-2">
        <Link to="/customers" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Kembali
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Tambah pelanggan</h1>
      </header>
      <Card className="p-5">
        <CustomerForm onSubmit={submit} submitting={submitting} submitLabel="Simpan pelanggan" />
      </Card>
    </div>
  );
}
