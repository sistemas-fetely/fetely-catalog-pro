import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CartItem,
  OrderCommercial,
  OrderMeta,
  PedidoHistoricoEvento,
  Product,
  SavedOrder,
  StatusPedido,
} from "@/types";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { supabase } from "@/integrations/supabase/client";
import { createSafeStorage } from "@/lib/safeStorage";
import { formatBRL } from "@/lib/format";



interface OrderState {
  items: CartItem[];
  meta: OrderMeta;
  history: SavedOrder[];
  hidratado: boolean;
  lastSyncAt: number;
  hydrate: (opts?: { force?: boolean }) => Promise<void>;
  hydrateOrderById: (orderId: string) => Promise<SavedOrder | null>;
  setHistoryFromRows: (orders: SavedOrder[]) => void;
  addItem: (product: Product, quantity: number) => void;
  addBulk: (entries: { product: Product; quantity: number }[]) => void;
  updateQty: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  removeItems: (skus: string[]) => void;
  clearCart: () => void;
  setMeta: (m: Partial<OrderMeta>) => void;
  // V21 — Negociação por item (modo negociação ativo)
  setItemPrecoOverride: (sku: string, preco: number | undefined) => void;
  setItemDescontoPct: (sku: string, pct: number | undefined) => void;
  setItemJustificativa: (sku: string, texto: string) => void;
  clearItemNegociacao: (sku: string) => void;
  clearAllItemNegociacoes: () => void;
  saveOrder: (commercial?: OrderCommercial, itemsOverride?: CartItem[]) => Promise<SavedOrder>;
  reassignOrder: (
    orderId: string,
    novo: { vendedorId: string; vendedorNome?: string | null; vendedorLogin?: string | null; vendedorTipo?: "interno" | "representante" | null },
  ) => void;
  deleteOrder: (orderId: string) => Promise<void>;
  reprovarOrder: (orderId: string, motivo: string) => Promise<void>;
  desfazerReprovacao: (orderId: string) => Promise<void>;
  saveOrderAsCliente: (commercial: OrderCommercial | undefined, items: CartItem[]) => Promise<SavedOrder>;
  aprovarPedidoCliente: (orderId: string, obs?: string) => Promise<{ provisaoId?: string }>;
  recusarPedidoCliente: (orderId: string, motivo: string, obs?: string) => Promise<void>;
  solicitarAjustePedido: (orderId: string, mensagem: string) => Promise<void>;
  cancelarPedidoPendente: (orderId: string) => Promise<void>;
}

const defaultMeta: OrderMeta = {
  cliente: "",
  cnpj: "",
  condicaoPagamento: "À vista",
  observacoes: "",
  observacoesCliente: "",
  vendedor: "Representante Fetély",
};


function rowToOrder(row: Record<string, unknown>, items: CartItem[]): SavedOrder {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    items,
    meta: row.meta as OrderMeta,
    total: Number(row.total ?? 0),
    commercial: (row.commercial as OrderCommercial | null) ?? undefined,
    vendedorId: (row.vendedor_id as string | null) ?? undefined,
    vendedorNome: (row.vendedor_nome as string | null) ?? undefined,
    vendedorLogin: (row.vendedor_login as string | null) ?? undefined,
    vendedorTipo: (row.vendedor_tipo as "interno" | "representante" | null) ?? null,
    reprovado: Boolean(row.reprovado ?? false),
    reprovadoEm: (row.reprovado_em as string | null) ?? null,
    reprovadoMotivo: (row.reprovado_motivo as string | null) ?? null,
    reprovadoPorId: (row.reprovado_por_id as string | null) ?? null,
    reprovadoPorNome: (row.reprovado_por_nome as string | null) ?? null,
    origemPerfil: (row.origem_perfil as SavedOrder["origemPerfil"]) ?? "vendedor",
    statusPedido: (row.status_pedido as StatusPedido) ?? "confirmado",
    aprovadoPorId: (row.aprovado_por_id as string | null) ?? null,
    aprovadoPorNome: (row.aprovado_por_nome as string | null) ?? null,
    aprovadoEm: (row.aprovado_em as string | null) ?? null,
    aprovacaoObs: (row.aprovacao_obs as string | null) ?? null,
    recusadoPorId: (row.recusado_por_id as string | null) ?? null,
    recusadoPorNome: (row.recusado_por_nome as string | null) ?? null,
    recusadoMotivoTexto: (row.recusado_motivo as string | null) ?? null,
    recusadoObs: (row.recusado_obs as string | null) ?? null,
    recusadoEmAprovacao: (row.recusado_em as string | null) ?? null,
    temSolicitacaoAjuste: Boolean(row.tem_solicitacao_ajuste ?? false),
    ajusteMensagem: (row.ajuste_mensagem as string | null) ?? null,
    historico: (row.historico as PedidoHistoricoEvento[] | null) ?? [],
    sncfPedidoId: (row.sncf_pedido_id as string | null) ?? null,
    duplicadoDe: (row.duplicado_de as string | null) ?? null,
    modeloOrigemId: (row.modelo_origem_id as string | null) ?? null,
    grupoOrigemId: (row.grupo_origem_id as string | null) ?? null,
    bonificado: Boolean(row.bonificado ?? false),
    motivoBonificacao: (row.motivo_bonificacao as string | null) ?? null,
    estadoLiberacao: (row.estado_liberacao as SavedOrder["estadoLiberacao"]) ?? "aguardando_liberacao",
  };
}

