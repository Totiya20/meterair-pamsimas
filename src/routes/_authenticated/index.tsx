import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Camera, Users, QrCode, Droplets, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Beranda — MeterAir PDAM" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const [{ count: customers }, { count: readsThisMonth }] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase
          .from("readings")
          .select("*", { count: "exact", head: true })
          .gte("created_at", monthStart),
      ]);
      return { customers: customers ?? 0, readsThisMonth: readsThisMonth ?? 0 };
    },
  });

  return (
    <div className="px-5">
      <header className="pt-4 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/30">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">MeterAir PDAM</h1>
            <p className="text-xs text-slate-500">Selamat bertugas hari ini</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Users className="h-3.5 w-3.5" /> Total pelanggan
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {stats.data?.customers ?? "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Dibaca bulan ini
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {stats.data?.readsThisMonth ?? "—"}
          </div>
        </Card>
      </div>

      <div className="mt-5 space-y-2.5">
        <Link to="/scan" className="block">
          <Card className="p-4 flex items-center gap-3 hover:bg-sky-50/50 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Mulai catat meter</p>
              <p className="text-xs text-slate-500">Scan QR pelanggan → foto meteran</p>
            </div>
          </Card>
        </Link>
        <Link to="/customers" className="block">
          <Card className="p-4 flex items-center gap-3 hover:bg-sky-50/50 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Daftar pelanggan</p>
              <p className="text-xs text-slate-500">Tambah, ubah, lihat riwayat</p>
            </div>
          </Card>
        </Link>
        <Link to="/qr-print" className="block">
          <Card className="p-4 flex items-center gap-3 hover:bg-sky-50/50 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Cetak stiker QR</p>
              <p className="text-xs text-slate-500">Tempel di meteran pelanggan</p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
