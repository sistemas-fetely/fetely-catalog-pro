import { useAuth, type AppRole } from "@/store/authStore";
import { useOrder, orderToRow, orderItemsToRows } from "@/store/orderStore";
import { useClientes, clienteToRow } from "@/store/clienteStore";
import { useProvisao, provisaoToRow, provisaoItensToRows } from "@/store/provisaoStore";
import { useCartilhas } from "@/store/cartilhasStore";
import { useCatalog, upsertProductsChunked, productToRow } from "@/store/catalogStore";
import { PRODUCTS as DEFAULT_PRODUCTS } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import type { SavedOrder } from "@/types";
import type { Cliente } from "@/types/cliente";
import type { ProvisaoFutura } from "@/types/provisao";

const MIGRATION_FLAG = "fetely_migracao_v1_concluida";
const CATALOG_SEED_FLAG = "fetely_catalog_seed_v1";

/**
 * Bootstrap do FOP após login:
 * 1) Roda migração one-shot de localStorage pro banco (se ainda não rodou)
 * 2) Hidrata os 3 stores a partir do banco
 *
 * Idempotente. Seguro pra chamar várias vezes.
 */
export async function bootstrapFopAfterLogin(): Promise<void> {
  const auth = useAuth.getState();
  if (!auth.user) return;

  try {
    await maybeRunMigration();
  } catch (err) {
    console.error("[fopBootstrap] migração falhou:", err);
  }

  await Promise.all([
    useClientes.getState().hydrate(),
    useOrder.getState().hydrate(),
    useProvisao.getState().hydrate(),
    useCartilhas.getState().hydrate(),
  ]);
}

async function maybeRunMigration(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MIGRATION_FLAG) === "true") return;

  const auth = useAuth.getState();
  if (!auth.user) return;

  const oldClientes = readPersistedArray<Cliente>("fetely_clientes_v1", "clientes");
  const oldOrders = readPersistedArray<SavedOrder>("fetely-order", "history");
  const oldProvisoes = readPersistedArray<ProvisaoFutura>("fetely_provisoes_v1", "provisoes");

  const nada =
    oldClientes.length === 0 &&
    oldOrders.length === 0 &&
    oldProvisoes.length === 0;

  if (nada) {
    window.localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  console.info("[fopBootstrap] migrando localStorage → banco:", {
    clientes: oldClientes.length,
    orders: oldOrders.length,
    provisoes: oldProvisoes.length,
  });

  if (oldClientes.length > 0) {
    const rows = oldClientes.map(clienteToRow);
    const { error } = await supabase
      .from("clientes")
      .upsert(rows as never, { onConflict: "id" });
    if (error) console.error("[fopBootstrap] upsert clientes falhou:", error);
  }

  if (oldOrders.length > 0) {
    const orderRows = oldOrders.map(orderToRow);
    const { error: errO } = await supabase
      .from("orders")
      .upsert(orderRows as never, { onConflict: "id" });
    if (errO) {
      console.error("[fopBootstrap] upsert orders falhou:", errO);
    } else {
      const orderIds = oldOrders.map((o) => o.id);
      await supabase.from("order_items").delete().in("order_id", orderIds);
      const allItemRows = oldOrders.flatMap(orderItemsToRows);
      if (allItemRows.length > 0) {
        const { error: errI } = await supabase
          .from("order_items")
          .insert(allItemRows as never);
        if (errI) console.error("[fopBootstrap] insert order_items falhou:", errI);
      }
    }
  }

  if (oldProvisoes.length > 0) {
    const provRows = oldProvisoes.map(provisaoToRow);
    const { error: errP } = await supabase
      .from("provisoes")
      .upsert(provRows as never, { onConflict: "id" });
    if (errP) {
      console.error("[fopBootstrap] upsert provisoes falhou:", errP);
    } else {
      const provIds = oldProvisoes.map((p) => p.id);
      await supabase.from("provisao_itens").delete().in("provisao_id", provIds);
      const allItemRows = oldProvisoes.flatMap(provisaoItensToRows);
      if (allItemRows.length > 0) {
        const { error: errPI } = await supabase
          .from("provisao_itens")
          .insert(allItemRows as never);
        if (errPI) console.error("[fopBootstrap] insert provisao_itens falhou:", errPI);
      }
    }
  }

  window.localStorage.setItem(MIGRATION_FLAG, "true");
  console.info("[fopBootstrap] migração concluída");
}

function readPersistedArray<T>(storageKey: string, stateKey: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = parsed?.state?.[stateKey];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch (err) {
    console.warn(`[fopBootstrap] falha ao ler ${storageKey}.${stateKey}:`, err);
    return [];
  }
}