function rowToItem(row: Record<string, unknown>): CartItem {
  const override = row.preco_unit_override;
  const desc = row.desconto_item_pct;
  return {
    sku: row.sku as string,
    product: row.product_snapshot as Product,
    quantity: Number(row.quantity ?? 0),
    precoOverride: override == null ? undefined : Number(override),
    descontoItemPct: desc == null ? undefined : Number(desc),
    justificativaNegociacao: (row.justificativa_negociacao as string | null) ?? undefined,
  };
}

export function orderToRow(o: SavedOrder): Record<string, unknown> {
  const totalUnidades = o.items.reduce((s, i) => s + i.quantity, 0);
  const totalSkus = o.items.length;
  const metaAny = o.meta as OrderMeta & { provisaoOrigemId?: string };
  return {
    id: o.id,
    created_at: o.createdAt,
    vendedor_id: o.vendedorId ?? null,
    vendedor_nome: o.vendedorNome ?? "—",
    vendedor_login: o.vendedorLogin ?? null,
    vendedor_tipo: o.vendedorTipo ?? null,
    cliente_id: o.meta.clienteId ?? null,
    meta: o.meta,
    cliente_snapshot: o.meta.clienteSnapshot ?? null,
    commercial: o.commercial ?? null,
    total: o.total,
    total_unidades: totalUnidades,
    total_skus: totalSkus,
    provisao_origem_id: metaAny.provisaoOrigemId ?? null,
    origem_perfil: o.origemPerfil ?? "vendedor",
    status_pedido: o.statusPedido ?? "confirmado",
    historico: o.historico ?? [],
    duplicado_de: o.duplicadoDe ?? null,
    modelo_origem_id: o.modeloOrigemId ?? null,
    grupo_origem_id: o.grupoOrigemId ?? null,
    bonificado: o.bonificado ?? false,
    motivo_bonificacao: o.motivoBonificacao ?? null,
  };
}


async function fetchSkuToProductId(skus: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const unique = Array.from(new Set(skus.filter(Boolean)));
  if (unique.length === 0) return map;
  // chunk para evitar URL gigante
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("products")
      .select("id, sku")
      .in("sku", chunk);
    if (error) throw error;
    (data ?? []).forEach((r) => {
      const row = r as { id: string; sku: string };
      map[row.sku] = row.id;
    });
  }
  return map;
}

export async function orderItemsToRows(o: SavedOrder): Promise<Record<string, unknown>[]> {
  const skuMap = await fetchSkuToProductId(o.items.map((it) => it.sku));
  const missing = o.items.filter((it) => !skuMap[it.sku]).map((it) => it.sku);
  if (missing.length > 0) {
    throw new Error(
      `Produtos não encontrados no catálogo do banco: ${missing.join(", ")}. ` +
        `Atualize o catálogo antes de salvar o pedido.`,
    );
  }
  return o.items.map((it, idx) => {
    const desc = it.descontoItemPct ?? 0;
    const precoUnitEfetivo = (it.precoOverride ?? it.product.precoAtacado);
    const subtotalEfetivo = precoUnitEfetivo * it.quantity * (1 - desc / 100);
    return {
      order_id: o.id,
      posicao: idx,
      sku: it.sku,
      product_id: skuMap[it.sku],
      product_snapshot: it.product,
      quantity: it.quantity,
      preco_unit_atacado: it.product.precoAtacado, // snapshot do preço de tabela
      preco_unit_override: it.precoOverride ?? null,
      desconto_item_pct: it.descontoItemPct ?? null,
      justificativa_negociacao: it.justificativaNegociacao ?? null,
      subtotal_bruto: subtotalEfetivo, // contribuição efetiva ao bruto do pedido (já considera override + desconto)
    };
  });
}

const ORDER_ITEMS_PAGE_SIZE = 1000;

