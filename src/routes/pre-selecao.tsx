import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronRight, X, Menu, Heart, ArrowRight, Search, Trash2, Minus, Plus } from "lucide-react";
import {
  getOrCreateSessionId,
  ensureLinkInstance,
  upsertSessao,
  emitEvento,
  loadGateIdentidade,
  saveGateIdentidade,
} from "@/lib/tracking";
import { getFeatureFlags } from "@/lib/featureFlags";
import { GateEntradaDialog } from "@/components/catalog/GateEntradaDialog";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { useCatalog, getProductsBy } from "@/store/catalogStore";
import { useUI } from "@/store/uiStore";
import { usePhotos, getColecaoPhoto, getProdutoPhoto } from "@/store/photoStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { fetchCNPJ, formatCNPJ, isValidCNPJLength } from "@/lib/cnpj";
import { toast } from "sonner";
import { SEGMENTO_LABEL, type SegmentoCliente } from "@/types/preSelecao";
import { buildPreSelecao, encodePreSelecao, itemFromProductQty, submitPreSelecaoRemote, PUBLIC_SITE_URL } from "@/lib/preSelecao";
import { enviarPreSelecaoPublica } from "@/lib/preSelecao.functions";
import { usePreSelecao } from "@/store/preSelecaoStore";
import { formatBRL } from "@/lib/format";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  v: fallback(z.string(), "").optional(),
  colecao: fallback(z.string(), "").optional(),
  grupo: fallback(z.string(), "").optional(),
  categoria: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/pre-selecao")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Fetély — Catálogo de Pré-seleção" },
      { name: "description", content: "Navegue pelo catálogo Fetély e marque os produtos de interesse antes da reunião." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreSelecaoPage,
});

type CartMap = Record<string, number>; // sku → qty (0 = ♡ interesse sem qtd)

