import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";

import { toast } from "sonner";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { formatBRL } from "@/lib/format";
import { useOrder, cartTotal } from "@/store/orderStore";
import { useNegotiation, registrarNegociacao } from "@/store/negotiationStore";
import { CartCommercialPanel, type CommercialState } from "@/components/cart/CartCommercialPanel";
import { ClienteSelector } from "@/components/clientes/ClienteSelector";
import { MixedCartBanner } from "@/components/cart/MixedCartBanner";
import { ProvisaoSection } from "@/components/cart/ProvisaoSection";
import { FinalConfirmModal } from "@/components/cart/FinalConfirmModal";
import { classificarItem, extrairDataPrevisao, compararPrevisao } from "@/lib/classifyItem";
import { useProvisao } from "@/store/provisaoStore";
import { useCotacao } from "@/store/cotacaoStore";
import type { CartItem, OrderCommercial, OrderMeta } from "@/types";
import type { Cliente, ClienteSnapshot } from "@/types/cliente";
import type { ItemProvisao } from "@/types/provisao";
import { getPremissasVigentes } from "@/lib/premissas";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Carrinho — Fetély B2B" },
      { name: "description", content: "Revise e finalize o pedido em andamento." },
    ],
  }),
  component: CartPage,
});

function buildClienteSnapshot(c: Cliente): ClienteSnapshot {
  const endereco = c.enderecoEntregaIgual
    ? `${c.logradouro ?? ""}${c.numero ? `, ${c.numero}` : ""} — ${c.bairro ?? ""}, ${c.cidade ?? ""}/${c.estado ?? ""} · ${c.cep ?? ""}`
    : `${c.entregaLogradouro ?? ""}${c.entregaNumero ? `, ${c.entregaNumero}` : ""} — ${c.entregaBairro ?? ""}, ${c.entregaCidade ?? ""}/${c.entregaEstado ?? ""} · ${c.entregaCep ?? ""}`;
  return {
    clienteId: c.id,
    cnpj: c.cnpjFormatado,
    razaoSocial: c.razaoSocial,
    nomeFantasia: c.nomeFantasia,
    cidade: c.cidade,
    estado: c.estado,
    contatoNome: c.contatoNome,
    contatoEmail: c.contatoEmail,
    contatoTelefone: c.contatoTelefone,
    enderecoEntrega: endereco,
    premissasAplicadas: getPremissasVigentes(c),
  };
}

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

