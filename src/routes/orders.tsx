import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Eye, Package, Printer, Trash2, UserCog, XCircle, RotateCcw, FileEdit } from "lucide-react";
import { printOrdersBatch } from "@/lib/orderPdf";
import { BotaoEnviarSncf } from "@/components/BotaoEnviarSncf";
import { formatBRL } from "@/lib/format";
import { useOrder, useVisibleOrders } from "@/store/orderStore";
import { useCotacao } from "@/store/cotacaoStore";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { listAppUsers } from "@/lib/users.functions";
import { ExportModal } from "@/components/export/ExportModal";
import { ReprovarDialog } from "@/components/ReprovarDialog";


export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Pedidos salvos — Fetély B2B" },
      { name: "description", content: "Histórico de pedidos salvos." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [showReprovados, setShowReprovados] = useState(false);
  const history = useVisibleOrders({ includeReprovados: showReprovados });
  const isAdmin = useAuth((s) => s.roles.includes("admin"));
  const isMaster = useAuth((s) => s.roles.includes("master"));
  const isAdminOrMaster = useAuth((s) => s.roles.includes("admin") || s.roles.includes("master"));
  const currentUserId = useAuth((s) => s.user?.id);
  const clientes = useClientes((s) => s.clientes);
  const reassignOrder = useOrder((s) => s.reassignOrder);
  const deleteOrder = useOrder((s) => s.deleteOrder);
  const reprovarOrder = useOrder((s) => s.reprovarOrder);
  const desfazerReprovacao = useOrder((s) => s.desfazerReprovacao);
  const criarCotacao = useCotacao((s) => s.criarCotacao);
  const [query, setQuery] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [reprovarTarget, setReprovarTarget] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportOrders, setExportOrders] = useState<typeof history | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  useEffect(() => setHydrated(true), []);

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fetchUsers = useServerFn(listAppUsers);
  const { data: appUsers } = useQuery({
    queryKey: ["app-users-for-reassign"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
    staleTime: 60_000,
  });


  // lista de vendedores únicos (somente admin vê dropdown)
  const vendedores = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((o) => {
      if (o.vendedorId) {
        map.set(o.vendedorId, o.vendedorNome ?? o.vendedorLogin ?? o.vendedorId);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((o) => {
      if (vendedorFilter !== "all" && o.vendedorId !== vendedorFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.meta.cliente.toLowerCase().includes(q) ||
        (o.meta.cnpj ?? "").toLowerCase().includes(q) ||
        (o.vendedorNome ?? "").toLowerCase().includes(q)
      );
    });
  }, [history, query, vendedorFilter]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Histórico</div>
          <h1 className="font-display text-4xl mt-1">Pedidos salvos</h1>
          <p className="text-sm text-text-secondary mt-2">
            {history.length} pedido{history.length === 1 ? "" : "s"}
            {isAdminOrMaster ? " no sistema" : " seu"}
            {history.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setPrintDialogOpen(true)}
                className="flex items-center gap-1.5 rounded-md gold-border bg-surface px-3 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir {selectedIds.size}
              </button>
              <button
                onClick={() =>
                  setExportOrders(history.filter((o) => selectedIds.has(o.id)))
                }
                className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
              >
                <Download className="h-3.5 w-3.5" /> Exportar {selectedIds.size}
              </button>
            </>
          )}
          {isAdminOrMaster && vendedores.length > 0 && (
            <select
              value={vendedorFilter}
              onChange={(e) => setVendedorFilter(e.target.value)}
              className="rounded-md gold-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            >
              <option value="all">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowReprovados((v) => !v)}
            className={`rounded-md border px-3 py-2 text-[11px] uppercase tracking-wider transition ${
              showReprovados
                ? "border-stock-out/50 bg-stock-out/10 text-stock-out"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {showReprovados ? "Ocultar reprovados" : "Mostrar reprovados"}
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, CNPJ ou nº pedido..."
            className="w-72 rounded-md gold-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
      </div>

      {!hydrated ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center text-text-secondary">
          Carregando pedidos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center">
          <Package className="h-10 w-10 text-gold/60 mx-auto mb-3" />
          <p className="text-text-secondary">
            {history.length === 0
              ? "Nenhum pedido encontrado. Seus pedidos aparecerão aqui após a primeira venda."
              : "Nenhum pedido encontrado para essa busca."}
          </p>
          <Link
            to="/catalog"
            className="inline-block mt-4 text-xs uppercase tracking-wider text-gold hover:underline"
          >
            Ir ao catálogo
          </Link>
        </div>
      ) : (
        <div className="rounded-lg gold-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    className="accent-gold"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((o) => selectedIds.has(o.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedIds(new Set(filtered.map((o) => o.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <th className="text-left px-4 py-3">Pedido</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Cliente</th>
                {isAdminOrMaster && <th className="text-left px-4 py-3">Vendedor</th>}
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-right px-4 py-3">Itens</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                const isRep = o.vendedorTipo === "representante";
                const cliente = o.meta.clienteId
                  ? clientes.find((c) => c.id === o.meta.clienteId)
                  : null;
                const isResponsavel =
                  !!cliente && !!currentUserId && cliente.cadastradoPorVendedorId === currentUserId;
                const canReprovar =
                  isAdminOrMaster || o.vendedorId === currentUserId || isResponsavel;
                return (
                  <tr
                    key={o.id}
                    className={`border-t border-border transition ${
                      o.reprovado
                        ? "bg-stock-out/5 hover:bg-stock-out/10"
                        : "hover:bg-surface-2/50"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="accent-gold"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelected(o.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gold">
                      <div className="flex items-center gap-2">
                        {o.id}
                        {o.reprovado && (
                          <span
                            title={o.reprovadoMotivo ?? ""}
                            className="inline-flex items-center gap-1 rounded-full border border-stock-out/40 bg-stock-out/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-stock-out"
                          >
                            <XCircle className="h-2.5 w-2.5" /> Reprovado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">{o.meta.cliente || "—"}</td>
                    {isAdminOrMaster && (
                      <td className="px-4 py-3">
                        {o.vendedorNome ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{o.vendedorNome}</span>
                            <span className="text-[10px] text-text-muted">
                              {o.vendedorLogin ?? "—"}
                              {o.vendedorTipo && (
                                <span
                                  className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                                    isRep
                                      ? "bg-amber-500/15 text-amber-300"
                                      : "bg-gold/15 text-gold"
                                  }`}
                                >
                                  {isRep ? "Rep" : "Interno"}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-text-secondary">{o.meta.cnpj || "—"}</td>
                    <td className="px-4 py-3 text-right">{qty}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gold">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{formatBRL(o.total)}</span>
                        {(() => {
                          const c = o.commercial;
                          if (!c || c.frete !== "FOB") return null;
                          const FRETE_PCT_DEFAULT = 5;
                          const subAposDesc = c.bruto - c.descontoCelebraValor - c.descontoMasterValor;
                          const fretePct = c.fretePercent ?? FRETE_PCT_DEFAULT;
                          const freteVal = c.freteValor ?? subAposDesc * (fretePct / 100);
                          if (freteVal <= 0) return null;
                          return (
                            <span
                              title={`Frete FOB cobrado (${fretePct.toFixed(1).replace(".", ",")}%)`}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
                            >
                              🚚 Frete FOB + {formatBRL(freteVal)}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {isAdmin && (
                          <button
                            onClick={() => setReassignTarget(o.id)}
                            title="Reatribuir vendedor"
                            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-1.5 text-[10px] uppercase tracking-wider text-amber-300 hover:bg-amber-500/10"
                          >
                            <UserCog className="h-3 w-3" />
                          </button>
                        )}
                        {canReprovar && !o.reprovado && (
                          <button
                            onClick={async () => {
                              if (
                                !confirm(
                                  `Enviar o pedido ${o.id} para cotação? Ele será removido dos pedidos firmes e uma nova cotação editável será criada.`,
                                )
                              )
                                return;
                              try {
                                const cot = await criarCotacao({
                                  items: o.items,
                                  meta: o.meta,
                                  total: o.total,
                                  commercial: o.commercial,
                                });
                                await deleteOrder(o.id);
                                toast.success(`Pedido ${o.id} enviado para cotação ${cot.id}`);

                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Erro ao enviar para cotação",
                                );
                              }
                            }}
                            title="Enviar para cotação (editar novamente)"
                            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-1.5 text-[10px] uppercase tracking-wider text-amber-300 hover:bg-amber-500/10"
                          >
                            <FileEdit className="h-3 w-3" />
                          </button>
                        )}
                        {canReprovar && !o.reprovado && (
                          <button
                            onClick={() => setReprovarTarget(o.id)}
                            title="Reprovar pedido"
                            className="inline-flex items-center gap-1 rounded-md border border-stock-out/40 px-2 py-1.5 text-[10px] uppercase tracking-wider text-stock-out hover:bg-stock-out/10"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        )}
                        {canReprovar && o.reprovado && (
                          <button
                            onClick={async () => {
                              try {
                                await desfazerReprovacao(o.id);
                                toast.success("Reprovação desfeita");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Erro ao desfazer",
                                );
                              }
                            }}
                            title="Desfazer reprovação"
                            className="inline-flex items-center gap-1 rounded-md border border-stock-in/40 px-2 py-1.5 text-[10px] uppercase tracking-wider text-stock-in hover:bg-stock-in/10"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                        {isMaster && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Deletar definitivamente o pedido ${o.id}? Esta ação não pode ser desfeita.`)) return;
                              try {
                                await deleteOrder(o.id);
                                toast.success("Pedido deletado");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Erro ao deletar",
                                );
                              }
                            }}
                            title="Deletar pedido (master)"
                            className="inline-flex items-center gap-1 rounded-md border border-stock-out/50 px-2 py-1.5 text-[10px] uppercase tracking-wider text-stock-out hover:bg-stock-out/15"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={() => setExportOrders([o])}
                          title="Exportar pedido"
                          className="inline-flex items-center gap-1 rounded-md gold-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <BotaoEnviarSncf orderId={o.id} />
                        <Link
                          to="/confirmation"
                          search={{ id: o.id }}
                          className="inline-flex items-center gap-1.5 rounded-md gold-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10"
                        >
                          <Eye className="h-3 w-3" /> Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reassignTarget && isAdmin && (
        <ReassignModal
          orderId={reassignTarget}
          users={(appUsers ?? []).filter((u: any) => u.ativo)}
          onClose={() => setReassignTarget(null)}
          onConfirm={(novo) => {
            reassignOrder(reassignTarget, novo);
            setReassignTarget(null);
          }}
        />
      )}

      {exportOrders && (
        <ExportModal orders={exportOrders} onClose={() => setExportOrders(null)} />
      )}

      <ReprovarDialog
        open={!!reprovarTarget}
        onOpenChange={(o) => !o && setReprovarTarget(null)}
        entidade="pedido"
        identificador={reprovarTarget ?? ""}
        onConfirm={async (motivo) => {
          if (!reprovarTarget) return;
          try {
            await reprovarOrder(reprovarTarget, motivo);
            toast.success("Pedido reprovado");
            setReprovarTarget(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao reprovar");
          }
        }}
      />
    </main>
  );
}

function ReassignModal({
  orderId,
  users,
  onClose,
  onConfirm,
}: {
  orderId: string;
  users: any[];
  onClose: () => void;
  onConfirm: (novo: {
    vendedorId: string;
    vendedorNome?: string | null;
    vendedorLogin?: string | null;
    vendedorTipo?: "interno" | "representante" | null;
  }) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border border-gold/40 bg-surface p-6 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Admin</div>
          <h3 className="font-display text-lg">Reatribuir pedido</h3>
          <p className="text-xs text-text-muted font-mono mt-1">{orderId}</p>
        </div>
        <label className="block text-xs uppercase tracking-wider text-text-secondary">
          Novo vendedor
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 w-full rounded-md gold-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="">Selecione um vendedor...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome_completo ?? u.email}
                {u.tipo_vendedor ? ` · ${u.tipo_vendedor}` : ""}
                {u.regiao ? ` · ${u.regiao}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            disabled={!selected}
            onClick={() => {
              const u = users.find((x) => x.id === selected);
              if (!u) return;
              onConfirm({
                vendedorId: u.id,
                vendedorNome: u.nome_completo ?? u.email,
                vendedorLogin: u.login_amigavel ?? u.email,
                vendedorTipo: (u.tipo_vendedor as "interno" | "representante" | null) ?? null,
              });
            }}
            className="rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar reatribuição
          </button>
        </div>
      </div>
    </div>
  );
}

