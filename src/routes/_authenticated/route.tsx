import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Users, Camera, QrCode, LogOut, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useIsAdmin();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Keluar berhasil.");
    navigate({ to: "/auth", replace: true });
  }

  const tabs: Array<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
    { to: "/", label: "Beranda", icon: Home, exact: true },
    { to: "/scan", label: "Scan", icon: Camera },
    { to: "/customers", label: "Pelanggan", icon: Users },
    { to: "/report", label: "Laporan", icon: FileText },
    { to: "/qr-print", label: "QR", icon: QrCode },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];


  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="text-xs font-medium text-slate-500">MeterAir Pamsimas</div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-600 h-8 px-2">
          <LogOut className="h-4 w-4 mr-1" /> Keluar
        </Button>
      </div>

      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 grid grid-cols-5 z-40">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                active ? "text-sky-600" : "text-slate-500"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
