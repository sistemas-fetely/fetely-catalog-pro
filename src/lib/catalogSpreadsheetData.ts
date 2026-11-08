import { supabase } from "@/integrations/supabase/client";
import { normalizeName, type CatalogLists, type Dimension, type NewValue } from "./catalogSpreadsheet";

export async function loadLists(): Promise<CatalogLists> {
  const results = await Promise.all([
    supabase.from("produto_grupos").select("id,nome,categoria_id"),
    supabase.from("produto_colecoes").select("id,nome"),
    supabase.from("produto_cores").select("id,nome"),
    supabase.from("produto_canal_dim").select("slug"),
    supabase.from("produto_categorias").select("id,nome"),
  ]);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  return {
    grupo: (results[0]?.data ?? []) as Dimension[],
    colecao: (results[1]?.data ?? []) as Dimension[],
    cor: (results[2]?.data ?? []) as Dimension[],
    canais: (results[3]?.data ?? []).map(d => String((d as { slug: string }).slug)),
    categorias: (results[4]?.data ?? []) as Dimension[],
  };
}

export async function createValue(value: NewValue, lists: CatalogLists) {
  const table = value.kind === "grupo" ? "produto_grupos" : value.kind === "colecao" ? "produto_colecoes" : "produto_cores";
  const fresh = await loadLists();
  const existing = fresh[value.kind].find(d => normalizeName(d.nome) === normalizeName(value.nome) && (value.kind !== "grupo" || d.categoria_id === value.categoriaId));
  if (existing) return existing.nome;
  if (value.kind === "grupo" && !value.categoriaId) throw new Error(`Grupo ${value.nome}: categoria não encontrada para criar este valor`);
  const { error } = await supabase.from(table).insert({ nome: value.nome, ...(value.kind === "grupo" ? { categoria_id: value.categoriaId } : {}) } as never);
  if (error) throw new Error(error.message);
  lists[value.kind].push({ id: "", nome: value.nome, categoria_id: value.categoriaId });
  return value.nome;
}
