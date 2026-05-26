import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { formatBRL } from "@/lib/format";
import { useOrder, cartTotal } from "@/store/orderStore";
import { useNegotiation, registrarNegociacao } from "@/store/negotiationStore";
import { CartCommercialPanel, type CommercialState } from "@/components/cart/CartCommercialPanel";
import type { CartItem, OrderCommercial } from "@/types";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Carrinho — Fetély B2B" },
      { name: "description", content: "Revise e finalize o pedido em andamento." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const items = useOrder((s) => s.items);
  const meta = useOrder((s) => s.meta);
  const setMeta = useOrder((s) => s.setMeta);
  const updateQty = useOrder((s) => s.updateQty);
  const removeItem = useOrder((s) => s.removeItem);
  const saveOrder = useOrder((s) => s.saveOrder);
  const clearCart = useOrder((s) => s.clearCart);
  const negotiationAtivo = useNegotiation((s) => s.ativo);
  const negDescontoPct = useNegotiation((s) => s.descontoPct);
  const negJustificativa = useNegotiation((s) => s.justificativa);
  const negObservacaoInterna = useNegotiation((s) => s.observacaoInterna);
  const negUsarReservada = useNegotiation((s) => s.usarReservada);
  const resetNegotiation = useNegotiation((s) => s.resetSession);
  const navigate = useNavigate();

  const [commercial, setCommercial] = useState<CommercialState | null>(null);
  const handleCommercialChange = useCallback((s: CommercialState) => setCommercial(s), []);

  const grouped = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    items.forEach((i) => {
      const key = i.product.colecao;
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [items]);

  const total = cartTotal(items);

  const handleConfirm = () => {
    if (!meta.cliente.trim()) return alert("Informe o nome do cliente.");
    if (!commercial?.podeFinalizar || !commercial.calculo.faixa || !commercial.condicao) {
      return alert(commercial?.motivoBloqueio ?? "Revise o pedido.");
    }
    const c = commercial.calculo;
    const faixa = c.faixa!;
    const orderCommercial: OrderCommercial = {
      faixaId: faixa.id,
      faixaNome: faixa.nome,
      frete: faixa.frete,
      condicaoId: commercial.condicao.id,
      condicaoDescricao: commercial.condicao.descricao,
      bruto: c.bruto,
      descontoCelebraPct: faixa.descontoCelebra,
      descontoCelebraValor: c.descontoCelebraValor,
      descontoMasterPct: negotiationAtivo ? negDescontoPct : 0,
      descontoMasterValor: c.descontoMasterValor,
      bonusPixValor: c.bonusPixValor,
      aplicouPix: c.aplicouPix,
      totalFinal: c.total,
      totalSemPix: c.totalSemPix,
      negociacao: negotiationAtivo,
      justificativa: negotiationAtivo ? negJustificativa : "",
      observacaoInterna: negotiationAtivo ? negObservacaoInterna : "",
      usouReservada: negotiationAtivo && negUsarReservada,
    };

    setMeta({ condicaoPagamento: commercial.condicao.descricao });
    const order = saveOrder(orderCommercial);

    if (orderCommercial.negociacao && orderCommercial.descontoMasterPct > 0) {
      registrarNegociacao({
        id: order.id,
        timestamp: order.createdAt,
        valorBruto: orderCommercial.bruto,
        descontoPct: orderCommercial.descontoMasterPct,
        descontoValor: orderCommercial.descontoMasterValor,
        justificativa: orderCommercial.justificativa,
        faixaUsada: orderCommercial.faixaNome,
      });
    }

    clearCart();
    resetNegotiation();
    navigate({ to: "/confirmation", search: { id: order.id } });
  };

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">Carrinho</div>
        <h1 className="font-display text-5xl mt-2">Vazio por enquanto</h1>
        <p className="text-text-secondary mt-3 text-sm">
          Comece um novo pedido para popular o carrinho.
        </p>
        <Link
          to="/new-order"
          className="inline-flex mt-8 items-center gap-2 rounded-md bg-gold px-6 py-3 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light"
        >
          Novo Pedido
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Revisão</div>
          <h1 className="font-display text-4xl mt-1">Carrinho do Pedido</h1>
        </div>
        <Link
          to="/new-order"
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary hover:text-gold"
        >
          <ArrowLeft className="h-3 w-3" /> Continuar comprando
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        <div className="space-y-6">
          {grouped.map(([col, group]) => {
            const sub = group.reduce(
              (s, i) => s + i.quantity * i.product.precoAtacado,
              0,
            );
            return (
              <section key={col} className="rounded-lg gold-border bg-surface overflow-hidden">
                <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-2">
                  <div className="font-display text-xl">{col}</div>
                  <div className="text-xs text-text-secondary">
                    Subtotal: <span className="text-gold">{formatBRL(sub)}</span>
                  </div>
                </header>
                <ul>
                  {group.map((item) => (
                    <li
                      key={item.sku}
                      className="grid grid-cols-[1fr_140px_140px_40px] items-center gap-4 px-5 py-4 border-t border-border/50 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-text-primary truncate">
                          {item.product.nomeComercial}
                        </div>
                        <div className="text-[10px] font-mono text-text-muted mt-0.5">
                          {item.product.sku} · Caixa {item.product.multiplos}
                        </div>
                      </div>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(v) => updateQty(item.sku, v)}
                        multiplos={item.product.multiplos}
                        compact
                      />
                      <div className="text-right">
                        <div className="text-gold font-medium">
                          {formatBRL(item.quantity * item.product.precoAtacado)}
                        </div>
                        <div className="text-[10px] text-text-muted">
                          {formatBRL(item.product.precoAtacado)} un.
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.sku)}
                        className="text-text-muted hover:text-stock-out p-2"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <CartCommercialPanel bruto={total} onChange={handleCommercialChange} />

          <div className="rounded-lg gold-border bg-surface p-5 space-y-4">
            <h2 className="font-display text-2xl">Dados do pedido</h2>
            <Field label="Cliente / Lojista *">
              <input
                value={meta.cliente}
                onChange={(e) => setMeta({ cliente: e.target.value })}
                placeholder="Razão social ou nome fantasia"
                className="input"
              />
            </Field>
            <Field label="CNPJ">
              <input
                value={meta.cnpj}
                onChange={(e) => setMeta({ cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="input"
              />
            </Field>
            <Field label="Observações">
              <textarea
                value={meta.observacoes}
                onChange={(e) => setMeta({ observacoes: e.target.value })}
                rows={3}
                className="input resize-none"
                placeholder="Notas internas, prazo, transportadora..."
              />
            </Field>
          </div>

          <div className="rounded-lg gold-border bg-surface p-5">
            {commercial?.motivoBloqueio && (
              <p className="mb-3 text-xs text-stock-out">{commercial.motivoBloqueio}</p>
            )}
            <button
              onClick={handleConfirm}
              disabled={!commercial?.podeFinalizar}
              className="w-full rounded-md bg-gold py-3 text-xs font-semibold uppercase tracking-[0.18em] text-background hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmar pedido
            </button>
            <button
              onClick={() => {
                if (confirm("Limpar todo o carrinho?")) {
                  clearCart();
                  resetNegotiation();
                }
              }}
              className="mt-2 w-full text-[10px] uppercase tracking-wider text-text-muted hover:text-stock-out"
            >
              Limpar carrinho
            </button>
          </div>
        </aside>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color .15s;
        }
        .input:focus { border-color: var(--gold); }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
