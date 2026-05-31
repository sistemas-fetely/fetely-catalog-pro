import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ItemProvisao, ProvisaoFutura, StatusProvisao } from "@/types/provisao";
import type { ClienteSnapshot } from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { compararPrevisao } from "@/lib/classifyItem";
import { supabase } from "@/integrations/supabase/client";

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};
const safeStorage = (): Storage =>
  typeof window !== "undefined" ? window.localStorage : noopStorage;

interface CreateProvisaoInput {
  clienteId: string;
  clienteSnapshot: ClienteSnapshot;
  itens: ItemProvisao[];
  pedidoFirmeId?: string;
  observacoes?: string;
}

interface ProvisaoState {
  provisoes: ProvisaoFutura[];
  counter: number;
  hidratado: boolean;
  hydrate: () => Promise<void>;
  setProvisoesFromRows: (p: ProvisaoFutura[], maxCounter: number) => void;
  createProvisao: (input: CreateProvisaoInput) => ProvisaoFutura;
  updateStatus: (id: string, status: StatusProvisao, extra?: Partial<ProvisaoFutura>) => void;
  setObservacoes: (id: string, txt: string) => void;
  cancelar: (id: string) => void;
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
    pedidoConvertidoId: (row.pedido_convertido_id as string | null) ?? undefined,
    status: row.status as StatusProvisao,
    itens,
    datasPrevisao: (row.datas_previsao as string[] | null) ?? [],
    proximaPrevisao: row.proxima_previsao as string,
    observacoes: (row.observacoes as string | null) ?? undefined,
    totalReferencia: Number(row.total_referencia ?? 0),
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
            const { data: itemRows, error: err2 } = await supabase
              .from("provisao_itens")
              .select("*")
              .in("provisao_id", ids);
            if (err2) throw err2;
            itensByProv = (itemRows ?? []).reduce<Record<string, ItemProvisao[]>>((acc, r) => {
              const pid = (r as Record<string, unknown>).provisao_id as string;
              if (!acc[pid]) acc[pid] = [];
              acc[pid].push(rowToItemProvisao(r as Record<string, unknown>));
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
      createProvisao: (input) => {
        const auth = useAuth.getState();
        const next = get().counter + 1;
        const id = `P${String(next).padStart(4, "0")}`;
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
          vendedorId: auth.user?.id ?? "",
          vendedorNome:
            auth.profile?.nome_completo ?? auth.profile?.email ?? "—",
          clienteId: input.clienteId,
          clienteSnapshot: input.clienteSnapshot,
          pedidoFirmeId: input.pedidoFirmeId,
          status: "aguardando_estoque",
          itens: input.itens,
          datasPrevisao,
          proximaPrevisao: datasPrevisao[0] ?? "—",
          observacoes: input.observacoes,
          totalReferencia,
        };
        set((s) => ({
          provisoes: [provisao, ...s.provisoes],
          counter: next,
        }));
        void (async () => {
          try {
            const { error: errP } = await supabase
              .from("provisoes")
              .upsert(provisaoToRow(provisao) as never, { onConflict: "id" });
            if (errP) throw errP;
            const itemRows = provisaoItensToRows(provisao);
            if (itemRows.length > 0) {
              await supabase.from("provisao_itens").delete().eq("provisao_id", provisao.id);
              const { error: errI } = await supabase
                .from("provisao_itens")
                .insert(itemRows as never);
              if (errI) throw errI;
            }
          } catch (err) {
            console.error("[provisaoStore] createProvisao banco falhou:", err, provisao.id);
          }
        })();
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
    }),
    {
      name: "fetely_provisoes_v1",
      storage: createJSONStorage(safeStorage),
      partialize: (state) =>
        ({ provisoes: state.provisoes, counter: state.counter }) as Partial<ProvisaoState>,
    },
  ),
);

export function useVisibleProvisoes(): ProvisaoFutura[] {
  const provisoes = useProvisao((s) => s.provisoes);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return provisoes;
  if (!user) return [];
  if (roles.includes("cliente")) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return provisoes.filter((p) => p.clienteId === cid);
  }
  return provisoes.filter((p) => p.vendedorId === user.id);
}
