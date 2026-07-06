import { create } from "zustand";
import type { PreSelecao, StatusPreSelecao } from "@/types/preSelecao";
import {
  loadPreSelecoes,
  savePreSelecoes,
  isExpired,
} from "@/lib/preSelecao";
import { useAuth } from "@/store/authStore";

interface PreSelecaoState {
  hidratado: boolean;
  todas: PreSelecao[];
  hydrate: () => void;
  adicionar: (pre: PreSelecao) => void;
  atualizarStatus: (id: string, status: StatusPreSelecao, extra?: Partial<PreSelecao>) => void;
  marcarVisualizada: (id: string) => void;
  descartar: (id: string) => void;
  vincularCotacao: (id: string, cotacaoId: string) => void;
  vincularCliente: (id: string, clienteId: string) => void;
  excluir: (id: string) => void;
  processarExpiradas: () => void;
}

export const usePreSelecao = create<PreSelecaoState>()((set, get) => ({
  hidratado: false,
  todas: [],

  hydrate: () => {
    if (get().hidratado) return;
    set({ todas: loadPreSelecoes(), hidratado: true });
    get().processarExpiradas();
  },

  adicionar: (pre) => {
    const todas = [pre, ...get().todas];
    set({ todas });
    savePreSelecoes(todas);
  },

  atualizarStatus: (id, status, extra) => {
    const todas = get().todas.map((p) => (p.id === id ? { ...p, ...extra, status } : p));
    set({ todas });
    savePreSelecoes(todas);
  },

  marcarVisualizada: (id) => {
    const todas = get().todas.map((p) =>
      p.id === id && p.status === "nova"
        ? { ...p, status: "visualizada" as const, visualizadoEm: new Date().toISOString() }
        : p,
    );
    set({ todas });
    savePreSelecoes(todas);
  },

  descartar: (id) => get().atualizarStatus(id, "descartada"),

  vincularCotacao: (id, cotacaoId) =>
    get().atualizarStatus(id, "convertida", { cotacaoGeradaId: cotacaoId }),

  vincularCliente: (id, clienteId) => {
    const todas = get().todas.map((p) => (p.id === id ? { ...p, clienteB2bId: clienteId } : p));
    set({ todas });
    savePreSelecoes(todas);
  },

  excluir: (id) => {
    const todas = get().todas.filter((p) => p.id !== id);
    set({ todas });
    savePreSelecoes(todas);
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
      savePreSelecoes(todas);
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
    (p) => p.vendedorId === login || p.atribuidoParaVendedorId === profile?.id,
  );
}