async function fetchOrderItemRowsByOrderIds(ids: string[]): Promise<Record<string, CartItem[]>> {
  const itemsByOrder: Record<string, CartItem[]> = {};
  if (ids.length === 0) return itemsByOrder;
  for (let from = 0; ; from += ORDER_ITEMS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", ids)
      .order("order_id", { ascending: true })
      .order("posicao", { ascending: true })
      .range(from, from + ORDER_ITEMS_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    rows.forEach((r) => {
      const oid = (r as Record<string, unknown>).order_id as string;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push(rowToItem(r as Record<string, unknown>));
    });
    if (rows.length < ORDER_ITEMS_PAGE_SIZE) break;
  }
  return itemsByOrder;
}

async function fetchOrderItemsByOrderId(orderId: string): Promise<CartItem[]> {
  const items: CartItem[] = [];
  for (let from = 0; ; from += ORDER_ITEMS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("posicao", { ascending: true })
      .range(from, from + ORDER_ITEMS_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    items.push(...rows.map((r) => rowToItem(r as Record<string, unknown>)));
    if (rows.length < ORDER_ITEMS_PAGE_SIZE) break;
  }
  return items;
}

export const useOrder = create<OrderState>()(
  persist(
    (set, get) => ({
      items: [],
      meta: defaultMeta,
      history: [],
      hidratado: false,
      lastSyncAt: 0,
      hydrate: async (opts) => {
        // Cache-first: se já temos histórico recente em memória/cache, não
        // bloqueia a navegação — só revalida se passou do TTL ou se forçado.
        const st = get();
        const TTL = 90_000;
        if (!opts?.force && st.hidratado && Date.now() - st.lastSyncAt < TTL) return;
        if (inflightHydrate) return inflightHydrate;
        inflightHydrate = (async () => {
        try {
          const { data: orderRows, error: err1 } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);
          if (err1) throw err1;
          const ids = (orderRows ?? []).map((r) => r.id as string);
          const itemsByOrder = await fetchOrderItemRowsByOrderIds(ids);
          const history = (orderRows ?? []).map((r) =>
            rowToOrder(r as Record<string, unknown>, itemsByOrder[(r as Record<string, unknown>).id as string] ?? []),
          );
          set({ history, hidratado: true, lastSyncAt: Date.now() });
        } catch (err) {
          console.error("[orderStore] hydrate falhou:", err);
          set({ hidratado: true });
        } finally {
          inflightHydrate = null;
        }
        })();
        return inflightHydrate;
      },
      hydrateOrderById: async (orderId) => {
        try {
          const { data: orderRow, error: errO } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .maybeSingle();
          if (errO) throw errO;
          if (!orderRow) return null;

          const order = rowToOrder(
            orderRow as Record<string, unknown>,
            await fetchOrderItemsByOrderId(orderId),
          );
          set((s) => ({
            history: [order, ...s.history.filter((o) => o.id !== order.id)].slice(0, 200),
            hidratado: true,
          }));
          return order;
        } catch (err) {
          console.error("[orderStore] hydrateOrderById falhou:", err, orderId);
          return null;
        }
      },
      setHistoryFromRows: (orders) => set({ history: orders }),
      addItem: (product, quantity) => {
        if (quantity <= 0) return;
        set((s) => {
          const existing = s.items.find((i) => i.sku === product.sku);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.sku === product.sku ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...s.items, { sku: product.sku, product, quantity }] };
        });
      },
      addBulk: (entries) => {
        const valid = entries.filter((e) => e.quantity > 0);
        if (valid.length === 0) return;
        set((s) => {
          const next = [...s.items];
          for (const { product, quantity } of valid) {
            const idx = next.findIndex((i) => i.sku === product.sku);
            if (idx >= 0) {
              next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
            } else {
              next.push({ sku: product.sku, product, quantity });
            }
          }
          return { items: next };
        });
      },
      updateQty: (sku, quantity) => {
        if (quantity <= 0) return get().removeItem(sku);
        set((s) => ({
          items: s.items.map((i) => (i.sku === sku ? { ...i, quantity } : i)),
        }));
      },
      removeItem: (sku) => set((s) => ({ items: s.items.filter((i) => i.sku !== sku) })),
      removeItems: (skus) => {
        const set_ = new Set(skus);
        set((s) => ({ items: s.items.filter((i) => !set_.has(i.sku)) }));
      },
      clearCart: () => set({ items: [], meta: defaultMeta }),
      setMeta: (m) => set((s) => ({ meta: { ...s.meta, ...m } })),
      setItemPrecoOverride: (sku, preco) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.sku === sku
              ? { ...i, precoOverride: preco != null && preco > 0 ? preco : undefined }
              : i,
          ),
        })),
      setItemDescontoPct: (sku, pct) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.sku === sku
              ? {
                  ...i,
                  descontoItemPct:
                    pct != null && pct > 0 ? Math.min(100, pct) : undefined,
                }
              : i,
          ),
        })),
      setItemJustificativa: (sku, texto) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.sku === sku ? { ...i, justificativaNegociacao: texto } : i,
          ),
        })),
      clearItemNegociacao: (sku) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.sku === sku
              ? {
                  ...i,
                  precoOverride: undefined,
                  descontoItemPct: undefined,
                  justificativaNegociacao: undefined,
                }
              : i,
          ),
        })),
      clearAllItemNegociacoes: () =>
        set((s) => ({
          items: s.items.map((i) => ({
            ...i,
            precoOverride: undefined,
            descontoItemPct: undefined,
            justificativaNegociacao: undefined,
          })),
        })),
      saveOrder: async (commercial, itemsOverride) => {
        const { items: allItems, meta } = get();
        const items = itemsOverride ?? allItems;
        const total =
          commercial?.totalFinal ??
          items.reduce((sum, i) => sum + effectiveItemSubtotal(i), 0);

        // ── GUARD (antes de qualquer gravação e antes da reserva de ID) ──
        assertCommercialMatchesItems(commercial, items, "saveOrder");


        // ── GUARD: session pronta e usuário identificado ──
        const auth = useAuth.getState();
        if (!auth.session || !auth.user?.id) {
          throw new Error(
            "Sua sessão expirou ou ainda está carregando. Atualize a página e tente novamente.",
          );
        }
        const profile = auth.profile;
        const vendedorNomeFinal =
          profile?.nome_completo ?? profile?.email ?? auth.user.email;
        if (!vendedorNomeFinal) {
          throw new Error("Perfil do vendedor não está disponível. Atualize a página.");
        }

        let metaWithSnapshot = meta;
        if (meta.clienteId && !meta.clienteSnapshot && typeof window !== "undefined") {
          try {
            const raw = window.localStorage.getItem("fetely_clientes_v1");
            if (raw) {
              const parsed = JSON.parse(raw);
              const list: Array<Record<string, unknown>> = parsed?.state?.clientes ?? [];
              const c = list.find((x) => x.id === meta.clienteId) as
                | Record<string, string | boolean | undefined>
                | undefined;
              if (c) {
                const endereco = c.enderecoEntregaIgual
                  ? `${c.logradouro ?? ""}${c.numero ? `, ${c.numero}` : ""} — ${c.bairro ?? ""}, ${c.cidade ?? ""}/${c.estado ?? ""} · ${c.cep ?? ""}`
                  : `${c.entregaLogradouro ?? ""}${c.entregaNumero ? `, ${c.entregaNumero}` : ""} — ${c.entregaBairro ?? ""}, ${c.entregaCidade ?? ""}/${c.entregaEstado ?? ""} · ${c.entregaCep ?? ""}`;
                metaWithSnapshot = {
                  ...meta,
                  clienteSnapshot: {
                    clienteId: String(c.id),
                    cnpj: String(c.cnpjFormatado ?? ""),
                    razaoSocial: String(c.razaoSocial ?? ""),
                    nomeFantasia: String(c.nomeFantasia ?? ""),
                    cidade: String(c.cidade ?? ""),
                    estado: String(c.estado ?? ""),
                    contatoNome: String(c.contatoNome ?? ""),
                    contatoEmail: String(c.contatoEmail ?? ""),
                    contatoTelefone: String(c.contatoTelefone ?? ""),
                    enderecoEntrega: endereco,
                  },
                };
              }
            }
          } catch {
            /* ignore */
          }
        }

        // ── ID sequencial global via RPC (security definer) — contorna RLS por vendedor ──
        const reservarId = async (): Promise<string> => {
          try {
            const { data: rpcId, error: errRpc } = await supabase.rpc("next_order_id");
            if (errRpc) throw errRpc;
            if (typeof rpcId === "string" && /^PED-\d+$/.test(rpcId)) return rpcId;
          } catch (err) {
            console.error("[orderStore] next_order_id RPC falhou, usando fallback timestamp:", err);
          }
          return `PED-${Date.now()}`;
        };

        // V19 — Carimba origem de duplicação se houver fila ativa
        let duplicadoDe: string | null = null;
        let modeloOrigemId: string | null = null;
        let grupoOrigemId: string | null = null;
        try {
          const { useDuplicacao } = await import("@/store/duplicacaoStore");
          const dup = useDuplicacao.getState();
          if (dup.ativo && dup.origem) {
            const isClienteNaFila = dup.fila.some(
              (f) => f.clienteId === meta.clienteId && f.status === "pendente",
            );
            if (isClienteNaFila) {
              if (dup.origem.tipo === "pedido") duplicadoDe = dup.origem.refId;
              if (dup.origem.tipo === "modelo") modeloOrigemId = dup.origem.refId;
              grupoOrigemId = dup.origem.grupoOrigemId ?? null;
            }
          }
        } catch {
          /* noop */
        }

        const buildOrder = (id: string): SavedOrder => ({
          id,
          createdAt: new Date().toISOString(),
          items,
          meta: metaWithSnapshot,
          total,
          commercial,
          vendedorId: auth.user!.id,
          vendedorNome: vendedorNomeFinal,
          vendedorLogin: profile?.login_amigavel ?? profile?.email ?? undefined,
          vendedorTipo: profile?.tipo_vendedor ?? null,
          duplicadoDe,
          modeloOrigemId,
          grupoOrigemId,
          bonificado: commercial?.bonificado ?? false,
          motivoBonificacao: commercial?.motivoBonificacao ?? null,
        });

        const isUniqueViolation = (err: unknown) =>
          (err as { code?: string } | null)?.code === "23505";

        const describeErr = (err: unknown) => {
          const e = err as { message?: string; details?: string; hint?: string; code?: string };
          const parts = [e?.message, e?.details, e?.hint, e?.code ? `(${e.code})` : null].filter(
            Boolean,
          );
          return err instanceof Error
            ? err.message
            : parts.length > 0
              ? parts.join(" — ")
              : (() => {
                  try {
                    return JSON.stringify(err);
                  } catch {
                    return String(err);
                  }
                })();
        };

        // ── CRIAÇÃO: INSERT puro do cabeçalho (fail-loud em colisão de PK) + retry com ID novo ──
        let order: SavedOrder | null = null;
        let lastPkError: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const candidate = buildOrder(await reservarId());
          const { error: errO } = await supabase
            .from("orders")
            .insert(orderToRow(candidate) as never);
          if (!errO) {
            order = candidate;
            break;
          }
          if (isUniqueViolation(errO)) {
            lastPkError = errO;
            console.warn(
              `[orderStore] colisão de ID de pedido (${candidate.id}) — tentativa ${attempt}/3`,
            );
            continue;
          }
          console.error("[orderStore] saveOrder cabeçalho falhou:", errO, candidate.id);
          const msg = describeErr(errO);
          throw new Error(
            msg
              ? `Não foi possível salvar o pedido no banco: ${msg}`
              : "Não foi possível salvar o pedido. Verifique sua conexão e tente novamente.",
          );
        }

        if (!order) {
          console.error("[orderStore] saveOrder: falha ao reservar ID após 3 tentativas", lastPkError);
          throw new Error("Não foi possível reservar um número de pedido. Tente novamente.");
        }

        // ── ITENS: só depois do cabeçalho inserido, usando o id efetivamente gravado ──
        try {
          const itemRows = await orderItemsToRows(order);
          if (itemRows.length > 0) {
            await supabase.from("order_items").delete().eq("order_id", order.id);
            const { error: errI } = await supabase
              .from("order_items")
              .insert(itemRows as never);
            if (errI) {
              if (isUniqueViolation(errI)) {
                throw new Error(
                  `Conflito ao gravar os itens do pedido ${order.id}: outra sessão já gravou itens nesse número. Recarregue a página e confira o pedido antes de tentar novamente.`,
                );
              }
              throw errI;
            }
          }
        } catch (err: unknown) {
          console.error("[orderStore] saveOrder itens falhou:", err, order.id);
          if (err instanceof Error) throw err;
          const msg = describeErr(err);
          throw new Error(
            msg
              ? `Não foi possível salvar os itens do pedido: ${msg}`
              : "Não foi possível salvar os itens do pedido. Verifique sua conexão e tente novamente.",
          );
        }


        // ── SÓ ADICIONA AO HISTORY APÓS SUCESSO NO BANCO ──
        set((s) => ({ history: [order, ...s.history].slice(0, 200) }));

        // V19 — Marca cliente como concluído na fila de duplicação, se aplicável
        if (order.duplicadoDe || order.modeloOrigemId) {
          try {
            const { useDuplicacao } = await import("@/store/duplicacaoStore");
            const dup = useDuplicacao.getState();
            if (dup.ativo && meta.clienteId) {
              dup.marcarFeito(meta.clienteId, order.id);
            }
          } catch { /* noop */ }
        }

        return order;
      },
      reassignOrder: (orderId, novo) => {
        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  vendedorId: novo.vendedorId,
                  vendedorNome: novo.vendedorNome ?? o.vendedorNome,
                  vendedorLogin: novo.vendedorLogin ?? o.vendedorLogin,
                  vendedorTipo: novo.vendedorTipo ?? o.vendedorTipo ?? null,
                }
              : o,
          ),
        }));
        const update: Record<string, unknown> = { vendedor_id: novo.vendedorId };
        if (novo.vendedorNome !== undefined && novo.vendedorNome !== null) update.vendedor_nome = novo.vendedorNome;
        if (novo.vendedorLogin !== undefined && novo.vendedorLogin !== null) update.vendedor_login = novo.vendedorLogin;
        if (novo.vendedorTipo !== undefined && novo.vendedorTipo !== null) update.vendedor_tipo = novo.vendedorTipo;
        void supabase
          .from("orders")
          .update(update as never)
          .eq("id", orderId)
          .then(({ error }) => {
            if (error) console.error("[orderStore] reassignOrder falhou:", error, orderId);
          });
      },
      deleteOrder: async (orderId) => {
        const prev = get().history;
        set((s) => ({ history: s.history.filter((o) => o.id !== orderId) }));
        try {
          await supabase.from("order_items").delete().eq("order_id", orderId);
          const { error } = await supabase.from("orders").delete().eq("id", orderId);
          if (error) throw error;
        } catch (err) {
          console.error("[orderStore] deleteOrder falhou:", err, orderId);
          set({ history: prev });
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
      reprovarOrder: async (orderId, motivo) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada.");
        const reprovadoEm = new Date().toISOString();
        const reprovadoPorNome =
          auth.profile?.nome_completo ?? auth.profile?.email ?? auth.user.email ?? "—";
        const prev = get().history;
        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  reprovado: true,
                  reprovadoEm,
                  reprovadoMotivo: motivo,
                  reprovadoPorId: auth.user!.id,
                  reprovadoPorNome,
                }
              : o,
          ),
        }));
        const { error } = await supabase
          .from("orders")
          .update({
            reprovado: true,
            reprovado_em: reprovadoEm,
            reprovado_motivo: motivo,
            reprovado_por_id: auth.user.id,
            reprovado_por_nome: reprovadoPorNome,
          } as never)
          .eq("id", orderId);
        if (error) {
          console.error("[orderStore] reprovarOrder falhou:", error, orderId);
          set({ history: prev });
          throw new Error(error.message);
        }
      },
      desfazerReprovacao: async (orderId) => {
        const prev = get().history;
        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  reprovado: false,
                  reprovadoEm: null,
                  reprovadoMotivo: null,
                  reprovadoPorId: null,
                  reprovadoPorNome: null,
                }
              : o,
          ),
        }));
        const { error } = await supabase
          .from("orders")
          .update({
            reprovado: false,
            reprovado_em: null,
            reprovado_motivo: null,
            reprovado_por_id: null,
            reprovado_por_nome: null,
          } as never)
          .eq("id", orderId);
        if (error) {
          console.error("[orderStore] desfazerReprovacao falhou:", error, orderId);
          set({ history: prev });
          throw new Error(error.message);
        }
      },
      // ====================================================================
      // V16 — Aprovação de pedidos do portal do cliente
      // ====================================================================
      saveOrderAsCliente: async (commercial, items) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada. Faça login novamente.");
        const profile = auth.profile;
        if (!profile?.cliente_id) {
          throw new Error("Seu usuário não está vinculado a um cliente cadastrado.");
        }
        const meta = get().meta;
        const total =
          commercial?.totalFinal ??
          items.reduce((s, i) => s + effectiveItemSubtotal(i), 0);

        // ── GUARD (antes de qualquer gravação e antes da reserva de ID) ──
        assertCommercialMatchesItems(commercial, items, "saveOrderAsCliente");


        let nextId = `PED-${Date.now()}`;
        try {
          const { data: rpcId } = await supabase.rpc("next_order_id");
          if (typeof rpcId === "string" && /^PED-\d+$/.test(rpcId)) nextId = rpcId;
        } catch (e) {
          console.error("[orderStore] next_order_id falhou:", e);
        }

        const nowIso = new Date().toISOString();
        const evento: PedidoHistoricoEvento = {
          em: nowIso,
          acao: "enviado_para_analise",
          porId: auth.user.id,
          porNome: profile.nome_completo ?? profile.email ?? auth.user.email ?? "Cliente",
          obs: "Pedido enviado pelo portal do cliente.",
        };

        const order: SavedOrder = {
          id: nextId,
          createdAt: nowIso,
          items,
          meta: { ...meta, clienteId: profile.cliente_id, pedidoOrigem: "portal_cliente" },
          total,
          commercial,
          vendedorId: auth.user.id,
          vendedorNome: profile.nome_completo ?? profile.email ?? "Cliente",
          vendedorLogin: profile.login_amigavel ?? profile.email ?? undefined,
          vendedorTipo: null,
          origemPerfil: "cliente",
          statusPedido: "pendente_aprovacao",
          historico: [evento],
        };

        try {
          const { error: errO } = await supabase
            .from("orders")
            .insert(orderToRow(order) as never);
          if (errO) throw errO;
          const itemRows = await orderItemsToRows(order);
          if (itemRows.length > 0) {
            const { error: errI } = await supabase
              .from("order_items")
              .insert(itemRows as never);
            if (errI) throw errI;
          }
        } catch (err) {
          console.error("[orderStore] saveOrderAsCliente falhou:", err, order.id);
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Não foi possível enviar o pedido: ${msg}`);
        }

        set((s) => ({ history: [order, ...s.history].slice(0, 200) }));
        return order;
      },

      aprovarPedidoCliente: async (orderId, obs) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada.");
        const order = get().history.find((o) => o.id === orderId);
        if (!order) throw new Error("Pedido não encontrado.");
        if (order.statusPedido !== "pendente_aprovacao") {
          throw new Error("Pedido não está mais aguardando aprovação.");
        }

        // Lazy imports para não criar dependência circular
        const { emEstoque } = await import("@/lib/classifyItem");
        const { useProvisao } = await import("@/store/provisaoStore");
        const itensFirmes = order.items.filter((i) => emEstoque(i.product));
        const itensProvisao = order.items.filter((i) => !emEstoque(i.product));

        const aprovadoEm = new Date().toISOString();
        const aprovadoPorNome =
          auth.profile?.nome_completo ?? auth.profile?.email ?? auth.user.email ?? "—";
        const evento: PedidoHistoricoEvento = {
          em: aprovadoEm,
          acao: "aprovado",
          porId: auth.user.id,
          porNome: aprovadoPorNome,
          obs: obs ?? null,
        };
        const historicoNovo = [...(order.historico ?? []), evento];

        // Cria provisão se houver itens de previsão
        let provisaoId: string | undefined;
        if (itensProvisao.length > 0 && order.meta.clienteSnapshot && order.meta.clienteId) {
          const { extrairDataPrevisao } = await import("@/lib/classifyItem");
          const prov = await useProvisao.getState().createProvisao({
            clienteId: order.meta.clienteId,
            clienteSnapshot: order.meta.clienteSnapshot,
            pedidoFirmeId: itensFirmes.length > 0 ? order.id : undefined,
            itens: itensProvisao.map((i) => ({
              sku: i.sku,
              nomeComercial: i.product.nomeComercial,
              colecao: i.product.colecao,
              corNome: i.product.corNome,
              tamanhoNumero: i.product.tamanhoNumero,
              quantidade: i.quantity,
              precoAtacadoReferencia: i.product.precoAtacado,
              statusEstoque: i.product.statusEstoque,
              previsaoData: extrairDataPrevisao(i.product.statusEstoque),
            })),
            observacoes: `Gerada via aprovação do pedido ${order.id}`,
          });
          provisaoId = prov.id;
        }

        // Atualiza pedido (ou marca como convertido se 100% provisão)
        const statusFinal: StatusPedido = itensFirmes.length > 0 ? "aprovado" : "convertido";
        const novosItens = itensFirmes.length > 0 ? itensFirmes : order.items;
        const novoTotal = itensFirmes.reduce(
          (s, i) => s + effectiveItemSubtotal(i),
          0,
        );

        // Remove itens de provisão da tabela order_items (mantém só firmes)
        if (itensProvisao.length > 0 && itensFirmes.length > 0) {
          const skusRemover = itensProvisao.map((i) => i.sku);
          await supabase
            .from("order_items")
            .delete()
            .eq("order_id", order.id)
            .in("sku", skusRemover);
        }

        const { error } = await supabase
          .from("orders")
          .update({
            status_pedido: statusFinal,
            aprovado_por_id: auth.user.id,
            aprovado_por_nome: aprovadoPorNome,
            aprovado_em: aprovadoEm,
            aprovacao_obs: obs ?? null,
            historico: historicoNovo,
            tem_solicitacao_ajuste: false,
            ajuste_mensagem: null,
            ...(itensFirmes.length > 0
              ? { total: novoTotal, total_unidades: novosItens.reduce((s, i) => s + i.quantity, 0), total_skus: novosItens.length }
              : {}),
          } as never)
          .eq("id", order.id);
        if (error) throw new Error(error.message);

        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  statusPedido: statusFinal,
                  aprovadoPorId: auth.user!.id,
                  aprovadoPorNome,
                  aprovadoEm,
                  aprovacaoObs: obs ?? null,
                  temSolicitacaoAjuste: false,
                  ajusteMensagem: null,
                  historico: historicoNovo,
                  items: novosItens,
                  total: itensFirmes.length > 0 ? novoTotal : o.total,
                }
              : o,
          ),
        }));

        return { provisaoId };
      },

      recusarPedidoCliente: async (orderId, motivo, obs) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada.");
        const order = get().history.find((o) => o.id === orderId);
        if (!order) throw new Error("Pedido não encontrado.");
        const recusadoEm = new Date().toISOString();
        const porNome =
          auth.profile?.nome_completo ?? auth.profile?.email ?? auth.user.email ?? "—";
        const evento: PedidoHistoricoEvento = {
          em: recusadoEm,
          acao: "recusado",
          porId: auth.user.id,
          porNome,
          obs: `${motivo}${obs ? ` — ${obs}` : ""}`,
        };
        const historicoNovo = [...(order.historico ?? []), evento];

        const { error } = await supabase
          .from("orders")
          .update({
            status_pedido: "recusado",
            recusado_por_id: auth.user.id,
            recusado_por_nome: porNome,
            recusado_motivo: motivo,
            recusado_obs: obs ?? null,
            recusado_em: recusadoEm,
            historico: historicoNovo,
          } as never)
          .eq("id", orderId);
        if (error) throw new Error(error.message);

        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  statusPedido: "recusado",
                  recusadoPorId: auth.user!.id,
                  recusadoPorNome: porNome,
                  recusadoMotivoTexto: motivo,
                  recusadoObs: obs ?? null,
                  recusadoEmAprovacao: recusadoEm,
                  historico: historicoNovo,
                }
              : o,
          ),
        }));
      },

      solicitarAjustePedido: async (orderId, mensagem) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada.");
        const order = get().history.find((o) => o.id === orderId);
        if (!order) throw new Error("Pedido não encontrado.");
        const em = new Date().toISOString();
        const porNome =
          auth.profile?.nome_completo ?? auth.profile?.email ?? auth.user.email ?? "—";
        const evento: PedidoHistoricoEvento = {
          em,
          acao: "ajuste_solicitado",
          porId: auth.user.id,
          porNome,
          obs: mensagem,
        };
        const historicoNovo = [...(order.historico ?? []), evento];

        const { error } = await supabase
          .from("orders")
          .update({
            tem_solicitacao_ajuste: true,
            ajuste_mensagem: mensagem,
            historico: historicoNovo,
          } as never)
          .eq("id", orderId);
        if (error) throw new Error(error.message);

        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  temSolicitacaoAjuste: true,
                  ajusteMensagem: mensagem,
                  historico: historicoNovo,
                }
              : o,
          ),
        }));
      },

      cancelarPedidoPendente: async (orderId) => {
        const auth = useAuth.getState();
        if (!auth.user?.id) throw new Error("Sessão expirada.");
        const order = get().history.find((o) => o.id === orderId);
        if (!order) throw new Error("Pedido não encontrado.");
        const em = new Date().toISOString();
        const porNome =
          auth.profile?.nome_completo ?? auth.profile?.email ?? auth.user.email ?? "Cliente";
        const evento: PedidoHistoricoEvento = {
          em,
          acao: "cancelado",
          porId: auth.user.id,
          porNome,
          obs: "Cancelado pelo cliente.",
        };
        const historicoNovo = [...(order.historico ?? []), evento];

        const { error } = await supabase
          .from("orders")
          .update({
            status_pedido: "cancelado",
            historico: historicoNovo,
          } as never)
          .eq("id", orderId);
        if (error) throw new Error(error.message);

        set((s) => ({
          history: s.history.map((o) =>
            o.id === orderId
              ? { ...o, statusPedido: "cancelado", historico: historicoNovo }
              : o,
          ),
        }));
      },
    }),

    {
      name: "fetely-order",
      storage: createJSONStorage(createSafeStorage),
      partialize: (state) =>
        ({
          items: state.items,
          meta: state.meta,
        }) as Partial<OrderState>,
    },
  ),
);

/** V21 — preço unitário efetivo após override de negociação por item */
export function effectiveUnitPrice(item: CartItem): number {
  return item.precoOverride ?? item.product.precoAtacado;
}

/** V21 — subtotal por item considerando override + desconto por linha */
export function effectiveItemSubtotal(item: CartItem): number {
  const desc = item.descontoItemPct ?? 0;
  return effectiveUnitPrice(item) * item.quantity * (1 - desc / 100);
}

/** V21 — true quando o item teve algum ajuste no modo negociação */
export function hasItemOverride(item: CartItem): boolean {
  return item.precoOverride !== undefined || (item.descontoItemPct ?? 0) > 0;
}

/**
 * FAIL-LOUD — impede que um pedido nasça com total comercial que não corresponde
 * aos itens que estão sendo persistidos. Usa a MESMA fórmula de subtotal
 * empregada por orderItemsToRows (preço efetivo × qtd × (1 - desconto_item)).
 * Tolerância de R$ 0,05 apenas para arredondamento de preços com 4 decimais.
 */
export function assertCommercialMatchesItems(
  commercial: OrderCommercial | undefined,
  items: CartItem[],
  contexto: string,
): void {
  if (!commercial) return;
  const brutoItens = items.reduce((sum, i) => sum + effectiveItemSubtotal(i), 0);
  const diff = Math.abs(brutoItens - commercial.bruto);
  if (diff <= 0.05) return;
  console.error(
    `[orderStore] ${contexto}: divergência entre itens e total do pedido`,
    {
      brutoItens,
      brutoComercial: commercial.bruto,
      diferenca: diff,
      skus: items.map((i) => i.sku),
    },
  );
  throw new Error(
    `Divergência de valores: os itens somam ${formatBRL(brutoItens)}, mas o total do pedido está em ${formatBRL(commercial.bruto)} (diferença ${formatBRL(diff)}). O pedido não foi salvo. Recarregue o catálogo e refaça a conferência antes de confirmar.`,
  );
}


export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + effectiveItemSubtotal(i), 0);
}


export function useVisibleOrders(opts?: { includeReprovados?: boolean }): SavedOrder[] {
  const history = useOrder((s) => s.history);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  const filterReprovados = (list: SavedOrder[]) =>
    opts?.includeReprovados ? list : list.filter((o) => !o.reprovado);
  if (isAdminOrMaster) return filterReprovados(history);
  if (!user) return [];
  if (roles.includes("cliente")) {
    const cid = profile?.cliente_id ?? null;
    if (!cid) return [];
    return filterReprovados(history.filter((o) => o.meta.clienteId === cid));
  }
  // Vendedor: próprios pedidos + pedidos de clientes que ele cadastrou
  const meusClienteIds = new Set(
    clientes.filter((c) => c.cadastradoPorVendedorId === user.id).map((c) => c.id),
  );
  return filterReprovados(
    history.filter(
      (o) =>
        o.vendedorId === user.id ||
        (o.meta.clienteId && meusClienteIds.has(o.meta.clienteId)),
    ),
  );
}

/**
 * Pode reprovar = admin/master OU vendedor do pedido OU vendedor responsável pelo cliente.
 */
export function useCanReprovarOrder(order: SavedOrder | null | undefined): boolean {
  const user = useAuth((s) => s.user);
  const roles = useAuth((s) => s.roles);
  const clientes = useClientes((s) => s.clientes);
  if (!order || !user) return false;
  if (roles.includes("admin") || roles.includes("master")) return true;
  if (order.vendedorId === user.id) return true;
  const cliente = order.meta.clienteId
    ? clientes.find((c) => c.id === order.meta.clienteId)
    : null;
  return !!cliente && cliente.cadastradoPorVendedorId === user.id;
}

export function useIsMaster(): boolean {
  return useAuth((s) => s.roles.includes("master"));
}

/**
 * V16 — pedidos pendentes de aprovação (apenas admin/master enxergam aqui).
 */
export function usePendingApprovals(): SavedOrder[] {
  const history = useOrder((s) => s.history);
  const roles = useAuth((s) => s.roles);
  if (!(roles.includes("admin") || roles.includes("master"))) return [];
  return history.filter(
    (o) => o.statusPedido === "pendente_aprovacao" && o.origemPerfil === "cliente",
  );
}

