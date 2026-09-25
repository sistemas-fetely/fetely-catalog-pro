import type { Product } from "@/types";

// Preserve the internal type (used by integrations and reports); only simplify
// customer-facing plate names and descriptions.
export function simplifyPlateText(value: string | undefined): string | undefined {
  return value?.replace(/\bPrato\s+(?:Raso|Fundo|Sobremesa)\b\s*/gi, "Prato ");
}

export function normalizePlateNames(product: Product): Product {
  if (product.grupo !== "Prato") return product;
  return {
    ...product,
    nomeComercial: simplifyPlateText(product.nomeComercial) ?? product.nomeComercial,
    nomeCompleto: simplifyPlateText(product.nomeCompleto),
    metaDescricao: simplifyPlateText(product.metaDescricao),
    descricaoProduto: simplifyPlateText(product.descricaoProduto),
  };
}

export function productGroupLabel(product: Product): string {
  return product.grupo === "Prato" || !product.tipo
    ? product.grupo
    : `${product.grupo} • ${product.tipo}`;
}