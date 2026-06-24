import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Droplets, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — MeterAir Pamsimas" },
      { name: "description", content: "Login petugas pencatat meter air Pamsimas." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) {
          throw new Error(
            error.message === "Invalid login credentials"
              ? "Email atau password belum cocok. Jika pernah daftar ulang, gunakan password lama karena daftar ulang tidak mengganti password."
              : error.message,
          );
        }
        toast.success("Berhasil masuk.");
        navigate({ to: "/", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Akun dibuat dan langsung masuk.");
          navigate({ to: "/", replace: true });
          return;
        }

        if (data.user?.identities && data.user.identities.length === 0) {
          toast.error("Email ini sudah terdaftar. Daftar ulang tidak mengganti password.");
        } else {
          toast.success("Akun dibuat. Silakan masuk.");
        }
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white px-5 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/30">
          <Droplets className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">MeterAir Pamsimas</h1>
          <p className="text-xs text-slate-500">Aplikasi pencatat meter air</p>
        </div>
      </div>

      <Card className="p-5 max-w-md w-full mx-auto">
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === "login" ? "Masuk petugas" : "Daftar petugas baru"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login"
            ? "Gunakan email & password yang diberikan admin."
            : "Daftarkan akun petugas baru."}
        </p>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama lengkap</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Budi Petugas"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoComplete="email"
              placeholder="petugas@pamsimas.id"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "login" ? "Masuk" : "Daftar"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-sky-600 hover:text-sky-700"
        >
          {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </Card>
    </div>
  );
}
