import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createSafeStorage } from "@/lib/safeStorage";

// O JSON default do catálogo (1,2 MB) NÃO é importado estaticamente — fica num
// chunk separado carregado sob demanda (banco vazio, reset ou seed inicial).
let defaultProductsCache: Product[] | null = null;
async function loadDefaultProducts(): Promise<Product[]> {
  if (!defaultProductsCache) {
    const mod = await import("@/data/products");
    defaultProductsCache = mod.PRODUCTS;
  }
  return defaultProductsCache;
}


export type AuditAcao =
  | "criado" | "editado" | "desativado" | "reativado" | "duplicado" | "importado";

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
  source: "default" | "imported" | "banco";
  importedAt: string | null;
  hidratado: boolean;
  lastSyncAt: number;
  hydrate: (opts?: { force?: boolean }) => Promise<void>;
  setProducts: (products: Product[], meta?: AuditMeta) => Promise<void>;
  resetToDefault: () => void;
  upsertProduct: (p: Product, meta: AuditMeta) => { ok: true } | { ok: false; error: string };
  setFase: (sku: string, fase: string, meta: AuditMeta) => Promise<void>;
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

function makeAudit(
  meta: AuditMeta,
  produtoSku: string,
  produtoNome: string,
  acao: AuditAcao,
  camposAlterados?: AuditCampo[],
): AuditEntry {
  return {
    id: `A${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    usuarioId: meta.usuarioId,
    usuarioNome: meta.usuarioNome,
    produtoSku,
    produtoNome,
    acao,
    camposAlterados,
  };
}

const SIX_PACK_COLLECTIONS = new Set([
  "Le Moment",
  "Amour",
  "Lumi Star",
  "Twist",
  "Pattern",
  "Spirale",
]);

function applySixPackOverride(p: Product): Product {
  if (SIX_PACK_COLLECTIONS.has(p.colecao) && p.multiplos === 12) {
    return { ...p, multiplos: 6 };
  }
  return p;
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    sku: row.sku as string,
    codCadastro: (row.cod_cadastro as string | null) ?? "",
    ean: (row.ean as string | null) ?? "",
    marca: (row.marca as string) ?? "Fetély",
    linha: (row.linha as string | null) ?? "",
    categoria: row.categoria as string,
    departamento: (row.departamento as string | null) ?? undefined,
    grupo: row.grupo as string,
    tipo: (row.tipo as string | null) ?? "",
    familia: (row.familia as string | null) ?? "",
    colecao: row.colecao as string,
    subColecao: (row.sub_colecao as string | null) ?? undefined,
    subColecao2: (row.sub_colecao2 as string | null) ?? undefined,
    corNome: (row.cor_nome as string | null) ?? "",
    cor: (row.cor as string | null) ?? "",
    estampa: (row.estampa as string | null) ?? "",
    tamanhoNumero: (row.tamanho_numero as string | null) ?? "",
    tamanhoRef: (row.tamanho_ref as string | null) ?? "",
    nomeComercial: row.nome_comercial as string,
    nomeCompleto: (row.nome_completo as string | null) ?? undefined,
    metaDescricao: (row.meta_descricao as string | null) ?? undefined,
    descricaoColecao: (row.descricao_colecao as string | null) ?? undefined,
    descricaoProduto: (row.descricao_produto as string | null) ?? undefined,
    ncm: (row.ncm as string | null) ?? undefined,
    cest: (row.cest as string | null) ?? undefined,
    origemFisc: (row.origem_fisc as string | null) ?? undefined,
    origemProd: (row.origem_prod as string | null) ?? undefined,
    tipoEmbalagem: (row.tipo_embalagem as string | null) ?? undefined,
    material: (row.material as string | null) ?? "",
    materialDescritivo: (row.material_descritivo as string | null) ?? undefined,
    pesoG: Number(row.peso_g ?? 0),
    larguraCm: Number(row.largura_cm ?? 0),
    alturaCm: Number(row.altura_cm ?? 0),
    profundidadeCm:
      row.profundidade_cm == null ? undefined : Number(row.profundidade_cm),
    multiplos: Number(row.multiplos ?? 1),
    qtdKit: Number(row.qtd_kit ?? 1),
    precoVarejo: Number(row.preco_varejo ?? 0),
    precoAtacado: Number(row.preco_atacado ?? 0),
    statusEstoque: (row.status_estoque as string | null) ?? "em estoque",
    estoqueDisponivel: Number((row as { estoque_disponivel?: number | null }).estoque_disponivel ?? 0),
    isVelaNumerica: (row.is_vela_numerica as boolean) ?? false,
    numeroVela: (row.numero_vela as number | null) ?? null,
    ativo: (row.ativo as boolean) ?? true,
    fase: (row.fase as string | null) ?? "registrado",
    prontaEntrega: (row.pronta_entrega as boolean) ?? false,
  };
}

export function productToRow(p: Product): Record<string, unknown> {
  return {
    sku: p.sku,
    cod_cadastro: p.codCadastro || null,
    ean: p.ean || null,
    marca: p.marca || "Fetély",
    linha: p.linha || null,
    categoria: p.categoria,
    departamento: p.departamento ?? null,
    grupo: p.grupo,
    tipo: p.tipo || null,
    familia: p.familia || null,
    colecao: p.colecao,
    sub_colecao: p.subColecao ?? null,
    sub_colecao2: p.subColecao2 ?? null,
    cor_nome: p.corNome || null,
    cor: p.cor || null,
    estampa: p.estampa || null,
    tamanho_numero: p.tamanhoNumero || null,
    tamanho_ref: p.tamanhoRef || null,
    nome_comercial: p.nomeComercial,
    nome_completo: p.nomeCompleto ?? null,
    meta_descricao: p.metaDescricao ?? null,
    descricao_colecao: p.descricaoColecao ?? null,
    descricao_produto: p.descricaoProduto ?? null,
    ncm: p.ncm ?? null,
    cest: p.cest ?? null,
    origem_fisc: p.origemFisc ?? null,
    origem_prod: p.origemProd ?? null,
    tipo_embalagem: p.tipoEmbalagem ?? null,
    material: p.material || null,
    material_descritivo: p.materialDescritivo ?? null,
    peso_g: p.pesoG ?? 0,
    largura_cm: p.larguraCm ?? 0,
    altura_cm: p.alturaCm ?? 0,
    profundidade_cm: p.profundidadeCm ?? null,
    multiplos: p.multiplos ?? 1,
    qtd_kit: p.qtdKit ?? 1,
    preco_varejo: p.precoVarejo ?? 0,
    preco_atacado: p.precoAtacado ?? 0,
    status_estoque: p.statusEstoque || "em estoque",
    estoque_disponivel: p.estoqueDisponivel ?? 0,
    is_vela_numerica: p.isVelaNumerica ?? false,
    numero_vela: p.numeroVela ?? null,
    // `ativo` é derivado da fase por trigger no banco — escrever direto dá erro.
    // publicação só pelo botão Publicar, que valida a ficha no SNCF
    fase: p.fase ?? "registrado",
    pronta_entrega: p.prontaEntrega ?? false,
  };
}

// Caminho em massa não decide publicação nem fase. Omitir as duas faz o upsert
// preservar o valor atual da linha; em linha nova, vale o default do banco.
// Publicar é ato humano pelo botão Publicar, que valida a ficha no SNCF.
export function productToRowBulk(p: Product): Record<string, unknown> {
  const { ativo: _ativo, fase: _fase, ...row } = productToRow(p);
  return row;
}

async function upsertProductsChunked(rows: Record<string, unknown>[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("products")
      .upsert(slice as never, { onConflict: "sku" });
    if (error) {
      console.error(`[catalogStore] upsert chunk ${i}..${i + CHUNK} falhou:`, error);
      throw error;
    }
  }
}

function logAudit(entry: AuditEntry): void {
  supabase
    .from("catalog_audit")
    .insert({
      criado_em: entry.timestamp,
      usuario_id: entry.usuarioId || null,
      usuario_nome: entry.usuarioNome,
      produto_sku: entry.produtoSku,
      produto_nome: entry.produtoNome,
      acao: entry.acao,
      campos_alterados: (entry.camposAlterados ?? null) as never,
    } as never)
    .then(({ error }) => {
      if (error) console.error("[catalogStore] logAudit falhou:", error);
    });
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      products: [],
      audit: [],
      source: "default",
      importedAt: null,
      hidratado: false,
      lastSyncAt: 0,

      hydrate: async (opts) => {
        // Cache-first: catálogo muda raramente — só revalida após o TTL (5 min)
        // ou quando forçado. Em reloads, usa o cache persistido instantaneamente.
        const st = get();
        const TTL = 300_000;
        if (!opts?.force && st.products.length > 0 && Date.now() - st.lastSyncAt < TTL) {
          if (!st.hidratado) set({ hidratado: true });
          return;
        }
        try {
          const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("sku", { ascending: true });
          if (error) throw error;
          const products = (data ?? []).map((r) => applySixPackOverride(rowToProduct(r as Record<string, unknown>)));
          if (products.length > 0) {
            set({
              products,
              source: "banco",
              importedAt: null,
              hidratado: true,
              lastSyncAt: Date.now(),
            });
          } else {
            // Banco vazio — cai pro catálogo default embutido (chunk sob demanda)
            const defaults = await loadDefaultProducts();
            set({ products: defaults, source: "default", hidratado: true, lastSyncAt: Date.now() });
          }
        } catch (err) {
          console.error("[catalogStore] hydrate falhou:", err);
          // Sem rede e sem cache: tenta o catálogo default embutido
          if (get().products.length === 0) {
            try {
              const defaults = await loadDefaultProducts();
              set({ products: defaults, source: "default" });
            } catch {
              /* ignora — hidrata mesmo assim */
            }
          }
          set({ hidratado: true });
        }
      },

      setProducts: async (products, meta) => {
        set({
          products,
          source: "imported",
          importedAt: new Date().toISOString(),
          lastSyncAt: Date.now(),
        });
        (async () => {
          try {
            await upsertProductsChunked(products.map(productToRowBulk));
            if (meta) {
              const entry = makeAudit(
                meta,
                "BULK",
                `Importação de ${products.length} produtos`,
                "importado",
              );
              logAudit(entry);
              const state = get();
              set({ audit: [entry, ...state.audit].slice(0, 100) });
            }
          } catch (err) {
            console.error("[catalogStore] setProducts banco falhou:", err);
          }
        })();
      },

      resetToDefault: () => {
        void loadDefaultProducts().then((defaults) => {
          set({ products: defaults, source: "default", importedAt: null });
        });
        console.warn(
          "[catalogStore] resetToDefault aplicado só no estado local; o banco mantém o catálogo atual",
        );
      },

      upsertProduct: (p, meta) => {
        const state = get();
        const sku = p.sku.trim();
        if (!sku) return { ok: false, error: "SKU é obrigatório" };
        const idx = state.products.findIndex((x) => x.sku === sku);
        const existing = idx >= 0 ? state.products[idx] : null;
        if (!existing && state.products.some((x) => x.sku === sku)) {
          return { ok: false, error: "SKU já cadastrado" };
        }
        // publicação só pelo botão Publicar, que valida a ficha no SNCF
        const next: Product = { ...p, sku, ativo: p.ativo ?? false };
        const newProducts =
          idx >= 0
            ? state.products.map((x, i) => (i === idx ? next : x))
            : [...state.products, next];
        const entry = makeAudit(
          meta,
          sku,
          next.nomeComercial,
          existing ? "editado" : "criado",
          existing ? diffProducts(existing, next) : undefined,
        );
        set({ products: newProducts, audit: [entry, ...state.audit].slice(0, 100) });
        supabase
          .from("products")
          .upsert(productToRow(next) as never, { onConflict: "sku" })
          .then(({ error }) => {
            if (error) console.error("[catalogStore] upsertProduct banco falhou:", error);
            else logAudit(entry);
          });
        return { ok: true };
      },

      // `ativo` é derivado da fase por trigger no banco: aqui só se escreve `fase`.
      // A trigger recusa promoção sem ficha completa; a mensagem dela lista os campos
      // que faltam e por isso é propagada para a tela.
      setFase: async (sku, fase, meta) => {
        const state = get();
        const idx = state.products.findIndex((x) => x.sku === sku);
        if (idx < 0) return;
        const cur = state.products[idx];
        const publicando = fase === "pre_venda" || fase === "ativo";
        const { error } = await supabase
          .from("products")
          .update({ fase } as never)
          .eq("sku", sku);
        if (error) {
          console.error("[catalogStore] setFase banco falhou:", error);
          throw new Error(error.message);
        }
        const next = { ...cur, fase, ativo: publicando };
        const entry = makeAudit(
          meta,
          sku,
          cur.nomeComercial,
          publicando ? "reativado" : "desativado",
        );
        set({
          products: get().products.map((x, i) => (i === idx ? next : x)),
          audit: [entry, ...get().audit].slice(0, 100),
        });
        logAudit(entry);
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
          // publicação só pelo botão Publicar, que valida a ficha no SNCF
          fase: "registrado",
        };
        const entry = makeAudit(meta, newSku, copy.nomeComercial, "duplicado");
        set({
          products: [...state.products, copy],
          audit: [entry, ...state.audit].slice(0, 100),
        });
        supabase
          .from("products")
          .insert(productToRow(copy) as never)
          .then(({ error }) => {
            if (error) console.error("[catalogStore] duplicateProduct banco falhou:", error);
            else logAudit(entry);
          });
        return copy;
      },
    }),
    {
      name: "fetely-catalog",
      storage: createJSONStorage(createSafeStorage),
      version: 13,
      partialize: (state) => ({
        products: state.products,
        source: state.source,
        importedAt: state.importedAt,
        lastSyncAt: state.lastSyncAt,
      }) as never,
      migrate: (_persisted: unknown, _version) => {
        return {
          products: [],
          source: "default" as const,
          importedAt: null,
          lastSyncAt: 0,
        };
      },
    },
  ),
);

export { nextSkuFor, upsertProductsChunked };

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
  categoria?: string,
): Product[] {
  return products.filter(
    (p) =>
      p.ativo !== false &&
      p.colecao === colecao &&
      (!grupo || p.grupo === grupo) &&
      (!categoria || p.categoria === categoria) &&
      p.precoAtacado &&
      p.precoAtacado > 0,
  );
}

export function isNumericCollection(colecao: string): boolean {
  // Derivado do catálogo atual (banco/cache) — sem depender do JSON estático
  return useCatalog.getState().products.some(
    (p) => p.colecao === colecao && p.grupo === "Vela" && p.tipo === "Numérica",
  );
}
