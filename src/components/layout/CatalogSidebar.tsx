import { useMemo } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Folder,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import { useUI } from "@/store/uiStore";
import { useOrder, cartTotal } from "@/store/orderStore";
import { formatBRL } from "@/lib/format";
import type { Product } from "@/types";

type Tree = Record<string, Record<string, string[]>>;

// Categorias onde a hierarquia é invertida: Coleção → Grupo (ex.: Celebrar à Mesa)
const COLECAO_FIRST_CATEGORIES = new Set(["Celebrar à Mesa"]);

function buildTree(products: Product[]): Tree {
  const tree: Tree = {};
  for (const p of products) {
    if (!tree[p.categoria]) tree[p.categoria] = {};
    const colecaoFirst = COLECAO_FIRST_CATEGORIES.has(p.categoria);
    const lvl1 = colecaoFirst ? p.colecao : p.grupo;
    const lvl2 = colecaoFirst ? p.grupo : p.colecao;
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

interface Props {
  onNavigate?: () => void;
  forceExpanded?: boolean;
}

export function CatalogSidebar({ onNavigate, forceExpanded }: Props) {
  const products = useCatalog((s) => s.products);
  const tree = useMemo(() => buildTree(products), [products]);
  const collapsedState = useUI((s) => s.sidebarCollapsed);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const expandedGroups = useUI((s) => s.expandedGroups);
  const toggleGroup = useUI((s) => s.toggleGroup);
  const collapsed = forceExpanded ? false : collapsedState;

  const items = useOrder((s) => s.items);
  const total = cartTotal(items);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  const search = useRouterState({ select: (r) => r.location.search as { colecao?: string; grupo?: string } });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const activeColecao = pathname === "/catalog" ? search.colecao : undefined;
  const activeGrupo = pathname === "/catalog" ? search.grupo : undefined;
  const navigate = useNavigate();

  const handleSelectColecao = (colecao: string, grupo?: string) => {
    navigate({ to: "/catalog", search: grupo ? { colecao, grupo } : { colecao } });
    onNavigate?.();
  };

  return (
    <aside
      className={`flex flex-col bg-surface border-r border-border h-[calc(100vh-4rem)] sticky top-16 transition-all ${
        collapsed ? "w-[60px]" : "w-[260px]"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
            Catálogo
          </div>
        )}
        {!forceExpanded && (
          <button
            onClick={toggleSidebar}
            className="ml-auto text-text-muted hover:text-gold transition"
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {Object.entries(tree).map(([categoria, grupos]) => (
          <div key={categoria} className="mb-3">
            {collapsed ? (
              <div
                className="flex justify-center py-2 text-gold/60"
                title={categoria}
              >
                <Folder className="h-4 w-4" />
              </div>
            ) : (
              <div className="px-3 pb-1.5 pt-2 text-[10px] uppercase tracking-[0.2em] text-gold flex items-center gap-2">
                <Folder className="h-3 w-3" /> {categoria}
              </div>
            )}

            {!collapsed &&
              Object.entries(grupos).map(([grupo, colecoes]) => {
                const gkey = `${categoria}::${grupo}`;
                const isOpen = expandedGroups[gkey] ?? true;
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
                      <span className="uppercase tracking-wider">{grupo}</span>
                    </button>
                    {isOpen && (
                      <ul className="pl-5 pb-1">
                        {colecoes.map((col) => {
                          const active = activeColecao === col;
                          return (
                            <li key={col}>
                              <button
                                onClick={() => handleSelectColecao(col)}
                                className={`block w-full text-left text-xs py-1.5 pl-3 pr-2 rounded transition border-l-2 ${
                                  active
                                    ? "border-gold bg-gold/10 text-gold"
                                    : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-2/60"
                                }`}
                              >
                                {col}
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

      {!collapsed ? (
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
      )}
    </aside>
  );
}
