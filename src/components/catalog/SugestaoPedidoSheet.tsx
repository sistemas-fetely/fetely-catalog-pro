import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  MoreHorizontal,
  ShoppingBag,
  TrendingUp,
  Compass,
  Layers,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sugestaoQueryOptions } from "@/lib/sugestaoPedidoQuery";
import {
  GRUPOS_SUGESTAO,
  PREFERENCIAS_PADRAO,
  montarSugestao,
  montarKits,
  atualizarKit,
  alternativasKit,
  totalSugestao,
  faixaSugestao,
  type PreferenciasSugestao,
  type ItemSugestao,
  type OrigemSugestao,
  type KitSugestao,
} from "@/lib/sugestaoPedido";
import { SugestaoKitCard, FotoKit } from "./SugestaoKitCard";
import {
  SugestaoPreferencias,
  SECOES_PREFERENCIAS,
  type SecaoPreferencias,
} from "./SugestaoPreferencias";
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
const CORES_GRUPOS = [
  "text-gold",
  "text-info",
  "text-success",
  "text-warning",
  "text-stock-pre",
  "text-muted-foreground",
];
function TotalAnimado({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);
  const reduzido = useReducedMotion();
  useEffect(() => {
    if (reduzido) {
      setMostrado(valor);
      anterior.current = valor;
      return;
    }
    const controle = animate(anterior.current, valor, { duration: 0.35, onUpdate: setMostrado });
    anterior.current = valor;
    return () => controle.stop();
  }, [valor, reduzido]);
  return (
    <span className="tabular-nums" aria-label={formatBRL(valor)}>
      {formatBRL(mostrado)}
    </span>
  );
}
export function SugestaoPedidoSheet({ open, onOpenChange, onAplicar, onGerada }: Props) {
  const query = useQuery({ ...sugestaoQueryOptions(), enabled: open });
  const [pref, setPref] = useState<PreferenciasSugestao>(PREFERENCIAS_PADRAO);
  const [seed, setSeed] = useState(1);
  const [kits, setKits] = useState<KitSugestao[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [secao, setSecao] = useState<SecaoPreferencias | null>(null);
  const [troca, setTroca] = useState<KitSugestao | null>(null);
  const kitsRef = useRef(kits);
  const eventoRef = useRef(onGerada);
  const ultimo = useRef({ seed, profundidade: pref.profundidade, caixas: pref.caixas });
  const reduzido = useReducedMotion();
  const aplicarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    kitsRef.current = kits;
  }, [kits]);
  useEffect(() => {
    eventoRef.current = onGerada;
  }, [onGerada]);
  useEffect(
    () => () => {
      if (aplicarTimer.current) clearTimeout(aplicarTimer.current);
    },
    [],
  );
  const produtos = useMemo(() => query.data?.produtos ?? [], [query.data]);
  const faixas = query.data?.faixas ?? [];
  const candidatos = useMemo(
    () => montarKits(produtos, pref, query.data?.ranking ?? [], query.data?.afinidades ?? []),
    [produtos, pref, query.data],
  );
  const vitrine = useMemo(
    () =>
      montarKits(
        produtos,
        {
          ...pref,
          grupos: Object.fromEntries(GRUPOS_SUGESTAO.map((g) => [g, 1])),
          excluidas: [],
          prontaEntrega: false,
        },
        query.data?.ranking ?? [],
      ),
    [produtos, pref, query.data],
  );
  useEffect(() => {
    if (!open || !query.data) return;
    setRecalculando(true);
    const t = setTimeout(() => {
      const profundidadeMudou =
        ultimo.current.profundidade !== pref.profundidade || ultimo.current.caixas !== pref.caixas;
      const anteriores = profundidadeMudou
        ? kitsRef.current.flatMap((k) => {
            const base = candidatos.find((x) => x.id === k.id);
            return base ? [{ ...base, travado: k.travado }] : [];
          })
        : kitsRef.current;
      const r = montarSugestao(
        query.data.produtos,
        query.data.ranking,
        query.data.afinidades,
        pref,
        seed,
        { anteriores, regenerar: ultimo.current.seed !== seed },
      );
      setKits(r.kits);
      kitsRef.current = r.kits;
      setAviso(r.aviso);
      setAvisos(r.avisosProfundidade);
      setRecalculando(false);
      eventoRef.current(pref, r.total);
      ultimo.current = { seed, profundidade: pref.profundidade, caixas: pref.caixas };
    }, 250);
    return () => clearTimeout(t);
  }, [open, query.data, pref, seed, candidatos]);
  const itens = useMemo(() => kits.flatMap((k) => k.itens), [kits]);
  const total = totalSugestao(itens);
  const faixa = faixaSugestao(total, faixas);
  const patch = (v: Partial<PreferenciasSugestao>) => setPref((p) => ({ ...p, ...v }));
  const distribuicao = GRUPOS_SUGESTAO.map((grupo, i) => ({
    grupo,
    cor: CORES_GRUPOS[i] ?? "text-gold",
    valor: kits.filter((k) => k.grupo === grupo).reduce((s, k) => s + k.custo, 0),
  })).filter((g) => g.valor > 0);
  const podeAplicar =
    itens.length > 0 &&
    total >= 1000 &&
    total <= pref.investimento * 1.05 &&
    pref.investimento >= 1000 &&
    pref.investimento <= 30000 &&
    !recalculando &&
    !query.isError &&
    !aplicando;
  const aplicar = (substituir: boolean) => {
    setConfirmar(false);
    setAplicando(true);
    aplicarTimer.current = setTimeout(
      () => {
        onAplicar(
          itens,
          { preferencias: pref, seed, skus: itens.map((i) => i.produto.sku) },
          substituir,
          produtos,
        );
        setAplicando(false);
      },
      reduzido ? 0 : 350,
    );
  };
  const alternativas = troca
    ? alternativasKit(troca, candidatos, kits, pref.investimento).filter(
        (k) =>
          pref.colecoes !== "espalhar" ||
          !kits.some((x) => x.id !== troca.id && x.colecao === k.colecao),
      )
    : [];
  const mudarKit = (kit: KitSugestao, novas: ItemSugestao[]) => {
    const alterado = atualizarKit(kit, novas);
    if (total - kit.custo + alterado.custo > pref.investimento * 1.05) {
      toast.info("Esta quantidade ultrapassa o investimento escolhido.");
      return;
    }
    setKits((prev) =>
      novas.length
        ? prev.map((k) => (k.id === kit.id ? alterado : k))
        : prev.filter((k) => k.id !== kit.id),
    );
  };
  const cenarios = [
    {
      nome: "Os Queridinhos",
      descricao: "Os favoritos das lojas",
      estilo: "vendidos",
      colecoes: "concentrar",
      Icon: TrendingUp,
    },
    {
      nome: "Mesa Coordenada",
      descricao: "Coleções que se completam",
      estilo: "equilibrado",
      colecoes: "concentrar",
      Icon: Layers,
    },
    {
      nome: "Descobertas",
      descricao: "Novas cores, novos encontros",
      estilo: "mesclado",
      colecoes: "espalhar",
      Icon: Compass,
    },
  ] as const;
  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          aria-label="Seu pedido sugerido"
          className="sugestao-concierge inset-x-0 bottom-0 w-full max-w-none h-dvh rounded-none p-0 gap-0 flex flex-col overflow-hidden gold-border md:inset-x-[4vw] md:top-[4vh] md:bottom-[4vh] md:w-[92vw] md:h-[92dvh] md:rounded-xl shadow-xl"
        >
          <header className="shrink-0 px-4 md:px-7 py-4 md:py-5 border-b border-border pr-12">
            <SheetTitle className="font-display text-2xl md:text-3xl text-gold flex items-center gap-2">
              <Sparkles className="size-5 shrink-0" /> Seu pedido sugerido
            </SheetTitle>
            <SheetDescription className="text-xs mt-1">
              Montado a partir do que as lojas mais compram na Fetély
            </SheetDescription>
          </header>
          <div
            className="md:hidden shrink-0 flex flex-nowrap overflow-x-auto gap-1.5 px-3 py-3 border-b border-border scrollbar-thin"
            aria-label="Preferências"
          >
            {SECOES_PREFERENCIAS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="h-8 px-2 text-[11px] gold-border shrink-0"
                onClick={() => setSecao(s)}
              >
                {s === "Investimento"
                  ? formatBRL(pref.investimento)
                  : s === "Profundidade"
                    ? `${pref.profundidade === "meia" ? "½" : pref.profundidade === "duas" ? "2" : pref.profundidade === "personalizado" ? pref.caixas : "1"} caixa`
                    : s}
              </Button>
            ))}
          </div>
          <div className="flex-1 min-h-0 grid md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="hidden md:block min-h-0 overflow-y-auto overflow-x-hidden border-r border-border px-5 py-6 scrollbar-thin">
              <h2 className="font-display text-xl mb-5">Preferências</h2>
              <SugestaoPreferencias pref={pref} patch={patch} kits={vitrine} faixas={faixas} />
            </aside>
            <section className="min-w-0 min-h-0 flex flex-col" aria-busy={recalculando}>
              <div className="shrink-0 border-b border-border px-4 md:px-6 py-4 bg-background/95">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-3xl md:text-4xl text-gold">
                      <TotalAnimado valor={total} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kits.length} kits · {itens.length} SKUs ·{" "}
                      {itens.reduce((s, i) => s + i.quantidade, 0)} un.
                    </p>
                  </div>
                  <span className="text-xs text-gold text-right">
                    {faixa?.nome ?? "Pedido mínimo R$ 1.000"}
                    <span className="block text-[10px] text-muted-foreground">
                      {recalculando ? "Atualizando…" : "Valores estimados · atacado"}
                    </span>
                  </span>
                </div>
                {!!total && (
                  <>
                    <svg
                      viewBox="0 0 100 4"
                      preserveAspectRatio="none"
                      className="w-full h-1.5 mt-3 rounded overflow-hidden"
                      role="img"
                      aria-label="Distribuição do investimento por grupo"
                    >
                      {distribuicao.map((g, i) => (
                        <rect
                          key={g.grupo}
                          x={
                            (distribuicao.slice(0, i).reduce((s, x) => s + x.valor, 0) / total) *
                            100
                          }
                          width={(g.valor / total) * 100}
                          height={4}
                          fill="currentColor"
                          className={g.cor}
                        />
                      ))}
                    </svg>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] mt-2 text-muted-foreground">
                      {distribuicao.map((g) => (
                        <span key={g.grupo} className="flex items-center gap-1">
                          <span className={g.cor}>●</span>
                          {g.grupo} {Math.round((g.valor / total) * 100)}%
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-5 scrollbar-thin">
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {cenarios.map((c) => (
                    <Button
                      key={c.nome}
                      variant="outline"
                      aria-pressed={pref.estilo === c.estilo && pref.colecoes === c.colecoes}
                      className={cn(
                        "h-auto min-h-20 px-1.5 py-3 flex-col gap-1 whitespace-normal text-center",
                        pref.estilo === c.estilo &&
                          pref.colecoes === c.colecoes &&
                          "border-gold bg-gold/10",
                      )}
                      onClick={() => {
                        setPref((p) => ({
                          ...p,
                          estilo: c.estilo,
                          colecoes: c.colecoes,
                          limiteAncoras: c.nome === "Mesa Coordenada" ? 3 : 4,
                          grupos:
                            c.nome === "Mesa Coordenada"
                              ? {
                                  "Mesa posta": 2,
                                  "Copos e Taças": 1,
                                  Talheres: 1,
                                  "Jogo Americano": 1,
                                }
                              : PREFERENCIAS_PADRAO.grupos,
                        }));
                        setSeed((s) => s + 1);
                      }}
                    >
                      <c.Icon className="size-4 text-gold" />
                      <span className="font-display text-base leading-tight">{c.nome}</span>
                      <span className="hidden xl:block text-[10px] text-muted-foreground">
                        {c.descricao}
                      </span>
                    </Button>
                  ))}
                </div>
                {query.isPending ? (
                  <div className="grid xl:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-3">
                        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                        <Skeleton className="h-7 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : query.isError ? (
                  <div role="alert" className="space-y-3">
                    <p>Não foi possível carregar o histórico de vendas.</p>
                    <Button variant="outline" onClick={() => void query.refetch()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <>
                    {aviso && (
                      <div role="status" className="mb-5 space-y-3">
                        <p className="text-xs text-muted-foreground">{aviso}</p>
                        <div className="flex flex-wrap gap-2">
                          {!pref.grupos.Velas && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => patch({ grupos: { ...pref.grupos, Velas: 1 } })}
                            >
                              Incluir Velas
                            </Button>
                          )}
                          {pref.profundidade !== "duas" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => patch({ profundidade: "duas" })}
                            >
                              Aumentar para 2 caixas
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patch({ colecoes: "espalhar", excluidas: [], preferidas: [] })
                            }
                          >
                            Liberar mais coleções
                          </Button>
                        </div>
                      </div>
                    )}
                    {avisos.map((a) => (
                      <p
                        key={a}
                        className="text-[11px] text-gold bg-gold/10 rounded px-3 py-2 mb-2"
                      >
                        {a}
                      </p>
                    ))}
                    {GRUPOS_SUGESTAO.map((g) => {
                      const lista = kits.filter((k) => k.grupo === g);
                      return lista.length ? (
                        <div key={g} className="mb-8">
                          <h3 className="font-body text-[11px] uppercase text-muted-foreground mb-3">
                            {g}
                          </h3>
                          <div className="grid xl:grid-cols-2 gap-4 items-start">
                            <AnimatePresence initial={false}>
                              {lista.map((kit) => (
                                <SugestaoKitCard
                                  key={kit.id}
                                  kit={kit}
                                  base={candidatos.find((k) => k.id === kit.id) ?? kit}
                                  onChange={(i) => mudarKit(kit, i)}
                                  onLock={() =>
                                    setKits((ks) =>
                                      ks.map((k) =>
                                        k.id === kit.id ? { ...k, travado: !k.travado } : k,
                                      ),
                                    )
                                  }
                                  onSwap={() => setTroca(kit)}
                                  onRemove={() =>
                                    setKits((ks) => ks.filter((k) => k.id !== kit.id))
                                  }
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      ) : null;
                    })}
                    {!kits.length && (
                      <p className="py-10 text-center text-muted-foreground text-sm">
                        Nenhum kit completo cabe nas preferências atuais.
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
          <footer className="relative shrink-0 border-t border-border bg-background/90 backdrop-blur-xl px-3 md:px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] grid grid-cols-[minmax(0,1fr)_auto] md:flex md:items-center gap-2 overflow-hidden">
            <div className="min-w-0 md:mr-auto">
              <div className="font-display text-xl text-gold truncate">{formatBRL(total)}</div>
              <p className="text-[10px] text-muted-foreground">
                {faixa?.nome ?? "Mínimo R$ 1.000"}
              </p>
            </div>
            <Button
              variant="outline"
              className="text-xs md:text-sm"
              disabled={!query.data || recalculando || aplicando}
              onClick={() => {
                setRecalculando(true);
                setSeed((s) => s + 1);
              }}
            >
              <motion.span
                animate={{ rotate: recalculando && !reduzido ? 360 : 0 }}
                transition={{ duration: 0.5 }}
              >
                <RefreshCw className="size-4" />
              </motion.span>
              Outra opção
            </Button>
            <Button
              className="h-11 min-w-0 text-xs md:text-sm active:scale-[0.97] md:px-6"
              disabled={!podeAplicar}
              onClick={() => aplicar(false)}
            >
              <ShoppingBag className="size-4 shrink-0" />
              Adicionar à minha lista
            </Button>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 justify-self-end"
                      aria-label="Mais opções da sugestão"
                    >
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Mais opções</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!podeAplicar} onSelect={() => setConfirmar(true)}>
                  Substituir minha lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AnimatePresence>
              {aplicando && (
                <motion.span
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{
                    x: reduzido ? 0 : -100,
                    y: reduzido ? 0 : -25,
                    opacity: 0,
                    scale: 0.5,
                  }}
                  transition={{ duration: 0.35 }}
                  className="absolute left-1/2 bottom-3 text-gold pointer-events-none"
                >
                  <ShoppingBag className="size-7" />
                </motion.span>
              )}
            </AnimatePresence>
          </footer>
          <Drawer
            open={!!secao}
            onOpenChange={(v) => {
              if (!v) setSecao(null);
            }}
            shouldScaleBackground={false}
          >
            <DrawerContent className="max-h-[80dvh] z-[60] overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <DrawerTitle className="font-display text-2xl">{secao}</DrawerTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar preferência"
                  onClick={() => setSecao(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <DrawerDescription className="sr-only">
                Preferências do pedido sugerido
              </DrawerDescription>
              <div className="overflow-y-auto p-5 pt-0">
                {secao && (
                  <SugestaoPreferencias
                    pref={pref}
                    patch={patch}
                    kits={vitrine}
                    faixas={faixas}
                    secao={secao}
                  />
                )}
              </div>
              <Button className="m-4 shrink-0" onClick={() => setSecao(null)}>
                Pronto
              </Button>
            </DrawerContent>
          </Drawer>
          <Dialog
            open={!!troca}
            onOpenChange={(v) => {
              if (!v) setTroca(null);
            }}
          >
            <DialogContent className="max-w-[calc(100vw-24px)] sm:max-w-3xl p-5">
              <DialogTitle className="font-display text-2xl">
                Outra escolha para {troca?.grupo}
              </DialogTitle>
              <DialogDescription>Kits completos próximos do valor atual.</DialogDescription>
              <div className="flex gap-3 overflow-x-auto snap-x pb-3">
                {alternativas.map((k) => (
                  <Button
                    key={k.id}
                    variant="outline"
                    className="h-auto w-44 shrink-0 snap-start flex-col items-stretch p-0 overflow-hidden whitespace-normal"
                    onClick={() => {
                      setKits((ks) =>
                        ks.map((x) => (x.id === troca?.id ? { ...k, travado: x.travado } : x)),
                      );
                      setTroca(null);
                    }}
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <FotoKit kit={k} />
                    </div>
                    <span className="font-display text-lg p-2">{k.nome}</span>
                    <span className="text-xs text-gold pb-3">{formatBRL(k.custo)}</span>
                  </Button>
                ))}
              </div>
              {!alternativas.length && (
                <p className="text-sm text-muted-foreground">
                  Não há outra opção completa neste grupo que caiba no investimento.
                </p>
              )}
            </DialogContent>
          </Dialog>
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
    </TooltipProvider>
  );
}
