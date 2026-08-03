// Store de permissões efetivas do usuário logado.
// Hidratado uma vez após o login (ver fopBootstrap / BootEffects).
// Enquanto não hidratado, temPermissao() retorna `true` para não piscar UI.

import { create } from "zustand";
import { useCallback } from "react";
import type { AcaoPermissao } from "@/security/permissions";
import { representanteConcede } from "@/security/permissions";
import { chave } from "@/security/permissionEvaluator";
import { getMinhasPermissoes } from "@/lib/permissoes.functions";
import { useAuth } from "@/store/authStore";


interface PermissoesState {
  hydrated: boolean;
  loading: boolean;
  permissoes: Set<string>;
  hidratar: (userId: string) => Promise<void>;
  reset: () => void;
}

export const usePermissoesStore = create<PermissoesState>((set, get) => ({
  hydrated: false,
  loading: false,
  permissoes: new Set(),

  hidratar: async (_userId: string) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const lista = await getMinhasPermissoes();
      const novo = new Set<string>();
      for (const r of lista) novo.add(chave(r.tela_id, r.acao as AcaoPermissao));
      set({ permissoes: novo, hydrated: true, loading: false });
    } catch (e) {
      console.error("[permissoes] falha ao hidratar:", e);
      set({ loading: false });
    }
  },

  reset: () => set({ hydrated: false, loading: false, permissoes: new Set() }),
}));

/**
 * Hook reativo. Devolve `temPermissao(telaId, acao?)`.
 * - Enquanto não hidratou → true (otimista, evita flash).
 * - Depois → consulta o Set efetivo.
 */
export function useTemPermissao() {
  const permissoes = usePermissoesStore((s) => s.permissoes);
  const hydrated = usePermissoesStore((s) => s.hydrated);
  return useCallback(
    (telaId: string, acao: AcaoPermissao = "ver"): boolean => {
      if (!hydrated) return true;
      return permissoes.has(`${telaId}:${acao}`);
    },
    [permissoes, hydrated],
  );
}

/** Versão imperativa (fora de componentes React). */
export function temPermissaoAgora(
  telaId: string,
  acao: AcaoPermissao = "ver",
): boolean {
  const { hydrated, permissoes } = usePermissoesStore.getState();
  if (!hydrated) return true;
  return permissoes.has(`${telaId}:${acao}`);
}
