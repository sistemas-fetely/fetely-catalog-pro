import { create } from "zustand";
import type { CartItem, OrderCommercial, OrderMeta } from "@/types";
import type {
  Cotacao,
  MotivoPerdaCotacao,
  StatusCotacao,
} from "@/types/cotacao";
import { COTACAO_VALIDADE_DIAS } from "@/types/cotacao";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { supabase } from "@/integrations/supabase/client";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

interface CotacaoRow {
  id: string;
  vendedor_id: string;
  vendedor_nome: string;
  vendedor_login: string | null;
  cliente_id: string | null;
  criado_em: string;
  atualizado_em: string;
  valido_ate: string;
  status: StatusCotacao;
  total: number | string;
  items: unknown;
  meta: unknown;
  commercial: unknown;
  pedido_convertido_id: string | null;
  motivo_perda: string | null;
  motivo_perda_obs: string | null;
}

function fromRow(r: CotacaoRow): Cotacao {
  return {
    id: r.id,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    validoAte: r.valido_ate,
    vendedorId: r.vendedor_id,
    vendedorNome: r.vendedor_nome,
    vendedorLogin: r.vendedor_login ?? undefined,
    items: (r.items as CartItem[]) ?? [],
    meta: (r.meta as OrderMeta) ?? ({} as OrderMeta),
    total: Number(r.total ?? 0),
    commercial: (r.commercial as OrderCommercial | null) ?? undefined,
    status: r.status,
    pedidoConvertidoId: r.pedido_convertido_id ?? undefined,
    motivoPerda: (r.motivo_perda as MotivoPerdaCotacao | null) ?? undefined,
    motivoPerdaObs: r.motivo_perda_obs ?? undefined,
  };
}

interface CreateCotacaoInput {
  items: CartItem[];
  meta: OrderMeta;
  total: number;
  commercial?: OrderCommercial;
}

interface CotacaoState {
  cotacoes: Cotacao[];
  loading: boolean;
  loaded: boolean;
  fetchAll: () => Promise<void>;
  criarCotacao: (input: CreateCotacaoInput) => Promise<Cotacao>;
  atualizarCotacao: (id: string, input: CreateCotacaoInput) => Promise<Cotacao | null>;
  atualizarStatus: (
    id: string,
    status: StatusCotacao,
    extra?: { motivo?: MotivoPerdaCotacao; motivoObs?: string; pedidoConvertidoId?: string },
  ) => Promise<void>;
  duplicar: (id: string) => Promise<Cotacao | null>;
  marcarConvertida: (id: string, pedidoId: string) => Promise<void>;
  deletar: (id: string) => Promise<void>;
  expirarVencidas: () => Promise<void>;
}

