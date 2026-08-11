import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ShieldCheck, ScrollText, Loader2, Trash2, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard Admin — MeterAir Pamsimas" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/", replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="px-5 pt-6 flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }

  return (
    <div className="px-5 pt-2 space-y-4">
      <header className="pt-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">Dashboard Admin</h1>
        <p className="text-xs text-slate-500">Akses penuh fitur petugas + kontrol khusus admin.</p>
      </header>

      <div className="space-y-2.5">
        <Link to="/admin/login-logs" className="block">
          <Card className="p-4 flex items-center gap-3 hover:bg-sky-50/50 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-white">
              <ScrollText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Log aktivitas login</p>
              <p className="text-xs text-slate-500">Email, waktu, dan status login terbaru</p>
            </div>
          </Card>
        </Link>

        <Link to="/admin/account" className="block">
          <Card className="p-4 flex items-center gap-3 hover:bg-sky-50/50 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Pengaturan akun</p>
              <p className="text-xs text-slate-500">Ubah email & password akun admin ini</p>
            </div>
          </Card>
        </Link>

        <Card className="p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Hapus riwayat pembacaan</p>
            <p className="text-xs text-slate-500">
              Buka detail pelanggan, lalu hapus baris riwayat (khusus admin).
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-xs text-slate-500">
          Fitur petugas (scan QR, catat meter, daftar pelanggan, laporan, cetak QR) tetap bisa
          diakses lewat menu di bawah.
        </p>
      </Card>
    </div>
  );
}
