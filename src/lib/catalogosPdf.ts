// Catálogos PDF — camada de dados.
// Bucket "catalogos" é privado; os arquivos são servidos pelo proxy público
// same-origin /api/public/catalogo-file (link compartilhável com o cliente).

import { supabase } from "@/integrations/supabase/client";

export interface CatalogoPdf {
  id: string;
  nome: string;
  descricao: string | null;
  colecao: string | null;
  capa_url: string | null;
  capa_path: string | null;
  pdf_url: string;
  pdf_path: string;
  tamanho_bytes: number | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

// URL pública do site publicado — links compartilhados com o cliente devem
// sempre apontar para o domínio de produção, nunca para o preview.
const BASE_PUBLICA = "https://fetely-catalog-pro.lovable.app";

/** URL pública absoluta do arquivo no bucket privado (via proxy). */
export function urlArquivo(path: string, download = false): string {
  const p = `${BASE_PUBLICA}/api/public/catalogo-file?path=${encodeURIComponent(path)}`;
  return download ? `${p}&dl=1` : p;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "catalogo";
}

const LIMITE_BYTES = 1024 * 1024 * 1024; // 1 GB

export async function uploadCatalogoArquivo(
  file: File,
  tipo: "pdfs" | "capas",
  nomeBase: string,
): Promise<string> {
  if (file.size > LIMITE_BYTES) {
    throw new Error(
      `O arquivo tem ${(file.size / (1024 * 1024)).toFixed(0)} MB e o limite é 1 GB.`,
    );
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${tipo}/${slug(nomeBase)}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("catalogos")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

export async function listarCatalogos(
  incluirInativos = false,
): Promise<CatalogoPdf[]> {
  let q = supabase
    .from("catalogos_pdf")
    .select("*")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: false });
  if (!incluirInativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogoPdf[];
}

export async function salvarCatalogo(
  patch: Partial<CatalogoPdf> & { nome: string; pdf_path: string },
): Promise<void> {
  const row = {
    nome: patch.nome,
    descricao: patch.descricao ?? null,
    colecao: patch.colecao ?? null,
    capa_path: patch.capa_path ?? null,
    capa_url: patch.capa_path ? urlArquivo(patch.capa_path) : null,
    pdf_path: patch.pdf_path,
    pdf_url: urlArquivo(patch.pdf_path),
    tamanho_bytes: patch.tamanho_bytes ?? null,
    ordem: patch.ordem ?? 0,
    ativo: patch.ativo ?? true,
    updated_at: new Date().toISOString(),
  };
  if (patch.id) {
    const { error } = await supabase
      .from("catalogos_pdf")
      .update(row)
      .eq("id", patch.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("catalogos_pdf").insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function excluirCatalogo(id: string): Promise<void> {
  const { error } = await supabase.from("catalogos_pdf").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from("catalogos_pdf")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
