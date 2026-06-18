import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/authStore";
import { type GrupoCliente, rowToGrupo, grupoToRow } from "@/types/grupo";

interface GrupoState {
  grupos: GrupoCliente[];
  hidratado: boolean;
  hydrate: () => Promise<void>;
  upsertGrupo: (g: GrupoCliente) => Promise<void>;
  deleteGrupo: (id: string) => Promise<void>;
  getById: (id: string) => GrupoCliente | undefined;
  gruposDoCliente: (clienteId: string) => GrupoCliente[];
}

export const useGrupos = create<GrupoState>()((set, get) => ({
  grupos: [],
  hidratado: false,
  hydrate: async () => {
    try {
      const { data, error } = await supabase
        .from("grupos_clientes" as never)
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      const grupos = ((data ?? []) as Record<string, unknown>[]).map(rowToGrupo);
      set({ grupos, hidratado: true });
    } catch (err) {
      console.error("[grupoStore] hydrate falhou:", err);
      set({ hidratado: true });
    }
  },
  upsertGrupo: async (g) => {
    const prev = get().grupos;
    const idx = prev.findIndex((x) => x.id === g.id);
    set((s) => {
      if (idx >= 0) {
        const copy = [...s.grupos];
        copy[idx] = g;
        return { grupos: copy };
      }
      return { grupos: [g, ...s.grupos] };
    });
    try {
      const row = grupoToRow(g) as never;
      const { error } =
        idx >= 0
          ? await supabase.from("grupos_clientes" as never).update(row).eq("id", g.id)
          : await supabase.from("grupos_clientes" as never).insert(row);
      if (error) throw error;
    } catch (err) {
      set({ grupos: prev });
      console.error("[grupoStore] upsert falhou:", err, g.id);
      throw err instanceof Error ? err : new Error("Não foi possível salvar o grupo.");
    }
  },
  deleteGrupo: async (id) => {
    const prev = get().grupos;
    set((s) => ({ grupos: s.grupos.filter((g) => g.id !== id) }));
    try {
      const { error } = await supabase.from("grupos_clientes" as never).delete().eq("id", id);
      if (error) throw error;
    } catch (err) {
      set({ grupos: prev });
      throw err instanceof Error ? err : new Error("Erro ao excluir grupo.");
    }
  },
  getById: (id) => get().grupos.find((g) => g.id === id),
  gruposDoCliente: (clienteId) =>
    get().grupos.filter((g) => g.clienteIds.includes(clienteId)),
}));

export function useVisibleGrupos(): GrupoCliente[] {
  const grupos = useGrupos((s) => s.grupos);
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return grupos;
  if (!user) return [];
  return grupos.filter((g) => g.criadoPorVendedorId === user.id);
}
