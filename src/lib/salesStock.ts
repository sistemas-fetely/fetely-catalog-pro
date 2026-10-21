import type { Product } from "@/types";
import { useCatalog } from "@/store/catalogStore";
import { supabase } from "@/integrations/supabase/client";
import { vendaBloqueada } from "@/lib/classifyItem";
import { toast } from "sonner";

export function produtoAtual(product: Product): Product {
  return useCatalog.getState().products.find((p) => p.sku === product.sku) ?? product;
}

export function avisarEsgotados(products: Product[]) {
  if (!products.length) return;
  toast.warning("Produtos esgotados não foram incluídos", {
    description: [...new Set(products.map((p) => p.codCadastro || p.sku))].join(", "),
    duration: 7000,
  });
}

/** Confirma o sinal atual do SNCF antes de qualquer gravação de venda/provisão. */
export async function validarEstoqueAtual(items: { sku: string; quantity: number; product: { codCadastro?: string } }[], somenteFirme = false): Promise<void> {
  if (!items.length) throw new Error("Não há itens disponíveis para salvar.");
  const { data, error } = await supabase.from("products")
    .select("sku, estoque_disponivel, status_estoque")
    .in("sku", [...new Set(items.map((i) => i.sku))]);
  if (error) throw new Error("Não foi possível conferir o estoque. Tente novamente.");
  const bySku = new Map((data ?? []).map((p) => [p.sku, p]));
  for (const item of items) {
    const row = bySku.get(item.sku);
    if (!row) throw new Error(`Produto ${item.sku} não está disponível no catálogo.`);
    const product = { estoqueDisponivel: Number(row.estoque_disponivel ?? 0), statusEstoque: row.status_estoque ?? "" };
    if (vendaBloqueada(product)) throw new Error(`Produto ${item.product.codCadastro || item.sku}: Esgotado. Remova-o antes de salvar.`);
    if (somenteFirme && product.estoqueDisponivel < item.quantity) {
      throw new Error(`O estoque de ${item.sku} mudou. Revise o carrinho antes de salvar.`);
    }
  }
}