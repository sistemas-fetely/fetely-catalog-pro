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
    useCatalog.getState().hydrate(),
  ]);

  try {
    await retrySyncLocalCache();
  } catch (err) {
    console.error("[fopBootstrap] retrySync falhou:", err);
  }

  await maybeSeedCatalog(auth.roles);
}

/**
 * Reaproveita o cache local (zustand persist) pra reempurrar ao banco quaisquer
 * pedidos/clientes/provisões que não chegaram lá (ex: falha 403 anterior).
 * Idempotente — só envia o que falta.
 */
async function retrySyncLocalCache(): Promise<void> {
  const localOrders = readPersistedArray<SavedOrder>("fetely-order", "history");
  const localClientes = readPersistedArray<Cliente>("fetely_clientes_v1", "clientes");
  const localProvisoes = readPersistedArray<ProvisaoFutura>("fetely_provisoes_v1", "provisoes");

  if (localClientes.length > 0) {
    const ids = localClientes.map((c) => c.id);
    const { data } = await supabase.from("clientes").select("id").in("id", ids);
    const existing = new Set((data ?? []).map((r) => r.id as string));
    const missing = localClientes.filter((c) => !existing.has(c.id));
    if (missing.length > 0) {
      console.info(`[fopBootstrap] retrySync: empurrando ${missing.length} clientes ausentes`);
      const { error } = await supabase
        .from("clientes")
        .upsert(missing.map(clienteToRow) as never, { onConflict: "id" });
      if (error) console.error("[fopBootstrap] retrySync clientes falhou:", error);
      else await useClientes.getState().hydrate();
    }
  }

  if (localOrders.length > 0) {
    const ids = localOrders.map((o) => o.id);
    const { data } = await supabase.from("orders").select("id").in("id", ids);
    const existing = new Set((data ?? []).map((r) => r.id as string));
    const missing = localOrders.filter((o) => !existing.has(o.id));
    if (missing.length > 0) {
      console.info(`[fopBootstrap] retrySync: empurrando ${missing.length} pedidos ausentes`);
      const { error: errO } = await supabase
        .from("orders")
        .upsert(missing.map(orderToRow) as never, { onConflict: "id" });
      if (errO) {
        console.error("[fopBootstrap] retrySync orders falhou:", errO);
      } else {
        const missingIds = missing.map((o) => o.id);
        await supabase.from("order_items").delete().in("order_id", missingIds);
        const itemRows = (await Promise.all(missing.map(orderItemsToRows))).flat();
        if (itemRows.length > 0) {
          const { error: errI } = await supabase
            .from("order_items")
            .insert(itemRows as never);
          if (errI) console.error("[fopBootstrap] retrySync order_items falhou:", errI);
        }
        await useOrder.getState().hydrate();
      }
    }
  }

  if (localProvisoes.length > 0) {
    const ids = localProvisoes.map((p) => p.id);
    const { data } = await supabase.from("provisoes").select("id").in("id", ids);
    const existing = new Set((data ?? []).map((r) => r.id as string));
    const missing = localProvisoes.filter((p) => !existing.has(p.id));
    if (missing.length > 0) {
      console.info(`[fopBootstrap] retrySync: empurrando ${missing.length} provisões ausentes`);
      const { error: errP } = await supabase
        .from("provisoes")
        .upsert(missing.map(provisaoToRow) as never, { onConflict: "id" });
      if (errP) {
        console.error("[fopBootstrap] retrySync provisoes falhou:", errP);
      } else {
        const missingIds = missing.map((p) => p.id);
        await supabase.from("provisao_itens").delete().in("provisao_id", missingIds);
        const itemRows = missing.flatMap(provisaoItensToRows);
        if (itemRows.length > 0) {
          const { error: errPI } = await supabase
            .from("provisao_itens")
            .insert(itemRows as never);
          if (errPI) console.error("[fopBootstrap] retrySync provisao_itens falhou:", errPI);
        }
        await useProvisao.getState().hydrate();
      }
    }
  }
}

async function maybeSeedCatalog(roles: AppRole[]): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CATALOG_SEED_FLAG) === "done") return;
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  if (!isAdminOrMaster) return;
  try {
    const { count, error } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    if ((count ?? 0) > 0) {
      localStorage.setItem(CATALOG_SEED_FLAG, "done");
      return;
    }
    console.info(`[fopBootstrap] populando ${DEFAULT_PRODUCTS.length} produtos default no banco...`);
    await upsertProductsChunked(DEFAULT_PRODUCTS.map(productToRow));
    await useCatalog.getState().hydrate();
    localStorage.setItem(CATALOG_SEED_FLAG, "done");
    console.info("[fopBootstrap] catálogo default carregado no banco");
  } catch (err) {
    console.error("[fopBootstrap] auto-seed catálogo falhou:", err);
  }
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
      const allItemRows = (await Promise.all(oldOrders.map(orderItemsToRows))).flat();
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
