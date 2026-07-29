import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import type { Cotacao } from "@/types/cotacao";
import type { CartItem } from "@/types";
import type { ItemProvisao } from "@/types/provisao";
import { useOrder } from "@/store/orderStore";
import { useCotacao } from "@/store/cotacaoStore";
import { useProvisao } from "@/store/provisaoStore";
import { useCatalog } from "@/store/catalogStore";
import { emEstoque, extrairDataPrevisao } from "@/lib/classifyItem";

function toItemProvisao(i: CartItem): ItemProvisao {
  return {
    sku: i.sku,
    nomeComercial: i.product.nomeComercial,
    colecao: i.product.colecao,
    corNome: i.product.corNome,
    tamanhoNumero: i.product.tamanhoNumero,
    quantidade: i.quantity,
    precoAtacadoReferencia: i.product.precoAtacado,
    statusEstoque: i.product.statusEstoque,
    previsaoData: extrairDataPrevisao(i.product.statusEstoque),
  };
}

export function ConverterEmPedidoModal({
  cotacao,
  onClose,
  onConverted,
}: {
  cotacao: Cotacao;
  onClose: () => void;
  onConverted: (pedidoId: string) => void;
}) {
  const saveOrder = useOrder((s) => s.saveOrder);
  const setMeta = useOrder((s) => s.setMeta);
  const clearCart = useOrder((s) => s.clearCart);
  const addBulk = useOrder((s) => s.addBulk);
  const marcarConvertida = useCotacao((s) => s.marcarConvertida);
  const createProvisao = useProvisao((s) => s.createProvisao);
  const [saving, setSaving] = useState(false);

  const { itensFirmes, itensProvisao } = useMemo(() => {
    const firmes: CartItem[] = [];
    const provisao: CartItem[] = [];
    cotacao.items.forEach((i) => {
      if (emEstoque(i.product)) firmes.push(i);
      else provisao.push(i);
    });
    return { itensFirmes: firmes, itensProvisao: provisao };
  }, [cotacao.items]);

  const isMisto = itensFirmes.length > 0 && itensProvisao.length > 0;
  const apenasProvisao = itensFirmes.length === 0 && itensProvisao.length > 0;

  const handleConvert = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Carrega o cart com TODOS os itens (firmes + provisão) p/ preservar UI/estado se algo der errado
      clearCart();
      addBulk(cotacao.items.map((i) => ({ product: i.product, quantity: i.quantity })));
      setMeta({
        ...cotacao.meta,
        cotacaoOrigemId: cotacao.id,
        pedidoOrigem: "cotacao",
      });

      let pedidoId: string | undefined;
      let provisaoId: string | undefined;

      // 1) Provisão primeiro — evita perder itens em previsão caso o pedido firme falhe depois
      if (itensProvisao.length > 0 && cotacao.meta.clienteId && cotacao.meta.clienteSnapshot) {
        const prov = await createProvisao({
          clienteId: cotacao.meta.clienteId,
          clienteSnapshot: cotacao.meta.clienteSnapshot,
          itens: itensProvisao.map(toItemProvisao),
          observacoes: cotacao.meta.observacoes || undefined,
          cotacaoOrigemId: cotacao.id,
        });
        provisaoId = prov.id;
      }

      if (itensProvisao.length > 0 && !provisaoId) {
        throw new Error("A cotação tem itens de provisão, mas não foi possível salvar a provisão. Verifique o cliente e tente novamente.");
      }

      // 2) Pedido firme — só se houver itens em estoque
      if (itensFirmes.length > 0) {
        const pedido = await saveOrder(cotacao.commercial, itensFirmes);
        pedidoId = pedido.id;
      }

      if (pedidoId && provisaoId) {
        useProvisao.getState().updateStatus(provisaoId, "aguardando_estoque", {
          pedidoFirmeId: pedidoId,
        });
      }

      // 3) Marca cotação convertida (usa o pedido firme se houver, senão a provisão)
      const refId = pedidoId ?? provisaoId;
      if (refId) {
        marcarConvertida(cotacao.id, refId);
      }

      clearCart();

      if (pedidoId && provisaoId) {
        toast.success(`Cotação ${cotacao.id} convertida`, {
          description: `Pedido ${pedidoId} + Provisão ${provisaoId}`,
        });
      } else if (pedidoId) {
        toast.success(`Cotação ${cotacao.id} convertida no Pedido ${pedidoId}`);
      } else if (provisaoId) {
        toast.success(`Cotação ${cotacao.id} convertida na Provisão ${provisaoId}`);
      }

      onConverted(pedidoId ?? provisaoId ?? cotacao.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível converter";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-lg gold-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl">Converter em pedido</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Fechar" disabled={saving}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-md border border-gold/40 bg-gold/5 p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold font-semibold">
            Cotação {cotacao.id}
          </div>
          <div className="text-sm text-text-primary">
            {cotacao.meta.cliente} · {cotacao.items.length} {cotacao.items.length === 1 ? "item" : "itens"}
          </div>
          <div className="font-display text-2xl text-gold">{formatBRL(cotacao.total)}</div>
          <div className="text-[11px] text-text-muted">
            {cotacao.commercial?.condicaoDescricao ?? "—"}
            {cotacao.commercial?.frete ? ` · ${cotacao.commercial.frete}` : ""}
          </div>
        </div>

        {isMisto && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-semibold">
              Pedido misto
            </div>
            <div className="text-xs text-text-secondary">
              Serão criados <span className="text-text-primary font-medium">2 registros</span>:
            </div>
            <ul className="text-xs text-text-secondary space-y-0.5 pl-3">
              <li>• <span className="text-text-primary">Pedido firme</span> — {itensFirmes.length} item(ns) em estoque</li>
              <li>• <span className="text-text-primary">Provisão</span> — {itensProvisao.length} item(ns) em previsão</li>
            </ul>
          </div>
        )}

        {apenasProvisao && (
          <div className="rounded-md border border-blue-500/40 bg-blue-500/5 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold">
              Somente provisão
            </div>
            <div className="text-xs text-text-secondary">
              Nenhum item em estoque. Será criada uma <span className="text-text-primary font-medium">Provisão</span> com {itensProvisao.length} item(ns).
            </div>
          </div>
        )}

        {!isMisto && !apenasProvisao && (
          <p className="text-xs text-text-secondary">
            Um pedido firme será criado com os mesmos itens e condições. A cotação ficará marcada como
            convertida.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-md border border-border py-2.5 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={saving}
            className="flex-1 rounded-md bg-gold py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light disabled:opacity-40"
          >
            {saving ? "Convertendo…" : "✦ Confirmar conversão"}
          </button>
        </div>
      </div>
    </div>
  );
}
