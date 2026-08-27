import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Search, Users, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOrder, useVisibleOrders } from "@/store/orderStore";
import { useClientes } from "@/store/clienteStore";
import { useVisibleGrupos } from "@/store/grupoStore";
import { useVisibleModelos } from "@/store/modeloStore";
import { useCotacao } from "@/store/cotacaoStore";
import { useDuplicacao } from "@/store/duplicacaoStore";
import { recalcularItens, itensDePedido, itensDeModelo } from "@/lib/duplicar";
import { formatBRL } from "@/lib/format";
import type { SavedOrder, OrderMeta } from "@/types";
import type { GrupoCliente } from "@/types/grupo";

type OrigemTipo = "pedido" | "modelo";
type DestinoTipo = "mesmo" | "grupo" | "manual";
type ModoGeracao = "carrinho" | "cotacoes";

export function DuplicarPedidoModal({
  pedidoInicial,
  grupoInicial,
  onClose,
}: {
  pedidoInicial?: SavedOrder | null;
  grupoInicial?: GrupoCliente | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const allOrders = useVisibleOrders();
  const modelos = useVisibleModelos();
  const grupos = useVisibleGrupos();
  const clientes = useClientes((s) => s.clientes);
  const criarCotacao = useCotacao((s) => s.criarCotacao);
  const setCartItems = useOrder((s) => s.addBulk);
  const clearCart = useOrder((s) => s.clearCart);
  const setMeta = useOrder((s) => s.setMeta);
  const iniciarFila = useDuplicacao((s) => s.iniciar);

  // ORIGEM
  const [origemTipo, setOrigemTipo] = useState<OrigemTipo>(pedidoInicial ? "pedido" : "pedido");
  const [pedidoBuscaQ, setPedidoBuscaQ] = useState("");
  const [pedidoOrigemId, setPedidoOrigemId] = useState<string | null>(pedidoInicial?.id ?? null);
  const [modeloOrigemId, setModeloOrigemId] = useState<string | null>(null);

  // DESTINO
  const [destinoTipo, setDestinoTipo] = useState<DestinoTipo>(
    grupoInicial ? "grupo" : pedidoInicial?.meta.clienteId ? "mesmo" : "manual",
  );
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(
    grupoInicial?.id ?? null,
  );
  const [clientesSelecionados, setClientesSelecionados] = useState<Set<string>>(() => {
    if (grupoInicial) return new Set(grupoInicial.clienteIds);
    if (pedidoInicial?.meta.clienteId) return new Set([pedidoInicial.meta.clienteId]);
    return new Set();
  });
  const [viaGrupoIds, setViaGrupoIds] = useState<Set<string>>(() =>
    grupoInicial ? new Set(grupoInicial.clienteIds) : new Set(),
  );
  const [buscaClienteQ, setBuscaClienteQ] = useState("");

  // MODO
  const [modo, setModo] = useState<ModoGeracao>("carrinho");
  const [processando, setProcessando] = useState(false);

  // Reatividade: quando grupo selecionado muda, preencher
  useEffect(() => {
    if (destinoTipo === "grupo" && grupoSelecionadoId) {
      const g = grupos.find((x) => x.id === grupoSelecionadoId);
      if (g) {
        setClientesSelecionados((prev) => {
          const next = new Set(prev);
          g.clienteIds.forEach((id) => next.add(id));
          return next;
        });
        setViaGrupoIds(new Set(g.clienteIds));
      }
    }
  }, [destinoTipo, grupoSelecionadoId, grupos]);

  const pedidosFiltrados = useMemo(() => {
    const q = pedidoBuscaQ.trim().toLowerCase();
    return allOrders
      .filter((o) => {
        if (!q) return true;
        return (
          o.id.toLowerCase().includes(q) ||
          o.meta.cliente.toLowerCase().includes(q) ||
          (o.meta.cnpj ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [allOrders, pedidoBuscaQ]);

  const pedidoOrigem = useMemo(
    () => (pedidoOrigemId ? allOrders.find((o) => o.id === pedidoOrigemId) : null),
    [pedidoOrigemId, allOrders],
  );

  const modeloOrigem = useMemo(
    () => (modeloOrigemId ? modelos.find((m) => m.id === modeloOrigemId) : null),
    [modeloOrigemId, modelos],
  );

  const itensBase = useMemo(() => {
    if (origemTipo === "pedido" && pedidoOrigem) return itensDePedido(pedidoOrigem);
    if (origemTipo === "modelo" && modeloOrigem) return itensDeModelo(modeloOrigem);
    return [];
  }, [origemTipo, pedidoOrigem, modeloOrigem]);

  const clientesParaAdicionar = useMemo(() => {
    const q = buscaClienteQ.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return clientes
      .filter((c) => !clientesSelecionados.has(c.id))
      .filter((c) => {
        if (!q) return true;
        return (
          c.razaoSocial.toLowerCase().includes(q) ||
          c.nomeFantasia.toLowerCase().includes(q) ||
          (digits && c.cnpj.includes(digits))
        );
      })
      .slice(0, 8);
  }, [clientes, clientesSelecionados, buscaClienteQ]);

  const handleContinuar = async () => {
    if (itensBase.length === 0) { toast.error("Escolha a origem dos itens"); return; }
    if (clientesSelecionados.size === 0) { toast.error("Selecione ao menos um cliente destino"); return; }

    const recalc = recalcularItens(itensBase);
    if (recalc.itens.length === 0) {
      toast.error("Nenhum item válido após recálculo (todos descontinuados).");
      return;
    }
    if (recalc.itensRemovidos.length > 0) {
      toast.warning(`${recalc.itensRemovidos.length} item(ns) descontinuado(s) removido(s).`);
    }
    if (recalc.itensComPrecoAlterado.length > 0) {
      toast.info(`${recalc.itensComPrecoAlterado.length} item(ns) com preço atualizado.`);
    }

    const grupoOrigemId = destinoTipo === "grupo" ? grupoSelecionadoId ?? undefined : undefined;
    const clientesArr = Array.from(clientesSelecionados);

    if (modo === "cotacoes") {
      // Gera N cotações
      setProcessando(true);
      let ok = 0;
      const erros: string[] = [];
      for (const cid of clientesArr) {
        const cliente = clientes.find((c) => c.id === cid);
        if (!cliente) continue;
        const meta: OrderMeta = {
          cliente: cliente.razaoSocial,
          cnpj: cliente.cnpjFormatado,
          condicaoPagamento: "À vista",
          observacoes: "",
          vendedor: cliente.cadastradoPorVendedorNome,
          nomeFantasia: cliente.nomeFantasia,
          email: cliente.contatoEmail,
          telefone: cliente.contatoTelefone,
          municipio: cliente.cidade,
          uf: cliente.estado,
          cep: cliente.cep,
          clienteId: cliente.id,
        };
        const total = recalc.itens.reduce((s, i) => s + i.product.precoAtacado * i.quantity, 0);
        try {
          await criarCotacao({ items: recalc.itens, meta, total });
          ok++;
        } catch (err) {
          erros.push(`${cliente.razaoSocial}: ${err instanceof Error ? err.message : "erro"}`);
        }
      }
      setProcessando(false);
      if (ok > 0) toast.success(`${ok} cotação(ões) gerada(s).`);
      if (erros.length > 0) toast.error(`Erros em ${erros.length} cliente(s).`);
      onClose();
      navigate({ to: "/cotacoes" });
      return;
    }

    // Modo carrinho: cria fila + abre primeiro
    iniciarFila(
      {
        tipo: origemTipo,
        refId: origemTipo === "pedido" ? pedidoOrigem!.id : modeloOrigem!.id,
        refLabel:
          origemTipo === "pedido"
            ? `#${pedidoOrigem!.id}`
            : modeloOrigem!.nome,
        itens: recalc.itens,
        grupoOrigemId,
      },
      clientesArr.map((cid) => {
        const c = clientes.find((x) => x.id === cid);
        return { id: cid, nome: c?.razaoSocial ?? cid };
      }),
    );

    // Carrega o primeiro no carrinho
    const primeiroId = clientesArr[0];
    const primeiroCliente = clientes.find((c) => c.id === primeiroId);
    if (primeiroCliente) {
      clearCart();
      setCartItems(recalc.itens.map((i) => ({ product: i.product, quantity: i.quantity })));
      setMeta({
        clienteId: primeiroCliente.id,
        cliente: primeiroCliente.razaoSocial,
        nomeFantasia: primeiroCliente.nomeFantasia,
        cnpj: primeiroCliente.cnpjFormatado,
        email: primeiroCliente.contatoEmail,
        telefone: primeiroCliente.contatoTelefone,
        municipio: primeiroCliente.cidade,
        uf: primeiroCliente.estado,
        cep: primeiroCliente.cep,
      });
    }
    onClose();
    navigate({ to: "/cart" });
    toast.success(`Fila iniciada: ${clientesArr.length} pedido(s) a revisar`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-lg border border-gold/40 bg-surface flex flex-col max-h-[92vh]">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Duplicação</div>
            <h3 className="font-display text-2xl mt-0.5">Duplicar pedido</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* ORIGEM */}
          <section>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted mb-2">Origem</div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="origem" checked={origemTipo === "pedido"} onChange={() => setOrigemTipo("pedido")} className="mt-1 accent-gold" />
                <div className="flex-1">
                  <div className="text-sm">Pedido existente</div>
                  {origemTipo === "pedido" && (
                    <div className="mt-2 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          value={pedidoBuscaQ}
                          onChange={(e) => setPedidoBuscaQ(e.target.value)}
                          placeholder="Buscar por nº ou cliente..."
                          className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
                        />
                      </div>
                      <div className="border border-border rounded-md max-h-48 overflow-y-auto divide-y divide-border/50">
                        {pedidosFiltrados.length === 0 && (
                          <div className="p-4 text-center text-xs text-text-muted">Nenhum pedido</div>
                        )}
                        {pedidosFiltrados.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setPedidoOrigemId(o.id)}
                            className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2 text-xs ${
                              pedidoOrigemId === o.id ? "bg-gold/10" : "hover:bg-surface-2/50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-gold">{o.id}</span>
                              <span className="text-text-secondary"> · {o.meta.cliente}</span>
                            </div>
                            <span className="text-text-muted shrink-0">{o.totalSkus ?? o.items.length} itens · {formatBRL(o.total)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="origem" checked={origemTipo === "modelo"} onChange={() => setOrigemTipo("modelo")} className="mt-1 accent-gold" />
                <div className="flex-1">
                  <div className="text-sm">Modelo salvo</div>
                  {origemTipo === "modelo" && (
                    <select
                      value={modeloOrigemId ?? ""}
                      onChange={(e) => setModeloOrigemId(e.target.value || null)}
                      className="mt-2 w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      <option value="">Selecione um modelo...</option>
                      {modelos.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome} ({m.itens.length} itens)</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            </div>
          </section>

          {/* DESTINO */}
          <section>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted mb-2">Destino</div>
            <div className="space-y-2">
              {pedidoInicial?.meta.clienteId && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="destino" checked={destinoTipo === "mesmo"} onChange={() => {
                    setDestinoTipo("mesmo");
                    setClientesSelecionados(new Set([pedidoInicial.meta.clienteId!]));
                    setViaGrupoIds(new Set());
                  }} className="mt-1 accent-gold" />
                  <div className="text-sm">Mesmo cliente <span className="text-text-muted">({pedidoInicial.meta.cliente})</span></div>
                </label>
              )}
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="destino" checked={destinoTipo === "grupo"} onChange={() => setDestinoTipo("grupo")} className="mt-1 accent-gold" />
                <div className="flex-1">
                  <div className="text-sm flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-gold" /> Selecionar por grupo
                  </div>
                  {destinoTipo === "grupo" && (
                    <select
                      value={grupoSelecionadoId ?? ""}
                      onChange={(e) => {
                        setGrupoSelecionadoId(e.target.value || null);
                        if (!e.target.value) { setClientesSelecionados(new Set()); setViaGrupoIds(new Set()); }
                      }}
                      className="mt-2 w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      <option value="">Selecione um grupo...</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>{g.nome} ({g.clienteIds.length})</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="destino" checked={destinoTipo === "manual"} onChange={() => setDestinoTipo("manual")} className="mt-1 accent-gold" />
                <div className="text-sm">Selecionar manualmente</div>
              </label>
            </div>

            {/* Lista clientes selecionados */}
            <div className="mt-3 border border-border rounded-md p-3 bg-surface-2/40">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                Clientes selecionados ({clientesSelecionados.size})
              </div>
              {clientesSelecionados.size === 0 ? (
                <div className="text-xs text-text-muted">Nenhum cliente selecionado ainda.</div>
              ) : (
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {Array.from(clientesSelecionados).map((cid) => {
                    const c = clientes.find((x) => x.id === cid);
                    if (!c) return null;
                    return (
                      <li key={cid} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-text-primary">{c.razaoSocial}</span>
                          <span className="text-text-muted font-mono"> · {c.cnpjFormatado}</span>
                          {viaGrupoIds.has(cid) && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-gold/70">← via grupo</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setClientesSelecionados((p) => { const n = new Set(p); n.delete(cid); return n; });
                          }}
                          className="text-text-muted hover:text-stock-out"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <input
                  value={buscaClienteQ}
                  onChange={(e) => setBuscaClienteQ(e.target.value)}
                  placeholder="Adicionar outro cliente..."
                  className="w-full bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-gold"
                />
              </div>
              {buscaClienteQ && clientesParaAdicionar.length > 0 && (
                <div className="mt-2 border border-border rounded-md divide-y divide-border/50 max-h-40 overflow-y-auto">
                  {clientesParaAdicionar.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClientesSelecionados((p) => new Set(p).add(c.id));
                        setBuscaClienteQ("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2/50"
                    >
                      {c.razaoSocial} <span className="text-text-muted">· {c.cnpjFormatado}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* MODO */}
          <section>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted mb-2">Modo de geração</div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="modo" checked={modo === "carrinho"} onChange={() => setModo("carrinho")} className="mt-1 accent-gold" />
                <div className="text-sm">Revisar cada pedido no carrinho <span className="text-text-muted">(recomendado)</span></div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="modo" checked={modo === "cotacoes"} onChange={() => setModo("cotacoes")} className="mt-1 accent-gold" />
                <div className="text-sm flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-gold" /> Gerar todos como cotações
                </div>
              </label>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between px-5 py-4 border-t border-border">
          <button onClick={onClose} className="text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary">
            Cancelar
          </button>
          <button
            onClick={handleContinuar}
            disabled={processando}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-50"
          >
            {processando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Continuar →
          </button>
        </footer>
      </div>
    </div>
  );
}
