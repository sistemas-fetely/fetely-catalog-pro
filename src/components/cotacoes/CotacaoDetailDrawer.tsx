import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Copy, FileDown, Edit, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import type { Cotacao } from "@/types/cotacao";
import { STATUS_COTACAO_LABEL } from "@/types/cotacao";
import { useCotacao, diasAteExpirar } from "@/store/cotacaoStore";
import { useOrder } from "@/store/orderStore";
import { useCatalog } from "@/store/catalogStore";
import { MarcarPerdidaModal } from "./MarcarPerdidaModal";
import { ConverterEmPedidoModal } from "./ConverterEmPedidoModal";
import { generateCotacaoPDF } from "@/lib/orderPdf";

const STATUS_BADGE: Record<Cotacao["status"], string> = {
  aberta: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  em_negociacao: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  aprovada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  convertida: "border-gold/40 bg-gold/10 text-gold",
  expirada: "border-border bg-surface-2 text-text-muted",
  perdida: "border-red-500/40 bg-red-500/10 text-red-500",
};

export function CotacaoDetailDrawer({
  cotacao,
  onClose,
}: {
  cotacao: Cotacao;
  onClose: () => void;
}) {
  const atualizarStatus = useCotacao((s) => s.atualizarStatus);
  const duplicar = useCotacao((s) => s.duplicar);
  const setCartMeta = useOrder((s) => s.setMeta);
  const clearCart = useOrder((s) => s.clearCart);
  const addBulk = useOrder((s) => s.addBulk);
  const navigate = useNavigate();
  const [showPerdida, setShowPerdida] = useState(false);
  const [showConverter, setShowConverter] = useState(false);

  const dias = diasAteExpirar(cotacao);
  const expirando = dias >= 0 && dias <= 3 && (cotacao.status === "aberta" || cotacao.status === "em_negociacao");

  const handleEditar = () => {
    const itens = (cotacao.items ?? []).filter(
      (i) => i && i.product && i.quantity > 0,
    );
    if (itens.length === 0) {
      toast.error("Esta cotação não possui itens para edição");
      return;
    }
    // Reset + hidrata o carrinho de forma síncrona via getState para evitar
    // qualquer interferência de re-render / unmount do drawer.
    const store = useOrder.getState();
    store.clearCart();
    store.addBulk(itens.map((i) => ({ product: i.product, quantity: i.quantity })));
    store.setMeta({
      ...cotacao.meta,
      cotacaoOrigemId: cotacao.id,
    });
    toast.message(`Editando cotação ${cotacao.id}`);
    navigate({ to: "/cart" });
    onClose();
  };

  const handleDuplicar = async () => {
    const nova = await duplicar(cotacao.id);
    if (nova) toast.success(`Cotação duplicada: ${nova.id}`);
  };


  const handlePdf = async () => {
    try {
      const { blob, filename } = await generateCotacaoPDF(cotacao);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      toast.error("Falha ao gerar PDF");
      console.error(err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gold/30 bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">Cotação</div>
            <h2 className="font-display text-3xl mt-1">{cotacao.id}</h2>
            <div className="mt-1 text-sm text-text-secondary">
              {cotacao.meta.cliente} ·{" "}
              {new Date(cotacao.criadoEm).toLocaleDateString("pt-BR")}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Válida até{" "}
              {new Date(cotacao.validoAte).toLocaleDateString("pt-BR")}
              {expirando && (
                <span className="ml-2 text-amber-500">⚠ Expira em {dias} {dias === 1 ? "dia" : "dias"}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider ${STATUS_BADGE[cotacao.status]}`}>
              {STATUS_COTACAO_LABEL[cotacao.status]}
            </span>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {cotacao.status === "convertida" && cotacao.pedidoConvertidoId && (
          <div className="mb-4 rounded-md border border-gold/40 bg-gold/5 p-3 text-xs text-gold">
            ✅ Convertida no pedido <strong>{cotacao.pedidoConvertidoId}</strong>
          </div>
        )}
        {cotacao.status === "perdida" && cotacao.motivoPerda && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500">
            ⛔ Perdida — {cotacao.motivoPerda}{cotacao.motivoPerdaObs ? ` · ${cotacao.motivoPerdaObs}` : ""}
          </div>
        )}

        {/* Itens */}
        <section className="rounded-md border border-border bg-surface-2 p-4 mb-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-semibold mb-2">
            Itens ({cotacao.items.length})
          </h3>
          <ul className="divide-y divide-border">
            {cotacao.items.map((i) => (
              <li key={i.sku} className="py-2 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-text-primary">{i.product.nomeComercial}</div>
                  <div className="text-[10px] text-text-muted font-mono">{i.sku} · ×{i.quantity}</div>
                </div>
                <div className="text-gold text-right shrink-0">
                  {formatBRL(i.product.precoAtacado * i.quantity)}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Resumo financeiro */}
        {(() => {
          const c = cotacao.commercial;
          const prontaTotal = c?.totalFinal ?? cotacao.total;
          const provisaoRef = Math.max(0, cotacao.total - prontaTotal);
          const temProvisao = provisaoRef > 0.01;
          return (
            <section className="rounded-md gold-border bg-surface p-4 mb-4">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>{temProvisao ? "Bruto (pronta entrega)" : "Bruto"}</span>
                <span>{formatBRL(c?.bruto ?? cotacao.total)}</span>
              </div>
              {c?.descontoCelebraValor ? (
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>Desconto Celebra ({c.descontoCelebraPct}%)</span>
                  <span>− {formatBRL(c.descontoCelebraValor)}</span>
                </div>
              ) : null}
              {c?.descontoMasterValor ? (
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>Negociação ({c.descontoMasterPct}%)</span>
                  <span>− {formatBRL(c.descontoMasterValor)}</span>
                </div>
              ) : null}
              {c?.frete === "FOB" && (c?.freteValor ?? 0) > 0 ? (
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>
                    Frete FOB
                    {c?.fretePercent
                      ? ` (${c.fretePercent.toFixed(1).replace(".", ",")}%)`
                      : ""}
                  </span>
                  <span>+ {formatBRL(c.freteValor ?? 0)}</span>
                </div>
              ) : null}
              {temProvisao && (
                <>
                  <div className="border-t border-border my-2" />
                  <div className="flex justify-between text-xs text-text-secondary mb-1">
                    <span>Subtotal pronta entrega</span>
                    <span>{formatBRL(prontaTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-500 mb-1">
                    <span>Provisão futura (referência)</span>
                    <span>+ {formatBRL(provisaoRef)}</span>
                  </div>
                  <div className="text-[10px] text-text-muted -mt-0.5 mb-1">
                    Itens de provisão entram pelo preço de referência, sem desconto/frete aplicados.
                  </div>
                </>
              )}
              <div className="border-t border-border my-2" />
              <div className="flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-text-secondary">Total</span>
                <span className="font-display text-2xl text-gold">{formatBRL(cotacao.total)}</span>
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                {c?.condicaoDescricao ?? "—"}
                {c?.frete
                  ? ` · ${c.frete}${c.frete === "CIF" ? " — Fetély entrega" : " — por conta do lojista"}`
                  : ""}
              </div>
            </section>
          );
        })()}

        {cotacao.meta?.observacoes && (
          <section className="rounded-md border border-border bg-surface/40 p-4 mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-semibold mb-2">
              Observações
            </div>
            <p className="text-xs text-text-secondary whitespace-pre-wrap">
              {cotacao.meta.observacoes}
            </p>
          </section>
        )}

        <section className="rounded-md border border-border bg-surface/40 p-4 mb-4 text-[11px] text-text-muted space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-semibold mb-2">
            Histórico
          </div>
          <div>Criada em {new Date(cotacao.criadoEm).toLocaleString("pt-BR")} por {cotacao.vendedorNome}</div>
          {cotacao.atualizadoEm && cotacao.atualizadoEm !== cotacao.criadoEm && (
            <div>Atualizada em {new Date(cotacao.atualizadoEm).toLocaleString("pt-BR")}</div>
          )}
          <div>Válida até {new Date(cotacao.validoAte).toLocaleDateString("pt-BR")}</div>
        </section>

        {/* Ações principais */}
        <div className="space-y-2 mb-4">
          {cotacao.status !== "convertida" && (
            <button
              onClick={() => setShowConverter(true)}
              className="w-full rounded-md bg-gold py-3 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" /> Converter em Pedido
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleEditar}
              className="rounded-md border border-border py-2.5 text-[11px] uppercase tracking-wider text-text-secondary hover:text-gold flex items-center justify-center gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              onClick={handlePdf}
              className="rounded-md border border-border py-2.5 text-[11px] uppercase tracking-wider text-text-secondary hover:text-gold flex items-center justify-center gap-1.5"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              onClick={handleDuplicar}
              className="rounded-md border border-border py-2.5 text-[11px] uppercase tracking-wider text-text-secondary hover:text-gold flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </button>
          </div>
        </div>


        {/* Status quick-update */}
        {(cotacao.status === "aberta" || cotacao.status === "em_negociacao" || cotacao.status === "aprovada") && (
          <section className="border-t border-border pt-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-semibold mb-2">
              Atualizar status
            </div>
            <div className="flex flex-wrap gap-2">
              {cotacao.status !== "em_negociacao" && (
                <button
                  onClick={() => {
                    atualizarStatus(cotacao.id, "em_negociacao");
                    toast.success("Status: Em negociação");
                  }}
                  className="rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-500 px-3 py-1.5 text-[11px] uppercase tracking-wider hover:bg-blue-500/15"
                >
                  Em negociação
                </button>
              )}
              {cotacao.status !== "aprovada" && (
                <button
                  onClick={() => {
                    atualizarStatus(cotacao.id, "aprovada");
                    toast.success("Status: Aprovada");
                  }}
                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 text-[11px] uppercase tracking-wider hover:bg-emerald-500/15"
                >
                  Aprovada
                </button>
              )}
              <button
                onClick={() => setShowPerdida(true)}
                className="rounded-md border border-red-500/40 bg-red-500/10 text-red-500 px-3 py-1.5 text-[11px] uppercase tracking-wider hover:bg-red-500/15"
              >
                Perdida
              </button>
            </div>
          </section>
        )}
      </aside>

      {showPerdida && (
        <MarcarPerdidaModal
          onCancel={() => setShowPerdida(false)}
          onConfirm={(motivo, obs) => {
            atualizarStatus(cotacao.id, "perdida", { motivo, motivoObs: obs });
            toast.success("Cotação marcada como perdida");
            setShowPerdida(false);
          }}
        />
      )}
      {showConverter && (
        <ConverterEmPedidoModal
          cotacao={cotacao}
          onClose={() => setShowConverter(false)}
          onConverted={(pid) => {
            setShowConverter(false);
            onClose();
            navigate({ to: "/orders", search: { highlight: pid } as never });
          }}
        />
      )}
    </>
  );
}
