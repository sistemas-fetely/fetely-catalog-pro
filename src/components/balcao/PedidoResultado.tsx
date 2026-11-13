import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Copy, Loader2, MessageCircle, ShoppingBag } from "lucide-react";
import { balcao } from "@/hooks/useBalcao";
import { brl, vendaImediataConcluida } from "@/lib/balcaoPedido";
import { entregaLabel } from "./EntregaCard";
import type { MeioPagamento, ModoEntrega, OpcaoEntrega, PagamentoDeclarado, PedidoCriado } from "./types";

export function PedidoResultado({ criado, pagamento, clienteNome, clienteTelefone, modo, cd, opcao, edicao, resultadoEdicao,
  totalAnterior, gerandoLink, onGerarLink, onNovo, onAbrir, onFechar, erro }: {
  criado: PedidoCriado; pagamento: MeioPagamento | null; clienteNome: string; clienteTelefone: string | null;
  modo: ModoEntrega; cd: string; opcao: OpcaoEntrega | null; edicao: boolean; resultadoEdicao: Record<string, unknown> | null;
  totalAnterior?: number; gerandoLink: boolean; onGerarLink: () => void; onNovo?: () => void; onAbrir: () => void; onFechar: () => void; erro?: string;
}) {
  const bonif = pagamento === "bonificacao";
  const maquininha = pagamento === "cartao_maquininha";
  const imediato = modo === "balcao";
  const [declarado, setDeclarado] = useState<PagamentoDeclarado | null>(null);
  const [declarando, setDeclarando] = useState(false);
  const [erroPagamento, setErroPagamento] = useState("");
  const [qrPix, setQrPix] = useState("");
  const [erroQr, setErroQr] = useState("");
  const vendido = vendaImediataConcluida(modo, pagamento, declarado !== null);
  useEffect(() => {
    setDeclarado(null); setDeclarando(false); setErroPagamento("");
  }, [criado.pedido_id]);
  useEffect(() => {
    let cancelado = false;
    setQrPix(""); setErroQr("");
    if (!imediato || pagamento !== "pix" || !criado.pix_copia_cola || vendido) return;
    const texto = criado.pix_copia_cola;
    void import("qrcode").then(mod => mod.default.toDataURL(texto, { width: 280, margin: 2 })).then(url => {
      if (!cancelado) setQrPix(url);
    }).catch(() => { if (!cancelado) setErroQr("Não foi possível exibir o QR. Use o PIX copia e cola."); });
    return () => { cancelado = true; };
  }, [imediato, pagamento, criado.pix_copia_cola, vendido]);
  const declararPagamento = async () => {
    if (!imediato || pagamento !== "pix" || vendido || declarando) return;
    setDeclarando(true); setErroPagamento("");
    try {
      const resposta = await balcao<PagamentoDeclarado>("balcao_declarar_pagamento", { pedido_id: criado.pedido_id });
      setDeclarado(resposta);
      toast.success(`Pedido ${resposta.id_externo} vendido`);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro ao declarar pagamento";
      setErroPagamento(mensagem); toast.error(mensagem);
    } finally { setDeclarando(false); }
  };
  const copiar = (texto: string) => { void navigator.clipboard.writeText(texto).then(() => toast.success("Copiado")).catch(() => toast.error("Não foi possível copiar")); };
  return <Card data-balcao-evento={imediato ? "true" : undefined} className="mx-auto max-w-3xl rounded-lg border-primary/40">
    <CardHeader><CardTitle className="break-words text-lg tracking-normal">{vendido ? `${declarado?.id_externo ?? criado.id_externo} vendido — cliente pode levar` : `${criado.id_externo} ${edicao ? "atualizado" : "criado"} — ${bonif ? "bonificado" : "aguardando pagamento"}`}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <p className="text-2xl font-semibold">{brl(criado.valor_total)}</p>
      <p className="text-sm text-muted-foreground">{imediato ? "Entrega imediata — cliente leva agora · Sem frete" : <>Frete: {entregaLabel(modo, cd)} · {opcao ? opcao.frete_cobrado === 0 ? "Grátis" : brl(opcao.frete_cobrado) : "—"}{opcao?.prazo_dias != null ? ` · prazo ${opcao.prazo_dias}d` : ""}</>}</p>
      {vendido && <p role="status" className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="h-5 w-5 shrink-0" />A NF chega por e-mail ao cliente em alguns minutos</p>}
      {imediato && pagamento === "cartao" && <p role="status" className="text-sm text-muted-foreground">Aguardando a confirmação do Safra</p>}
      {edicao && resultadoEdicao && (resultadoEdicao.pagamento_refeito === true || criado.link_pagamento || criado.pix_copia_cola) && <p role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">Total mudou de {brl(Number(resultadoEdicao.valor_anterior ?? totalAnterior))} para {brl(criado.valor_total)} — envie o novo link/PIX ao cliente</p>}
      {criado.endereco_gravado_no_cadastro && <p className="text-sm text-muted-foreground">Endereço salvo no cadastro do cliente</p>}
      {bonif && <p className="rounded-md border border-info/40 bg-info/10 p-3 text-sm text-info">Pedido bonificado criado — segue para faturamento</p>}
      {maquininha && !imediato && <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">Aguardando comprovante da maquininha — passe o cartão e anexe o comprovante no SNCF › Pedidos Site SP para liberar o pedido.</p>}
      {!bonif && !maquininha && !vendido && criado.link_pagamento && <div className="space-y-2"><Label htmlFor="resultado-link">Link de pagamento</Label><Input id="resultado-link" readOnly value={criado.link_pagamento} /><div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => copiar(criado.link_pagamento ?? "")}><Copy />Copiar link</Button>
        <Button asChild><a href={`https://wa.me/55${(clienteTelefone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${clienteNome}! Seu pedido ${criado.id_externo} na Fetély ficou em ${brl(criado.valor_total)}. Pague por aqui: ${criado.link_pagamento}`)}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>
      </div></div>}
      {!bonif && !maquininha && !vendido && criado.pix_copia_cola && <div className="space-y-3">
        {imediato && <div className="flex min-h-60 justify-center">{qrPix ? <img src={qrPix} alt="QR do PIX" width={280} height={280} className="h-auto w-60 max-w-full rounded-md border" /> : erroQr ? <p role="alert" className="text-sm text-destructive">{erroQr}</p> : <Loader2 aria-label="Carregando QR do PIX" className="h-6 w-6 animate-spin self-center" />}</div>}
        <Label htmlFor="resultado-pix">PIX copia e cola</Label><Input id="resultado-pix" readOnly value={criado.pix_copia_cola} className="font-mono text-xs" /><Button variant="outline" className={imediato ? "h-12 w-full" : ""} onClick={() => copiar(criado.pix_copia_cola ?? "")}><Copy />Copiar PIX</Button>
      </div>}
      {imediato && pagamento === "pix" && !vendido && <Button size="lg" className="h-14 w-full text-base" disabled={declarando} onClick={() => void declararPagamento()}>{declarando ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Cliente pagou</Button>}
      {erroPagamento && <p role="alert" className="text-sm text-destructive">{erroPagamento}</p>}
      {!bonif && !maquininha && !vendido && criado.link_erro && <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><p>{criado.link_erro}</p><Button variant="outline" onClick={onGerarLink} disabled={gerandoLink}>{gerandoLink && <Loader2 className="animate-spin" />}Gerar link de novo</Button></div>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {!!criado.avisos?.length && <ul className="list-disc space-y-1 pl-5 text-sm text-warning">{criado.avisos.map((a, i) => <li key={i}>{a.aviso}</li>)}</ul>}
      <div className={`flex flex-wrap gap-2 ${imediato ? "flex-col sm:flex-row" : ""}`}><Button onClick={onNovo} variant={imediato ? "default" : "outline"} size={imediato ? "lg" : "default"} className={imediato ? "h-14 w-full text-base" : ""} disabled={declarando}>{imediato && <ShoppingBag />}{imediato ? "Próxima venda" : "Novo pedido"}</Button><Button onClick={onAbrir} variant={imediato ? "outline" : "default"} disabled={declarando}>Voltar ao pedido</Button><Button onClick={onFechar} variant="ghost" disabled={declarando}>Fechar</Button></div>
    </CardContent>
  </Card>;
}