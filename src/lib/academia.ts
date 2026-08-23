// Academia Fetély — tipos, helpers e camada de dados (cliente browser, RLS aplica).
// Bucket "academia" é privado: arquivos são servidos por URL assinada (1h).

import { supabase } from "@/integrations/supabase/client";

// As tabelas treinamento_* ainda não constam no types.ts gerado — acesso sem tipagem.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type VisibilidadeModulo = "todos" | "interno";
export type StatusModulo = "rascunho" | "publicado";
export type TipoBloco = "video" | "texto" | "imagem" | "anexo";

export interface TreinamentoModulo {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null; // path no bucket (não URL pública)
  ordem: number;
  visibilidade: VisibilidadeModulo;
  status: StatusModulo;
  criado_por: string | null;
  criado_em: string;
}

export interface TreinamentoAula {
  id: string;
  modulo_id: string;
  titulo: string;
  ordem: number;
}

export interface DescritivoSegmento {
  tempo: string; // "mm:ss" ou "hh:mm:ss"
  fala: string;
}

export interface TreinamentoBloco {
  id: string;
  aula_id: string;
  tipo: TipoBloco;
  ordem: number;
  conteudo_texto: string | null;
  youtube_id: string | null;
  arquivo_url: string | null; // path no bucket
  arquivo_nome: string | null;
  descritivo: DescritivoSegmento[] | null; // só blocos de vídeo
  faq_conhecimento: string | null; // conhecimento oculto: alimenta o FAQ, nunca renderiza
}

// ------------------------------------------------------------- FAQ (tipos)

export interface FaqFonte {
  modulo_id: string | null; // null = veio da base de conhecimento manual
  modulo_titulo: string;
  aula_id: string | null;
  aula_titulo: string | null;
  timestamp: string | null;
  trecho: string;
}

export interface FaqConhecimentoRow {
  id: string;
  titulo: string;
  conteudo: string;
  ativo: boolean;
  atualizado_em: string;
}

export interface FaqResposta {
  resposta: string;
  encontrou: boolean;
  fontes: FaqFonte[];
}

export interface FaqPerguntaRow {
  id: string;
  pergunta: string;
  resposta: string | null;
  encontrou_resposta: boolean;
  criado_em: string;
  usuario_nome: string | null;
}

export interface AulaComBlocos extends TreinamentoAula {
  blocos: TreinamentoBloco[];
}

export interface ModuloResumo extends TreinamentoModulo {
  total_aulas: number;
  aula_ids: string[];
}

// ---------------------------------------------------------------- YouTube

/** Extrai o ID de URLs watch?v=, youtu.be/, /embed/ e /shorts/. */
export function extrairYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m ? m[1] : null;
}

// ------------------------------------------------------------- Descritivo

/** "mm:ss" | "hh:mm:ss" | segundos puros → segundos. */
export function tempoParaSegundos(t: string): number {
  const parts = t.trim().split(":").map(Number);
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Parse do texto do admin: uma linha por segmento, "mm:ss fala". */
export function parseDescritivo(texto: string): DescritivoSegmento[] {
  const out: DescritivoSegmento[] = [];
  for (const line of texto.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{1,3}(?::\d{2}){1,2})\s+(.+)$/);
    if (m) out.push({ tempo: m[1], fala: m[2].trim() });
  }
  return out;
}

export function descritivoParaTexto(
  seg: DescritivoSegmento[] | null | undefined,
): string {
  return (seg ?? []).map((s) => `${s.tempo} ${s.fala}`).join("\n");
}

// ------------------------------------------------------- Texto rico (markdown-lite)
// Suporta: # ## ### títulos, **negrito**, *itálico*, - listas, [texto](https://...)
// O HTML é escapado antes da formatação — seguro contra injeção.

function inlineMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-gold underline underline-offset-2 hover:text-gold-light">$1</a>',
    );
}

