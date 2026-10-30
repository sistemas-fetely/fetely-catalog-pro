import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { useB2BAdjustment, refreshAdjustedOrder } from "@/store/b2bAdjustmentStore";
import { useOrder, cartTotal } from "@/store/orderStore";
import { useCatalog } from "@/store/catalogStore";
import { useClientes } from "@/store/clienteStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { calcularPedido, CONDICOES_PAGAMENTO, fatorDescontoItens } from "@/lib/commercial";
import { getPremissasVigentes } from "@/lib/premissas";
import { adjustmentItems, canAdjustFreight, submitAdjustment } from "@/lib/b2bAdjustment";
import { formatBRL } from "@/lib/format";

export function B2BAdjustmentPanel({ cartMode = false }: { cartMode?: boolean }) {
  const { target, permissions, close } = useB2BAdjustment();
  const navigate = useNavigate();
  const items = useOrder(s => s.items);
  const products = useCatalog(s => s.products);
  const clientes = useClientes(s => s.clientes);
  const photos = usePhotos();
  const [motivos, setMotivos] = useState({ itens: "", frete: "", pagamento: "" });
  const [frete, setFrete] = useState(String(permissions?.frete.valor ?? ""));
  const [condicao, setCondicao] = useState(permissions?.condicao_atual ?? "");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ warning: boolean; message: string } | null>(null);
  const currentItems = useMemo(() => items.map(i => ({ ...i, product: products.find(p => p.sku === i.sku) ?? i.product })), [items, products]);
  const customer = clientes.find(c => c.id === target?.meta.clienteId);
  const calculation = calcularPedido({ bruto: cartTotal(currentItems), premissas: getPremissasVigentes(customer ?? null),
    ignorarPedidoMinimo: true, condicao: CONDICOES_PAGAMENTO.find(c => c.id === target?.commercial?.condicaoId),
    aplicarDescontoCelebra: (target?.commercial?.descontoCelebraPct ?? 0) > 0,
    descontoMasterPct: target?.commercial?.descontoMasterPct, aplicarBonusPix: target?.commercial?.aplicouPix });
  const serialized = adjustmentItems(currentItems, fatorDescontoItens(calculation));
  if (!target || !permissions) return null;

  const send = async (kind: "itens" | "frete" | "pagamento") => {
    if (busy) return;
    const allowed = kind === "itens" ? permissions.editar_itens === true : kind === "frete" ? canAdjustFreight(permissions) : permissions.editar_pagamento === true;
    if (!allowed) return;
    setBusy(true);
    try {
      const tipo = kind === "itens" ? "b2b_editar_itens" : kind === "frete" ? "b2b_frete" : "b2b_trocar_pagamento";
      const body = kind === "itens" ? { itens: serialized } : kind === "frete" ? { valor_frete: Number(frete) } : { condicao_slug: condicao };
      const result = await submitAdjustment(tipo, { pedido_id: target.sncfPedidoId, motivo: motivos[kind], ...body });
      const warning = result.resultado === "enviado_reanalise";
      const message = warning ? `Ajuste registrado. O pedido voltou para a análise de crédito. ${result.mensagem}` : result.mensagem;
      setNotice({ warning, message });
      if (warning) toast.warning("Ajuste registrado. O pedido voltou para a análise de crédito", { description: result.mensagem });
      else toast.success(result.mensagem);
      setMotivos(m => ({ ...m, [kind]: "" }));
      try {
        await refreshAdjustedOrder(target);
      } catch (error) {
        toast.warning("Ajuste salvo; não foi possível atualizar a consulta", { description: error instanceof Error ? error.message : String(error) });
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const reason = (kind: keyof typeof motivos) => <label className="block text-sm mt-3">Motivo do ajuste
    <textarea aria-label={`Motivo do ajuste de ${kind}`} className="input mt-1" rows={2} value={motivos[kind]} onChange={e => setMotivos(m => ({ ...m, [kind]: e.target.value }))} />
  </label>;
  return <div className="space-y-5">
    <header><h1 className="font-display text-2xl">Ajustar pedido {target.id}</h1><p className="text-sm text-text-secondary">{target.meta.cliente} · {formatBRL(target.total)}</p></header>
    {notice && <p role="status" className={notice.warning ? "border border-stock-pre p-3 text-stock-pre" : "border border-stock-in p-3 text-stock-in"}>{notice.message}</p>}
    <section className="border-t border-border pt-4">
      <h2 className="font-display text-xl">Itens</h2>
      {!permissions.editar_itens && <p className="text-sm text-text-muted">{permissions.motivo_bloqueio || "Edição de itens não autorizada pelo SNCF."}</p>}
      {cartMode ? <fieldset disabled={!permissions.editar_itens || busy} className="space-y-3 mt-3">
        <label className="block text-sm">Buscar produto<input className="input mt-1" value={query} onChange={e => setQuery(e.target.value)} /></label>
        {query.trim().length > 1 && <div className="max-h-48 overflow-y-auto">{products.filter(p => `${p.sku} ${p.nomeComercial}`.toLowerCase().includes(query.toLowerCase())).slice(0, 15).map(p => <Button key={p.sku} variant="ghost" className="w-full justify-between" onClick={() => { useOrder.getState().addItem(p, 1); setQuery(""); }}>{p.sku} · {p.nomeComercial}</Button>)}</div>}
        <ul className="divide-y divide-border">{currentItems.map((item, index) => {
          const photo = getProdutoPhoto(photos, item.product.colecao, item.sku);
          return <li key={item.sku} className="flex flex-wrap items-center gap-3 py-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-2">{photo ? <img src={photo} alt={item.product.nomeComercial} className="h-full w-full object-cover" /> : <PhotoPlaceholder colecao={item.product.colecao} className="h-full w-full" showIcon={false} />}</div>
            <div className="min-w-0 flex-1"><p className="text-sm break-words">{item.product.nomeComercial}</p><p className="text-xs text-text-muted">{item.sku} · {formatBRL(serialized[index]?.valor_unitario ?? 0)} un.</p></div>
            <QuantityInput value={item.quantity} multiplos={item.product.multiplos} onChange={quantity => useOrder.setState(s => ({ items: s.items.map(i => i.sku === item.sku ? { ...i, quantity } : i) }))} compact />
            <Button variant="ghost" size="icon" title="Remover item" aria-label={`Remover ${item.sku}`} onClick={() => useOrder.getState().removeItem(item.sku)}><Trash2 /></Button>
          </li>;
        })}</ul>
        <p className="text-sm">Faixa: {calculation.faixa?.nome ?? "—"} · Itens: {formatBRL(serialized.reduce((sum, i) => sum + i.quantidade * i.valor_unitario, 0))}</p>
        {reason("itens")}
        <Button disabled={busy || motivos.itens.trim().length < 3} onClick={() => void send("itens")}>Salvar ajuste</Button>
      </fieldset> : <Button className="mt-3" disabled={!permissions.editar_itens || busy} onClick={async () => {
        const [full] = await useOrder.getState().ensureItemsFor([target.id]);
        if (!full) { toast.error("Não foi possível carregar os itens do pedido."); return; }
        useOrder.getState().clearCart();
        useOrder.setState({ items: full.items, meta: { ...full.meta } });
        await navigate({ to: "/cart" });
      }}>Ajustar itens no carrinho</Button>}
    </section>
    <section className="border-t border-border pt-4"><h2 className="font-display text-xl">Frete</h2>
      <p className="text-sm text-text-secondary">Atual: {formatBRL(permissions.frete.valor)} · {permissions.frete.tipo}</p>
      {permissions.frete.contratado_pelo_cliente && <p className="text-sm text-text-muted">Frete contratado pelo cliente</p>}
      <fieldset disabled={!canAdjustFreight(permissions) || busy}>
        <label className="block text-sm mt-3">Novo valor total do frete<input aria-label="Novo valor total do frete" type="number" step="0.01" className="input mt-1" value={frete} onChange={e => setFrete(e.target.value)} /></label>
        {reason("frete")}<Button className="mt-3" disabled={busy || motivos.frete.trim().length < 3 || frete === ""} onClick={() => void send("frete")}>Salvar frete</Button>
      </fieldset>
    </section>
    <section className="border-t border-border pt-4"><h2 className="font-display text-xl">Pagamento</h2>
      <fieldset disabled={!permissions.editar_pagamento || busy} className="mt-3">
        {permissions.condicoes.map(c => <label key={c.slug} className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="b2b-condition" value={c.slug} checked={condicao === c.slug} onChange={() => setCondicao(c.slug)} />{c.rotulo}</label>)}
        {reason("pagamento")}<Button className="mt-3" disabled={busy || motivos.pagamento.trim().length < 3 || !condicao} onClick={() => void send("pagamento")}>Salvar pagamento</Button>
      </fieldset>
    </section>
    <footer className="flex flex-wrap gap-3 border-t border-border pt-4">
      <Button variant="outline" disabled={busy} onClick={() => { if (cartMode) useOrder.getState().clearCart(); close(); if (cartMode) void navigate({ to: "/orders" }); }}>Voltar aos pedidos</Button>
      <Link to="/confirmation" search={{ id: target.id }} className="text-sm text-gold py-2">Ver pedido</Link>
    </footer>
  </div>;
}