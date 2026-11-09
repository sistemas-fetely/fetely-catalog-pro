import { loadCatalogLists } from "./catalogProductPersistence";
import { supabase } from "@/integrations/supabase/client";
import { normalizeName, type CatalogLists, type NewValue } from "./catalogSpreadsheet";

export async function loadLists(): Promise<CatalogLists> {
  return loadCatalogLists(supabase);
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
