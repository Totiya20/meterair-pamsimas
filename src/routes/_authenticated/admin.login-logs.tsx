import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/login-logs")({
  head: () => ({ meta: [{ title: "Log Aktivitas Login — MeterAir Pamsimas" }] }),
  component: LoginLogsPage,
});

function LoginLogsPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/", replace: true });
  }, [loading, isAdmin, navigate]);

  const logs = useQuery({
    queryKey: ["login-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_logs")
        .select("id, email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

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
        <Link to="/admin" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Kembali
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Log Aktivitas Login</h1>
            <p className="text-xs text-slate-500">200 percobaan login terbaru. Password tidak disimpan.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => logs.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <Card className="p-4">
        {logs.isLoading && <p className="text-xs text-slate-500">Memuat…</p>}
        {logs.data && logs.data.length === 0 && (
          <p className="text-xs text-slate-500">Belum ada aktivitas login tercatat.</p>
        )}
        <div className="divide-y divide-slate-100">
          {logs.data?.map((l) => {
            const ok = l.status === "berhasil";
            return (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{l.email}</p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(l.created_at).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {ok ? "Berhasil" : "Gagal"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
