import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, X } from "lucide-react";
import { brl, type Pendencia } from "@/lib/balcaoPedido";
import { ProdutoThumb } from "./ProdutoThumb";
import { PAGAMENTO_ICON } from "./PagamentoCard";
import { entregaLabel } from "./EntregaCard";
import type { Item, MeioPagamento, ModoEntrega } from "./types";
import { resumoPagamentoB2c } from "@/lib/balcaoPagamento";

export function ResumoPedido({ cliente, itens, valorItens, desconto, motivoDesconto, frete, modo, cd, total, pagamento, parcelas,
  pendencia, onPendencia, onSubmit, disabled, enviando, edicao, somenteLeitura, motivo, onMotivo, pagamentoRefeito, onCancelar, temConteudo }: {
  cliente: string; itens: Item[]; valorItens: number; desconto: number; motivoDesconto: string; frete: number | null; modo: ModoEntrega; cd: string;
  total: number; pagamento: MeioPagamento | null; parcelas: number; pendencia: Pendencia | null; onPendencia: () => void;
  onSubmit: () => void; disabled: boolean; enviando: boolean; edicao: boolean; somenteLeitura: boolean; motivo: string; onMotivo: (v: string) => void; pagamentoRefeito?: string;
  onCancelar?: () => void; temConteudo?: boolean;
}) {
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const mostrarCancelar = !!onCancelar && !edicao;
  const pedirCancelamento = () => {
    if (!onCancelar) return;
    if (temConteudo) setConfirmarCancelamento(true);
    else onCancelar();
  };
  const Icon = pagamento ? PAGAMENTO_ICON[pagamento] : null;
  const textoMeio = resumoPagamentoB2c(pagamento, modo === "balcao", parcelas);
  const botao = somenteLeitura ? "Somente leitura" : edicao ? "Salvar alterações" : "Criar pedido";
  const acao = <div onClick={() => { if (pendencia && !enviando) onPendencia(); }}><Button size="lg" className="h-11 w-full px-4" disabled={disabled} onClick={onSubmit}>{enviando && <Loader2 className="animate-spin" />}{botao}</Button></div>;
  return <>
    <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <Card id="balcao-card-resumo" className="rounded-lg scroll-mt-4">
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base tracking-normal">Resumo do pedido</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <p className={cliente ? "break-words font-medium" : "text-sm text-muted-foreground"}>{cliente || "Cliente não selecionado"}</p>
          <ul className="max-h-80 space-y-3 overflow-y-auto">{itens.map(i => <li key={i.sku} className="flex items-start gap-2"><ProdutoThumb colecao={i.colecao} corNome={i.cor_nome} sku={i.sku} nome={i.nome} /><span className="min-w-0 flex-1 text-sm">{i.quantidade}× {i.cod_cadastro ?? i.sku} {i.nome}</span><span className="shrink-0 text-sm font-medium">{brl(i.quantidade * i.preco_varejo)}</span></li>)}</ul>
          <Separator />
          <div className="space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Itens ({itens.reduce((s, i) => s + i.quantidade, 0)} peças)</span><span>{brl(valorItens)}</span></div>
            {desconto > 0 && <div className="flex justify-between gap-3"><span className="min-w-0 text-muted-foreground">Desconto{motivoDesconto && <small className="block break-words">{motivoDesconto}</small>}</span><span className="shrink-0 text-success">− {brl(desconto)}</span></div>}
            <div className="flex justify-between gap-3"><span className="min-w-0 text-muted-foreground">Frete <small className="block">{entregaLabel(modo, cd)}</small></span><span className="shrink-0">{frete == null ? "—" : modo === "balcao" ? "Sem frete" : frete === 0 ? "Grátis" : brl(frete)}</span></div>
          </div>
          <Separator />
          <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium">Total</span><span className="text-3xl font-semibold">{brl(total)}</span></div>
          {pagamento === "bonificacao" && <p className="text-xs text-muted-foreground">Prévia · valor final calculado pelo SNCF</p>}
          <p className="flex items-center gap-2 text-sm text-muted-foreground">{Icon && <Icon className="h-4 w-4 shrink-0" />}{textoMeio}</p>
          {pagamentoRefeito && <p role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">{pagamentoRefeito}</p>}
          {edicao && !somenteLeitura && <div className="space-y-1.5"><Label htmlFor="balcao-motivo-alteracao">Motivo da alteração *</Label><Textarea id="balcao-motivo-alteracao" rows={2} value={motivo} onChange={e => onMotivo(e.target.value)} disabled={enviando} /></div>}
          {pendencia && <Button variant="link" className="h-auto w-full justify-start whitespace-normal p-0 text-left text-sm text-destructive" onClick={onPendencia}>{pendencia.mensagem}</Button>}
          <div className="hidden lg:block">{acao}{mostrarCancelar && (
            <Button variant="outline" className="mt-2 h-11 w-full px-4" disabled={enviando} onClick={pedirCancelamento}>
              Cancelar pedido
            </Button>
          )}</div>
        </CardContent>
      </Card>
    </aside>
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 md:bottom-0 lg:hidden">
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-semibold">{brl(total)}</p></div>
        {mostrarCancelar && (
          <Button variant="ghost" size="sm" aria-label="Cancelar pedido" className="h-9 shrink-0 gap-1 px-2 text-xs text-muted-foreground" disabled={enviando} onClick={pedirCancelamento}>
            <X className="h-4 w-4 shrink-0" />
            Cancelar
          </Button>
        )}
        <div className="min-w-0 max-w-[60%]">{acao}</div>
      </div>
    </div>
    {mostrarCancelar && (
      <AlertDialog open={confirmarCancelamento} onOpenChange={setConfirmarCancelamento}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens e o cliente serão descartados. O CD selecionado é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmarCancelamento(false);
                onCancelar?.();
              }}
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
  </>;
}