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
  items?: unknown;
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
    items: (r.items as CartItem[] | undefined) ?? [],
    meta: (r.meta as OrderMeta) ?? ({} as OrderMeta),
    total: Number(r.total ?? 0),
    commercial: (r.commercial as OrderCommercial | null) ?? undefined,
    status: r.status,
    pedidoConvertidoId: r.pedido_convertido_id ?? undefined,
    motivoPerda: (r.motivo_perda as MotivoPerdaCotacao | null) ?? undefined,
    motivoPerdaObs: r.motivo_perda_obs ?? undefined,
  };
}

const LIST_COLS =
  "id, vendedor_id, vendedor_nome, vendedor_login, cliente_id, criado_em, atualizado_em, valido_ate, status, total, meta, commercial, pedido_convertido_id, motivo_perda, motivo_perda_obs";

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
  lastSyncAt: number;
  fetchAll: (opts?: { force?: boolean }) => Promise<void>;
  ensureItems: (id: string) => Promise<Cotacao | null>;
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
  lastSyncAt: 0,

  fetchAll: async (opts) => {
    // Cache-first: lista já carregada continua na tela; só revalida se ficou velha.
    const st = get();
    const TTL = 60_000;
    if (!opts?.force && st.loaded && Date.now() - st.lastSyncAt < TTL) return;
    if (st.loading) return;
    set({ loading: true });
    // Lista leve: sem o JSON de itens (carregado sob demanda ao abrir).
    const { data, error } = await supabase
      .from("cotacoes")
      .select(LIST_COLS)
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("[cotacoes] fetchAll", error);
      set({ loading: false });
      return;
    }
    const anteriores = new Map(get().cotacoes.map((c) => [c.id, c.items]));
    set({
      cotacoes: (data as unknown as CotacaoRow[]).map((r) => {
        const c = fromRow(r);
        const prev = anteriores.get(c.id);
        return prev && prev.length > 0 ? { ...c, items: prev } : c;
      }),
      loading: false,
      loaded: true,
      lastSyncAt: Date.now(),
    });
  },

  ensureItems: async (id) => {
    const atual = get().cotacoes.find((c) => c.id === id) ?? null;
    if (atual && atual.items.length > 0) return atual;
    const { data, error } = await supabase
      .from("cotacoes")
      .select("items")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("[cotacoes] ensureItems", error);
      return atual;
    }
    const items = ((data as { items: unknown }).items as CartItem[]) ?? [];
    set((s) => ({
      cotacoes: s.cotacoes.map((c) => (c.id === id ? { ...c, items } : c)),
    }));
    return get().cotacoes.find((c) => c.id === id) ?? null;
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
  // RLS já filtra no servidor; aqui aplicamos defense-in-depth por papel.
  const cotacoes = useCotacao((s) => s.cotacoes);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);
  const admin = roles.includes("admin") || roles.includes("master");

  if (roles.includes("cliente") && !admin) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return cotacoes.filter((c) => c.meta.clienteId === cid);
  }

  if (admin) return cotacoes;
  if (!user) return [];

  // Vendedor interno: visão total (inclui cotações de representantes).
  if ((profile?.tipo_vendedor ?? "interno") !== "representante") return cotacoes;

  // Representante: próprias cotações + de clientes da sua carteira.
  const meusClienteIds = new Set(

    clientes.filter((c) => c.cadastradoPorVendedorId === user.id).map((c) => c.id),
  );
  return cotacoes.filter(
    (c) =>
      c.vendedorId === user.id ||
      (c.meta.clienteId && meusClienteIds.has(c.meta.clienteId)),
  );
}


export function diasAteExpirar(cotacao: Cotacao): number {
  const ms = new Date(cotacao.validoAte).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
