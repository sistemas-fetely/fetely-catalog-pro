import type { Product } from "@/types";
import rawProducts from "./products.json";

// Coleções de velas que permitem múltiplos de 6 (pacote menor que a caixa de 12).
const SIX_PACK_COLLECTIONS = new Set([
  "Le Moment",
  "Amour",
  "Lumi Star",
  "Twist",
  "Pattern",
  "Spirale",
]);

// Catálogo carregado direto da base oficial (planilha XLSX → JSON).
export const PRODUCTS: Product[] = (rawProducts as Product[]).map((p) => {
  if (SIX_PACK_COLLECTIONS.has(p.colecao) && p.multiplos === 12) {
    return { ...p, multiplos: 6 };
  }
  return p;
});

// Coleções derivadas dinamicamente do dataset
const _numericCandles = Array.from(
  new Set(
    PRODUCTS.filter((p) => p.grupo === "Vela" && p.tipo === "Numérica").map(
      (p) => p.colecao,
    ),
  ),
);
const _decorativeCandles = Array.from(
  new Set(
    PRODUCTS.filter((p) => p.grupo === "Vela" && p.tipo !== "Numérica").map(
      (p) => p.colecao,
    ),
  ),
);

export const NUMERIC_CANDLE_COLLECTIONS = _numericCandles as readonly string[];
export const DECORATIVE_CANDLE_COLLECTIONS = _decorativeCandles as readonly string[];

// Cor de destaque por coleção (usada nos placeholders visuais)
export const COLLECTION_ACCENT: Record<string, string> = {
  Classique: "oklch(0.55 0.02 80)",
  "Dots Doux": "oklch(0.78 0.09 350)",
  "Fine Pure": "oklch(0.92 0.01 80)",
  "Frost Glow": "oklch(0.82 0.06 220)",
  "Glitter Glow": "oklch(0.75 0.13 85)",
  "Golden Line": "oklch(0.74 0.115 85)",
  "Splash Neon": "oklch(0.78 0.20 145)",
  "Sweet Candy": "oklch(0.80 0.10 20)",
  Texture: "oklch(0.55 0.04 60)",
  Amour: "oklch(0.62 0.18 20)",
  "Le Moment": "oklch(0.50 0.06 280)",
  "Lumi Star": "oklch(0.78 0.11 85)",
  Pattern: "oklch(0.45 0.05 250)",
  Spirale: "oklch(0.68 0.13 50)",
  Twist: "oklch(0.70 0.10 320)",
  "Aura Gold": "oklch(0.78 0.11 85)",
  Blosson: "oklch(0.78 0.10 350)",
  "Butterfly -B&W": "oklch(0.30 0 0)",
  "Costa Serena": "oklch(0.70 0.10 220)",
  "Fresh-Frutta": "oklch(0.78 0.18 90)",
  "Fungi Royale": "oklch(0.45 0.08 30)",
  "Lemon Blue": "oklch(0.80 0.14 100)",
  "Lottus Golden": "oklch(0.76 0.11 85)",
  "Luxury Blue": "oklch(0.45 0.12 250)",
  Mosaïque: "oklch(0.60 0.10 200)",
  "Ocean Blue": "oklch(0.55 0.12 230)",
  Piacera: "oklch(0.72 0.06 80)",
  "Pink Flower": "oklch(0.78 0.13 0)",
  "Solar-Tropical": "oklch(0.75 0.16 60)",
  "Tropical-Chic": "oklch(0.60 0.14 150)",
  Signature: "oklch(0.70 0.04 80)",
  Blasson: "oklch(0.72 0.08 30)",
  Cadre: "oklch(0.65 0.05 60)",
  Coquille: "oklch(0.85 0.05 80)",
  "Dolce Frutta": "oklch(0.78 0.15 80)",
  "Éclat": "oklch(0.78 0.10 85)",
  "Ondée": "oklch(0.70 0.08 220)",
  "Pétale": "oklch(0.78 0.10 350)",
  "Floréale Glass": "oklch(0.85 0.04 200)",
  "Lineare Glass": "oklch(0.82 0.02 80)",
  Lavoire: "oklch(0.78 0.11 85)",
};

export const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.categoria)));

export function collectionsByCategory(categoria: string): string[] {
  return Array.from(
    new Set(PRODUCTS.filter((p) => p.categoria === categoria).map((p) => p.colecao)),
  );
}

export function groupsByCollection(colecao: string): string[] {
  return Array.from(
    new Set(PRODUCTS.filter((p) => p.colecao === colecao).map((p) => p.grupo)),
  );
}

export function productsBy(colecao: string, grupo?: string): Product[] {
  return PRODUCTS.filter((p) => p.colecao === colecao && (!grupo || p.grupo === grupo));
}

export function isNumericCollection(colecao: string): boolean {
  return NUMERIC_CANDLE_COLLECTIONS.includes(colecao);
}
