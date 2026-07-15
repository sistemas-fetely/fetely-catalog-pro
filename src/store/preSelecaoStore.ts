import { create } from "zustand";
import type { PreSelecao, StatusPreSelecao } from "@/types/preSelecao";
import {
  loadPreSelecoes,
  savePreSelecoes,
  isExpired,
  fetchPreSelecoesRemote,
  updatePreSelecaoRemote,
  deletePreSelecaoRemote,
} from "@/lib/preSelecao";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/authStore";

interface PreSelecaoState {
  hidratado: boolean;
  carregando: boolean;
  todas: PreSelecao[];
  hydrate: () => void;
  refresh: () => Promise<void>;
  adicionar: (pre: PreSelecao) => void;
  atualizarStatus: (id: string, status: StatusPreSelecao, extra?: Partial<PreSelecao>) => void;
  marcarVisualizada: (id: string) => void;
  descartar: (id: string) => void;
  vincularCotacao: (id: string, cotacaoId: string) => void;
  vincularCliente: (id: string, clienteId: string) => void;
  excluir: (id: string) => void;
  processarExpiradas: () => void;
}

function persist(list: PreSelecao[]) {
  savePreSelecoes(list);
}

export const usePreSelecao = create<PreSelecaoState>()((set, get) => ({
  hidratado: false,
  carregando: false,
  todas: [],

  hydrate: () => {
    if (get().hidratado) {
      // Já hidratado, apenas atualiza em background.
      void get().refresh();
      return;
    }
    // Bootstrap com cache local para UI imediata.
    set({ todas: loadPreSelecoes(), hidratado: true });
    get().processarExpiradas();
    void get().refresh();
  },

  refresh: async () => {
    // Só busca no backend se houver sessão (RLS exige authenticated).
    const session = useAuth.getState().session;
    if (!session) return;
    set({ carregando: true });
    try {
      const remotas = await fetchPreSelecoesRemote();
      // Merge: mantém metadados locais (visualizadoEm) se remotos vazios
      const localMap = new Map(get().todas.map((p) => [p.id, p]));
      const merged = remotas.map((r) => {
        const l = localMap.get(r.id);
        return l ? { ...l, ...r } : r;
      });
      set({ todas: merged });
      persist(merged);
    } catch (e) {
      console.warn("[preSelecao] refresh remoto falhou", e);
    } finally {
      set({ carregando: false });
    }
  },

  adicionar: (pre) => {
    const todas = [pre, ...get().todas];
    set({ todas });
    persist(todas);
  },

  atualizarStatus: (id, status, extra) => {
    const todas = get().todas.map((p) => (p.id === id ? { ...p, ...extra, status } : p));
    set({ todas });
    persist(todas);
    void updatePreSelecaoRemote(id, { status, ...extra }).catch((e) =>
      console.warn("[preSelecao] update remoto falhou", e),
    );
  },

  marcarVisualizada: (id) => {
    const now = new Date().toISOString();
    const todas = get().todas.map((p) =>
      p.id === id && p.status === "nova"
        ? { ...p, status: "visualizada" as const, visualizadoEm: now }
        : p,
    );
    set({ todas });
    persist(todas);
    void updatePreSelecaoRemote(id, { status: "visualizada", visualizadoEm: now }).catch(
      (e) => console.warn("[preSelecao] update remoto falhou", e),
    );
  },

  descartar: (id) => get().atualizarStatus(id, "descartada"),

  vincularCotacao: (id, cotacaoId) =>
    get().atualizarStatus(id, "convertida", { cotacaoGeradaId: cotacaoId }),

  vincularCliente: (id, clienteId) => {
    const todas = get().todas.map((p) => (p.id === id ? { ...p, clienteB2bId: clienteId } : p));
    set({ todas });
    persist(todas);
    void updatePreSelecaoRemote(id, { clienteB2bId: clienteId }).catch((e) =>
      console.warn("[preSelecao] update remoto falhou", e),
    );
  },

  excluir: (id) => {
    const todas = get().todas.filter((p) => p.id !== id);
    set({ todas });
    persist(todas);
    void deletePreSelecaoRemote(id).catch((e) =>
      console.warn("[preSelecao] delete remoto falhou", e),
    );
  },

  processarExpiradas: () => {
    let changed = false;
    const todas = get().todas.map((p) => {
      if ((p.status === "nova" || p.status === "visualizada") && isExpired(p)) {
        changed = true;
        return { ...p, status: "expirada" as const };
      }
      return p;
    });
    if (changed) {
      set({ todas });
      persist(todas);
    }
  },
}));

/** Retorna pré-seleções filtradas pelo escopo do usuário logado. */
export function usePreSelecoesEscopo(): PreSelecao[] {
  const todas = usePreSelecao((s) => s.todas);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);

  const isAdmin = roles.includes("admin") || roles.includes("master");
  if (isAdmin) return todas;

  const login = profile?.login_amigavel || profile?.codigo_vendedor || profile?.id || null;
  if (!login) return [];
  return todas.filter(
    (p) =>
      p.vendedorId?.toLowerCase() === login.toLowerCase() ||
      p.atribuidoParaVendedorId === profile?.id,
  );
}
