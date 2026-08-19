import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ItemProvisao, ProvisaoFutura, StatusProvisao } from "@/types/provisao";
import type { ClienteSnapshot } from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { compararPrevisao } from "@/lib/classifyItem";
import { supabase } from "@/integrations/supabase/client";
import { createSafeStorage } from "@/lib/safeStorage";


interface CreateProvisaoInput {
  clienteId: string;
  clienteSnapshot: ClienteSnapshot;
  itens: ItemProvisao[];
  pedidoFirmeId?: string;
  cotacaoOrigemId?: string;
  observacoes?: string;
}

/** Dedup de hidratação de provisões. */
let inflightProvHydrate: Promise<void> | null = null;

interface ProvisaoState {
  provisoes: ProvisaoFutura[];
  counter: number;
  hidratado: boolean;
  lastSyncAt: number;
  hydrate: (opts?: { force?: boolean }) => Promise<void>;
  setProvisoesFromRows: (p: ProvisaoFutura[], maxCounter: number) => void;
  createProvisao: (input: CreateProvisaoInput) => Promise<ProvisaoFutura>;
  updateStatus: (id: string, status: StatusProvisao, extra?: Partial<ProvisaoFutura>) => void;
  setObservacoes: (id: string, txt: string) => void;
  atualizarProvisao: (id: string, patch: { itens: ItemProvisao[]; observacoes?: string }) => Promise<ProvisaoFutura>;
  cancelar: (id: string) => void;
  deleteProvisao: (id: string) => Promise<void>;
  reprovarProvisao: (id: string, motivo: string) => Promise<void>;
  desfazerReprovacaoProvisao: (id: string) => Promise<void>;
}

function rowToProvisao(row: Record<string, unknown>, itens: ItemProvisao[]): ProvisaoFutura {
  return {
    id: row.id as string,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    vendedorId: row.vendedor_id as string,
    vendedorNome: row.vendedor_nome as string,
    clienteId: row.cliente_id as string,
    clienteSnapshot: row.cliente_snapshot as ClienteSnapshot,
    pedidoFirmeId: (row.pedido_firme_id as string | null) ?? undefined,
    cotacaoOrigemId: (row.cotacao_origem_id as string | null) ?? undefined,
    pedidoConvertidoId: (row.pedido_convertido_id as string | null) ?? undefined,
    status: row.status as StatusProvisao,
    itens,
    datasPrevisao: (row.datas_previsao as string[] | null) ?? [],
    proximaPrevisao: row.proxima_previsao as string,
    observacoes: (row.observacoes as string | null) ?? undefined,
    totalReferencia: Number(row.total_referencia ?? 0),
    reprovado: Boolean(row.reprovado ?? false),
    reprovadoEm: (row.reprovado_em as string | null) ?? null,
    reprovadoMotivo: (row.reprovado_motivo as string | null) ?? null,
    reprovadoPorId: (row.reprovado_por_id as string | null) ?? null,
    reprovadoPorNome: (row.reprovado_por_nome as string | null) ?? null,
  };
}

function rowToItemProvisao(row: Record<string, unknown>): ItemProvisao {
  return {
    sku: row.sku as string,
    nomeComercial: row.nome_comercial as string,
    colecao: (row.colecao as string) ?? "",
    corNome: (row.cor_nome as string) ?? "",
    tamanhoNumero: (row.tamanho_numero as string) ?? "",
    quantidade: Number(row.quantidade ?? 0),
    precoAtacadoReferencia: Number(row.preco_atacado_referencia ?? 0),
    statusEstoque: (row.status_estoque as string) ?? "",
    previsaoData: (row.previsao_data as string) ?? "",
  };
}

export function provisaoToRow(p: ProvisaoFutura): Record<string, unknown> {
  return {
    id: p.id,
    criado_em: p.criadoEm,
    atualizado_em: p.atualizadoEm,
    vendedor_id: p.vendedorId,
    vendedor_nome: p.vendedorNome,
    cliente_id: p.clienteId,
    cliente_snapshot: p.clienteSnapshot,
    pedido_firme_id: p.pedidoFirmeId ?? null,
    cotacao_origem_id: p.cotacaoOrigemId ?? null,
    pedido_convertido_id: p.pedidoConvertidoId ?? null,
    status: p.status,
    datas_previsao: p.datasPrevisao,
    proxima_previsao: p.proximaPrevisao,
    observacoes: p.observacoes ?? null,
    total_referencia: p.totalReferencia,
  };
}

