import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Minus, PackageSearch, Plus, Search, Trash2 } from "lucide-react";
import { brl } from "@/lib/balcaoPedido";
import { ProdutoThumb } from "./ProdutoThumb";
import { saldoDo, type BalcaoProduto, type Item } from "./types";

export function ItensCard({ busca, onBusca, buscando, resultados, itens, cd, disabled, onAdicionar, onQuantidade, onRemover, erro, carregandoCarrinho, indisponiveisCarrinho }: {
  busca: string; onBusca: (v: string) => void; buscando: boolean; resultados: BalcaoProduto[]; itens: Item[];
  cd: string; disabled: boolean; onAdicionar: (p: BalcaoProduto) => void; onQuantidade: (sku: string, qtd: number) => void; onRemover: (sku: string) => void; erro?: string;
  carregandoCarrinho?: boolean; indisponiveisCarrinho?: string[];
}) {
  return <Card id="balcao-card-itens" className="rounded-lg scroll-mt-4">
    <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base tracking-normal">Itens</CardTitle></CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      {!!indisponiveisCarrinho?.length && <p role="alert" className="break-words text-sm text-warning">Não disponíveis para B2C: {indisponiveisCarrinho.join(", ")}</p>}
      {carregandoCarrinho && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando itens do carrinho…</p>}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input id="balcao-busca-produto" role="combobox" aria-label="Buscar produto" aria-expanded={resultados.length > 0}
          aria-controls="balcao-produtos" autoComplete="off" className="h-10 pl-9" placeholder="Buscar produto por nome, código ou SKU"
          value={busca} onChange={e => onBusca(e.target.value)} disabled={disabled} />
        {buscando && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {resultados.length > 0 && <ul id="balcao-produtos" role="listbox" className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border">
        {resultados.map(p => <li key={p.sku} role="option" aria-selected={false}>
          <Button variant="ghost" className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none p-3 text-left" disabled={disabled} onClick={() => onAdicionar(p)}>
            <ProdutoThumb colecao={p.colecao} corNome={p.cor_nome} sku={p.sku} nome={p.nome} />
            <span className="min-w-0 flex-1"><span className="block font-medium">{p.nome}</span><span className="block text-xs text-muted-foreground">{p.cod_cadastro ?? p.sku} · {p.colecao} · {p.cor_nome} · {cd}: {saldoDo(p)} disp.</span></span>
            <span className="shrink-0 text-sm">{brl(p.preco_varejo)}</span><Plus />
          </Button>
        </li>)}
      </ul>}
      {!buscando && !erro && busca.trim().length >= 2 && !resultados.length && <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>}
      {!itens.length ? <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-5 text-center text-muted-foreground"><PackageSearch className="h-7 w-7" /><p className="text-sm">Busque um produto pelo código, SKU ou nome</p></div> :
        <ul className="divide-y divide-border">{itens.map(i => <li key={i.sku} className="grid grid-cols-[64px_minmax(0,1fr)_36px] items-start gap-3 py-4 first:pt-0 sm:grid-cols-[64px_minmax(0,1fr)]">
          <ProdutoThumb colecao={i.colecao} corNome={i.cor_nome} sku={i.sku} nome={i.nome} tamanho={64} />
          <div className="min-w-0 space-y-2"><p className="line-clamp-2 text-base font-medium">{i.nome}</p><p className="text-xs text-muted-foreground">{i.cod_cadastro ?? i.sku}{i.colecao ? ` · ${i.colecao}` : ""}{i.cor_nome ? ` · ${i.cor_nome}` : ""}</p>
            <Badge variant="outline" className={i.quantidade > saldoDo(i) ? "border-warning/50 bg-warning/10 text-warning" : "border-success/40 bg-success/10 text-success"}>{i.quantidade > saldoDo(i) ? `Sem saldo no ${cd}` : `${cd}: ${saldoDo(i)} disp.`}</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive sm:hidden" title="Remover item" aria-label={`Remover ${i.nome}`} disabled={disabled} onClick={() => onRemover(i.sku)}><Trash2 /></Button>
          <div className="col-span-3 flex flex-wrap items-center justify-between gap-3 sm:col-span-2 sm:pl-[76px]">
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="icon" className="h-10 w-10" title="Diminuir quantidade" aria-label={`Diminuir quantidade de ${i.nome}`} disabled={disabled || i.quantidade <= 1} onClick={() => onQuantidade(i.sku, i.quantidade - 1)}><Minus /></Button>
              <Input type="number" inputMode="numeric" min={1} step={1} aria-label={`Quantidade de ${i.nome}`} className="h-10 w-14 px-1 text-center" disabled={disabled} value={i.quantidade} onChange={e => onQuantidade(i.sku, Number(e.target.value))} />
              <Button variant="outline" size="icon" className="h-10 w-10" title="Aumentar quantidade" aria-label={`Aumentar quantidade de ${i.nome}`} disabled={disabled} onClick={() => onQuantidade(i.sku, i.quantidade + 1)}><Plus /></Button>
            </div>
            <div className="ml-auto text-right"><p className="text-lg font-semibold">{brl(i.preco_varejo * i.quantidade)}</p><p className="text-xs text-muted-foreground">{brl(i.preco_varejo)} cada</p></div>
            <Button variant="ghost" size="icon" className="hidden text-destructive sm:inline-flex" title="Remover item" aria-label={`Remover ${i.nome}`} disabled={disabled} onClick={() => onRemover(i.sku)}><Trash2 /></Button>
          </div>
        </li>)}</ul>}
    </CardContent>
  </Card>;
}