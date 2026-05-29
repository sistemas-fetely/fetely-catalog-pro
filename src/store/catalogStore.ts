import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";
import { PRODUCTS as DEFAULT_PRODUCTS, NUMERIC_CANDLE_COLLECTIONS } from "@/data/products";

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};
const safeStorage = (): Storage =>
  typeof window !== "undefined" ? window.localStorage : noopStorage;

export type AuditAcao = "criado" | "editado" | "desativado" | "reativado" | "duplicado" | "importado";

export interface AuditCampo {
  campo: string;
  valorAnterior: string;
  valorNovo: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  usuarioId: string;
  usuarioNome: string;
  produtoSku: string;
  produtoNome: string;
  acao: AuditAcao;
  camposAlterados?: AuditCampo[];
}

interface AuditMeta {
  usuarioId: string;
  usuarioNome: string;
}

interface CatalogState {
  products: Product[];
  audit: AuditEntry[];
  source: "default" | "imported";
  importedAt: string | null;
  setProducts: (products: Product[]) => void;
  resetToDefault: () => void;
  upsertProduct: (p: Product, meta: AuditMeta) => { ok: true } | { ok: false; error: string };
  toggleAtivo: (sku: string, meta: AuditMeta) => void;
  duplicateProduct: (sku: string, meta: AuditMeta) => Product | null;
}

function diffProducts(prev: Product, next: Product): AuditCampo[] {
  const keys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);
  const out: AuditCampo[] = [];
  for (const k of keys) {
    const a = (prev as unknown as Record<string, unknown>)[k];
    const b = (next as unknown as Record<string, unknown>)[k];

    if (JSON.stringify(a ?? "") !== JSON.stringify(b ?? "")) {
      out.push({ campo: k, valorAnterior: String(a ?? ""), valorNovo: String(b ?? "") });
    }
  }
  return out;
}