export function provisaoItensToRows(p: ProvisaoFutura): Record<string, unknown>[] {
  return p.itens.map((i) => ({
    provisao_id: p.id,
    sku: i.sku,
    nome_comercial: i.nomeComercial,
    colecao: i.colecao,
    cor_nome: i.corNome,
    tamanho_numero: i.tamanhoNumero,
    quantidade: i.quantidade,
    preco_atacado_referencia: i.precoAtacadoReferencia,
    status_estoque: i.statusEstoque,
    previsao_data: i.previsaoData,
  }));
}

export const useProvisao = create<ProvisaoState>()(
  persist(
    (set, get) => ({
      provisoes: [],
      counter: 0,
      hidratado: false,
      hydrate: async () => {
        try {
          const { data: provRows, error: err1 } = await supabase
            .from("provisoes")
            .select("*")
            .order("criado_em", { ascending: false })
            .limit(500);
          if (err1) throw err1;
          const ids = (provRows ?? []).map((r) => r.id as string);
          let itensByProv: Record<string, ItemProvisao[]> = {};
          if (ids.length > 0) {
            // Paginar para evitar truncamento pelo limite padrão do PostgREST (1000 linhas).
            const PAGE = 1000;
            const allItems: Record<string, unknown>[] = [];
            for (let from = 0; ; from += PAGE) {
              const { data: itemRows, error: err2 } = await supabase
                .from("provisao_itens")
                .select("*")
                .in("provisao_id", ids)
                .range(from, from + PAGE - 1);
              if (err2) throw err2;
              const rows = (itemRows ?? []) as Record<string, unknown>[];
              allItems.push(...rows);
              if (rows.length < PAGE) break;
            }
            itensByProv = allItems.reduce<Record<string, ItemProvisao[]>>((acc, r) => {
              const pid = r.provisao_id as string;
              if (!acc[pid]) acc[pid] = [];
              acc[pid].push(rowToItemProvisao(r));
              return acc;
            }, {});
          }
          const provisoes = (provRows ?? []).map((r) =>
            rowToProvisao(r as Record<string, unknown>, itensByProv[(r as Record<string, unknown>).id as string] ?? []),
          );
          const maxCounter = provisoes.reduce((max, p) => {
            const m = /^P(\d+)$/.exec(p.id);
            if (m) {
              const n = parseInt(m[1], 10);
              return n > max ? n : max;
            }
            return max;
          }, 0);
          set({ provisoes, counter: maxCounter, hidratado: true });
        } catch (err) {
          console.error("[provisaoStore] hydrate falhou:", err);
          set({ hidratado: true });
        }
      },
      setProvisoesFromRows: (p, maxCounter) => set({ provisoes: p, counter: maxCounter }),
      createProvisao: async (input) => {
        const auth = useAuth.getState();
        if (!auth.session || !auth.user?.id) {
          throw new Error("Sua sessão expirou ou ainda está carregando. Atualize a página e tente novamente.");
        }
        if (input.itens.length === 0) {
          throw new Error("Não há itens de provisão para salvar.");
        }
        // ID globalmente único (evita colisão entre contadores locais de vendedores diferentes)
        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const id = `PROV-${ts}-${rand}`;
        const next = get().counter + 1;
        const datasSet = new Set(input.itens.map((i) => i.previsaoData));
        const datasPrevisao = Array.from(datasSet).sort(compararPrevisao);
        const totalReferencia = input.itens.reduce(
          (s, i) => s + i.precoAtacadoReferencia * i.quantidade,
          0,
        );
        const now = new Date().toISOString();
        const provisao: ProvisaoFutura = {
          id,
          criadoEm: now,
          atualizadoEm: now,
          vendedorId: auth.user.id,
          vendedorNome:
            auth.profile?.nome_completo ?? auth.profile?.email ?? "—",
          clienteId: input.clienteId,
          clienteSnapshot: input.clienteSnapshot,
          pedidoFirmeId: input.pedidoFirmeId,
          cotacaoOrigemId: input.cotacaoOrigemId,
          status: "aguardando_estoque",
          itens: input.itens,
          datasPrevisao,
          proximaPrevisao: datasPrevisao[0] ?? "—",
          observacoes: input.observacoes,
          totalReferencia,
        };

        try {
          const { error: errP } = await supabase
            .from("provisoes")
            .upsert(provisaoToRow(provisao) as never, { onConflict: "id" });
          if (errP) throw errP;

          const itemRows = provisaoItensToRows(provisao);
          if (itemRows.length > 0) {
            const { error: errDel } = await supabase
              .from("provisao_itens")
              .delete()
              .eq("provisao_id", provisao.id);
            if (errDel) throw errDel;

            const { error: errI } = await supabase
              .from("provisao_itens")
              .insert(itemRows as never);
            if (errI) throw errI;
          }
        } catch (err: unknown) {
          console.error("[provisaoStore] createProvisao banco falhou:", err, provisao.id);
          const e = err as { message?: string; details?: string; hint?: string; code?: string };
          const parts = [e?.message, e?.details, e?.hint, e?.code ? `(${e.code})` : null]
            .filter(Boolean);
          const msg =
            err instanceof Error
              ? err.message
              : parts.length > 0
                ? parts.join(" — ")
                : (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
          throw new Error(
            msg
              ? `Não foi possível salvar a provisão no banco: ${msg}`
              : "Não foi possível salvar a provisão. Verifique sua conexão e tente novamente.",
          );
        }

        set((s) => ({
          provisoes: [provisao, ...s.provisoes],
          counter: next,
        }));
        return provisao;
      },
      updateStatus: (id, status, extra) => {
        const atualizadoEm = new Date().toISOString();
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id ? { ...p, ...extra, status, atualizadoEm } : p,
          ),
        }));
        const update: Record<string, unknown> = { status, atualizado_em: atualizadoEm };
        if (extra?.pedidoFirmeId !== undefined) update.pedido_firme_id = extra.pedidoFirmeId;
        if (extra?.pedidoConvertidoId !== undefined) update.pedido_convertido_id = extra.pedidoConvertidoId;
        if (extra?.observacoes !== undefined) update.observacoes = extra.observacoes;
        void supabase
          .from("provisoes")
          .update(update as never)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[provisaoStore] updateStatus falhou:", error, id);
          });
      },
      setObservacoes: (id, txt) => {
        const atualizadoEm = new Date().toISOString();
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id ? { ...p, observacoes: txt, atualizadoEm } : p,
          ),
        }));
        void supabase
          .from("provisoes")
          .update({ observacoes: txt, atualizado_em: atualizadoEm } as never)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[provisaoStore] setObservacoes falhou:", error, id);
          });
      },
      atualizarProvisao: async (id, patch) => {
        const atual = get().provisoes.find((p) => p.id === id);
        if (!atual) throw new Error("Provisão não encontrada");
        if (atual.status === "convertido_em_pedido") {
          throw new Error("Provisão já convertida em pedido não pode ser editada");
        }
        if (patch.itens.length === 0) {
          throw new Error("A provisão precisa ter pelo menos um item");
        }
        const datasSet = new Set(patch.itens.map((i) => i.previsaoData));
        const datasPrevisao = Array.from(datasSet).sort(compararPrevisao);
        const totalReferencia = patch.itens.reduce(
          (s, i) => s + i.precoAtacadoReferencia * i.quantidade,
          0,
        );
        const atualizadoEm = new Date().toISOString();
        const atualizada: ProvisaoFutura = {
          ...atual,
          itens: patch.itens,
          datasPrevisao,
          proximaPrevisao: datasPrevisao[0] ?? "—",
          observacoes: patch.observacoes ?? atual.observacoes,
          totalReferencia,
          atualizadoEm,
        };
        try {
          const { error: errP } = await supabase
            .from("provisoes")
            .update({
              datas_previsao: datasPrevisao,
              proxima_previsao: atualizada.proximaPrevisao,
              observacoes: atualizada.observacoes ?? null,
              total_referencia: totalReferencia,
              atualizado_em: atualizadoEm,
            } as never)
            .eq("id", id);
          if (errP) throw errP;
          const { error: errDel } = await supabase
            .from("provisao_itens")
            .delete()
            .eq("provisao_id", id);
          if (errDel) throw errDel;
          const { error: errI } = await supabase
            .from("provisao_itens")
            .insert(provisaoItensToRows(atualizada) as never);
          if (errI) throw errI;
        } catch (err) {
          console.error("[provisaoStore] atualizarProvisao falhou:", err, id);
          throw err instanceof Error ? err : new Error(String(err));
        }
        set((s) => ({
          provisoes: s.provisoes.map((p) => (p.id === id ? atualizada : p)),
        }));
        return atualizada;
      },
      cancelar: (id) => {
        const atualizadoEm = new Date().toISOString();
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id ? { ...p, status: "cancelado", atualizadoEm } : p,
          ),
        }));
        void supabase
          .from("provisoes")
          .update({ status: "cancelado", atualizado_em: atualizadoEm } as never)
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[provisaoStore] cancelar falhou:", error, id);
          });
      },
      deleteProvisao: async (id) => {
        const prev = get().provisoes;
        set((s) => ({ provisoes: s.provisoes.filter((p) => p.id !== id) }));
        try {
          await supabase.from("provisao_itens").delete().eq("provisao_id", id);
          const { error } = await supabase.from("provisoes").delete().eq("id", id);
          if (error) throw error;
        } catch (err) {
          console.error("[provisaoStore] deleteProvisao falhou:", err, id);
          set({ provisoes: prev });
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
      reprovarProvisao: async (id, motivo) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada.");
        const reprovadoEm = new Date().toISOString();
        const reprovadoPorNome =
          auth.profile?.nome_completo ?? auth.profile?.email ?? auth.user.email ?? "—";
        const prev = get().provisoes;
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id
              ? {
                  ...p,
                  reprovado: true,
                  reprovadoEm,
                  reprovadoMotivo: motivo,
                  reprovadoPorId: auth.user!.id,
                  reprovadoPorNome,
                  atualizadoEm: reprovadoEm,
                }
              : p,
          ),
        }));
        const { error } = await supabase
          .from("provisoes")
          .update({
            reprovado: true,
            reprovado_em: reprovadoEm,
            reprovado_motivo: motivo,
            reprovado_por_id: auth.user.id,
            reprovado_por_nome: reprovadoPorNome,
            atualizado_em: reprovadoEm,
          } as never)
          .eq("id", id);
        if (error) {
          console.error("[provisaoStore] reprovarProvisao falhou:", error, id);
          set({ provisoes: prev });
          throw new Error(error.message);
        }
      },
      desfazerReprovacaoProvisao: async (id) => {
        const prev = get().provisoes;
        const atualizadoEm = new Date().toISOString();
        set((s) => ({
          provisoes: s.provisoes.map((p) =>
            p.id === id
              ? {
                  ...p,
                  reprovado: false,
                  reprovadoEm: null,
                  reprovadoMotivo: null,
                  reprovadoPorId: null,
                  reprovadoPorNome: null,
                  atualizadoEm,
                }
              : p,
          ),
        }));
        const { error } = await supabase
          .from("provisoes")
          .update({
            reprovado: false,
            reprovado_em: null,
            reprovado_motivo: null,
            reprovado_por_id: null,
            reprovado_por_nome: null,
            atualizado_em: atualizadoEm,
          } as never)
          .eq("id", id);
        if (error) {
          console.error("[provisaoStore] desfazerReprovacaoProvisao falhou:", error, id);
          set({ provisoes: prev });
          throw new Error(error.message);
        }
      },
    }),
    {
      name: "fetely_provisoes_v1",
      storage: createJSONStorage(createSafeStorage),
      partialize: (state) =>
        ({ provisoes: state.provisoes, counter: state.counter }) as Partial<ProvisaoState>,
    },
  ),
);

