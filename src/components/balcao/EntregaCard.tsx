import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, ShoppingBag, Store, Truck, Zap } from "lucide-react";
import { brl, enderecoParaCotacao, modalidadesVisiveis } from "@/lib/balcaoPedido";
import { EnderecoFields } from "./EnderecoFields";
import type { ClienteForm, Cotacao, ModoEntrega } from "./types";

export const ENTREGA_ICON = { retirada: Store, sedex: Zap, pac: Package, frete_fetely: Truck, balcao: ShoppingBag };
export function entregaLabel(modo: ModoEntrega, cd: string) {
  return { retirada: `Retirada no ${cd}`, sedex: "Correios SEDEX", pac: "Correios PAC", frete_fetely: "Frete Fetely", balcao: "Entrega imediata — cliente leva agora" }[modo];
}
export function EntregaCard({ form, onCampo, onCepBlur, buscandoCep, cotacao, cotando, semItens, modo, onModo, cd, modoBalcao = false, disabled, enderecoDisabled, erro, erroCep }: {
  form: ClienteForm; onCampo: (k: keyof ClienteForm, v: string) => void; onCepBlur: () => void; buscandoCep: boolean;
  cotacao: Cotacao | null; cotando: boolean; semItens: boolean; modo: ModoEntrega; onModo: (v: ModoEntrega) => void; cd: string;
  disabled: boolean; enderecoDisabled: boolean; modoBalcao?: boolean; erro?: string; erroCep?: string;
}) {
  const visiveis = modalidadesVisiveis(cotacao?.opcoes ?? []);
  return <Card id="balcao-card-entrega" className="rounded-lg scroll-mt-4">
    <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base tracking-normal">Entrega{cotando && <><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm font-normal text-muted-foreground">cotando…</span></>}</CardTitle></CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      {!modoBalcao && <>
        <EnderecoFields form={form} onChange={onCampo} prefixo="balcao-entrega" disabled={enderecoDisabled} buscandoCep={buscandoCep} onCepBlur={onCepBlur} />
        {erroCep && <p role="alert" className="text-sm text-destructive">{erroCep}</p>}
        {!form.cep && <p className="text-sm text-muted-foreground">Informe o CEP de entrega para cotar SEDEX, PAC e Frete Fetely</p>}
      </>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {cotacao?.correios_erro && <p role="alert" className="text-sm text-warning">{cotacao.correios_erro}</p>}
      <div role="radiogroup" aria-label="Modalidade de entrega" className={`grid gap-3 ${modoBalcao ? "" : "sm:grid-cols-2"}`}>
        {(modoBalcao ? ["balcao" as const] : ["retirada", "sedex", "pac", "frete_fetely"] as const).filter(m => m !== visiveis.oculto).map(m => {
          const o = visiveis.opcoes.find(x => x.modo === m);
          const ok = o?.ok ?? m === "retirada";
          const selecionada = modoBalcao || modo === m && ok;
          const Icon = ENTREGA_ICON[m];
          return <Button key={m} variant="outline" role="radio" aria-checked={selecionada} disabled={disabled || !ok || cotando}
            onClick={() => onModo(m)} onKeyDown={e => {
              if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
              e.preventDefault();
              const radios = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? []);
              const next = radios[(radios.indexOf(e.currentTarget) + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + radios.length) % radios.length];
              next?.focus(); next?.click();
            }}
            className={`h-auto min-h-36 items-stretch justify-start whitespace-normal p-4 text-left hover:bg-primary/5 hover:text-foreground disabled:opacity-60 ${selecionada ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border"}`}>
            <span className="flex w-full flex-col gap-2"><span className="flex items-center gap-2 font-medium"><Icon />{entregaLabel(m, cd)}</span>
              {m === "balcao" ? <>
                <span className="text-2xl font-semibold">Sem frete</span>
                {cotando ? <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />cotando…</span> : o && !o.ok ? <span className="text-xs text-muted-foreground">{o.erro ?? "Entrega imediata indisponível"}</span> : null}
              </> : cotando ? <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />cotando…</span> : ok ? <>
                <span className="flex flex-wrap items-center gap-2"><span className="text-2xl font-semibold">{o ? o.frete_cobrado === 0 ? "Grátis" : brl(o.frete_cobrado) : "—"}</span>{o?.frete_cobrado === 0 && <Badge variant="outline" className="border-success/40 bg-success/10 text-success">Grátis</Badge>}</span>
                <span className="text-xs text-muted-foreground">{o?.prazo_dias != null ? `Prazo ${o.prazo_dias} dias úteis` : m === "retirada" ? "Retirada no balcão" : ""}</span>
              </> : <span className="text-xs text-muted-foreground">{semItens ? "Adicione itens para cotar esta modalidade" : !enderecoParaCotacao(form) ? "Informe o CEP para cotar" : o?.erro || erro || cotacao?.correios_erro || "Modalidade indisponível para este CEP"}</span>}
            </span>
          </Button>;
        })}
      </div>
      {visiveis.oculto && <p className="text-xs text-muted-foreground">{visiveis.oculto === "pac" ? "PAC oculto: o SEDEX sai mais barato e mais rápido para este CEP" : "SEDEX oculto: o PAC tem valor e prazo iguais ou melhores para este CEP"}</p>}
      {!!cotacao?.opcoes.some(o => o.avisos?.length) && <ul className="list-disc space-y-1 pl-5 text-xs text-warning">{Array.from(new Set(cotacao.opcoes.flatMap(o => o.avisos ?? []).map(a => a.aviso))).map(aviso => <li key={aviso}>{aviso}</li>)}</ul>}
    </CardContent>
  </Card>;
}