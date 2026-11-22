import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Dengarkan perubahan data dari petugas lain lalu segarkan tampilan otomatis. */
export function RealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      // Gabungkan banyak perubahan beruntun (mis. sinkron lunas dua arah) jadi satu penyegaran.
      timer = setTimeout(() => {
        qc.invalidateQueries({
          predicate: (q) => !["is-admin", "me-email", "login-logs"].includes(String(q.queryKey[0])),
        });
      }, 400);
    };

    const channel = supabase
      .channel(`live-sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "readings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "arrears" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, refresh)
      .subscribe();

    // Tetap terhubung dengan token login terbaru.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return null;
}
