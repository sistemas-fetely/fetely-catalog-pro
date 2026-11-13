import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Gift, QrCode, Smartphone } from "lucide-react";
import type { MeioPagamento } from "./types";

export const PAGAMENTO_ICON = { pix: QrCode, cartao: CreditCard, cartao_maquininha: Smartphone, bonificacao: Gift };
const labels = { pix: "PIX", cartao: "Cartão link", cartao_maquininha: "Cartão maquininha", bonificacao: "Bonificação" };
export function PagamentoCard({ pagamento, onPagamento, onSairBonificacao, edicao, modoBalcao = false, nsu = "", onNsu, disabled, parcelas, onParcelas, autorizado, onAutorizado, motivo, onMotivo, observacao, onObservacao, motivos, carregandoMotivos, erroMotivos }: {
  pagamento: MeioPagamento | null; onPagamento: (p: MeioPagamento) => void; onSairBonificacao: () => void; edicao: boolean; disabled: boolean;
  parcelas: number; onParcelas: (n: number) => void; autorizado: string; onAutorizado: (v: string) => void;
  motivo: string; onMotivo: (v: string) => void; observacao: string; onObservacao: (v: string) => void;
  motivos: { codigo: string; nome: string }[]; carregandoMotivos: boolean; erroMotivos?: string;
  modoBalcao?: boolean; nsu?: string; onNsu?: (v: string) => void;
}) {
  const bonif = pagamento === "bonificacao" && !modoBalcao;
  return <Card id="balcao-card-pagamento" className="rounded-lg scroll-mt-4">
    <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base tracking-normal">Pagamento</CardTitle></CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      {bonif ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm"><Gift className="h-4 w-4" />Sem pagamento — bonificação</p>{!edicao && <Button variant="outline" onClick={onSairBonificacao} disabled={disabled}>Alterar condição</Button>}</div> :
        <RadioGroup value={pagamento ?? ""} onValueChange={v => onPagamento(v as MeioPagamento)} disabled={disabled} aria-label="Meio de pagamento" className={`grid gap-3 sm:grid-cols-2 ${modoBalcao ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {(["pix", "cartao", "cartao_maquininha", "bonificacao"] as const).filter(p => p !== "bonificacao" || !edicao && !modoBalcao).map(p => {
            const Icon = PAGAMENTO_ICON[p];
            const legenda = { pix: modoBalcao ? "QR na tela · cliente pagou" : "QR code · link Safrapay", cartao: `Link Safrapay · até ${parcelas}x`, cartao_maquininha: modoBalcao ? "Pagou na maquininha? Digite o NSU do comprovante." : "Passa na loja · sem link · anexar o comprovante", bonificacao: "Sem cobrança · direto para faturamento" }[p];
            return <Label key={p} htmlFor={`pagamento-${p}`} className={`flex min-h-36 min-w-0 cursor-pointer flex-col items-start gap-2 rounded-md border p-3 leading-normal ${pagamento === p ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
              <span className="flex w-full justify-between gap-2"><Icon className="h-5 w-5 text-primary" /><RadioGroupItem id={`pagamento-${p}`} value={p} /></span>
              <span className="text-sm font-medium">{labels[p]}</span><span className="text-xs font-normal text-muted-foreground">{legenda}</span>
            </Label>;
          })}
        </RadioGroup>}
      {modoBalcao && pagamento === "cartao_maquininha" && <div className="space-y-1.5">
        <Label htmlFor="balcao-nsu">NSU da maquininha *</Label>
        <Input id="balcao-nsu" className="h-12" value={nsu} onChange={e => onNsu?.(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} required disabled={disabled} />
        <p className="text-sm text-muted-foreground">Pagou na maquininha? Digite o NSU do comprovante.</p>
      </div>}
      {!edicao && pagamento === "cartao" && <div className="max-w-40 space-y-1.5"><Label>Parcelas</Label><Select value={String(parcelas)} onValueChange={v => onParcelas(Number(v))} disabled={disabled}><SelectTrigger aria-label="Parcelas"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent></Select></div>}
      {!edicao && bonif && <div className="space-y-4 rounded-md border border-info/40 bg-info/10 p-3">
        <p className="text-sm text-info">Pedido sem cobrança. Preço de tabela com desconto de bonificação; frete por conta da Fetely. Segue direto para faturamento.</p>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="bonif-autorizado">Autorizado por *</Label><Input id="bonif-autorizado" value={autorizado} onChange={e => onAutorizado(e.target.value)} disabled={disabled} /></div>
          <div className="space-y-1.5"><Label>Motivo *</Label><Select value={motivo} onValueChange={onMotivo} disabled={disabled || carregandoMotivos}><SelectTrigger aria-label="Motivo da bonificação"><SelectValue placeholder={carregandoMotivos ? "Carregando…" : "Selecione"} /></SelectTrigger><SelectContent>{motivos.map(m => <SelectItem key={m.codigo} value={m.codigo}>{m.nome}</SelectItem>)}</SelectContent></Select></div></div>
        {erroMotivos && <p role="alert" className="text-sm text-destructive">{erroMotivos}</p>}
        <div className="space-y-1.5"><Label htmlFor="bonif-obs">Observação da bonificação</Label><Textarea id="bonif-obs" rows={2} value={observacao} onChange={e => onObservacao(e.target.value)} disabled={disabled} /></div>
      </div>}
    </CardContent>
  </Card>;
}