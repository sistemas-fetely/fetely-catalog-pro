import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Cliente } from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { useOrder } from "@/store/orderStore";
import { supabase } from "@/integrations/supabase/client";
import { createSafeStorage } from "@/lib/safeStorage";


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

export function rowToCliente(row: Record<string, unknown>): Cliente {
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
    telefonesInternacionais: (row.telefones_internacionais as boolean) ?? false,
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
    telefones_internacionais: c.telefonesInternacionais ?? false,
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
        if (!c.razaoSocial) {
          throw new Error("Razão social é obrigatória.");
        }
        if (!c.isInternacional && !c.cnpj) {
          throw new Error("CNPJ é obrigatório (ou marque como cliente internacional).");
        }
        if (c.isInternacional && !c.documentoNumero) {
          throw new Error("Informe o documento de identificação do cliente internacional.");
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
          const row = clienteToRow(c) as never;
          let exists = i >= 0;
          if (!exists) {
            const { data, error } = await supabase
              .from("clientes")
              .select("id")
              .eq("id", c.id)
              .maybeSingle();
            if (error) throw error;
            exists = Boolean(data);
          }
          const { error } = exists
            ? await supabase.from("clientes").update(row).eq("id", c.id)
            : await supabase.from("clientes").insert(row);
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
      storage: createJSONStorage(createSafeStorage),
      partialize: (state) => ({ clientes: state.clientes }) as Partial<ClienteState>,
    },
  ),
);

export function useVisibleClientes(): Cliente[] {
  const clientes = useClientes((s) => s.clientes);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const admin = roles.includes("admin") || roles.includes("master");
  if (admin) return clientes;
  if (!user) return [];
  // Representante: carteira exclusiva. Vendedor interno: pode apoiar todos.
  if (profile?.tipo_vendedor === "representante") {
    return clientes.filter((c) => c.cadastradoPorVendedorId === user.id);
  }
  return clientes;
}


/** True quando o usuário logado é representante (carteira exclusiva). */
export function isRepresentanteAtual(): boolean {
  const { profile, roles } = useAuth.getState();
  if (roles.includes("admin") || roles.includes("master")) return false;
  return profile?.tipo_vendedor === "representante";
}

export interface CnpjOwnership {
  existe: boolean;
  clienteId: string | null;
  razaoSocial: string | null;
  ownerId: string | null;
  ownerNome: string | null;
  isMine: boolean;
}

/** Consulta se o CNPJ já existe na base e de quem é a carteira. */
export async function checkCnpjOwnership(cnpj: string): Promise<CnpjOwnership> {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  const vazio: CnpjOwnership = {
    existe: false,
    clienteId: null,
    razaoSocial: null,
    ownerId: null,
    ownerNome: null,
    isMine: false,
  };
  if (digits.length < 11) return vazio;
  try {
    const { data, error } = await supabase.rpc("cliente_cnpj_status" as never, {
      p_cnpj: digits,
    } as never);
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row || row.existe !== true) return vazio;
    return {
      existe: true,
      clienteId: (row.cliente_id as string) ?? null,
      razaoSocial: (row.razao_social as string) ?? null,
      ownerId: (row.owner_id as string) ?? null,
      ownerNome: (row.owner_nome as string) ?? null,
      isMine: Boolean(row.is_mine),
    };
  } catch (err) {
    console.error("[clienteStore] checkCnpjOwnership falhou:", err);
    return vazio;
  }
}

/** Abre solicitação de migração do CNPJ para a carteira do usuário logado. */
export async function solicitarMigracaoCnpj(
  cnpj: string,
  justificativa?: string,
): Promise<void> {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  const { error } = await supabase.rpc("solicitar_migracao_cliente" as never, {
    p_cnpj: digits,
    p_justificativa: justificativa ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export function searchClientesForOrder(query: string, limit = 8): Cliente[] {
  const state = useClientes.getState();
  const userId = useAuth.getState().user?.id;
  const all = isRepresentanteAtual()
    ? state.clientes.filter((c) => c.cadastradoPorVendedorId === userId)
    : state.clientes;

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

// --- Carteira: vendedores/representantes disponíveis para direcionamento ------

export interface VendedorCarteira {
  id: string;
  nome: string;
  tipo: "interno" | "representante" | null;
}

/** Lista vendedores ativos (internos e representantes) para atribuir carteira. */
export async function listVendedoresCarteira(): Promise<VendedorCarteira[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome_completo, email, tipo_vendedor, ativo")
      .eq("ativo", true)
      .order("nome_completo", { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .map((r: Record<string, unknown>) => ({
        id: r.id as string,
        nome: ((r.nome_completo as string) || (r.email as string) || "—").trim(),
        tipo: (r.tipo_vendedor as VendedorCarteira["tipo"]) ?? null,
      }))
      .filter((v) => Boolean(v.id));
  } catch (err) {
    console.error("[clienteStore] listVendedoresCarteira falhou:", err);
    return [];
  }
}
