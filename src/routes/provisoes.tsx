import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Clock, Package, X, AlertTriangle, ChevronRight, ChevronDown, XCircle, Trash2, RotateCcw, FileDown, Edit, LayoutDashboard } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useProvisao, useVisibleProvisoes, useCanReprovarProvisao } from "@/store/provisaoStore";
import { useAuth } from "@/store/authStore";
import { useCatalog } from "@/store/catalogStore";
import { useOrder } from "@/store/orderStore";
import { useCotacao } from "@/store/cotacaoStore";
import { useClientes } from "@/store/clienteStore";
import { useCartilhas } from "@/store/cartilhasStore";
import { ReprovarDialog } from "@/components/ReprovarDialog";
import { generateProvisaoPDF } from "@/lib/orderPdf";
import { STATUS_PROVISAO_LABEL, type ProvisaoFutura, type StatusProvisao } from "@/types/provisao";
import { ProvisoesDashboard } from "@/components/provisoes/ProvisoesDashboard";

const CATEGORIA_ORDER = ["Celebrar a mesa", "Luz", "Momento"];

function bucketPorProduto(product?: { categoria?: string; tipo?: string }): string {
  if (!product) return "Sem categoria";
  if (product.categoria === "Celebrar à Mesa") return "Celebrar a mesa";
  if (product.categoria === "Luz e Momento") return product.tipo === "Numérica" ? "Momento" : "Luz";
  if (product.categoria === "Acessórios de Mesa") return "Celebrar a mesa";
  return product.categoria || "Sem categoria";
}

function getCondicaoPagamento(
  p: ProvisaoFutura,
  orders: ReturnType<typeof useOrder.getState>["history"],
  cotacoes: ReturnType<typeof useCotacao.getState>["cotacoes"],
  clientes: ReturnType<typeof useClientes.getState>["clientes"],
  condicoes: ReturnType<typeof useCartilhas.getState>["condicoes"],
): string {
  const fromOrder = (o?: { commercial?: { condicaoDescricao?: string } | null; meta?: { condicaoPagamento?: string } | null }) =>
    o?.commercial?.condicaoDescricao || o?.meta?.condicaoPagamento || "";

  // 1) Pedido firme vinculado
  if (p.pedidoFirmeId) {
    const v = fromOrder(orders.find((x) => x.id === p.pedidoFirmeId));
    if (v) return v;
  }
  // 2) Cotação de origem vinculada
  if (p.cotacaoOrigemId) {
    const v = fromOrder(cotacoes.find((x) => x.id === p.cotacaoOrigemId));
    if (v) return v;
  }
  // 3) Último pedido do cliente já enviado ao SNCF (aprovado)
  const pedidosCliente = orders
    .filter((o) => o.meta?.clienteId === p.clienteId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const ultimoSncf = pedidosCliente.find(
    (o) => o.estadoLiberacao === "enviado_sncf" || !!o.sncfPedidoId,
  );
  const vSncf = fromOrder(ultimoSncf);
  if (vSncf) return vSncf;
  // 4) Condição preferencial do cadastro do cliente
  const cli = clientes.find((c) => c.id === p.clienteId);
  const prefId = cli?.premissasComerciais?.condicaoPreferencialId ?? null;
  if (prefId != null) {
    const cond = condicoes.find((c) => c.id === prefId);
    if (cond?.descricao) return cond.descricao;
  }
  // 5) Último pedido do cliente (qualquer)
  const vPed = fromOrder(pedidosCliente[0]);
  if (vPed) return vPed;
  // 6) Última cotação do cliente
  const ultimaCot = cotacoes
    .filter((c) => c.meta?.clienteId === p.clienteId)
    .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))[0];
  const vCot = fromOrder(ultimaCot);
  if (vCot) return vCot;

  return "—";
}

function clienteTemSncf(
  p: ProvisaoFutura,
  orders: ReturnType<typeof useOrder.getState>["history"],
): boolean {
  return orders.some(
    (o) =>
      o.meta?.clienteId === p.clienteId &&
      (o.estadoLiberacao === "enviado_sncf" || !!o.sncfPedidoId),
  );
}




const search = z.object({
  highlight: z.string().optional(),
});

export const Route = createFileRoute("/provisoes")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Provisões — Fetély B2B" },
      { name: "description", content: "Provisões futuras aguardando estoque." },
    ],
  }),
  component: ProvisoesPage,
});

