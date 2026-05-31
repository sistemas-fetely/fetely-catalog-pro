import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Cliente } from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { useOrder } from "@/store/orderStore";
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

interface ClienteState {
  clientes: Cliente[];
  hidratado: boolean;
  hydrate: () => Promise<void>;
  setClientesFromRows: (clientes: Cliente[]) => void;
  upsertCliente: (c: Cliente) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  setAtivo: (id: string, ativo: boolean) => Promise<void>;
  findByCnpj: (cnpjDigits: string) => Cliente | undefined;
  getById: (id: string) => Cliente | undefined;
}

// --- Mappers TS <-> Banco ----------------------------------------------------

function rowToCliente(row: Record<string, unknown>): Cliente {
  return {
    id: row.id as string,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    cadastradoPorVendedorId: row.cadastrado_por_vendedor_id as string,
    cadastradoPorVendedorNome: row.cadastrado_por_vendedor_nome as string,
    cnpj: (row.cnpj as string) ?? "",
    cnpjFormatado: (row.cnpj_formatado as string) ?? "",
    razaoSocial: (row.razao_social as string) ?? "",
    nomeFantasia: (row.nome_fantasia as string) ?? "",
    inscricaoEstadual: (row.inscricao_estadual as string | null) ?? undefined,
    isentoIE: (row.isento_ie as boolean) ?? false,
    situacaoCadastral: (row.situacao_cadastral as Cliente["situacaoCadastral"]) ?? "desconhecida",
    isInternacional: (row.is_internacional as boolean) ?? false,
    pais: (row.pais as string | null) ?? undefined,
    documentoTipo: (row.documento_tipo as string | null) ?? undefined,
    documentoNumero: (row.documento_numero as string | null) ?? undefined,
    logradouro: (row.logradouro as string) ?? "",
    numero: (row.numero as string) ?? "",
    complemento: (row.complemento as string | null) ?? undefined,
    bairro: (row.bairro as string) ?? "",
    cidade: (row.cidade as string) ?? "",
    estado: (row.estado as string) ?? "",
    cep: (row.cep as string) ?? "",
    enderecoEntregaIgual: (row.endereco_entrega_igual as boolean) ?? true,
    entregaLogradouro: (row.entrega_logradouro as string | null) ?? undefined,
    entregaNumero: (row.entrega_numero as string | null) ?? undefined,
    entregaComplemento: (row.entrega_complemento as string | null) ?? undefined,
    entregaBairro: (row.entrega_bairro as string | null) ?? undefined,
    entregaCidade: (row.entrega_cidade as string | null) ?? undefined,
    entregaEstado: (row.entrega_estado as string | null) ?? undefined,
    entregaCep: (row.entrega_cep as string | null) ?? undefined,
    contatoNome: (row.contato_nome as string) ?? "",
    contatoEmail: (row.contato_email as string) ?? "",
    contatoTelefone: (row.contato_telefone as string) ?? "",
    contatoWhatsapp: (row.contato_whatsapp as string | null) ?? undefined,
    financeiroNome: (row.financeiro_nome as string | null) ?? undefined,
    financeiroEmail: (row.financeiro_email as string | null) ?? undefined,
    financeiroTelefone: (row.financeiro_telefone as string | null) ?? undefined,
    segmento: (row.segmento as Cliente["segmento"]) ?? "outro",
    canal: (row.canal as Cliente["canal"]) ?? "outro",
    regiaoAtuacao: (row.regiao_atuacao as string | null) ?? undefined,
    observacoes: (row.observacoes as string | null) ?? undefined,
    tags: (row.tags as string[] | null) ?? [],
    ativo: (row.ativo as boolean) ?? true,
    premissasComerciais: (row.premissas_comerciais as import("@/types/cliente").PremissasComerciais | null) ?? undefined,
  };
}

export function clienteToRow(c: Cliente): Record<string, unknown> {
  return {
    id: c.id,
    criado_em: c.criadoEm,
    atualizado_em: c.atualizadoEm,
    cadastrado_por_vendedor_id: c.cadastradoPorVendedorId,
    cadastrado_por_vendedor_nome: c.cadastradoPorVendedorNome,
    cnpj: c.cnpj,
    cnpj_formatado: c.cnpjFormatado,
    razao_social: c.razaoSocial,
    nome_fantasia: c.nomeFantasia,
    inscricao_estadual: c.inscricaoEstadual ?? null,
    isento_ie: c.isentoIE ?? false,
    situacao_cadastral: c.situacaoCadastral,
    is_internacional: c.isInternacional ?? false,
    pais: c.pais ?? null,
    documento_tipo: c.documentoTipo ?? null,
    documento_numero: c.documentoNumero ?? null,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento ?? null,
    bairro: c.bairro,
    cidade: c.cidade,
    estado: c.estado,
    cep: c.cep,
    endereco_entrega_igual: c.enderecoEntregaIgual,
    entrega_logradouro: c.entregaLogradouro ?? null,
    entrega_numero: c.entregaNumero ?? null,
    entrega_complemento: c.entregaComplemento ?? null,
    entrega_bairro: c.entregaBairro ?? null,
    entrega_cidade: c.entregaCidade ?? null,
    entrega_estado: c.entregaEstado ?? null,
    entrega_cep: c.entregaCep ?? null,
    contato_nome: c.contatoNome,
    contato_email: c.contatoEmail,
    contato_telefone: c.contatoTelefone,
    contato_whatsapp: c.contatoWhatsapp ?? null,
    financeiro_nome: c.financeiroNome ?? null,
    financeiro_email: c.financeiroEmail ?? null,
    financeiro_telefone: c.financeiroTelefone ?? null,
    segmento: c.segmento,
    canal: c.canal,
    regiao_atuacao: c.regiaoAtuacao ?? null,
    observacoes: c.observacoes ?? null,
    tags: c.tags ?? [],
    ativo: c.ativo,
    premissas_comerciais: c.premissasComerciais ?? null,
  };
}