function nextSkuFor(grupo: string, products: Product[]): string {
  const prefixoGrupo: Record<string, string> = {
    Vela: "VL",
    Prato: "PR",
    Guardanapo: "GN",
    "Jogo Americano": "JA",
    Travessa: "TV",
    "Copos e Taças": "CP",
    Talheres: "TL",
  };
  const prefixo = prefixoGrupo[grupo] ?? "XX";
  const re = new RegExp(`^FET-${prefixo}-(\\d+)$`);
  let max = 0;
  for (const p of products) {
    const m = p.sku.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `FET-${prefixo}-${String(max + 1).padStart(3, "0")}`;
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      products: DEFAULT_PRODUCTS,
      audit: [],
      source: "default",
      importedAt: null,
      setProducts: (products) =>
        set({ products, source: "imported", importedAt: new Date().toISOString() }),
      resetToDefault: () =>
        set({ products: DEFAULT_PRODUCTS, source: "default", importedAt: null }),

      upsertProduct: (p, meta) => {
        const state = get();
        const sku = p.sku.trim();
        if (!sku) return { ok: false, error: "SKU é obrigatório" };
        const idx = state.products.findIndex((x) => x.sku === sku);
        const existing = idx >= 0 ? state.products[idx] : null;
        // Detect duplicate when creating
        if (!existing && state.products.some((x) => x.sku === sku)) {
          return { ok: false, error: "SKU já cadastrado" };
        }
        const next = { ...p, sku, ativo: p.ativo ?? true };
        const newProducts =
          idx >= 0
            ? state.products.map((x, i) => (i === idx ? next : x))
            : [...state.products, next];
        const entry: AuditEntry = {
          id: `A${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          usuarioId: meta.usuarioId,
          usuarioNome: meta.usuarioNome,
          produtoSku: sku,
          produtoNome: next.nomeComercial,
          acao: existing ? "editado" : "criado",
          camposAlterados: existing ? diffProducts(existing, next) : undefined,
        };
        set({ products: newProducts, audit: [entry, ...state.audit].slice(0, 1000) });
        return { ok: true };
      },

      toggleAtivo: (sku, meta) => {
        const state = get();
        const idx = state.products.findIndex((x) => x.sku === sku);
        if (idx < 0) return;
        const cur = state.products[idx];
        const novoAtivo = !(cur.ativo ?? true);
        const next = { ...cur, ativo: novoAtivo };
        const newProducts = state.products.map((x, i) => (i === idx ? next : x));
        const entry: AuditEntry = {
          id: `A${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          usuarioId: meta.usuarioId,
          usuarioNome: meta.usuarioNome,
          produtoSku: sku,
          produtoNome: cur.nomeComercial,
          acao: novoAtivo ? "reativado" : "desativado",
        };
        set({ products: newProducts, audit: [entry, ...state.audit].slice(0, 1000) });
      },

      duplicateProduct: (sku, meta) => {
        const state = get();
        const src = state.products.find((x) => x.sku === sku);
        if (!src) return null;
        const newSku = nextSkuFor(src.grupo, state.products);
        const copy: Product = {
          ...src,
          sku: newSku,
          ean: "",
          codCadastro: "",
          ativo: true,
        };
        const entry: AuditEntry = {
          id: `A${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          usuarioId: meta.usuarioId,
          usuarioNome: meta.usuarioNome,
          produtoSku: newSku,
          produtoNome: copy.nomeComercial,
          acao: "duplicado",
        };
        set({
          products: [...state.products, copy],
          audit: [entry, ...state.audit].slice(0, 1000),
        });
        return copy;
      },
    }),
    {
      name: "fetely-catalog",
      storage: createJSONStorage(safeStorage),
      version: 7,
      migrate: (_persisted: unknown, _version) => {
        // v7: re-seed defaults to apply new "Acessórios de Mesa" category restructure
        return {
          products: DEFAULT_PRODUCTS,
          audit: [],
          source: "default" as const,
          importedAt: null,
        };
      },
      _legacyMigrate: (persisted: unknown, version) => {
        // v5 -> v6: keep persisted products if present, just add audit array
        if (
          persisted &&
          typeof persisted === "object" &&
          "products" in persisted &&
          Array.isArray((persisted as { products: unknown }).products) &&
          (persisted as { products: unknown[] }).products.length > 0
        ) {
          const p = persisted as Partial<CatalogState>;
          return {
            products: p.products as Product[],
            audit: (p.audit as AuditEntry[]) ?? [],
            source: p.source ?? "default",
            importedAt: p.importedAt ?? null,
          };
        }
        // Fallback: re-seed
        return {
          products: DEFAULT_PRODUCTS,
          audit: [],
          source: "default" as const,
          importedAt: null,
        };
      },
    },
  ),
);

export { nextSkuFor };

// Derived selectors
export function getCategories(products: Product[]): string[] {
  return Array.from(new Set(products.filter((p) => p.ativo !== false).map((p) => p.categoria)));
}
export function getCollectionsByCategory(products: Product[], categoria: string): string[] {
  return Array.from(
    new Set(
      products
        .filter((p) => p.ativo !== false && p.categoria === categoria)
        .map((p) => p.colecao),
    ),
  );
}
export function getGroupsByCollection(products: Product[], colecao: string): string[] {
  return Array.from(
    new Set(
      products.filter((p) => p.ativo !== false && p.colecao === colecao).map((p) => p.grupo),
    ),
  );
}
export function getProductsBy(
  products: Product[],
  colecao: string,
  grupo?: string,
): Product[] {
  return products.filter(
    (p) =>
      p.ativo !== false &&
      p.colecao === colecao &&
      (!grupo || p.grupo === grupo) &&
      p.precoAtacado &&
      p.precoAtacado > 0,
  );
}
export function isNumericCollection(colecao: string): boolean {
  return (NUMERIC_CANDLE_COLLECTIONS as readonly string[]).includes(colecao);
}
