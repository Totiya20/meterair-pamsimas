import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin/account")({
  head: () => ({ meta: [{ title: "Pengaturan Akun Admin — MeterAir Pamsimas" }] }),
  component: AdminAccount,
});

function AdminAccount() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  const me = useQuery({
    queryKey: ["me-email"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? "";
    },
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function verifyCurrentPassword(): Promise<boolean> {
    const email = me.data;
    if (!email) {
      toast.error("Sesi tidak valid, silakan login ulang.");
      return false;
    }
    if (!currentPassword) {
      toast.error("Masukkan password saat ini.");
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (error) {
      toast.error("Password saat ini salah.");
      return false;
    }
    return true;
  }

  async function forceRelogin(message: string) {
    toast.success(message);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function submitEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Format email tidak valid.");
      return;
    }
    if (email === (me.data ?? "").toLowerCase()) {
      toast.error("Email baru sama dengan email saat ini.");
      return;
    }
    setBusy(true);
    try {
      if (!(await verifyCurrentPassword())) return;
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      await forceRelogin(
        "Email konfirmasi dikirim ke alamat baru. Verifikasi dulu, lalu login kembali.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah email.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Password baru harus berbeda dari password saat ini.");
      return;
    }
    setBusy(true);
    try {
      if (!(await verifyCurrentPassword())) return;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await forceRelogin("Password berhasil diubah. Silakan login dengan password baru.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pt-2 pb-6 space-y-4">
      <header className="pt-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">Pengaturan Akun</h1>
        <p className="text-xs text-slate-500">
          Ubah email & password akun admin ini. Akun petugas lain tidak terpengaruh.
        </p>
      </header>

      <Card className="p-4 space-y-3">
        <div className="text-xs text-slate-500">Email saat ini</div>
        <div className="text-sm font-semibold text-slate-900 break-all">{me.data || "—"}</div>
        <div>
          <label className="text-xs font-medium text-slate-600">Password saat ini (wajib)</label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Password saat ini"
            className="mt-1 h-10"
            autoComplete="current-password"
            maxLength={72}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Mail className="h-4 w-4 text-slate-400" /> Ubah email
        </div>
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="email-baru@contoh.com"
          className="h-10"
          autoComplete="email"
          maxLength={255}
        />
        <Button onClick={submitEmail} disabled={busy} className="w-full bg-sky-600 hover:bg-sky-700">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Simpan email baru
        </Button>
        <p className="text-[11px] text-slate-500">
          Email konfirmasi akan dikirim ke alamat baru; perubahan aktif setelah diverifikasi.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <KeyRound className="h-4 w-4 text-slate-400" /> Ubah password
        </div>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Password baru (min. 8 karakter)"
          className="h-10"
          autoComplete="new-password"
          maxLength={72}
        />
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Ulangi password baru"
          className="h-10"
          autoComplete="new-password"
          maxLength={72}
        />
        <Button onClick={submitPassword} disabled={busy} className="w-full bg-sky-600 hover:bg-sky-700">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Simpan password baru
        </Button>
        <p className="text-[11px] text-slate-500">
          Setelah berhasil, sesi lama diakhiri dan kamu diminta login ulang.
        </p>
      </Card>
    </div>
  );
}