export function useVisibleProvisoes(opts?: { includeReprovados?: boolean }): ProvisaoFutura[] {
  const provisoes = useProvisao((s) => s.provisoes);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);
  const admin = roles.includes("admin") || roles.includes("master");
  const filterReprovados = (list: ProvisaoFutura[]) =>
    opts?.includeReprovados ? list : list.filter((p) => !p.reprovado);
  if (admin) return filterReprovados(provisoes);
  if (!user) return [];
  if (roles.includes("cliente")) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return filterReprovados(provisoes.filter((p) => p.clienteId === cid));
  }
  const meusClienteIds = new Set(
    clientes.filter((c) => c.cadastradoPorVendedorId === user.id).map((c) => c.id),
  );
  return filterReprovados(
    provisoes.filter(
      (p) => p.vendedorId === user.id || meusClienteIds.has(p.clienteId),
    ),
  );
}

export function useCanReprovarProvisao(provisao: ProvisaoFutura | null | undefined): boolean {
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);
  if (!provisao || !user) return false;
  if (roles.includes("admin") || roles.includes("master")) return true;
  if (provisao.vendedorId === user.id) return true;
  const cliente = clientes.find((c) => c.id === provisao.clienteId);
  return !!cliente && cliente.cadastradoPorVendedorId === user.id;
}