type Tab = "aguardando" | "liberado" | "todas";

function statusBadge(status: StatusProvisao) {
  const map: Record<StatusProvisao, string> = {
    aguardando_estoque: "bg-stock-pre/15 text-stock-pre border-stock-pre/30",
    estoque_liberado: "bg-stock-in/15 text-stock-in border-stock-in/30",
    convertido_em_pedido: "bg-gold/15 text-gold border-gold/30",
    cancelado: "bg-stock-out/15 text-stock-out border-stock-out/30",
  };
  return map[status];
}

function ProvisoesPage() {
  const { highlight } = Route.useSearch();
  const [showReprovados, setShowReprovados] = useState(false);
  const provisoes = useVisibleProvisoes({ includeReprovados: showReprovados });
  const [tab, setTab] = useState<Tab>("aguardando");
  const [showDashboard, setShowDashboard] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");
  const [condicaoFiltro, setCondicaoFiltro] = useState<string>("");

  const products = useCatalog((s) => s.products);
  const orders = useOrder((s) => s.history);
  const cotacoes = useCotacao((s) => s.cotacoes);
  const clientes = useClientes((s) => s.clientes);
  const condicoes = useCartilhas((s) => s.condicoes);

  const bucketBySku = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.sku, bucketPorProduto(p)));
    return m;
  }, [products]);

  const [sncfFiltro, setSncfFiltro] = useState<"" | "com" | "sem">("");

  const sncfClientes = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => {
      if ((o.estadoLiberacao === "enviado_sncf" || !!o.sncfPedidoId) && o.meta?.clienteId) {
        s.add(o.meta.clienteId);
      }
    });
    return s;
  }, [orders]);

  const isSncf = (p: ProvisaoFutura) => sncfClientes.has(p.clienteId);

  const [openId, setOpenId] = useState<string | null>(highlight ?? null);


  const provisaoBuckets = (p: ProvisaoFutura) => {
    const s = new Set<string>();
    p.itens.forEach((it) => s.add(bucketBySku.get(it.sku) ?? "Sem categoria"));
    return s;
  };

  const condicaoDe = (p: ProvisaoFutura) => getCondicaoPagamento(p, orders, cotacoes, clientes, condicoes);

  const categoriasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    provisoes.forEach((p) => provisaoBuckets(p).forEach((b) => s.add(b)));
    return Array.from(s).sort((a, b) => {
      const ia = CATEGORIA_ORDER.indexOf(a);
      const ib = CATEGORIA_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provisoes, bucketBySku]);

  const condicoesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    provisoes.forEach((p) => s.add(condicaoDe(p)));
    return Array.from(s).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provisoes, orders, cotacoes]);

  const filtered = useMemo(() => {
    let list = provisoes;
    if (tab === "aguardando") list = list.filter((p) => p.status === "aguardando_estoque");
    else if (tab === "liberado") list = list.filter((p) => p.status === "estoque_liberado");
    if (categoriaFiltro) list = list.filter((p) => provisaoBuckets(p).has(categoriaFiltro));
    if (condicaoFiltro) list = list.filter((p) => condicaoDe(p) === condicaoFiltro);
    if (sncfFiltro === "com") list = list.filter((p) => isSncf(p));
    else if (sncfFiltro === "sem") list = list.filter((p) => !isSncf(p));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provisoes, tab, categoriaFiltro, condicaoFiltro, sncfFiltro, sncfClientes, bucketBySku, orders, cotacoes]);



  const aguardandoCount = provisoes.filter((p) => p.status === "aguardando_estoque").length;
  const liberadoCount = provisoes.filter((p) => p.status === "estoque_liberado").length;
  const open = openId ? provisoes.find((p) => p.id === openId) ?? null : null;

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-10">
      <div className="mb-5 sm:mb-8 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Pipeline</div>
          <h1 className="font-display text-2xl sm:text-4xl mt-1">Provisões Futuras</h1>
          <p className="text-text-secondary text-sm mt-1">
            Rascunhos de pedidos aguardando liberação de estoque.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDashboard((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gold/40 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-medium transition-colors"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          {showDashboard ? "Ocultar dashboard" : "Dashboard provisões"}
        </button>
      </div>

      {showDashboard && <ProvisoesDashboard provisoes={provisoes} />}

      <div className="flex flex-wrap items-center gap-2 mb-5">



        <div className="flex flex-wrap gap-1 bg-surface-2 p-1 rounded-md w-fit">
          <TabBtn active={tab === "aguardando"} onClick={() => setTab("aguardando")}>
            Aguardando ({aguardandoCount})
          </TabBtn>
          <TabBtn active={tab === "liberado"} onClick={() => setTab("liberado")}>
            Liberado ({liberadoCount})
          </TabBtn>
          <TabBtn active={tab === "todas"} onClick={() => setTab("todas")}>
            Todas ({provisoes.length})
          </TabBtn>
        </div>
        <button
          type="button"
          onClick={() => setShowReprovados((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
            showReprovados
              ? "border-stock-out/50 bg-stock-out/10 text-stock-out"
              : "border-border text-text-secondary hover:text-text-primary"
          }`}
        >
          {showReprovados ? "Ocultar reprovadas" : "Mostrar reprovadas"}
        </button>

        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary focus:border-gold outline-none"
          title="Filtrar por categoria"
        >
          <option value="">Todas categorias</option>
          {categoriasDisponiveis.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={condicaoFiltro}
          onChange={(e) => setCondicaoFiltro(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary focus:border-gold outline-none max-w-[240px] truncate"
          title="Filtrar por condição de pagamento"
        >
          <option value="">Todas condições</option>
          {condicoesDisponiveis.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={sncfFiltro}
          onChange={(e) => setSncfFiltro(e.target.value as "" | "com" | "sem")}
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary focus:border-gold outline-none"
          title="Filtrar por status SNCF do cliente"
        >
          <option value="">SNCF: todos</option>
          <option value="com">Cliente com pedido SNCF</option>
          <option value="sem">Cliente sem pedido SNCF</option>
        </select>

        {(categoriaFiltro || condicaoFiltro || sncfFiltro) && (
          <button
            type="button"
            onClick={() => { setCategoriaFiltro(""); setCondicaoFiltro(""); setSncfFiltro(""); }}
            className="text-[11px] uppercase tracking-wider text-text-muted hover:text-gold"
          >
            Limpar filtros
          </button>
        )}
      </div>



      {filtered.length === 0 ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center">
          <Package className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">Nenhuma provisão nesta visão.</p>
        </div>
      ) : (
        <>
          {/* Tabela — desktop */}
          <div className="hidden md:block rounded-lg gold-border bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Vendedor</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Criada em</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Origem</th>
                  <th className="text-center px-4 py-3 font-medium">Itens</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Próx. previsão</th>
                  <th className="text-right px-4 py-3 font-medium">Ref.</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    className={`border-t border-border/50 hover:bg-surface-hover cursor-pointer transition ${
                      p.id === highlight ? "bg-gold/5" : ""
                    } ${p.reprovado ? "bg-stock-out/5" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gold">
                      <div className="flex items-center gap-2">
                        {p.id}
                        {p.reprovado && (
                          <span
                            title={p.reprovadoMotivo ?? ""}
                            className="inline-flex items-center gap-1 rounded-full border border-stock-out/40 bg-stock-out/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-stock-out"
                          >
                            <XCircle className="h-2.5 w-2.5" /> Reprovada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="text-text-primary truncate max-w-[200px]">
                          {p.clienteSnapshot.nomeFantasia || p.clienteSnapshot.razaoSocial}
                        </div>
                        {isSncf(p) && (
                          <span
                            title="Cliente possui pedido aprovado enviado ao SNCF"
                            className="shrink-0 inline-flex items-center rounded-full border border-stock-in/40 bg-stock-in/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-stock-in"
                          >
                            SNCF
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-text-secondary text-xs hidden lg:table-cell">
                      {p.vendedorNome}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs hidden xl:table-cell whitespace-nowrap">
                      {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-xs hidden lg:table-cell">
                      {p.cotacaoOrigemId ? (
                        <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                          Cot. {p.cotacaoOrigemId}
                        </span>
                      ) : p.pedidoFirmeId ? (
                        <span className="inline-flex items-center rounded-full border border-stock-in/30 bg-stock-in/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stock-in">
                          Ped. {p.pedidoFirmeId}
                        </span>
                      ) : (
                        <span className="text-text-muted">Direta</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{p.itens.length}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs hidden lg:table-cell">
                      {p.proximaPrevisao}
                    </td>
                    <td className="px-4 py-3 text-right text-stock-pre">
                      {formatBRL(p.totalReferencia)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusBadge(p.status)}`}>
                        {STATUS_PROVISAO_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpenId(p.id)}
                className={`w-full text-left rounded-lg gold-border bg-surface p-3 active:bg-surface-hover transition ${
                  p.id === highlight ? "ring-1 ring-gold" : ""
                } ${p.reprovado ? "bg-stock-out/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-gold truncate">{p.id}</div>
                    <div className="text-sm text-text-primary truncate mt-0.5 flex items-center gap-1.5">
                      <span className="truncate">{p.clienteSnapshot.nomeFantasia || p.clienteSnapshot.razaoSocial}</span>
                      {isSncf(p) && (
                        <span
                          title="Cliente possui pedido aprovado enviado ao SNCF"
                          className="shrink-0 inline-flex items-center rounded-full border border-stock-in/40 bg-stock-in/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-stock-in"
                        >
                          SNCF
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-text-muted mt-0.5 truncate">
                      {p.vendedorNome} · {p.itens.length} {p.itens.length === 1 ? "item" : "itens"} · {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="text-[10px] mt-0.5">
                      {p.cotacaoOrigemId ? (
                        <span className="text-gold">Origem: Cot. {p.cotacaoOrigemId}</span>
                      ) : p.pedidoFirmeId ? (
                        <span className="text-stock-in">Origem: Ped. {p.pedidoFirmeId}</span>
                      ) : (
                        <span className="text-text-muted">Origem: Direta</span>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${statusBadge(p.status)}`}>
                    {STATUS_PROVISAO_LABEL[p.status]}
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div className="text-[10px] text-text-secondary">
                    Próx.: <span className="text-text-primary">{p.proximaPrevisao}</span>
                  </div>
                  <div className="text-stock-pre font-semibold text-sm">
                    {formatBRL(p.totalReferencia)}
                  </div>
                </div>
                {p.reprovado && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-stock-out/40 bg-stock-out/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-stock-out">
                    <XCircle className="h-2.5 w-2.5" /> Reprovada
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {open && <ProvisaoDetail provisao={open} onClose={() => setOpenId(null)} />}
    </main>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] uppercase tracking-wider rounded ${
        active ? "bg-gold text-background" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function ProvisaoDetail({ provisao, onClose }: { provisao: ProvisaoFutura; onClose: () => void }) {
  const isAdmin = useAuth((s) => s.roles.includes("admin") || s.roles.includes("master"));
  const isMaster = useAuth((s) => s.roles.includes("master"));
  const canReprovar = useCanReprovarProvisao(provisao);
  const updateStatus = useProvisao((s) => s.updateStatus);
  const setObservacoes = useProvisao((s) => s.setObservacoes);
  const cancelar = useProvisao((s) => s.cancelar);
  const reprovarProvisao = useProvisao((s) => s.reprovarProvisao);
  const desfazerReprovacaoProvisao = useProvisao((s) => s.desfazerReprovacaoProvisao);
  const deleteProvisao = useProvisao((s) => s.deleteProvisao);
  const products = useCatalog((s) => s.products);
  const addBulk = useOrder((s) => s.addBulk);
  const setMeta = useOrder((s) => s.setMeta);
  const clearCart = useOrder((s) => s.clearCart);
  const orders = useOrder((s) => s.history);
  const cotacoes = useCotacao((s) => s.cotacoes);
  const clientes = useClientes((s) => s.clientes);
  const condicoes = useCartilhas((s) => s.condicoes);
  const condicaoPagamento = useMemo(
    () => getCondicaoPagamento(provisao, orders, cotacoes, clientes, condicoes),
    [provisao, orders, cotacoes, clientes, condicoes],
  );
  const navigate = useNavigate();
  const [obs, setObs] = useState(provisao.observacoes ?? "");
  const [reprovarOpen, setReprovarOpen] = useState(false);

  const itemsComStatus = useMemo(() => {
    return provisao.itens.map((i) => {
      const atual = products.find((p) => p.sku === i.sku);
      return {
        ...i,
        produtoAtual: atual,
        precoAtualDiff: atual ? atual.precoAtacado - i.precoAtacadoReferencia : 0,
        statusAtual: atual?.statusEstoque ?? i.statusEstoque,
      };
    });
  }, [provisao.itens, products]);

  const handleConverter = () => {
    clearCart();
    const entries = itemsComStatus
      .map((i) => (i.produtoAtual ? { product: i.produtoAtual, quantity: i.quantidade } : null))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (entries.length === 0) {
      alert("Nenhum produto da provisão está disponível no catálogo atual.");
      return;
    }
    addBulk(entries);
    setMeta({
      clienteId: provisao.clienteId,
      cliente: provisao.clienteSnapshot.razaoSocial,
      nomeFantasia: provisao.clienteSnapshot.nomeFantasia,
      cnpj: provisao.clienteSnapshot.cnpj,
      email: provisao.clienteSnapshot.contatoEmail,
      telefone: provisao.clienteSnapshot.contatoTelefone,
      municipio: provisao.clienteSnapshot.cidade,
      uf: provisao.clienteSnapshot.estado,
      clienteSnapshot: provisao.clienteSnapshot,
      provisaoOrigemId: provisao.id,
    });
    navigate({ to: "/cart" });
  };

  const handleEditar = () => {
    const entries = itemsComStatus
      .map((i) => (i.produtoAtual ? { product: i.produtoAtual, quantity: i.quantidade } : null))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (entries.length === 0) {
      toast.error("Nenhum item desta provisão consta no catálogo atual.");
      return;
    }
    const store = useOrder.getState();
    store.clearCart();
    store.addBulk(entries);
    store.setMeta({
      clienteId: provisao.clienteId,
      cliente: provisao.clienteSnapshot.razaoSocial,
      nomeFantasia: provisao.clienteSnapshot.nomeFantasia,
      cnpj: provisao.clienteSnapshot.cnpj,
      email: provisao.clienteSnapshot.contatoEmail,
      telefone: provisao.clienteSnapshot.contatoTelefone,
      municipio: provisao.clienteSnapshot.cidade,
      uf: provisao.clienteSnapshot.estado,
      clienteSnapshot: provisao.clienteSnapshot,
      observacoes: provisao.observacoes ?? "",
      provisaoEditandoId: provisao.id,
      provisaoOrigemId: undefined,
    });
    toast.message(`Editando provisão ${provisao.id}`);
    navigate({ to: "/cart" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface border-l gold-border overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">Provisão</div>
            <h2 className="font-display text-2xl">{provisao.id}</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {provisao.reprovado && (
            <div className="rounded-md border border-stock-out/40 bg-stock-out/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-stock-out shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-stock-out uppercase tracking-wider text-[10px]">
                    Provisão reprovada
                  </div>
                  <p className="text-text-secondary mt-0.5">
                    {provisao.reprovadoMotivo || "Sem motivo informado."}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Por {provisao.reprovadoPorNome ?? "—"} em{" "}
                    {provisao.reprovadoEm
                      ? new Date(provisao.reprovadoEm).toLocaleString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${statusBadge(provisao.status)}`}>
              {STATUS_PROVISAO_LABEL[provisao.status]}
            </span>
          </div>


          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Cliente" value={provisao.clienteSnapshot.razaoSocial} />
            <Info label="CNPJ" value={provisao.clienteSnapshot.cnpj} />
            <Info label="Vendedor" value={provisao.vendedorNome} />
            <Info label="Próx. previsão" value={provisao.proximaPrevisao} />
            <Info label="Criada em" value={new Date(provisao.criadoEm).toLocaleString("pt-BR")} />
            {provisao.pedidoFirmeId && <Info label="Pedido firme vinc." value={provisao.pedidoFirmeId} />}
            {provisao.cotacaoOrigemId && <Info label="Gerada da cotação" value={provisao.cotacaoOrigemId} />}
            {!provisao.pedidoFirmeId && !provisao.cotacaoOrigemId && <Info label="Origem" value="Direta (sem pedido/cotação)" />}
            {provisao.pedidoConvertidoId && <Info label="Convertida em" value={provisao.pedidoConvertidoId} />}
            <Info label="Condição de pagamento" value={condicaoPagamento} />

          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Itens ({provisao.itens.length})
            </div>
            <div className="rounded-md border border-border overflow-hidden">
              {itemsComStatus.map((i) => (
                <div key={i.sku} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{i.nomeComercial}</div>
                    <div className="font-mono text-[10px] text-text-muted">{i.sku}</div>
                    {Math.abs(i.precoAtualDiff) > 0.01 && i.produtoAtual && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-stock-out">
                        <AlertTriangle className="h-3 w-3" />
                        Preço mudou: {formatBRL(i.precoAtacadoReferencia)} → {formatBRL(i.produtoAtual.precoAtacado)}
                      </div>
                    )}
                  </div>
                  <div className="text-text-secondary text-center w-16">
                    {i.quantidade} un
                  </div>
                  <div className="text-stock-pre w-24 text-right">
                    {formatBRL(i.quantidade * i.precoAtacadoReferencia)}
                  </div>
                  <div className="w-24">
                    <span className="inline-flex text-[9px] uppercase tracking-wider rounded-full border border-stock-pre/30 bg-stock-pre/10 text-stock-pre px-1.5 py-0.5">
                      {i.statusAtual}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-text-muted">Total de referência</span>
              <span className="font-display text-2xl text-stock-pre">{formatBRL(provisao.totalReferencia)}</span>
            </div>

            <SubdivisaoCategoria items={itemsComStatus} />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Observações</div>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onBlur={() => setObservacoes(provisao.id, obs)}
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm resize-none focus:border-gold outline-none"
              placeholder="Notas internas sobre esta provisão..."
            />
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={async () => {
                try {
                  const { blob, filename } = await generateProvisaoPDF(provisao);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 30_000);
                } catch (err) {
                  console.error(err);
                  toast.error("Falha ao gerar PDF");
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border text-text-secondary py-2.5 text-xs uppercase tracking-wider hover:text-gold hover:border-gold/40"
            >
              <FileDown className="h-4 w-4" /> Baixar PDF
            </button>
            {provisao.status === "aguardando_estoque" && isAdmin && (
              <button
                onClick={() => updateStatus(provisao.id, "estoque_liberado")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-stock-in/20 border border-stock-in/40 text-stock-in py-2.5 text-xs uppercase tracking-wider hover:bg-stock-in/30"
              >
                <CheckCircle2 className="h-4 w-4" /> Marcar estoque como liberado
              </button>
            )}
            {(provisao.status === "aguardando_estoque" || provisao.status === "estoque_liberado") && (
              <button
                onClick={handleConverter}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold uppercase tracking-wider ${
                  provisao.status === "estoque_liberado"
                    ? "bg-gold text-background hover:bg-gold-light"
                    : "border border-gold/40 text-gold hover:bg-gold/10"
                }`}
              >
                <Package className="h-4 w-4" /> Converter em pedido
              </button>
            )}
            {provisao.status !== "convertido_em_pedido" && provisao.status !== "cancelado" && (
              <button
                onClick={handleEditar}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gold/40 text-gold py-2.5 text-xs uppercase tracking-wider hover:bg-gold/10"
              >
                <Edit className="h-4 w-4" /> Editar itens da provisão
              </button>
            )}
            {provisao.status !== "cancelado" && provisao.status !== "convertido_em_pedido" && (
              <button
                onClick={() => {
                  if (confirm(`Cancelar a provisão ${provisao.id}?`)) {
                    cancelar(provisao.id);
                    onClose();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stock-out/30 text-stock-out py-2 text-[11px] uppercase tracking-wider hover:bg-stock-out/10"
              >
                <Clock className="h-3 w-3" /> Cancelar provisão
              </button>
            )}
            {canReprovar && !provisao.reprovado && provisao.status !== "convertido_em_pedido" && (
              <button
                onClick={() => setReprovarOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stock-out/40 text-stock-out py-2 text-[11px] uppercase tracking-wider hover:bg-stock-out/10"
              >
                <XCircle className="h-3 w-3" /> Reprovar provisão
              </button>
            )}
            {canReprovar && provisao.reprovado && (
              <button
                onClick={async () => {
                  try {
                    await desfazerReprovacaoProvisao(provisao.id);
                    toast.success("Reprovação desfeita");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao desfazer");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stock-in/40 text-stock-in py-2 text-[11px] uppercase tracking-wider hover:bg-stock-in/10"
              >
                <RotateCcw className="h-3 w-3" /> Desfazer reprovação
              </button>
            )}
            {isMaster && (
              <button
                onClick={async () => {
                  if (!confirm(`Deletar definitivamente a provisão ${provisao.id}? Esta ação não pode ser desfeita.`)) return;
                  try {
                    await deleteProvisao(provisao.id);
                    toast.success("Provisão deletada");
                    onClose();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao deletar");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-stock-out/50 text-stock-out py-2 text-[11px] uppercase tracking-wider hover:bg-stock-out/15"
              >
                <Trash2 className="h-3 w-3" /> Deletar provisão (master)
              </button>
            )}
          </div>
        </div>
      </div>

      <ReprovarDialog
        open={reprovarOpen}
        onOpenChange={setReprovarOpen}
        entidade="provisão"
        identificador={provisao.id}
        onConfirm={async (motivo) => {
          try {
            await reprovarProvisao(provisao.id, motivo);
            toast.success("Provisão reprovada");
            onClose();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao reprovar");
          }
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-sm text-text-primary mt-0.5 truncate">{value}</div>
    </div>
  );
}

const BUCKET_ORDER_DETAIL = ["Celebrar a mesa", "Luz", "Momento"];

function bucketPorProdutoDetail(product?: { categoria: string; tipo?: string }): string {
  if (!product) return "Sem categoria";
  if (product.categoria === "Celebrar à Mesa") return "Celebrar a mesa";
  if (product.categoria === "Luz e Momento") {
    return product.tipo === "Numérica" ? "Momento" : "Luz";
  }
  if (product.categoria === "Acessórios de Mesa") return "Celebrar a mesa";
  return product.categoria || "Sem categoria";
}

function SubdivisaoCategoria({
  items,
}: {
  items: Array<{
    sku: string;
    nomeComercial: string;
    quantidade: number;
    precoAtacadoReferencia: number;
    produtoAtual?: { categoria: string; tipo?: string };
  }>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const buckets = useMemo(() => {
    type Row = { sku: string; nome: string; unidades: number; valor: number };
    const map = new Map<string, { bucket: string; unidades: number; valor: number; itens: Map<string, Row> }>();
    items.forEach((i) => {
      const bucket = bucketPorProdutoDetail(i.produtoAtual);
      const qtd = Number(i.quantidade || 0);
      const valor = qtd * Number(i.precoAtacadoReferencia || 0);
      const cur = map.get(bucket) ?? { bucket, unidades: 0, valor: 0, itens: new Map<string, Row>() };
      cur.unidades += qtd;
      cur.valor += valor;
      const existing = cur.itens.get(i.sku) ?? { sku: i.sku, nome: i.nomeComercial || i.sku, unidades: 0, valor: 0 };
      existing.unidades += qtd;
      existing.valor += valor;
      cur.itens.set(i.sku, existing);
      map.set(bucket, cur);
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, itensList: Array.from(v.itens.values()).sort((a, b) => b.valor - a.valor) }))
      .sort((a, b) => {
        const ia = BUCKET_ORDER_DETAIL.indexOf(a.bucket);
        const ib = BUCKET_ORDER_DETAIL.indexOf(b.bucket);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return b.valor - a.valor;
      });
  }, [items]);

  if (buckets.length === 0) return null;
  const total = buckets.reduce((s, b) => s + b.valor, 0);

  return (
    <div className="mt-4 rounded-md border border-border overflow-hidden">
      <div className="px-3 py-2 bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
        Por categoria (nesta provisão)
      </div>
      <ul className="divide-y divide-border/50">
        {buckets.map((b) => {
          const pct = total > 0 ? (b.valor / total) * 100 : 0;
          const isOpen = expanded === b.bucket;
          return (
            <li key={b.bucket}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : b.bucket)}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-2/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-text-primary truncate">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    )}
                    {b.bucket}
                  </div>
                  <div className="text-sm text-gold font-medium whitespace-nowrap">{formatBRL(b.valor)}</div>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full bg-gold/70" style={{ width: `${pct.toFixed(1)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
                  <span>{b.unidades.toLocaleString("pt-BR")} un.</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 bg-surface/40">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-text-muted uppercase tracking-wider text-[9px]">
                        <th className="text-left font-normal py-1.5">Produto</th>
                        <th className="text-right font-normal py-1.5 w-16">Qtd</th>
                        <th className="text-right font-normal py-1.5 w-24">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {b.itensList.map((it) => (
                        <tr key={it.sku} className="text-text-primary">
                          <td className="py-1.5 pr-2 truncate max-w-[220px]">
                            <div className="truncate">{it.nome}</div>
                            <div className="text-[9px] text-text-muted">{it.sku}</div>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {it.unidades.toLocaleString("pt-BR")}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-gold">
                            {formatBRL(it.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