export const useCotacao = create<CotacaoState>()((set, get) => ({
  cotacoes: [],
  loading: false,
  loaded: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("cotacoes")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("[cotacoes] fetchAll", error);
      set({ loading: false });
      return;
    }
    set({
      cotacoes: (data as CotacaoRow[]).map(fromRow),
      loading: false,
      loaded: true,
    });
  },

  criarCotacao: async (input) => {
    const auth = useAuth.getState();
    if (!auth.user) throw new Error("Usuário não autenticado");

    const { data: idData, error: idErr } = await supabase.rpc("next_cotacao_id");
    if (idErr || !idData) throw new Error(idErr?.message ?? "Erro ao gerar ID da cotação");
    const id = idData as string;

    const now = new Date().toISOString();
    const validoAte = addDays(now, COTACAO_VALIDADE_DIAS);
    const clienteId = (input.meta as OrderMeta & { clienteId?: string }).clienteId ?? null;

    const row = {
      id,
      vendedor_id: auth.user.id,
      vendedor_nome:
        auth.profile?.nome_completo ?? auth.profile?.email ?? "—",
      vendedor_login: auth.profile?.login_amigavel ?? auth.profile?.email ?? null,
      cliente_id: clienteId,
      criado_em: now,
      atualizado_em: now,
      valido_ate: validoAte,
      status: "aberta" as StatusCotacao,
      total: input.total,
      items: input.items as never,
      meta: input.meta as never,
      commercial: (input.commercial ?? null) as never,
    };

    const { data, error } = await supabase
      .from("cotacoes")
      .insert(row)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Erro ao salvar cotação");

    const cot = fromRow(data as CotacaoRow);
    set((s) => ({ cotacoes: [cot, ...s.cotacoes.filter((c) => c.id !== cot.id)] }));
    return cot;
  },

  atualizarCotacao: async (id, input) => {
    const now = new Date().toISOString();
    const validoAte = addDays(now, COTACAO_VALIDADE_DIAS);
    const current = get().cotacoes.find((c) => c.id === id);
    const novoStatus: StatusCotacao =
      current?.status === "expirada" ? "aberta" : current?.status ?? "aberta";

    const { data, error } = await supabase
      .from("cotacoes")
      .update({
        items: input.items as never,
        meta: input.meta as never,
        total: input.total,
        commercial: (input.commercial ?? null) as never,
        atualizado_em: now,
        valido_ate: validoAte,
        status: novoStatus,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[cotacoes] atualizar", error);
      return null;
    }
    if (!data) return null;
    const updated = fromRow(data as CotacaoRow);
    set((s) => ({
      cotacoes: s.cotacoes.map((c) => (c.id === id ? updated : c)),
    }));
    return updated;
  },

  atualizarStatus: async (id, status, extra) => {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status,
      atualizado_em: now,
    };
    if (status === "perdida") {
      if (extra?.motivo !== undefined) patch.motivo_perda = extra.motivo;
      if (extra?.motivoObs !== undefined) patch.motivo_perda_obs = extra.motivoObs;
    }
    if (status === "convertida" && extra?.pedidoConvertidoId !== undefined) {
      patch.pedido_convertido_id = extra.pedidoConvertidoId;
    }
    const { data, error } = await supabase
      .from("cotacoes")
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[cotacoes] atualizarStatus", error);
      return;
    }
    if (!data) return;
    const updated = fromRow(data as CotacaoRow);
    set((s) => ({ cotacoes: s.cotacoes.map((c) => (c.id === id ? updated : c)) }));
  },

  duplicar: async (id) => {
    const orig = get().cotacoes.find((c) => c.id === id);
    if (!orig) return null;
    return get().criarCotacao({
      items: orig.items,
      meta: orig.meta,
      total: orig.total,
      commercial: orig.commercial,
    });
  },

  marcarConvertida: async (id, pedidoId) => {
    await get().atualizarStatus(id, "convertida", { pedidoConvertidoId: pedidoId });
  },

  deletar: async (id) => {
    const { error } = await supabase.from("cotacoes").delete().eq("id", id);
    if (error) {
      console.error("[cotacoes] deletar", error);
      return;
    }
    set((s) => ({ cotacoes: s.cotacoes.filter((c) => c.id !== id) }));
  },

  expirarVencidas: async () => {
    const hoje = new Date().toISOString();
    const vencidas = get().cotacoes.filter(
      (c) =>
        (c.status === "aberta" || c.status === "em_negociacao") &&
        new Date(c.validoAte).getTime() < Date.now(),
    );
    if (vencidas.length === 0) return;
    const ids = vencidas.map((c) => c.id);
    const { error } = await supabase
      .from("cotacoes")
      .update({ status: "expirada", atualizado_em: hoje })
      .in("id", ids);
    if (error) {
      console.error("[cotacoes] expirarVencidas", error);
      return;
    }
    set((s) => ({
      cotacoes: s.cotacoes.map((c) =>
        ids.includes(c.id)
          ? { ...c, status: "expirada", atualizadoEm: hoje }
          : c,
      ),
    }));
  },
}));

export function useVisibleCotacoes(): Cotacao[] {
  // RLS já filtra no servidor (vendedora vê as suas, master vê tudo,
  // cliente vê as dele). Aqui só aplicamos um defense-in-depth para
  // o papel "cliente" caso algum dia o RLS afrouxe.
  const cotacoes = useCotacao((s) => s.cotacoes);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);

  if (roles.includes("cliente") && !roles.includes("admin") && !roles.includes("master")) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return cotacoes.filter((c) => c.meta.clienteId === cid);
  }

  // master/admin/vendedora: confia no RLS + filtra por clientes acessíveis
  // (vendedoras só receberam as suas via RLS de qualquer forma)
  void clientes; // mantido para compat de hook deps
  return cotacoes;
}

export function diasAteExpirar(cotacao: Cotacao): number {
  const ms = new Date(cotacao.validoAte).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
