import { useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  ShoppingBag,
  ArrowRight,
  Search,
  X,
} from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import { useUI } from "@/store/uiStore";
import { useOrder, cartTotal } from "@/store/orderStore";
import { useAuth } from "@/store/authStore";
import { formatBRL } from "@/lib/format";
import type { Product } from "@/types";

type Tree = Record<string, Record<string, string[]>>;

// Categorias onde a hierarquia é invertida: Coleção → Grupo (ex.: Celebrar à Mesa)
const COLECAO_FIRST_CATEGORIES = new Set(["Celebrar à Mesa", "Acessórios de Mesa"]);
// Grupos que devem aparecer como subdivisão expansível
const SUBDIVIDED_GROUPS = new Set(["Jogo Americano", "Copos e Taças", "Talheres"]);
const GRP_PREFIX = "GRP::";
// Rótulo do grupo virtual "Coleções" (agrupa a lista longa de coleções soltas)
const COLECOES_KEY = "__COLECOES__";

function buildTree(products: Product[], filterMode: "atacado" | "varejo" = "atacado"): Tree {
  const tree: Tree = {};
  for (const p of products) {
    if (p.ativo === false) continue;
    if (filterMode === "atacado") {
      if (!p.precoAtacado || p.precoAtacado <= 0) continue;
    } else {
      if (!p.precoVarejo || p.precoVarejo <= 0) continue;
    }
    if (!tree[p.categoria]) tree[p.categoria] = {};
    const colecaoFirst = COLECAO_FIRST_CATEGORIES.has(p.categoria);

    if (colecaoFirst && SUBDIVIDED_GROUPS.has(p.grupo)) {
      const key = `${GRP_PREFIX}${p.grupo}`;
      if (!tree[p.categoria][key]) tree[p.categoria][key] = [];
      if (!tree[p.categoria][key].includes(p.colecao)) {
        tree[p.categoria][key].push(p.colecao);
      }
      continue;
    }

    if (colecaoFirst) {
      // agrupa todas as coleções soltas sob "Coleções"
      if (!tree[p.categoria][COLECOES_KEY]) tree[p.categoria][COLECOES_KEY] = [];
      if (!tree[p.categoria][COLECOES_KEY].includes(p.colecao)) {
        tree[p.categoria][COLECOES_KEY].push(p.colecao);
      }
      continue;
    }

    const lvl1 = p.grupo;
    const lvl2 = p.colecao;
    if (!tree[p.categoria][lvl1]) tree[p.categoria][lvl1] = [];
    if (!tree[p.categoria][lvl1].includes(lvl2)) {
      tree[p.categoria][lvl1].push(lvl2);
    }
  }
  for (const cat of Object.keys(tree)) {
    for (const grp of Object.keys(tree[cat])) {
      tree[cat][grp].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
  }
  return tree;
}

function isColecaoFirst(categoria: string) {
  return COLECAO_FIRST_CATEGORIES.has(categoria);
}

/** Conta produtos por (categoria, coleção[, grupo]). */
function countProdutos(
  products: Product[],
  filterMode: "atacado" | "varejo",
  categoria: string,
  colecao: string,
  grupo?: string,
): number {
  return products.filter((p) => {
    if (p.ativo === false) return false;
    if (filterMode === "atacado" ? !(p.precoAtacado && p.precoAtacado > 0) : !(p.precoVarejo && p.precoVarejo > 0))
      return false;
    if (p.categoria !== categoria) return false;
    if (p.colecao !== colecao) return false;
    if (grupo && p.grupo !== grupo) return false;
    return true;
  }).length;
}

interface Props {
  onNavigate?: () => void;
  forceExpanded?: boolean;
  basePath?: "/catalog" | "/pre-selecao";
  filterMode?: "atacado" | "varejo";
  hideCart?: boolean;
}

export function CatalogSidebar({
  onNavigate,
  forceExpanded,
  basePath = "/catalog",
  filterMode = "atacado",
  hideCart,
}: Props) {
  const products = useCatalog((s) => s.products);
  const tree = useMemo(() => buildTree(products, filterMode), [products, filterMode]);
  const collapsedState = useUI((s) => s.sidebarCollapsed);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const expandedGroups = useUI((s) => s.expandedGroups);
  const toggleGroup = useUI((s) => s.toggleGroup);
  const collapsed = forceExpanded ? false : collapsedState;

  const items = useOrder((s) => s.items);
  const total = cartTotal(items);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const isPublic = !useAuth((s) => s.session);

  const search = useRouterState({
    select: (r) => r.location.search as { colecao?: string; grupo?: string; categoria?: string },
  });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const activeColecao = pathname === basePath ? search.colecao : undefined;
  const activeGrupo = pathname === basePath ? search.grupo : undefined;
  // Detecta categoria ativa: pela URL /catalog/categoria/:categoria ou pelo search param
  const categoriaFromPath = (() => {
    const m = pathname.match(/\/catalog\/categoria\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  })();
  const activeCategoria = categoriaFromPath ?? (pathname === basePath ? search.categoria : undefined);

  const navigate = useNavigate();
  const [filtro, setFiltro] = useState("");

  const handleSelectColecao = (colecao: string, grupo?: string, categoria?: string) => {
    const s: { colecao: string; grupo?: string; categoria?: string } = { colecao };
    if (grupo) s.grupo = grupo;
    if (categoria) s.categoria = categoria;
    navigate({ to: basePath as "/catalog", search: s as never });
    onNavigate?.();
  };

  // Estatísticas da categoria ativa (para o bloco de contexto)
  const contextoCategoria = useMemo(() => {
    if (!activeCategoria || !tree[activeCategoria]) return null;
    const grupos = tree[activeCategoria];
    const colecoesSet = new Set<string>();
    for (const lst of Object.values(grupos)) for (const c of lst) colecoesSet.add(c);
    const produtos = products.filter(
      (p) =>
        p.categoria === activeCategoria &&
        p.ativo !== false &&
        (filterMode === "atacado" ? (p.precoAtacado ?? 0) > 0 : (p.precoVarejo ?? 0) > 0),
    ).length;
    return { produtos, colecoes: colecoesSet.size };
  }, [activeCategoria, tree, products, filterMode]);

  const filtroNorm = filtro.trim().toLowerCase();
  const matchesFiltro = (s: string) => !filtroNorm || s.toLowerCase().includes(filtroNorm);

  return (
    <aside
      className={`flex flex-col bg-surface border-r-2 border-gold/30 h-[calc(100vh-4rem)] sticky top-16 transition-all shadow-[2px_0_12px_-6px_rgba(0,0,0,0.4)] ${
        collapsed ? "w-[60px]" : "w-[300px]"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
        {!collapsed && (
          <div className="text-[11px] uppercase tracking-[0.3em] text-gold font-semibold">
            Navegar
          </div>
        )}
        {!forceExpanded && (
          <button
            onClick={toggleSidebar}
            className="ml-auto text-text-muted hover:text-gold transition"
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Bloco de contexto */}
          {contextoCategoria && activeCategoria && (
            <div className="px-4 py-3 border-b border-border bg-surface-2/40">
              <div className="text-[9px] uppercase tracking-[0.25em] text-gold-muted">Categoria</div>
              <div className="font-display text-base text-text-primary mt-0.5 truncate">
                {activeCategoria}
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                {contextoCategoria.produtos} produtos · {contextoCategoria.colecoes} coleções
              </div>
            </div>
          )}

          {/* Filtro */}
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5 focus-within:border-gold/60 transition">
              <Search className="h-3.5 w-3.5 text-text-muted" />
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Filtrar coleção…"
                className="bg-transparent border-0 outline-none text-xs text-text-primary placeholder:text-text-muted flex-1 min-w-0"
              />
              {filtro && (
                <button
                  onClick={() => setFiltro("")}
                  className="text-text-muted hover:text-gold"
                  aria-label="Limpar filtro"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3">
        {Object.entries(tree).map(([categoria, grupos]) => (
          <div key={categoria} className="mb-4">
            {collapsed ? (
              <div className="flex justify-center py-2 text-gold/60" title={categoria}>
                <Folder className="h-4 w-4" />
              </div>
            ) : (
              <button
                onClick={() => {
                  navigate({ to: "/catalog/categoria/$categoria", params: { categoria } });
                  onNavigate?.();
                }}
                className={`w-full text-left px-3 py-2 mb-1 text-[12px] uppercase tracking-[0.18em] flex items-center gap-2 transition font-semibold border-l-2 ${
                  activeCategoria === categoria
                    ? "text-gold border-gold bg-gold/10"
                    : "text-gold border-gold/40 hover:text-gold-light hover:bg-gold/10"
                }`}
              >
                <Folder className="h-3.5 w-3.5" /> {categoria}
              </button>
            )}

            {!collapsed &&
              Object.entries(grupos)
                .sort(([a], [b]) => {
                  // Coleções gerais primeiro, grupos subdivididos depois
                  if (a === COLECOES_KEY) return -1;
                  if (b === COLECOES_KEY) return 1;
                  const aSub = a.startsWith(GRP_PREFIX);
                  const bSub = b.startsWith(GRP_PREFIX);
                  if (aSub && !bSub) return 1;
                  if (!aSub && bSub) return -1;
                  return a.localeCompare(b, "pt-BR");
                })
                .map(([lvl1, lvl2List]) => {
                  const colecaoFirst = isColecaoFirst(categoria);
                  const gkey = `${categoria}::${lvl1}`;
                  const isOpen = expandedGroups[gkey] ?? true;

                  // Grupo virtual "Coleções" (categorias coleção-first)
                  if (colecaoFirst && lvl1 === COLECOES_KEY) {
                    const filtradas = lvl2List.filter(matchesFiltro);
                    if (filtradas.length === 0 && filtroNorm) return null;
                    return (
                      <div key={gkey} className="px-2">
                        <button
                          onClick={() => toggleGroup(gkey)}
                          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs text-text-secondary hover:text-gold rounded transition"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="uppercase tracking-wider flex-1">Coleções</span>
                          <span className="text-[10px] text-text-muted tabular-nums">
                            {lvl2List.length}
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="pl-5 pb-1">
                            {filtradas.map((col) => {
                              const active = activeColecao === col && !activeGrupo;
                              const cnt = countProdutos(products, filterMode, categoria, col);
                              return (
                                <li key={col}>
                                  <button
                                    onClick={() => handleSelectColecao(col, undefined, categoria)}
                                    className={`flex w-full items-center gap-2 text-left text-xs py-1.5 pl-3 pr-2 rounded transition border-l-2 ${
                                      active
                                        ? "border-gold bg-gold/10 text-gold"
                                        : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-2/60"
                                    }`}
                                  >
                                    <span className="flex-1 truncate">{col}</span>
                                    <span className="text-[10px] text-text-muted tabular-nums">
                                      {cnt}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  }

                  // Subdivisão por grupo (Jogo Americano, Copos e Taças…)
                  if (colecaoFirst && lvl1.startsWith(GRP_PREFIX)) {
                    const grupoName = lvl1.slice(GRP_PREFIX.length);
                    const filtradas = lvl2List.filter(matchesFiltro);
                    if (filtradas.length === 0 && filtroNorm) return null;
                    return (
                      <div key={gkey} className="px-2">
                        <button
                          onClick={() => toggleGroup(gkey)}
                          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs text-text-secondary hover:text-gold rounded transition"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="uppercase tracking-wider flex-1">{grupoName}</span>
                          <span className="text-[10px] text-text-muted tabular-nums">
                            {lvl2List.length}
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="pl-5 pb-1">
                            {filtradas.map((col) => {
                              const active = activeColecao === col && activeGrupo === grupoName;
                              const cnt = countProdutos(products, filterMode, categoria, col, grupoName);
                              return (
                                <li key={col}>
                                  <button
                                    onClick={() => handleSelectColecao(col, grupoName, categoria)}
                                    className={`flex w-full items-center gap-2 text-left text-xs py-1.5 pl-3 pr-2 rounded transition border-l-2 ${
                                      active
                                        ? "border-gold bg-gold/10 text-gold"
                                        : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-2/60"
                                    }`}
                                  >
                                    <span className="flex-1 truncate">{col}</span>
                                    <span className="text-[10px] text-text-muted tabular-nums">
                                      {cnt}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  }

                  // Fallback: grupo-first (ex.: Luz e Momento) — lista coleções sob o grupo
                  const filtradas = lvl2List.filter(matchesFiltro);
                  if (filtradas.length === 0 && filtroNorm) return null;
                  return (
                    <div key={gkey} className="px-2">
                      <button
                        onClick={() => toggleGroup(gkey)}
                        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs text-text-secondary hover:text-gold rounded transition"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="uppercase tracking-wider flex-1">{lvl1}</span>
                        <span className="text-[10px] text-text-muted tabular-nums">
                          {lvl2List.length}
                        </span>
                      </button>
                      {isOpen && (
                        <ul className="pl-5 pb-1">
                          {filtradas.map((lvl2) => {
                            const active = activeColecao === lvl2;
                            const cnt = countProdutos(products, filterMode, categoria, lvl2);
                            return (
                              <li key={lvl2}>
                                <button
                                  onClick={() => handleSelectColecao(lvl2, undefined, categoria)}
                                  className={`flex w-full items-center gap-2 text-left text-xs py-1.5 pl-3 pr-2 rounded transition border-l-2 ${
                                    active
                                      ? "border-gold bg-gold/10 text-gold"
                                      : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-2/60"
                                  }`}
                                >
                                  <span className="flex-1 truncate">{lvl2}</span>
                                  <span className="text-[10px] text-text-muted tabular-nums">
                                    {cnt}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
          </div>
        ))}
      </nav>

      {!isPublic &&
        !hideCart &&
        (!collapsed ? (
          <div className="border-t border-border p-3 bg-surface-2/40">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted flex items-center gap-1.5">
              <ShoppingBag className="h-3 w-3" /> Carrinho
            </div>
            <div className="font-display text-xl text-gold mt-1">
              {totalUnits > 0 ? formatBRL(total) : "Vazio"}
            </div>
            {totalUnits > 0 && (
              <div className="text-[11px] text-text-secondary">
                {totalUnits} unidades · {items.length} itens
              </div>
            )}
            <Link
              to="/cart"
              onClick={onNavigate}
              className="mt-3 flex items-center justify-center gap-2 w-full rounded-md bg-gold px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light transition"
            >
              Revisar pedido <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <Link
            to="/cart"
            onClick={onNavigate}
            className="border-t border-border flex flex-col items-center justify-center py-3 text-gold hover:bg-surface-2 transition relative"
            aria-label="Carrinho"
          >
            <ShoppingBag className="h-4 w-4" />
            {totalUnits > 0 && (
              <span className="absolute top-2 right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-background">
                {totalUnits}
              </span>
            )}
          </Link>
        ))}
    </aside>
  );
}
