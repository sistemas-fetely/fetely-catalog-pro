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

/** True quando o usuário logado é vendedor representante (não admin/master). */
export function ehRepresentanteAgora(): boolean {
  const { roles, profile } = useAuth.getState();
  if (roles.includes("admin") || roles.includes("master")) return false;
  return roles.includes("vendedor") && profile?.tipo_vendedor === "representante";
}

/**
 * Hook reativo. Devolve `temPermissao(telaId, acao?)`.
 * - Enquanto não hidratou → true (otimista, evita flash).
 * - Depois → consulta o Set efetivo.
 * - Representante → intersecção com a whitelist do perfil.
 */
export function useTemPermissao() {
  const permissoes = usePermissoesStore((s) => s.permissoes);
  const hydrated = usePermissoesStore((s) => s.hydrated);
  const roles = useAuth((s) => s.roles);
  const profile = useAuth((s) => s.profile);
  const isRepresentante =
    !roles.includes("admin") &&
    !roles.includes("master") &&
    roles.includes("vendedor") &&
    profile?.tipo_vendedor === "representante";
  return useCallback(
    (telaId: string, acao: AcaoPermissao = "ver"): boolean => {
      if (isRepresentante && !representanteConcede(telaId)) return false;
      if (!hydrated) return true;
      return permissoes.has(`${telaId}:${acao}`);
    },
    [permissoes, hydrated, isRepresentante],
  );
}

/** Versão imperativa (fora de componentes React). */
export function temPermissaoAgora(
  telaId: string,
  acao: AcaoPermissao = "ver",
): boolean {
  if (ehRepresentanteAgora() && !representanteConcede(telaId)) return false;
  const { hydrated, permissoes } = usePermissoesStore.getState();
  if (!hydrated) return true;
  return permissoes.has(`${telaId}:${acao}`);
}

