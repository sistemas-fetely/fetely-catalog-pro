import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Minus, Plus, Trash2, ArrowLeftRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { getProdutoPhoto, usePhotos } from "@/store/photoStore";
import { formatBRL, halfBox } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sugestaoQueryOptions } from "@/lib/sugestaoPedidoQuery";
import {
  GRUPOS_SUGESTAO,
  PREFERENCIAS_PADRAO,
  montarSugestao,
  totalSugestao,
  faixaSugestao,
  dicaFaixa,
  grupoSugestao,
  trocarItemSugestao,
  type PreferenciasSugestao,
  type ItemSugestao,
  type OrigemSugestao,
} from "@/lib/sugestaoPedido";
import type { Product } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAplicar: (
    itens: ItemSugestao[],
    origem: OrigemSugestao,
    substituir: boolean,
    produtos: Product[],
  ) => void;
  onGerada: (preferencias: PreferenciasSugestao, valor: number) => void;
}
export function SugestaoPedidoSheet({ open, onOpenChange, onAplicar, onGerada }: Props) {
  const query = useQuery({ ...sugestaoQueryOptions(), enabled: open });
  const [pref, setPref] = useState<PreferenciasSugestao>(PREFERENCIAS_PADRAO);
  const [seed, setSeed] = useState(1);
  const [itens, setItens] = useState<ItemSugestao[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const photos = usePhotos();
  const produtos = useMemo(() => query.data?.produtos ?? [], [query.data]);
  const faixas = query.data?.faixas ?? [];
  useEffect(() => {
    if (!open || !query.data) return;
    setRecalculando(true);
    const t = setTimeout(() => {
      const r = montarSugestao(
        query.data.produtos,
        query.data.ranking,
        query.data.afinidades,
        pref,
        seed,
      );
      setItens(r.itens);
      setAviso(r.aviso);
      setRecalculando(false);
      onGerada(pref, r.total);
    }, 300);
    return () => clearTimeout(t);
  }, [open, query.data, pref, seed, onGerada]);
  const total = totalSugestao(itens);
  const faixa = faixaSugestao(total, faixas);
  const faixaAlvo = faixaSugestao(pref.investimento, faixas);
  const dica = dicaFaixa(pref.investimento, faixas);
  const colecoes = useMemo(
    () =>
      [...new Set(produtos.map((p) => p.colecao))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [produtos],
  );
  const agrupados = useMemo(() => {
    const m = new Map<string, ItemSugestao[]>();
    for (const i of itens) {
      const k = `${i.produto.categoria} → ${i.produto.colecao}`;
      const a = m.get(k) ?? [];
      a.push(i);
      m.set(k, a);
    }
    return [...m]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([nome, lista]) => ({
        nome,
        lista: lista.sort(
          (a, b) =>
            a.produto.corNome.localeCompare(b.produto.corNome, "pt-BR") ||
            (a.produto.numeroVela ?? 99) - (b.produto.numeroVela ?? 99),
        ),
      }));
  }, [itens]);
  const patch = (v: Partial<PreferenciasSugestao>) => setPref((p) => ({ ...p, ...v }));
  const mudarColecao = (campo: "preferidas" | "excluidas", col: string) =>
    setPref((p) => ({
      ...p,
      [campo]: p[campo].includes(col) ? p[campo].filter((c) => c !== col) : [...p[campo], col],
      ...(campo === "excluidas"
        ? { preferidas: p.preferidas.filter((c) => c !== col) }
        : { excluidas: p.excluidas.filter((c) => c !== col) }),
    }));
  const aplicar = (substituir: boolean) =>
    onAplicar(
      itens,
      { preferencias: pref, seed, skus: itens.map((i) => i.produto.sku) },
      substituir,
      produtos,
    );
  const mudarQty = (sku: string, delta: number) =>
    setItens((prev) =>
      prev.map((i) =>
        i.produto.sku === sku
          ? {
              ...i,
              quantidade: Math.max(
                halfBox(i.produto.multiplos),
                i.quantidade + delta * halfBox(i.produto.multiplos),
              ),
            }
          : i,
      ),
    );
  const trocar = (sku: string) => {
    const next = trocarItemSugestao(itens, sku, produtos, query.data?.ranking ?? [], pref);
    if (next === itens) toast.info("Não há outra opção elegível neste grupo.");
    else setItens(next);
  };
  const podeAplicar =
    itens.length > 0 &&
    total >= 1000 &&
    pref.investimento >= 1000 &&
    pref.investimento <= 30000 &&
    !recalculando &&
    !query.isError;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-5xl p-0 flex flex-col h-dvh gold-border"
      >
        <header className="px-5 py-4 border-b border-border pr-12">
          <SheetTitle className="font-display text-2xl text-gold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Sugestão de Pedido
          </SheetTitle>
          <SheetDescription>Valores estimados de atacado</SheetDescription>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden grid md:grid-cols-[300px_minmax(0,1fr)]">
          <section className="p-5 space-y-6 border-b md:border-b-0 md:border-r border-border min-w-0">
            <h2 className="font-display text-xl">Preferências</h2>
            <div className="space-y-3">
              <Label htmlFor="sugestao-investimento">Quanto quer investir (R$, atacado)</Label>
              <Input
                id="sugestao-investimento"
                type="number"
                min={1000}
                max={30000}
                step={100}
                value={pref.investimento}
                onChange={(e) => patch({ investimento: Number(e.target.value) })}
                onBlur={() =>
                  patch({
                    investimento: Math.max(1000, Math.min(30000, pref.investimento || 1000)),
                  })
                }
              />
              <Slider
                aria-label="Investimento"
                min={1000}
                max={30000}
                step={100}
                value={[Math.max(1000, Math.min(30000, pref.investimento))]}
                onValueChange={(v) => patch({ investimento: v[0] ?? 2500 })}
              />
              <p className="text-xs text-text-secondary">Pedido mínimo: {formatBRL(1000)}</p>
              {faixaAlvo && (
                <p className="text-xs text-gold">
                  {faixaAlvo.nome} · {faixaAlvo.desconto_celebra}% de desconto · Frete{" "}
                  {faixaAlvo.frete}
                </p>
              )}
              {dica && (
                <p className="text-xs text-text-secondary">
                  Faltam {formatBRL(dica.falta)} para a faixa {dica.faixa.nome} (+
                  {dica.descontoExtra}% de desconto
                  {dica.faixa.frete === "CIF" ? " / frete CIF" : ""})
                </p>
              )}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium mb-2">O que quer no pedido</legend>
              {GRUPOS_SUGESTAO.map((g) => (
                <div key={g} className="flex gap-2 items-center">
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start gold-border text-xs",
                      pref.grupos[g] && "bg-gold/10 text-gold",
                    )}
                    aria-pressed={!!pref.grupos[g]}
                    onClick={() =>
                      setPref((p) => ({ ...p, grupos: { ...p.grupos, [g]: p.grupos[g] ? 0 : 1 } }))
                    }
                  >
                    {g}
                  </Button>
                  {!!pref.grupos[g] && (
                    <Select
                      value={String(pref.grupos[g])}
                      onValueChange={(v) =>
                        setPref((p) => ({ ...p, grupos: { ...p.grupos, [g]: Number(v) } }))
                      }
                    >
                      <SelectTrigger className="w-28 text-xs" aria-label={`Peso ${g}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.5">Pouco</SelectItem>
                        <SelectItem value="1">Equilibrado</SelectItem>
                        <SelectItem value="2">Muito</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </fieldset>
            <div className="space-y-2">
              <Label>Profundidade por item</Label>
              <Select
                value={pref.profundidade}
                onValueChange={(v) =>
                  patch({ profundidade: v as PreferenciasSugestao["profundidade"] })
                }
              >
                <SelectTrigger aria-label="Profundidade por item">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meia">Quantidade mínima (meia caixa)</SelectItem>
                  <SelectItem value="uma">1 caixa</SelectItem>
                  <SelectItem value="duas">2 caixas</SelectItem>
                  <SelectItem value="personalizado">Personalizado (nº de caixas)</SelectItem>
                </SelectContent>
              </Select>
              {pref.profundidade === "personalizado" && (
                <Input
                  aria-label="Número de caixas"
                  type="number"
                  min={1}
                  max={100}
                  value={pref.caixas}
                  onChange={(e) =>
                    patch({ caixas: Math.max(1, Math.min(100, Number(e.target.value))) })
                  }
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Estilo do mix</Label>
              <Select
                value={pref.estilo}
                onValueChange={(v) => patch({ estilo: v as PreferenciasSugestao["estilo"] })}
              >
                <SelectTrigger aria-label="Estilo do mix">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendidos">Só os mais vendidos</SelectItem>
                  <SelectItem value="equilibrado">
                    Equilibrado (mais vendidos + variedade)
                  </SelectItem>
                  <SelectItem value="mesclado">Bem mesclado (máxima variedade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coleções</Label>
              <Select
                value={pref.colecoes}
                onValueChange={(v) => patch({ colecoes: v as PreferenciasSugestao["colecoes"] })}
              >
                <SelectTrigger
                  aria-label="Distribuição de coleções"
                  className="h-auto min-h-9 [&>span]:whitespace-normal"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concentrar">
                    Concentrar em poucas coleções completas (mesa coordenada)
                  </SelectItem>
                  <SelectItem value="espalhar">Espalhar por várias coleções</SelectItem>
                </SelectContent>
              </Select>
              {(["preferidas", "excluidas"] as const).map((campo) => (
                <details key={campo} className="text-sm">
                  <summary className="cursor-pointer py-2 text-text-secondary">
                    {campo === "preferidas" ? "Coleções preferidas" : "Coleções a excluir"} (
                    {pref[campo].length})
                  </summary>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {colecoes.map((col) => (
                      <Label key={col} className="flex gap-2 text-xs font-normal">
                        <Checkbox
                          checked={pref[campo].includes(col)}
                          onCheckedChange={() => mudarColecao(campo, col)}
                        />
                        <span className="break-words">{col}</span>
                      </Label>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <Label className="flex items-center justify-between gap-3">
              Só pronta entrega
              <Switch
                checked={pref.prontaEntrega}
                onCheckedChange={(v) => patch({ prontaEntrega: v })}
              />
            </Label>
          </section>
          <section className="p-4 sm:p-5 space-y-4 min-w-0" aria-busy={recalculando}>
            <h2 className="font-display text-xl">Sugestão</h2>
            {query.isPending ? (
              <p className="text-text-secondary">Consultando os mais vendidos…</p>
            ) : query.isError ? (
              <div role="alert">
                <p>Não foi possível carregar o histórico de vendas.</p>
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <div className="border-b border-border pb-4">
                  <div className="font-display text-3xl text-gold">{formatBRL(total)}</div>
                  <p className="text-xs text-text-secondary mt-1">
                    {itens.length} SKUs · {itens.reduce((s, i) => s + i.quantidade, 0)} unidades ·{" "}
                    {new Set(itens.map((i) => i.produto.colecao)).size} coleções
                  </p>
                  <p className="text-xs text-gold mt-1">
                    {faixa?.nome ?? "Abaixo do pedido mínimo"}
                    {recalculando ? " · Atualizando…" : ""}
                  </p>
                </div>
                {aviso && (
                  <p className="text-xs text-text-secondary" role="status">
                    {aviso}
                  </p>
                )}
                {total < 1000 && (
                  <p className="text-xs text-destructive">
                    A lista precisa atingir R$ 1.000 para ser adicionada.
                  </p>
                )}
                <div className="space-y-2" aria-label="Distribuição do valor por grupo">
                  {GRUPOS_SUGESTAO.map((g) => {
                    const valor = itens
                      .filter((i) => grupoSugestao(i.produto) === g)
                      .reduce((s, i) => s + i.quantidade * i.produto.precoAtacado, 0);
                    return valor > 0 ? (
                      <div
                        key={g}
                        className="grid grid-cols-[100px_minmax(0,1fr)_90px] items-center gap-2 text-[11px]"
                      >
                        <span>{g}</span>
                        <div className="h-2 bg-surface-2 overflow-hidden">
                          <svg
                            viewBox="0 0 100 8"
                            preserveAspectRatio="none"
                            className="w-full h-2 text-gold"
                            role="img"
                            aria-label={`${g}: ${Math.round((valor / total) * 100)}%`}
                          >
                            <rect width={(valor / total) * 100} height="8" fill="currentColor" />
                          </svg>
                        </div>
                        <span className="text-right">{formatBRL(valor)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
                {agrupados.map(({ nome, lista }) => (
                  <div key={nome}>
                    <h3 className="font-display text-base border-b border-border py-2 break-words">
                      {nome}
                    </h3>
                    {lista.map((i) => {
                      const p = i.produto;
                      const foto =
                        getProdutoPhoto(photos, p.colecao, p.sku) ??
                        getProdutoPhoto(photos, p.colecao, p.corNome);
                      return (
                        <article
                          key={p.sku}
                          className="flex gap-3 py-3 border-b border-border min-w-0"
                        >
                          <div className="w-14 h-14 shrink-0 bg-surface-2 overflow-hidden">
                            {foto ? (
                              <img
                                src={foto}
                                alt={p.nomeComercial}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <PhotoPlaceholder colecao={p.colecao} className="w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm break-words">{p.nomeComercial}</p>
                            <p className="text-xs text-text-secondary break-words">
                              {p.corNome} {p.tamanhoNumero} · {formatBRL(p.precoAtacado)}/un.
                            </p>
                            <span className="text-[10px] text-gold break-words">{i.motivo}</span>
                            <div className="flex flex-wrap gap-1 items-center mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Diminuir ${p.sku}`}
                                onClick={() => mudarQty(p.sku, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-10 text-center text-xs">{i.quantidade}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Aumentar ${p.sku}`}
                                onClick={() => mudarQty(p.sku, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Trocar"
                                aria-label={`Trocar ${p.sku}`}
                                onClick={() => trocar(p.sku)}
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Remover"
                                aria-label={`Remover ${p.sku}`}
                                onClick={() =>
                                  setItens((prev) => prev.filter((x) => x.produto.sku !== p.sku))
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              <span className="ml-auto text-xs font-medium">
                                {formatBRL(i.quantidade * p.precoAtacado)}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
        <footer className="border-t border-border bg-background p-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gold-border text-gold"
            disabled={!query.data || recalculando}
            onClick={() => setSeed((s) => s + 1)}
          >
            <RefreshCw className="h-4 w-4" />
            Gerar outra opção
          </Button>
          <Button
            className="flex-1 bg-gold text-background hover:bg-gold-light"
            disabled={!podeAplicar}
            onClick={() => aplicar(false)}
          >
            Adicionar à minha lista
          </Button>
          <Button
            variant="outline"
            className="gold-border text-gold"
            disabled={!podeAplicar}
            onClick={() => setConfirmar(true)}
          >
            Substituir minha lista
          </Button>
        </footer>
        <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Substituir sua lista?</AlertDialogTitle>
              <AlertDialogDescription>
                Os itens atuais serão substituídos pela sugestão de pedido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => aplicar(true)}>
                Substituir minha lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
