import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Regiao {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export function useRegioes() {
  return useQuery({
    queryKey: ["regioes"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Regiao[]> => {
      const { data, error } = await supabase
        .from("regioes")
        .select("id, nome, ordem, ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Regiao[];
    },
  });
}
