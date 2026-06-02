import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/store/authStore";
import { useCotacao } from "@/store/cotacaoStore";
import { useOrder } from "@/store/orderStore";
import { formatBRL } from "@/lib/format";
import { STATUS_COTACAO_LABEL } from "@/types/cotacao";
import type { Cotacao } from "@/types/cotacao";
import { Edit, X } from "lucide-react";

export const Route = createFileRoute("/portal/cotacoes")({
  component: PortalCotacoes,
});


function PortalCotacoes() {
  const clienteId = useAuth((s) => s.profile?.cliente_id ?? null);
  const cotacoes = useCotacao((s) => s.cotacoes);
  const fetchAll = useCotacao((s) => s.fetchAll);
  const loading = useCotacao((s) => s.loading);
  const loaded = useCotacao((s) => s.loaded);
  const [selected, setSelected] = useState<Cotacao | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const minhas = useMemo(
    () =>
      cotacoes.filter(
        (c) => clienteId && c.meta?.clienteId === clienteId,
      ),
    [cotacoes, clienteId],
  );

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-baseline justify-between mb-6 pb-4 border-b border-border">
        <h1 className="font-display text-3xl text-text-primary">Minhas Cotações</h1>
        <span className="text-xs text-text-muted">
          {minhas.length} {minhas.length === 1 ? "cotação" : "cotações"}
        </span>
      </header>

      {loading && !loaded ? (
        <div className="text-center text-text-muted text-sm py-12">Carregando...</div>
      ) : minhas.length === 0 ? (
        <div className="rounded-md border border-border bg-surface/40 px-6 py-12 text-center text-text-muted text-sm">
          Você ainda não possui cotações.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface/40 overflow-hidden">
          <div className="grid grid-cols-[90px_120px_1fr_120px_140px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-surface border-b border-border">
            <div>#</div>
            <div>Data</div>
            <div>Status</div>
            <div>Válida até</div>
            <div className="text-right">Total</div>
          </div>
          {minhas.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              className="grid grid-cols-[90px_120px_1fr_120px_140px] gap-3 px-4 py-3 text-xs items-center border-b border-border/40 last:border-b-0 hover:bg-surface-hover transition cursor-pointer"
            >
              <span className="font-mono text-text-muted">{c.id}</span>
              <span className="text-text-secondary">
                {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
              </span>
              <span>
                <span className="inline-block rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold-muted">
                  {STATUS_COTACAO_LABEL[c.status]}
                </span>
              </span>
              <span className="text-text-secondary">
                {new Date(c.validoAte).toLocaleDateString("pt-BR")}
              </span>
              <span className="text-right text-gold font-medium">
                {formatBRL(c.total)}
              </span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <CotacaoDrawer cotacao={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CotacaoDrawer({ cotacao, onClose }: { cotacao: Cotacao; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background border-l border-border h-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
              Cotação
            </div>
            <h2 className="font-display text-2xl text-text-primary mt-1">{cotacao.id}</h2>
            <p className="text-xs text-text-secondary mt-1">
              {new Date(cotacao.criadoEm).toLocaleString("pt-BR")} · Válida até{" "}
              {new Date(cotacao.validoAte).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-gold p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <section className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-surface border-b border-border">
              <div>Produto</div>
              <div className="text-right">Qtd</div>
              <div className="text-right">Unit.</div>
              <div className="text-right">Subtotal</div>
            </div>
            {cotacao.items.map((it) => (
              <div
                key={it.sku}
                className="grid grid-cols-[1fr_60px_90px_90px] gap-2 px-3 py-2 text-xs border-b border-border/40 last:border-b-0"
              >
                <div className="text-text-primary truncate">
                  {it.product.nomeComercial}
                  <span className="text-text-muted">
                    {it.product.corNome ? ` · ${it.product.corNome}` : ""}
                    {it.product.tamanhoNumero ? ` · ${it.product.tamanhoNumero}` : ""}
                  </span>
                </div>
                <div className="text-right text-text-secondary">{it.quantity}</div>
                <div className="text-right text-text-secondary">
                  {formatBRL(it.product.precoAtacado)}
                </div>
                <div className="text-right text-text-primary">
                  {formatBRL(it.product.precoAtacado * it.quantity)}
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-md border border-border bg-surface/40 p-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase tracking-wider text-gold-muted">
                Total da cotação
              </span>
              <span className="font-display text-2xl text-gold">
                {formatBRL(cotacao.total)}
              </span>
            </div>
          </section>

          {cotacao.vendedorNome && (
            <p className="text-xs text-text-muted">
              Vendedor responsável:{" "}
              <span className="text-text-secondary">{cotacao.vendedorNome}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