export function renderRichText(src: string): string {
  const esc = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const out: string[] = [];
  let inList = false;
  for (const rawLine of esc.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const isItem = /^- /.test(line);
    if (inList && !isItem) {
      out.push("</ul>");
      inList = false;
    }
    if (isItem) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 space-y-1 my-2">');
        inList = true;
      }
      out.push(`<li>${inlineMd(line.slice(2))}</li>`);
      continue;
    }
    if (line === "") {
      out.push('<div class="h-3"></div>');
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(`<h4 class="font-display text-lg mt-4 mb-1">${inlineMd(line.slice(4))}</h4>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h3 class="font-display text-xl mt-4 mb-1">${inlineMd(line.slice(3))}</h3>`);
    } else if (line.startsWith("# ")) {
      out.push(`<h2 class="font-display text-2xl mt-4 mb-1">${inlineMd(line.slice(2))}</h2>`);
    } else {
      out.push(`<p class="my-1 leading-relaxed">${inlineMd(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

// ---------------------------------------------------------------- Storage

export async function uploadAcademia(
  file: File,
  pasta: "capas" | "blocos",
): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${pasta}/${crypto.randomUUID()}.${ext || "bin"}`;
  const { error } = await supabase.storage.from("academia").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

/** Assina vários paths de uma vez. Devolve mapa path → URL temporária. */
export async function assinarPaths(paths: string[]): Promise<Record<string, string>> {
  const validos = [...new Set(paths.filter((p) => p && !/^https?:\/\//.test(p)))];
  if (validos.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("academia")
    .createSignedUrls(validos, 3600);
  if (error) return {};
  const mapa: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) mapa[row.path] = row.signedUrl;
  }
  return mapa;
}

// ---------------------------------------------------------------- Leitura

export async function listarModulos(): Promise<ModuloResumo[]> {
  const { data, error } = await db
    .from("treinamento_modulo")
    .select("*, aulas:treinamento_aula(id)")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: Record<string, unknown>) => {
    const aulas = (m.aulas as { id: string }[] | null) ?? [];
    const { aulas: _omit, ...rest } = m;
    void _omit;
    return {
      ...(rest as unknown as TreinamentoModulo),
      total_aulas: aulas.length,
      aula_ids: aulas.map((a) => a.id),
    };
  });
}

export async function obterModulo(
  id: string,
): Promise<{ modulo: TreinamentoModulo; aulas: AulaComBlocos[] } | null> {
  const { data: modulo, error: e1 } = await db
    .from("treinamento_modulo")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!modulo) return null;

  const { data: aulas, error: e2 } = await db
    .from("treinamento_aula")
    .select("*")
    .eq("modulo_id", id)
    .order("ordem", { ascending: true });
  if (e2) throw new Error(e2.message);

  const aulaIds = (aulas ?? []).map((a: TreinamentoAula) => a.id);
  let blocos: TreinamentoBloco[] = [];
  if (aulaIds.length > 0) {
    const { data: b, error: e3 } = await db
      .from("treinamento_bloco")
      .select("*")
      .in("aula_id", aulaIds)
      .order("ordem", { ascending: true });
    if (e3) throw new Error(e3.message);
    blocos = b ?? [];
  }

  return {
    modulo: modulo as TreinamentoModulo,
    aulas: (aulas ?? []).map((a: TreinamentoAula) => ({
      ...a,
      blocos: blocos.filter((b) => b.aula_id === a.id),
    })),
  };
}

export async function meuProgresso(userId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("treinamento_progresso")
    .select("aula_id")
    .eq("user_id", userId)
    .eq("concluida", true);
  if (error) return new Set();
  return new Set((data ?? []).map((r: { aula_id: string }) => r.aula_id));
}

export async function marcarAula(
  userId: string,
  aulaId: string,
  concluida: boolean,
): Promise<void> {
  const { error } = await db.from("treinamento_progresso").upsert(
    {
      user_id: userId,
      aula_id: aulaId,
      concluida,
      concluida_em: concluida ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,aula_id" },
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- Admin

export async function salvarModulo(
  m: Partial<TreinamentoModulo> & { titulo: string },
): Promise<string> {
  if (m.id) {
    const { id: _id, criado_em: _c, criado_por: _p, ...rest } = m;
    void _id; void _c; void _p;
    const { error } = await db.from("treinamento_modulo").update(rest).eq("id", m.id);
    if (error) throw new Error(error.message);
    return m.id;
  }
  const { data: maxRow } = await db
    .from("treinamento_modulo")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("treinamento_modulo")
    .insert({ ...m, ordem: (maxRow?.ordem ?? -1) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function excluirModulo(id: string): Promise<void> {
  const { error } = await db.from("treinamento_modulo").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function salvarAula(a: {
  id?: string;
  modulo_id: string;
  titulo: string;
  ordem?: number;
}): Promise<string> {
  if (a.id) {
    const { error } = await db
      .from("treinamento_aula")
      .update({ titulo: a.titulo })
      .eq("id", a.id);
    if (error) throw new Error(error.message);
    return a.id;
  }
  const { data: maxRow } = await db
    .from("treinamento_aula")
    .select("ordem")
    .eq("modulo_id", a.modulo_id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("treinamento_aula")
    .insert({ modulo_id: a.modulo_id, titulo: a.titulo, ordem: (maxRow?.ordem ?? -1) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function excluirAula(id: string): Promise<void> {
  const { error } = await db.from("treinamento_aula").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function salvarBloco(
  b: Partial<TreinamentoBloco> & { aula_id: string; tipo: TipoBloco },
): Promise<string> {
  if (b.id) {
    const { id: _id, aula_id: _a, ...rest } = b;
    void _id; void _a;
    const { error } = await db.from("treinamento_bloco").update(rest).eq("id", b.id);
    if (error) throw new Error(error.message);
    return b.id;
  }
  const { data: maxRow } = await db
    .from("treinamento_bloco")
    .select("ordem")
    .eq("aula_id", b.aula_id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("treinamento_bloco")
    .insert({ ...b, ordem: (maxRow?.ordem ?? -1) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function excluirBloco(id: string): Promise<void> {
  const { error } = await db.from("treinamento_bloco").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Troca a ordem de duas linhas vizinhas (módulo, aula ou bloco). */
export async function trocarOrdem(
  tabela: "treinamento_modulo" | "treinamento_aula" | "treinamento_bloco",
  a: { id: string; ordem: number },
  b: { id: string; ordem: number },
): Promise<void> {
  const r1 = await db.from(tabela).update({ ordem: b.ordem }).eq("id", a.id);
  if (r1.error) throw new Error(r1.error.message);
  const r2 = await db.from(tabela).update({ ordem: a.ordem }).eq("id", b.id);
  if (r2.error) throw new Error(r2.error.message);
}
