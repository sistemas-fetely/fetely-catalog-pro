// Photo keys require a named collection and category. Incomplete catalog rows
// remain in the catalog, but cannot be used as upload targets.
export function photoProducts<T extends { colecao?: string | null; categoria?: string | null }>(products: T[]): T[] {
  return products.filter((product) =>
    typeof product.colecao === "string" && product.colecao.trim().length > 0 &&
    typeof product.categoria === "string" && product.categoria.trim().length > 0,
  );
}