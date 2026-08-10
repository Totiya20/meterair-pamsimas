import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const q = useQuery({
    queryKey: ["is-admin"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data, error } = await supabase.rpc("is_admin", { _user_id: u.user.id });
      if (error) return false;
      return Boolean(data);
    },
  });
  return { isAdmin: q.data === true, loading: q.isLoading };
}
