import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, MessageCircle } from "lucide-react";
import { brl } from "@/lib/balcaoPedido";
import { entregaLabel } from "./EntregaCard";
import type { MeioPagamento, ModoEntrega, OpcaoEntrega, PedidoCriado } from "./types";

export function PedidoResultado({ criado, pagamento, clienteNome, clienteTelefone, modo, cd, opcao, edicao, resultadoEdicao,
  totalAnterior, gerandoLink, onGerarLink, onNovo, onAbrir, onFechar, erro }: {
  criado: PedidoCriado; pagamento: MeioPagamento | null; clienteNome: string; clienteTelefone: string | null;
  modo: ModoEntrega; cd: string; opcao: OpcaoEntrega | null; edicao: boolean; resultadoEdicao: Record<string, unknown> | null;
  totalAnterior?: number; gerandoLink: boolean; onGerarLink: () => void; onNovo?: () => void; onAbrir: () => void; onFechar: () => void; erro?: string;
}) {
  const bonif = pagamento === "bonificacao";
  const maquininha = pagamento === "cartao_maquininha";
  const copiar = (texto: string) => { void navigator.clipboard.writeText(texto).then(() => toast.success("Copiado")).catch(() => toast.error("Não foi possível copiar")); };
  return <Card className="mx-auto max-w-3xl rounded-lg border-primary/40">
    <CardHeader><CardTitle className="text-lg tracking-normal">{criado.id_externo} {edicao ? "atualizado" : "criado"} — {bonif ? "bonificado" : "aguardando pagamento"}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <p className="text-2xl font-semibold">{brl(criado.valor_total)}</p>
      <p className="text-sm text-muted-foreground">Frete: {entregaLabel(modo, cd)} · {opcao ? opcao.frete_cobrado === 0 ? "Grátis" : brl(opcao.frete_cobrado) : "—"}{opcao?.prazo_dias != null ? ` · prazo ${opcao.prazo_dias}d` : ""}</p>
      {edicao && resultadoEdicao && (resultadoEdicao.pagamento_refeito === true || criado.link_pagamento || criado.pix_copia_cola) && <p role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">Total mudou de {brl(Number(resultadoEdicao.valor_anterior ?? totalAnterior))} para {brl(criado.valor_total)} — envie o novo link/PIX ao cliente</p>}
      {criado.endereco_gravado_no_cadastro && <p className="text-sm text-muted-foreground">Endereço salvo no cadastro do cliente</p>}
      {bonif && <p className="rounded-md border border-info/40 bg-info/10 p-3 text-sm text-info">Pedido bonificado criado — segue para faturamento</p>}
      {maquininha && <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">Aguardando comprovante da maquininha — passe o cartão e anexe o comprovante no SNCF › Pedidos Site SP para liberar o pedido.</p>}
      {!bonif && !maquininha && criado.link_pagamento && <div className="space-y-2"><Label htmlFor="resultado-link">Link de pagamento</Label><Input id="resultado-link" readOnly value={criado.link_pagamento} /><div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => copiar(criado.link_pagamento ?? "")}><Copy />Copiar link</Button>
        <Button asChild><a href={`https://wa.me/55${(clienteTelefone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${clienteNome}! Seu pedido ${criado.id_externo} na Fetély ficou em ${brl(criado.valor_total)}. Pague por aqui: ${criado.link_pagamento}`)}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>
      </div></div>}
      {!bonif && !maquininha && criado.pix_copia_cola && <div className="space-y-2"><Label htmlFor="resultado-pix">PIX copia e cola</Label><Input id="resultado-pix" readOnly value={criado.pix_copia_cola} className="font-mono text-xs" /><Button variant="outline" onClick={() => copiar(criado.pix_copia_cola ?? "")}><Copy />Copiar PIX</Button></div>}
      {!bonif && !maquininha && criado.link_erro && <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><p>{criado.link_erro}</p><Button variant="outline" onClick={onGerarLink} disabled={gerandoLink}>{gerandoLink && <Loader2 className="animate-spin" />}Gerar link de novo</Button></div>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {!!criado.avisos?.length && <ul className="list-disc space-y-1 pl-5 text-sm text-warning">{criado.avisos.map((a, i) => <li key={i}>{a.aviso}</li>)}</ul>}
      <div className="flex flex-wrap gap-2"><Button onClick={onNovo} variant="outline">Novo pedido</Button><Button onClick={onAbrir}>Voltar ao pedido</Button><Button onClick={onFechar} variant="ghost">Fechar</Button></div>
    </CardContent>
  </Card>;
}