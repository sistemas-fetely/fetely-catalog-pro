import { createCatalogDimensionValue, loadCatalogLists } from "./catalogProductPersistence";
import { supabase } from "@/integrations/supabase/client";
import { type CatalogLists, type NewValue } from "./catalogSpreadsheet";

export async function loadLists(): Promise<CatalogLists> {
  return loadCatalogLists(supabase);
}

export async function createValue(value: NewValue, lists: CatalogLists) {
  const created = await createCatalogDimensionValue(supabase, value, lists);
  return created.nome;
}