function CartPage() {
  const items = useOrder((s) => s.items);
  const meta = useOrder((s) => s.meta);
  const setMeta = useOrder((s) => s.setMeta);
  const updateQty = useOrder((s) => s.updateQty);
  const removeItem = useOrder((s) => s.removeItem);
  const saveOrder = useOrder((s) => s.saveOrder);
  const removeItems = useOrder((s) => s.removeItems);
  const clearCart = useOrder((s) => s.clearCart);
  const negotiationAtivo = useNegotiation((s) => s.ativo);
  const negDescontoPct = useNegotiation((s) => s.descontoPct);
  const negJustificativa = useNegotiation((s) => s.justificativa);
  const negObservacaoInterna = useNegotiation((s) => s.observacaoInterna);
  const negUsarReservada = useNegotiation((s) => s.usarReservada);
  const resetNegotiation = useNegotiation((s) => s.resetSession);
  const createProvisao = useProvisao((s) => s.createProvisao);
  const updateProvisaoStatus = useProvisao((s) => s.updateStatus);
  const criarCotacao = useCotacao((s) => s.criarCotacao);
  const atualizarCotacao = useCotacao((s) => s.atualizarCotacao);
  const navigate = useNavigate();

  const [commercial, setCommercial] = useState<CommercialState | null>(null);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const handleCommercialChange = useCallback((s: CommercialState) => setCommercial(s), []);

  // Split firme / provisao
  const { itensFirmes, itensProvisao } = useMemo(() => {
    const firmes: CartItem[] = [];
    const provisao: CartItem[] = [];
    items.forEach((i) => {
      if (classificarItem(i.product.statusEstoque) === "firme") firmes.push(i);
      else provisao.push(i);
    });
    return { itensFirmes: firmes, itensProvisao: provisao };
  }, [items]);

  const isMisto = itensFirmes.length > 0 && itensProvisao.length > 0;
  const apenasProvisao = itensFirmes.length === 0 && itensProvisao.length > 0;

  const totalFirme = cartTotal(itensFirmes);
  const totalProvisaoRef = cartTotal(itensProvisao);

  const groupedFirmes = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    itensFirmes.forEach((i) => {
      const key = i.product.colecao;
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [itensFirmes]);

  const handleSelectCliente = useCallback(
    (c: Cliente) => {
      setMeta({
        clienteId: c.id,
        cliente: c.razaoSocial,
        nomeFantasia: c.nomeFantasia,
        cnpj: c.cnpjFormatado,
        email: c.contatoEmail,
        telefone: c.contatoTelefone,
        logradouro: c.logradouro,
        numero: c.numero,
        complemento: c.complemento,
        bairro: c.bairro,
        municipio: c.cidade,
        uf: c.estado,
        cep: c.cep,
        situacao: c.situacaoCadastral,
        clienteSnapshot: undefined,
      });
    },
    [setMeta],
  );

  const handleClearCliente = useCallback(() => {
    setMeta({
      clienteId: undefined,
      clienteSnapshot: undefined,
      cliente: "",
      nomeFantasia: "",
      cnpj: "",
      email: "",
      telefone: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
      situacao: "",
    });
  }, [setMeta]);

  // Resolve cliente from clienteStore for snapshot (lazy read of localStorage)
  const resolveClienteSnapshot = useCallback((): ClienteSnapshot | null => {
    if (meta.clienteSnapshot) return meta.clienteSnapshot;
    if (!meta.clienteId || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("fetely_clientes_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const list: Cliente[] = parsed?.state?.clientes ?? [];
      const c = list.find((x) => x.id === meta.clienteId);
      return c ? buildClienteSnapshot(c) : null;
    } catch {
      return null;
    }
  }, [meta.clienteId, meta.clienteSnapshot]);

  const executeConfirm = async () => {
    if (salvandoPedido) return;
    const snapshot = resolveClienteSnapshot();
    if (!snapshot) return alert("Selecione um cliente cadastrado.");

    if (!commercial?.podeFinalizar || !commercial.calculo.faixa || !commercial.condicao) {
      return alert(commercial?.motivoBloqueio ?? "Revise o pedido.");
    }
    const c = commercial.calculo;
    const faixa = c.faixa!;
    const orderCommercial: OrderCommercial = {
      faixaId: faixa.id,
      faixaNome: faixa.nome,
      frete: c.freteEfetivo ?? faixa.frete,
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
      premissasAplicadas: !!c.premissasAplicadas,
      freteValor: c.freteValor ?? 0,
      fretePercent: c.fretePercent,
      freteIsento: c.freteIsento ?? false,
    };

    setSalvandoPedido(true);
    try {
      setMeta({ condicaoPagamento: commercial.condicao.descricao });
      let provisaoId: string | undefined;
      if (itensProvisao.length > 0) {
        const prov = await createProvisao({
          clienteId: meta.clienteId!,
          clienteSnapshot: snapshot,
          itens: itensProvisao.map(toItemProvisao),
          observacoes: meta.observacoes || undefined,
        });
        provisaoId = prov.id;
      }

      const order = await saveOrder(orderCommercial, itensFirmes);

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

      if (provisaoId) {
        updateProvisaoStatus(provisaoId, "aguardando_estoque", {
          pedidoFirmeId: order.id,
        });
      }

      if (meta.provisaoOrigemId) {
        updateProvisaoStatus(meta.provisaoOrigemId, "convertido_em_pedido", {
          pedidoConvertidoId: order.id,
        });
      }

      clearCart();
      resetNegotiation();
      setShowFinalConfirm(false);
      navigate({
        to: "/confirmation",
        search: provisaoId ? { id: order.id, provisaoId } : { id: order.id },
      });
    } catch (err: unknown) {
      console.error("Falha ao confirmar pedido:", err);
      const msg = err instanceof Error ? err.message : "Não foi possível salvar o pedido";
      toast.error(msg, {
        description: "Tente novamente. Se persistir, atualize a página.",
        duration: 6000,
      });
      setShowFinalConfirm(false);
      // NÃO limpa carrinho, NÃO navega — usuário tenta de novo
    } finally {
      setSalvandoPedido(false);
    }
  };

  const handleConfirm = () => {
    if (!meta.clienteId) return alert("Selecione um cliente cadastrado.");
    if (!commercial?.podeFinalizar || !commercial.calculo.faixa || !commercial.condicao) {
      return alert(commercial?.motivoBloqueio ?? "Revise o pedido.");
    }
    setShowFinalConfirm(true);
  };

  const handleSalvarCotacao = async () => {
    if (salvandoPedido) return;
    const snapshot = resolveClienteSnapshot();
    if (!snapshot) return alert("Selecione um cliente cadastrado.");
    if (!commercial?.calculo.faixa || !commercial.condicao) {
      return alert(commercial?.motivoBloqueio ?? "Revise o pedido.");
    }
    const c = commercial.calculo;
    const faixa = c.faixa!;
    const orderCommercial: OrderCommercial = {
      faixaId: faixa.id,
      faixaNome: faixa.nome,
      frete: c.freteEfetivo ?? faixa.frete,
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
      premissasAplicadas: !!c.premissasAplicadas,
      freteValor: c.freteValor ?? 0,
      fretePercent: c.fretePercent,
      freteIsento: c.freteIsento ?? false,
    };
    const metaCompleto = {
      ...meta,
      clienteSnapshot: snapshot,
      condicaoPagamento: commercial.condicao.descricao,
    };
    const cotacaoItems = [...itensFirmes, ...itensProvisao];
    const totalCotacao = orderCommercial.totalFinal + totalProvisaoRef;

    setSalvandoPedido(true);
    try {
      // Se está editando uma cotação existente, atualiza in-place
      const editandoId = (meta as OrderMeta & { cotacaoOrigemId?: string }).cotacaoOrigemId;
      if (editandoId) {
        const upd = await atualizarCotacao(editandoId, {
          items: cotacaoItems,
          meta: metaCompleto,
          total: totalCotacao,
          commercial: orderCommercial,
        });
        if (upd) {
          toast.success(`Cotação ${upd.id} atualizada`, {
            description: `Válida até ${new Date(upd.validoAte).toLocaleDateString("pt-BR")}`,
          });
          clearCart();
          resetNegotiation();
          setShowFinalConfirm(false);
          navigate({ to: "/cotacoes" });
          return;
        }
      }
      const cot = await criarCotacao({
        items: cotacaoItems,
        meta: metaCompleto,
        total: totalCotacao,
        commercial: orderCommercial,
      });

      toast.success(`Cotação ${cot.id} salva`, {
        description: `Válida até ${new Date(cot.validoAte).toLocaleDateString("pt-BR")}`,
      });
      clearCart();
      resetNegotiation();
      setShowFinalConfirm(false);
      navigate({ to: "/cotacoes" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível salvar a cotação";
      toast.error(msg, { duration: 6000 });
    } finally {
      setSalvandoPedido(false);
    }
  };



  // Salvar tudo como provisão (carrinho 100% previsão)
  const handleSaveOnlyProvisao = async () => {
    if (salvandoPedido) return;
    const snapshot = resolveClienteSnapshot();
    if (!snapshot) return alert("Selecione um cliente cadastrado.");
    setSalvandoPedido(true);
    try {
      const prov = await createProvisao({
        clienteId: meta.clienteId!,
        clienteSnapshot: snapshot,
        itens: itensProvisao.map(toItemProvisao),
        observacoes: meta.observacoes || undefined,
      });
      clearCart();
      resetNegotiation();
      navigate({ to: "/provisoes", search: { highlight: prov.id } as never });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível salvar a provisão";
      toast.error(msg, {
        description: "O carrinho foi mantido para você tentar novamente.",
        duration: 6000,
      });
    } finally {
      setSalvandoPedido(false);
    }
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
    <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-8 lg:py-10 pb-28 lg:pb-10">
      <div className="mb-4 sm:mb-6 lg:mb-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Revisão</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl mt-1 truncate">Carrinho do Pedido</h1>
        </div>
        <Link
          to="/new-order"
          className="flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-wider text-text-secondary hover:text-gold shrink-0"
        >
          <ArrowLeft className="h-3 w-3" /> <span className="hidden sm:inline">Continuar comprando</span><span className="sm:hidden">Voltar</span>
        </Link>
      </div>

      {meta.provisaoOrigemId && (
        <div className="mb-4 rounded-md border border-stock-pre/40 bg-stock-pre/10 px-3 py-2.5 sm:px-4 sm:py-3 text-xs text-stock-pre">
          ⚡ Estes itens vieram da Provisão <strong>{meta.provisaoOrigemId}</strong>. Verifique quantidades e condições antes de confirmar.
        </div>
      )}

      {isMisto && (
        <div className="mb-4 sm:mb-5">
          <MixedCartBanner
            firmeCount={itensFirmes.length}
            firmeTotal={totalFirme}
            provisaoCount={itensProvisao.length}
            provisaoTotal={totalProvisaoRef}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-5 lg:gap-7 xl:gap-8">

        <div className="space-y-4 sm:space-y-6">
          {groupedFirmes.length > 0 && (
            <div className="text-[10px] uppercase tracking-[0.25em] text-stock-in font-semibold">
              📦 Pedido firme — pronta entrega
            </div>
          )}
          {groupedFirmes.map(([col, group]) => {
            const sub = group.reduce(
              (s, i) => s + i.quantity * i.product.precoAtacado,
              0,
            );
            return (
              <section key={col} className="rounded-lg gold-border bg-surface overflow-hidden">
                <header className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-5 sm:py-3 border-b border-border bg-surface-2">
                  <div className="font-display text-base sm:text-xl truncate">{col}</div>
                  <div className="text-[11px] sm:text-xs text-text-secondary shrink-0">
                    <span className="hidden sm:inline">Subtotal: </span>
                    <span className="text-gold font-medium">{formatBRL(sub)}</span>
                  </div>
                </header>
                <ul>
                  {group.map((item) => (
                    <li
                      key={item.sku}
                      className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_140px_40px] sm:items-center gap-3 sm:gap-4 px-3 py-3 sm:px-5 sm:py-4 border-t border-border/50 first:border-t-0"
                    >
                      <div className="min-w-0 flex items-start justify-between gap-2 sm:block">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-text-primary line-clamp-2 sm:truncate">
                            {item.product.nomeComercial}
                          </div>
                          <div className="text-[10px] font-mono text-text-muted mt-0.5">
                            {item.product.sku} · Caixa {item.product.multiplos}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.sku)}
                          className="sm:hidden text-text-muted hover:text-stock-out p-2 -mr-2 -mt-1 shrink-0"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:contents">
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
                          className="hidden sm:block text-text-muted hover:text-stock-out p-2"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {itensProvisao.length > 0 && <ProvisaoSection items={itensProvisao} />}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {!apenasProvisao && (
            <CartCommercialPanel bruto={totalFirme} onChange={handleCommercialChange} />
          )}

          {apenasProvisao && (
            <div className="rounded-lg border border-stock-pre/40 bg-stock-pre/5 p-4 sm:p-5 space-y-2">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-stock-pre font-semibold">
                ⚠ Carrinho 100% previsão
              </h3>
              <p className="text-sm text-text-secondary">
                Todos os itens estão com previsão de estoque. Não é possível gerar um pedido firme agora.
              </p>
              <p className="text-xs text-text-muted">
                Salve como provisão futura para faturamento quando o estoque liberar.
              </p>
              <div className="text-xs text-text-muted">
                Referência: <span className="text-stock-pre font-medium">{formatBRL(totalProvisaoRef)}</span>
              </div>
            </div>
          )}

          <div className="rounded-lg gold-border bg-surface p-4 sm:p-5 space-y-4">
            <h2 className="font-display text-xl sm:text-2xl">Dados do pedido</h2>


            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">
                Cliente *
              </div>
              <ClienteSelector
                selectedId={meta.clienteId}
                onSelect={handleSelectCliente}
                onClear={handleClearCliente}
              />
            </div>

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

          <div className="rounded-lg gold-border bg-surface p-4 sm:p-5">
            {apenasProvisao ? (
              <>
                <p className="mb-3 text-xs text-stock-pre">
                  Todos os itens são de previsão. Salve como provisão futura.
                </p>
                <button
                  onClick={handleSaveOnlyProvisao}
                  disabled={!meta.clienteId || salvandoPedido}
                  className="w-full rounded-md border border-stock-pre/60 bg-stock-pre/15 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-stock-pre hover:bg-stock-pre/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {salvandoPedido ? "Salvando..." : "Salvar como Provisão →"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Descartar todo o carrinho?")) {
                      clearCart();
                      resetNegotiation();
                    }
                  }}
                  className="mt-2 w-full text-[10px] uppercase tracking-wider text-text-muted hover:text-stock-out"
                >
                  Descartar
                </button>
              </>
            ) : (
              <>
                {commercial?.motivoBloqueio && (
                  <p className="mb-3 text-xs text-stock-out">
                    {!commercial.calculo.faixa && isMisto
                      ? `O valor dos itens em estoque (${formatBRL(totalFirme)}) está abaixo do pedido mínimo. Os itens de previsão não contam para este cálculo.`
                      : commercial.motivoBloqueio}
                  </p>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={!commercial?.podeFinalizar || salvandoPedido}
                  className="w-full rounded-md bg-gold py-3 text-xs font-semibold uppercase tracking-[0.18em] text-background hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {salvandoPedido ? "Salvando..." : isMisto ? "Confirmar pedido + provisão" : "Confirmar pedido"}
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
                {isMisto && (
                  <button
                    onClick={() => {
                      if (confirm("Remover todos os itens de previsão do carrinho?")) {
                        removeItems(itensProvisao.map((i) => i.sku));
                      }
                    }}
                    className="mt-1 w-full text-[10px] uppercase tracking-wider text-text-muted hover:text-stock-pre"
                  >
                    Remover só os itens de previsão
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Sticky mobile/tablet bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gold/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 py-3 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.5)]">
        <div className="mx-auto max-w-[1400px] flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.2em] text-text-muted">
              {apenasProvisao ? "Referência" : commercial?.calculo.aplicouPix ? "Valor com PIX" : "Total"}
            </div>
            <div className="font-display text-xl text-gold truncate leading-tight">
              {formatBRL(
                apenasProvisao
                  ? totalProvisaoRef
                  : commercial?.calculo.total ?? totalFirme,
              )}
            </div>
          </div>
          {apenasProvisao ? (
            <button
              onClick={handleSaveOnlyProvisao}
              disabled={!meta.clienteId || salvandoPedido}
              className="shrink-0 rounded-md border border-stock-pre/60 bg-stock-pre/15 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-stock-pre disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvandoPedido ? "Salvando..." : "Salvar Provisão"}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!commercial?.podeFinalizar || salvandoPedido}
              className="shrink-0 rounded-md bg-gold px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-background disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvandoPedido ? "Salvando..." : "Confirmar"}
            </button>
          )}
        </div>
      </div>


      {showFinalConfirm && commercial?.calculo.faixa && commercial.condicao && (
        <FinalConfirmModal
          data={{
            firmeCount: itensFirmes.length,
            firmeTotal: commercial.calculo.total,
            faixaNome: commercial.calculo.faixa.nome,
            condicaoDescricao: commercial.condicao.descricao,
            frete: commercial.calculo.faixa.frete,
            provisaoCount: itensProvisao.length,
            provisaoTotal: totalProvisaoRef,
            proximaPrevisao: Array.from(
              new Set(itensProvisao.map((i) => extrairDataPrevisao(i.product.statusEstoque))),
            ).sort(compararPrevisao)[0],
          }}
          onConfirmPedido={executeConfirm}
          onSalvarCotacao={handleSalvarCotacao}
          onCancel={() => setShowFinalConfirm(false)}
          loading={salvandoPedido}
        />
      )}

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