function PreSelecaoPage() {
  const { v, colecao, grupo, categoria } = Route.useSearch();
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const setGroupExpanded = useUI((s) => s.setGroupExpanded);

  const [cart, setCart] = useState<CartMap>({});
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmado, setConfirmado] = useState<{ id: string; link: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);

  // --- Gate de entrada (Fatia 2) ---------------------------------------
  const flags = useMemo(() => getFeatureFlags(), []);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateChecked, setGateChecked] = useState(false); // evita flicker antes de resolver LS

  // --- Rastreamento de jornada (Fatia 1) -------------------------------
  const sessionIdRef = useRef<string | null>(null);
  const montagemEmitidaRef = useRef(false);
  const formularioEmitidaRef = useRef(false);

  // Garante hidratação do catálogo (mesmo padrão do /catalog público).
  useEffect(() => {
    if (!useCatalog.getState().hidratado) {
      useCatalog.getState().hydrate();
    }
  }, []);

  // Bootstrap da sessão: cria/reutiliza session_id, resolve link_instance
  // via ?v=<login> (RPC), grava sessão e emite portal_acessado.
  useEffect(() => {
    let cancel = false;
    (async () => {
      const sid = getOrCreateSessionId();
      sessionIdRef.current = sid;
      const link = await ensureLinkInstance(v || undefined);
      if (cancel) return;
      const gateSaved = loadGateIdentidade();
      await upsertSessao(sid, {
        link_instance_id: link.id,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
        ...(gateSaved
          ? { nome: gateSaved.nome, whatsapp: gateSaved.whatsapp, identificado_gate: true }
          : {}),
      });
      await emitEvento(sid, "portal_acessado", { valor_parcial: 0, itens_parcial: 0 });
      if (cancel) return;
      // Gate leve: abre se flag ativa e ainda não identificamos.
      if (flags.GATE_ENTRADA_ATIVO && !gateSaved) {
        setGateOpen(true);
      }
      setGateChecked(true);
    })();
    return () => {
      cancel = true;
    };
  }, [v, flags.GATE_ENTRADA_ATIVO]);

  async function handleGateSubmit(value: { nome: string; whatsapp: string }) {
    saveGateIdentidade(value);
    const sid = sessionIdRef.current;
    if (sid) {
      await upsertSessao(sid, {
        nome: value.nome,
        whatsapp: value.whatsapp,
        identificado_gate: true,
      });
    }
    setGateOpen(false);
  }




  const colecaoProducts = useMemo(() => {
    if (!colecao) return [] as Product[];
    // usa mesmo helper do B2B mas filtrando por preço de varejo (público não vê atacado)
    return products.filter(
      (p) =>
        p.ativo !== false &&
        p.colecao === colecao &&
        (!grupo || p.grupo === grupo) &&
        (!categoria || p.categoria === categoria) &&
        p.precoVarejo > 0,
    );
  }, [products, colecao, grupo, categoria]);

  const meta = useMemo(() => {
    if (!colecao || colecaoProducts.length === 0) return null;
    const first = colecaoProducts[0];
    return { categoria: first.categoria, grupo: first.grupo };
  }, [colecao, colecaoProducts]);

  useEffect(() => {
    if (meta) setGroupExpanded(`${meta.categoria}::${meta.grupo}`, true);
  }, [meta, setGroupExpanded]);

  // busca: aplica filtro de texto sobre a lista da coleção atual
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return colecaoProducts;
    return colecaoProducts.filter((p) =>
      `${p.nomeComercial} ${p.corNome} ${p.tamanhoNumero} ${p.grupo}`.toLowerCase().includes(q),
    );
  }, [colecaoProducts, busca]);

  const heroPhoto = colecao ? getColecaoPhoto(photos, colecao, categoria || meta?.categoria) : undefined;

  const resumo = useMemo(() => {
    const skus = Object.keys(cart);
    let unidades = 0;
    let atacado = 0;
    let interessesSemQtd = 0;
    for (const sku of skus) {
      const p = products.find((x) => x.sku === sku);
      if (!p) continue;
      const q = cart[sku];
      if (q === 0) interessesSemQtd++;
      unidades += q;
      atacado += q * (p.precoAtacado || 0);
    }
    return { totalItens: skus.length, unidades, atacado, interessesSemQtd };
  }, [cart, products]);

  // Emite "montagem_iniciada" no 1º item + mantém valor/qtd sincronizados (debounced).
  useEffect(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (resumo.totalItens === 0) return;
    if (!montagemEmitidaRef.current) {
      montagemEmitidaRef.current = true;
      void emitEvento(sid, "montagem_iniciada", {
        valor_parcial: resumo.atacado,
        itens_parcial: resumo.totalItens,
      });
    }
    const t = setTimeout(() => {
      void upsertSessao(sid, {
        valor_wishlist: resumo.atacado,
        qtd_itens: resumo.totalItens,
        estado_atual: "montando",
      });
    }, 800);
    return () => clearTimeout(t);
  }, [resumo.atacado, resumo.totalItens]);

  // Emite "formulario_aberto" quando o modal abre (1x por sessão de abertura).
  useEffect(() => {
    const sid = sessionIdRef.current;
    if (!sid || !modalOpen) return;
    if (formularioEmitidaRef.current) return;
    formularioEmitidaRef.current = true;
    const now = new Date().toISOString();
    void emitEvento(sid, "formulario_aberto", {
      valor_parcial: resumo.atacado,
      itens_parcial: resumo.totalItens,
    });
    void upsertSessao(sid, {
      estado_atual: "formulario_aberto",
      ultimo_form_open: now,
    });
  }, [modalOpen, resumo.atacado, resumo.totalItens]);


  const setQty = (sku: string, q: number) =>
    setCart((prev) => {
      const next = { ...prev };
      if (q < 0) delete next[sku];
      else next[sku] = q;
      return next;
    });

  const toggleInteresse = (sku: string) =>
    setCart((prev) => {
      const next = { ...prev };
      if (sku in next) delete next[sku];
      else next[sku] = 0;
      return next;
    });

  const canSubmit = resumo.totalItens > 0;

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      {/* Header público */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 h-16 flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden text-text-secondary hover:text-gold p-1" aria-label="Coleções">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[300px] border-r border-border">
              <CatalogSidebar
                basePath="/pre-selecao"
                filterMode="varejo"
                hideCart
                forceExpanded
                onNavigate={() => setSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Link to="/pre-selecao" search={{ v: v || undefined } as never} className="flex items-baseline gap-2 min-w-0 hover:opacity-80">
            <span className="font-display text-xl sm:text-2xl tracking-[0.2em] truncate">FETÉLY</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.3em] text-gold-muted">
              Catálogo de Pré-seleção
            </span>
          </Link>
          <div className="ml-auto flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nesta coleção..."
              className="pl-9 h-9 bg-surface-2"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="hidden lg:block">
          <CatalogSidebar basePath="/pre-selecao" filterMode="varejo" hideCart />
        </div>
        <main className="flex-1 min-w-0 pb-32">
          <div className="px-3 py-4 sm:px-6 sm:py-8 max-w-[1200px] mx-auto">
            {!colecao ? (
              <EmptyStatePublic vendedor={v || ""} />
            ) : (
              <>
                <nav className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted mb-3 sm:mb-4 overflow-x-auto whitespace-nowrap pb-1">
                  {meta && (
                    <>
                      <span>{meta.categoria}</span>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span>{meta.grupo}</span>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </>
                  )}
                  <span className="text-gold">{colecao}</span>
                </nav>

                {/* Hero da coleção */}
                <header className="rounded-xl overflow-hidden gold-border mb-6 sm:mb-8 relative aspect-[16/7] sm:aspect-[16/5] md:aspect-[16/4] bg-surface-2">
                  {heroPhoto ? (
                    <img src={heroPhoto} alt={colecao} className="h-full w-full object-cover" />
                  ) : (
                    <PhotoPlaceholder colecao={colecao} className="h-full w-full" showIcon={false} />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 bg-gradient-to-t from-background via-background/60 to-transparent">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-gold">Coleção</div>
                    <h1 className="font-display text-2xl sm:text-4xl md:text-5xl mt-1 leading-tight">{colecao}</h1>
                  </div>
                </header>

                {visiveis.length === 0 ? (
                  <div className="text-center py-20 text-text-secondary text-sm">
                    Nenhum produto encontrado nesta coleção.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {visiveis.map((p) => (
                      <div id={`sku-${p.sku}`} key={p.sku}>
                        <ProductCard
                          product={p}
                          preSelecao={{
                            qty: cart[p.sku],
                            onQty: (q) => setQty(p.sku, q),
                            onInteresse: () => toggleInteresse(p.sku),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Barra fixa de resumo */}
      <div className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-gold/40 bg-background/95 backdrop-blur",
        !canSubmit && "opacity-95",
      )}>
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              <Heart className="inline h-4 w-4 text-gold mr-1.5" />
              {resumo.totalItens} {resumo.totalItens === 1 ? "item selecionado" : "itens selecionados"} · {resumo.unidades} un.
              {resumo.interessesSemQtd > 0 && (
                <span className="text-text-secondary"> · {resumo.interessesSemQtd} sem qtd</span>
              )}
            </div>
            <div className="text-xs text-text-secondary">
              Valor estimado (atacado): <span className="text-gold font-medium">{formatBRL(resumo.atacado)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={!canSubmit}
            onClick={() => setWishlistOpen(true)}
            className="shrink-0 gold-border text-gold hover:bg-gold/10"
          >
            Ver lista
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => setModalOpen(true)}
            className="bg-gold hover:bg-gold-light text-background shrink-0"
          >
            Enviar interesse <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <WishlistSheet
        open={wishlistOpen}
        onOpenChange={setWishlistOpen}
        cart={cart}
        produtos={products}
        onQty={setQty}
        onRemove={(sku) => setCart((prev) => { const n = { ...prev }; delete n[sku]; return n; })}
        onEnviar={() => { setWishlistOpen(false); setModalOpen(true); }}
      />

      <DadosEmpresaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        cart={cart}
        produtos={products}
        vendedor={v || null}
        sessionIdRef={sessionIdRef}
        onDone={(pre) => {
          setModalOpen(false);
          const link = `${PUBLIC_SITE_URL}/reunioes/importar#${encodePreSelecao(pre)}`;
          setConfirmado({ id: pre.id, link });
          setCart({});
          formularioEmitidaRef.current = false;
        }}
      />


      {confirmado && (
        <ConfirmacaoDialog id={confirmado.id} link={confirmado.link} onClose={() => setConfirmado(null)} />
      )}
    </div>
  );
}

/** Tela inicial (sem coleção selecionada) — mesma UX do /catalog público:
 *  primeiro escolhe categoria, depois vê grid de coleções com foto. */
function EmptyStatePublic({ vendedor }: { vendedor: string }) {
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const { categoria } = Route.useSearch();
  const navigate = useNavigate();

  const { collections, countByCategoria } = useMemo(() => {
    const colMap = new Map<
      string,
      { colecao: string; categoria: string; grupo: string; count: number }
    >();
    const catCount: Record<string, number> = {};
    for (const p of products) {
      if (p.ativo === false) continue;
      if (!p.precoVarejo || p.precoVarejo <= 0) continue;
      catCount[p.categoria] = (catCount[p.categoria] ?? 0) + 1;
      const mapKey = `${p.categoria}::${p.colecao}`;
      const existing = colMap.get(mapKey);
      if (existing) existing.count += 1;
      else colMap.set(mapKey, { colecao: p.colecao, categoria: p.categoria, grupo: p.grupo, count: 1 });
    }
    return {
      collections: Array.from(colMap.values()).sort((a, b) => a.colecao.localeCompare(b.colecao, "pt-BR")),
      countByCategoria: catCount,
    };
  }, [products]);

  const setCategoria = (c: string | undefined) =>
    navigate({
      to: "/pre-selecao",
      search: (prev: Record<string, unknown>) => ({ ...prev, categoria: c || undefined, grupo: undefined, colecao: undefined }),
    });

  if (!categoria) {
    const CATS = [
      { nome: "Celebrar à Mesa", descricao: "Coleções completas para mesa posta: jogos americanos, copos, taças e acessórios." },
      { nome: "Luz e Momento", descricao: "Velas decorativas, numéricas e aromas para celebrações inesquecíveis." },
    ];
    return (
      <div className="space-y-8">
        <header className="text-center max-w-2xl mx-auto pt-4 sm:pt-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">Catálogo Fetély</div>
          <h1 className="font-display text-4xl md:text-5xl mt-2">Marque o que faz sentido para sua loja</h1>
          <p className="text-text-secondary mt-3 text-sm">
            Navegue livremente, marque os produtos e quantidades de interesse.
            Nossa equipe entra em contato com uma proposta personalizada.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {CATS.map((c) => {
            const sampleCol = collections.find((x) => x.categoria === c.nome);
            const img = sampleCol ? getColecaoPhoto(photos, sampleCol.colecao, sampleCol.categoria) : undefined;
            const count = countByCategoria[c.nome] ?? 0;
            return (
              <button
                key={c.nome}
                onClick={() => setCategoria(c.nome)}
                className="group relative overflow-hidden rounded-xl gold-border gold-border-hover bg-surface text-left transition"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {img ? (
                    <img src={img} alt={c.nome} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <PhotoPlaceholder colecao={c.nome} className="h-full w-full" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Categoria</div>
                  <h2 className="font-display text-3xl sm:text-4xl mt-1 leading-tight">{c.nome}</h2>
                  <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-md">{c.descricao}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold">
                    Explorar coleções <ChevronRight className="h-3.5 w-3.5" />
                    {count > 0 && <span className="ml-2 text-text-muted normal-case tracking-normal">· {count} produtos</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {vendedor && (
          <p className="text-center text-[11px] text-text-muted">
            Consultor Fetély: <span className="text-gold uppercase tracking-wider">{vendedor}</span>
          </p>
        )}
      </div>
    );
  }

  const filtered = collections.filter((c) => c.categoria === categoria);
  return (
    <div className="space-y-6">
      <button
        onClick={() => setCategoria(undefined)}
        className="inline-flex items-center gap-2 rounded-lg gold-border px-4 py-2.5 text-[12px] uppercase tracking-wider text-gold bg-gold/5 hover:bg-gold/15 transition font-semibold shadow-sm"
      >
        <X className="h-4 w-4" /> Trocar categoria
      </button>
      <header>
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">Categoria</div>
        <h1 className="font-display text-4xl md:text-5xl mt-1">{categoria}</h1>
        <p className="text-text-secondary mt-2 text-sm">
          {filtered.length} {filtered.length === 1 ? "coleção disponível" : "coleções disponíveis"}.
        </p>
      </header>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">Nenhuma coleção encontrada.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((c) => {
            const img = getColecaoPhoto(photos, c.colecao, c.categoria);
            return (
              <Link
                key={`${c.categoria}::${c.colecao}`}
                to="/pre-selecao"
                search={{ colecao: c.colecao, categoria: c.categoria, v: vendedor || undefined } as never}
                className="group rounded-lg overflow-hidden gold-border gold-border-hover bg-surface transition"
              >
                <div className="relative aspect-square overflow-hidden">
                  {img ? (
                    <img src={img} alt={c.colecao} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <PhotoPlaceholder colecao={c.colecao} className="h-full w-full" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-display text-lg leading-tight">{c.colecao}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">{c.grupo}</div>
                    <div className="text-[10px] text-text-secondary">{c.count} {c.count === 1 ? "item" : "itens"}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DadosEmpresaModal({
  open,
  onOpenChange,
  cart,
  produtos,
  vendedor,
  sessionIdRef,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cart: CartMap;
  produtos: Product[];
  vendedor: string | null;
  sessionIdRef: React.MutableRefObject<string | null>;
  onDone: (pre: Awaited<ReturnType<typeof buildPreSelecao>>) => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoCargo, setContatoCargo] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoWhatsapp, setContatoWhatsapp] = useState("");
  const [cidadeEstado, setCidadeEstado] = useState("");
  const [segmento, setSegmento] = useState<SegmentoCliente>("boutique_decoracao");
  const [observacao, setObservacao] = useState("");
  const [aceitaNewsletter, setAceitaNewsletter] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const adicionar = usePreSelecao((s) => s.adicionar);
  const hydrate = usePreSelecao((s) => s.hydrate);
  const enviarPreSelecao = useServerFn(enviarPreSelecaoPublica);
  useEffect(() => { hydrate(); }, [hydrate]);

  // Autosave do formulário: enquanto o modal está aberto, snapshot dos
  // campos preenchidos a cada 30s (para detectar onde a pessoa travou).
  useEffect(() => {
    if (!open) return;
    const sid = sessionIdRef.current;
    if (!sid) return;
    const snapshot = () => {
      const campos = {
        cnpj: !!cnpj.trim(),
        razaoSocial: !!razaoSocial.trim(),
        nomeFantasia: !!nomeFantasia.trim(),
        contatoNome: !!contatoNome.trim(),
        contatoCargo: !!contatoCargo.trim(),
        contatoEmail: !!contatoEmail.trim(),
        contatoWhatsapp: !!contatoWhatsapp.trim(),
        cidadeEstado: !!cidadeEstado.trim(),
        segmento: !!segmento,
        observacao: !!observacao.trim(),
      };
      void emitEvento(sid, "formulario_autosave", { campos_preenchidos: campos });
      void upsertSessao(sid, { campos_preenchidos: campos });
    };
    const id = setInterval(snapshot, 30_000);
    return () => clearInterval(id);
  }, [open, sessionIdRef, cnpj, razaoSocial, nomeFantasia, contatoNome, contatoCargo, contatoEmail, contatoWhatsapp, cidadeEstado, segmento, observacao]);



  async function buscarCnpj() {
    if (!isValidCNPJLength(cnpj)) { toast.error("Informe um CNPJ válido"); return; }
    setBuscando(true);
    try {
      const data = await fetchCNPJ(cnpj);
      setRazaoSocial(data.razaoSocial);
      setNomeFantasia(data.nomeFantasia || data.razaoSocial);
      setContatoEmail((p) => p || data.email);
      setContatoWhatsapp((p) => p || data.telefone);
      setCidadeEstado(`${data.municipio} / ${data.uf}`);
      toast.success("Dados encontrados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar CNPJ");
    } finally { setBuscando(false); }
  }

  function validar(): string | null {
    if (!isValidCNPJLength(cnpj)) return "CNPJ inválido";
    if (!razaoSocial.trim()) return "Razão social obrigatória";
    if (!nomeFantasia.trim()) return "Nome fantasia obrigatório";
    if (!contatoNome.trim()) return "Nome do contato obrigatório";
    if (!contatoEmail.trim()) return "E-mail obrigatório";
    if (!contatoWhatsapp.trim()) return "WhatsApp obrigatório";
    return null;
  }

  async function enviar() {
    const err = validar();
    if (err) { toast.error(err); return; }
    setEnviando(true);
    try {
      const itens = Object.entries(cart).map(([sku, q]) => {
        const p = produtos.find((x) => x.sku === sku)!;
        return itemFromProductQty(p, q);
      });
      const preBase = await buildPreSelecao({
        vendedorId: vendedor,
        vendedorNome: null,
        cnpj: formatCNPJ(cnpj),
        razaoSocial,
        nomeFantasia,
        contatoNome,
        contatoCargo: contatoCargo || undefined,
        contatoEmail,
        contatoWhatsapp,
        cidadeEstado,
        segmento,
        observacao: observacao || undefined,
        aceitaNewsletter,
        itens,
      });
      const sid = sessionIdRef.current || undefined;
      const pre = { ...preBase, sessaoId: sid };

      // 1) Envia ao backend (fonte da verdade — chega no /reunioes do vendedor).
      try {
        await enviarPreSelecao({ data: pre });
      } catch (e) {
        console.warn("[pre-selecao] função do servidor falhou; tentando envio direto", e);
        try {
          await submitPreSelecaoRemote(pre);
        } catch (fallbackError) {
          console.error("[pre-selecao] falha ao enviar remoto", fallbackError);
          toast.error("Não foi possível enviar. Tente novamente.");
          return;
        }
      }
      // 2) Marca a jornada como enviada + evento final.
      if (sid) {
        void emitEvento(sid, "pre_selecao_enviada", {
          valor_parcial: pre.totalVarejoRef,
          itens_parcial: pre.totalItens,
        });
        void upsertSessao(sid, {
          estado_atual: "enviada",
          cnpj: pre.cnpj,
          razao_social: pre.razaoSocial,
          segmento: pre.segmento,
        });
      }
      // 3) Guarda também localmente (fallback + link de sincronização).
      adicionar(pre);
      onDone(pre);
    } finally { setEnviando(false); }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Antes de enviar</DialogTitle>
          <DialogDescription>Precisamos de algumas informações para personalizar nossa proposta.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>CNPJ *</Label>
            <div className="flex gap-2 mt-1">
              <Input value={cnpj} onChange={(e) => setCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
              <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscando || !isValidCNPJLength(cnpj)}>
                {buscando ? "..." : "Buscar"}
              </Button>
            </div>
          </div>
          <div><Label>Razão Social *</Label><Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="mt-1" /></div>
          <div><Label>Nome Fantasia *</Label><Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} className="mt-1" /></div>
          <div><Label>Nome do contato *</Label><Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} className="mt-1" /></div>
          <div><Label>Cargo / função</Label><Input value={contatoCargo} onChange={(e) => setContatoCargo(e.target.value)} className="mt-1" /></div>
          <div><Label>E-mail *</Label><Input type="email" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} className="mt-1" /></div>
          <div><Label>WhatsApp *</Label><Input value={contatoWhatsapp} onChange={(e) => setContatoWhatsapp(e.target.value)} className="mt-1" placeholder="(11) 99999-9999" /></div>
          <div className="md:col-span-2"><Label>Cidade / Estado</Label><Input value={cidadeEstado} onChange={(e) => setCidadeEstado(e.target.value)} className="mt-1" /></div>
          <div className="md:col-span-2">
            <Label>Segmento *</Label>
            <select
              value={segmento}
              onChange={(e) => setSegmento(e.target.value as SegmentoCliente)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {Object.entries(SEGMENTO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2"><Label>Observação (opcional)</Label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="mt-1" rows={3} /></div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={aceitaNewsletter} onChange={(e) => setAceitaNewsletter(e.target.checked)} className="accent-gold" />
            Tenho interesse em receber novidades e lançamentos
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button onClick={enviar} disabled={enviando} className="bg-gold hover:bg-gold-light text-background">
            {enviando ? "Enviando..." : "Enviar pré-seleção ✦"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmacaoDialog({ id, link, onClose }: { id: string; link: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md text-center">
        <div className="text-4xl text-gold">✦</div>
        <DialogTitle className="font-display text-2xl text-center">Pré-seleção enviada!</DialogTitle>
        <p className="text-sm text-text-secondary">
          Nossa equipe já recebeu sua lista. Em breve entraremos em contato.
        </p>
        <div className="rounded-md bg-surface-2 py-2 text-sm">
          Protocolo: <span className="font-semibold text-gold">#{id}</span>
        </div>
        <p className="text-[11px] text-text-muted">Válido por 72 horas</p>
        <details className="text-left text-xs text-text-muted">
          <summary className="cursor-pointer">Link de sincronização (compartilhe com o vendedor)</summary>
          <div className="mt-2 break-all bg-surface-2 p-2 rounded text-[10px]">{link}</div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
          >
            Copiar link
          </Button>
        </details>
        <div className="text-xs text-text-secondary pt-2">Fetély — Celebre o que importa. 🌟</div>
      </DialogContent>
    </Dialog>
  );
}

function WishlistSheet({
  open,
  onOpenChange,
  cart,
  produtos,
  onQty,
  onRemove,
  onEnviar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cart: CartMap;
  produtos: Product[];
  onQty: (sku: string, q: number) => void;
  onRemove: (sku: string) => void;
  onEnviar: () => void;
}) {
  const photos = usePhotos();

  const grupos = useMemo(() => {
    type Item = { p: Product; qty: number };
    const skus = Object.keys(cart);
    const itens: Item[] = [];
    for (const sku of skus) {
      const p = produtos.find((x) => x.sku === sku);
      if (!p) continue;
      itens.push({ p, qty: cart[sku] });
    }
    // groupBy categoria → coleção
    const map = new Map<string, Map<string, Item[]>>();
    for (const it of itens) {
      const cat = it.p.categoria || "—";
      const col = it.p.colecao || "—";
      if (!map.has(cat)) map.set(cat, new Map());
      const inner = map.get(cat)!;
      if (!inner.has(col)) inner.set(col, []);
      inner.get(col)!.push(it);
    }
    const numero = (p: Product): number => {
      if (typeof p.numeroVela === "number") return p.numeroVela;
      const n = parseInt((p.tamanhoNumero || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? n : 9999;
    };
    const sortItens = (arr: Item[]) =>
      arr.sort((a, b) => {
        const na = numero(a.p);
        const nb = numero(b.p);
        if (na !== nb) return na - nb;
        return (a.p.corNome || "").localeCompare(b.p.corNome || "", "pt-BR");
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([cat, inner]) => ({
        categoria: cat,
        colecoes: Array.from(inner.entries())
          .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
          .map(([col, arr]) => ({ colecao: col, itens: sortItens(arr) })),
      }));
  }, [cart, produtos]);

  const total = useMemo(() => {
    let unid = 0;
    let atacado = 0;
    for (const sku of Object.keys(cart)) {
      const p = produtos.find((x) => x.sku === sku);
      if (!p) continue;
      const q = cart[sku];
      unid += q;
      atacado += q * (p.precoAtacado || 0);
    }
    return { unid, atacado };
  }, [cart, produtos]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">Lista de desejos</div>
          <div className="font-display text-2xl mt-1">Sua seleção</div>
          <div className="text-xs text-text-secondary mt-1">
            {Object.keys(cart).length} {Object.keys(cart).length === 1 ? "item" : "itens"} · {total.unid} un.
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {grupos.length === 0 && (
            <div className="text-center text-sm text-text-muted py-16">Nenhum item selecionado ainda.</div>
          )}
          {grupos.map((g) => (
            <div key={g.categoria}>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-2">{g.categoria}</div>
              {g.colecoes.map((c) => (
                <div key={c.colecao} className="mb-5">
                  <div className="font-display text-lg mb-2 pb-1 border-b border-border/60">{c.colecao}</div>
                  <ul className="space-y-2">
                    {c.itens.map(({ p, qty }) => {
                      const img = getProdutoPhoto(photos, p.colecao, p.corNome);
                      const sub = qty * (p.precoAtacado || 0);
                      return (
                        <li key={p.sku} className="flex gap-3 items-start rounded-md bg-surface-2/50 p-2">
                          <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-surface">
                            {img ? (
                              <img src={img} alt={p.nomeComercial} className="w-full h-full object-cover" />
                            ) : (
                              <PhotoPlaceholder colecao={p.colecao} className="w-full h-full" showIcon={false} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.nomeComercial}</div>
                            <div className="text-[11px] text-text-muted">
                              {[p.tamanhoNumero, p.corNome].filter(Boolean).join(" · ")}
                            </div>
                            <div className="flex items-center justify-between mt-1.5 gap-2">
                              {qty > 0 ? (
                                <div className="inline-flex items-center rounded border border-border">
                                  <button
                                    className="px-2 py-1 text-text-secondary hover:text-gold"
                                    onClick={() => onQty(p.sku, Math.max(0, qty - (p.multiplos || 1)))}
                                    aria-label="Diminuir"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="px-2 text-sm min-w-[2.5rem] text-center">{qty}</span>
                                  <button
                                    className="px-2 py-1 text-text-secondary hover:text-gold"
                                    onClick={() => onQty(p.sku, qty + (p.multiplos || 1))}
                                    aria-label="Aumentar"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider text-gold-muted">
                                  <Heart className="inline h-3 w-3 mr-1" /> Interesse
                                </span>
                              )}
                              <div className="text-right">
                                <div className="text-[10px] uppercase tracking-wider text-text-muted">Atacado</div>
                                <div className="text-sm text-gold font-medium">
                                  {qty > 0 ? formatBRL(sub) : formatBRL(p.precoAtacado || 0)}
                                </div>
                              </div>
                              <button
                                onClick={() => onRemove(p.sku)}
                                className="p-1 text-text-muted hover:text-destructive"
                                aria-label="Remover"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-gold/40 px-5 py-3 bg-background/95">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary">Total estimado (atacado)</span>
            <span className="text-lg text-gold font-display">{formatBRL(total.atacado)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Continuar navegando
            </Button>
            <Button
              onClick={onEnviar}
              disabled={Object.keys(cart).length === 0}
              className="flex-1 bg-gold hover:bg-gold-light text-background"
            >
              Enviar interesse <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
