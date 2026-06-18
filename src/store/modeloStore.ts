import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/authStore";
import { type ModeloPedido, rowToModelo, modeloToRow } from "@/types/modelo";

interface ModeloState {
  modelos: ModeloPedido[];
  hidratado: boolean;
  hydrate: () => Promise<void>;
  upsertModelo: (m: ModeloPedido) => Promise<void>;
  deleteModelo: (id: string) => Promise<void>;
  getById: (id: string) => ModeloPedido | undefined;
}

export const useModelos = create<ModeloState>()((set, get) => ({
  modelos: [],
  hidratado: false,
  hydrate: async () => {
    try {
      const { data, error } = await supabase
        .from("modelos_pedido" as never)
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      const modelos = ((data ?? []) as Record<string, unknown>[]).map(rowToModelo);
      set({ modelos, hidratado: true });
    } catch (err) {
      console.error("[modeloStore] hydrate falhou:", err);
      set({ hidratado: true });
    }
  },
  upsertModelo: async (m) => {
    const prev = get().modelos;
    const idx = prev.findIndex((x) => x.id === m.id);
    set((s) => {
      if (idx >= 0) {
        const copy = [...s.modelos];
        copy[idx] = m;
        return { modelos: copy };
      }
      return { modelos: [m, ...s.modelos] };
    });
    try {
      const row = modeloToRow(m) as never;
      const { error } =
        idx >= 0
          ? await supabase.from("modelos_pedido" as never).update(row).eq("id", m.id)
          : await supabase.from("modelos_pedido" as never).insert(row);
      if (error) throw error;
    } catch (err) {
      set({ modelos: prev });
      throw err instanceof Error ? err : new Error("Não foi possível salvar o modelo.");
    }
  },
  deleteModelo: async (id) => {
    const prev = get().modelos;
    set((s) => ({ modelos: s.modelos.filter((m) => m.id !== id) }));
    try {
      const { error } = await supabase.from("modelos_pedido" as never).delete().eq("id", id);
      if (error) throw error;
    } catch (err) {
      set({ modelos: prev });
      throw err instanceof Error ? err : new Error("Erro ao excluir modelo.");
    }
  },
  getById: (id) => get().modelos.find((m) => m.id === id),
}));

export function useVisibleModelos(): ModeloPedido[] {
  const modelos = useModelos((s) => s.modelos);
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return modelos;
  if (!user) return [];
  return modelos.filter((m) => m.criadoPorVendedorId === user.id);
}