export const useClientes = create<ClienteState>()(
  persist(
    (set, get) => ({
      clientes: [],
      hidratado: false,
      hydrate: async () => {
        try {
          const { data, error } = await supabase
            .from("clientes")
            .select("*")
            .order("criado_em", { ascending: false });
          if (error) throw error;
          const clientes = (data ?? []).map((r) => rowToCliente(r as Record<string, unknown>));
          set({ clientes, hidratado: true });
        } catch (err) {
          console.error("[clienteStore] hydrate falhou:", err);
          set({ hidratado: true });
        }
      },
      setClientesFromRows: (clientes) => set({ clientes }),
      upsertCliente: async (c) => {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!c.cadastradoPorVendedorId || !UUID_RE.test(c.cadastradoPorVendedorId)) {
          throw new Error(
            "Sessão não está pronta. Atualize a página antes de cadastrar o cliente.",
          );
        }
        if (!c.cnpj || !c.razaoSocial) {
          throw new Error("CNPJ e razão social são obrigatórios.");
        }

        const prevList = get().clientes;
        const i = prevList.findIndex((x) => x.id === c.id);

        set((s) => {
          if (i >= 0) {
            const copy = [...s.clientes];
            copy[i] = c;
            return { clientes: copy };
          }
          return { clientes: [c, ...s.clientes] };
        });

        try {
          const { error } = await supabase
            .from("clientes")
            .upsert(clienteToRow(c) as never, { onConflict: "id" });
          if (error) throw error;
        } catch (err: any) {
          set({ clientes: prevList });
          console.error("[clienteStore] upsert falhou:", err, c.id);
          throw new Error(
            err?.message
              ? `Não foi possível salvar o cliente: ${err.message}`
              : "Não foi possível salvar o cliente. Verifique sua conexão.",
          );
        }
      },
      deleteCliente: async (id) => {
        const prevList = get().clientes;
        set((s) => ({ clientes: s.clientes.filter((c) => c.id !== id) }));
        try {
          const { error } = await supabase.from("clientes").delete().eq("id", id);
          if (error) throw error;
        } catch (err: any) {
          set({ clientes: prevList });
          console.error("[clienteStore] delete falhou:", err, id);
          throw new Error(
            err?.message
              ? `Não foi possível excluir o cliente: ${err.message}`
              : "Não foi possível excluir o cliente.",
          );
        }
      },
      setAtivo: async (id, ativo) => {
        const prevList = get().clientes;
        const atualizadoEm = new Date().toISOString();
        set((s) => ({
          clientes: s.clientes.map((c) =>
            c.id === id ? { ...c, ativo, atualizadoEm } : c,
          ),
        }));
        try {
          const { error } = await supabase
            .from("clientes")
            .update({ ativo, atualizado_em: atualizadoEm } as never)
            .eq("id", id);
          if (error) throw error;
        } catch (err: any) {
          set({ clientes: prevList });
          console.error("[clienteStore] setAtivo falhou:", err, id);
          throw new Error(
            err?.message ?? "Não foi possível atualizar o status do cliente.",
          );
        }
      },
      findByCnpj: (cnpjDigits) =>
        get().clientes.find((c) => c.cnpj === cnpjDigits && c.cnpj !== ""),
      getById: (id) => get().clientes.find((c) => c.id === id),
    }),
    {
      name: "fetely_clientes_v1",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ clientes: state.clientes }) as Partial<ClienteState>,
    },
  ),
);

export function useVisibleClientes(): Cliente[] {
  const clientes = useClientes((s) => s.clientes);
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return clientes;
  if (!user) return [];
  return clientes.filter((c) => c.cadastradoPorVendedorId === user.id);
}

export function searchClientesForOrder(query: string, limit = 8): Cliente[] {
  const all = useClientes.getState().clientes;
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const digits = q.replace(/\D/g, "");
  return all
    .filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(q) ||
        c.nomeFantasia.toLowerCase().includes(q) ||
        (digits.length > 0 && c.cnpj.includes(digits)) ||
        c.cidade.toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

export function calcClienteStats(clienteId: string) {
  const history = useOrder.getState().history;
  const pedidos = history.filter((o) => o.meta.clienteId === clienteId);
  const totalFaturado = pedidos.reduce((s, o) => s + o.total, 0);
  const ultimo = pedidos[0]?.createdAt;
  const ticketMedio = pedidos.length > 0 ? totalFaturado / pedidos.length : 0;
  return {
    totalPedidos: pedidos.length,
    totalFaturado,
    ultimoPedidoEm: ultimo,
    ticketMedio,
    pedidos,
  };
}
