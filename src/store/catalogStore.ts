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

interface CatalogState {
  products: Product[];
  source: "default" | "imported";
  importedAt: string | null;
  setProducts: (products: Product[]) => void;
  resetToDefault: () => void;
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set) => ({
      products: DEFAULT_PRODUCTS,
      source: "default",
      importedAt: null,
      setProducts: (products) =>
        set({ products, source: "imported", importedAt: new Date().toISOString() }),
      resetToDefault: () =>
        set({ products: DEFAULT_PRODUCTS, source: "default", importedAt: null }),
    }),
    {
      name: "fetely-catalog",
      storage: createJSONStorage(safeStorage),
      version: 3,
      migrate: () => ({
        products: DEFAULT_PRODUCTS,
        source: "default" as const,
        importedAt: null,
      }),
    },
  ),
);

// Derived selectors
export function getCategories(products: Product[]): string[] {
  return Array.from(new Set(products.map((p) => p.categoria)));
}
export function getCollectionsByCategory(products: Product[], categoria: string): string[] {
  return Array.from(
    new Set(products.filter((p) => p.categoria === categoria).map((p) => p.colecao)),
  );
}
export function getGroupsByCollection(products: Product[], colecao: string): string[] {
  return Array.from(
    new Set(products.filter((p) => p.colecao === colecao).map((p) => p.grupo)),
  );
}
export function getProductsBy(
  products: Product[],
  colecao: string,
  grupo?: string,
): Product[] {
  return products.filter(
    (p) =>
      p.colecao === colecao &&
      (!grupo || p.grupo === grupo) &&
      p.precoAtacado &&
      p.precoAtacado > 0,
  );
}
export function isNumericCollection(colecao: string): boolean {
  return (NUMERIC_CANDLE_COLLECTIONS as readonly string[]).includes(colecao);
}
