// Academia Inteligente — chunking, embeddings e FAQ com IA (SOMENTE servidor).
// A chave da IA (LOVABLE_API_KEY) nunca sai daqui; o front chama os server fns.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "openai/text-embedding-3-small";
const CHAT_MODEL = "google/gemini-3.7-flash";
const MATCH_LIMIT = 8;
const LIMIAR_SIMILARIDADE = 0.3;
const EMBED_LOTE = 50;

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FaqFonte, FaqPerguntaRow, FaqResposta } from "./academia";

function gatewayKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY não está configurada no servidor.");
  return key;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${GATEWAY_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayKey()}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`Falha ao gerar embeddings [${res.status}]: ${corpo}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function chatCompletar(system: string, user: string): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayKey()}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`Falha ao consultar a IA [${res.status}]: ${corpo}`);
  }
  const json = (await res.json()) as any;
  return String(json.choices?.[0]?.message?.content ?? "").trim();
}

export async function assertAdminAcademia(
  supabase: any,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("is_admin_or_master", {
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

// ------------------------------------------------------------- Chunking

interface ModuloRow {
  id: string;
  titulo: string;
  descricao: string | null;
}
interface AulaRow {
  id: string;
  titulo: string;
}
interface BlocoRow {
  id: string;
  aula_id: string;
  tipo: string;
  conteudo_texto: string | null;
  descritivo: { tempo: string; fala: string }[] | null;
  faq_conhecimento: string | null;
}

interface ChunkMontado {
  origem_tipo: "titulo" | "texto" | "descritivo" | "faq";
  aula_id: string | null;
  bloco_id: string | null;
  texto: string;
  timestamp_video: string | null;
}

function quebrarTexto(t: string): string[] {
  return t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 20);
}

function montarChunks(
  modulo: ModuloRow,
  aulas: AulaRow[],
  blocos: BlocoRow[],
): ChunkMontado[] {
  const chunks: ChunkMontado[] = [];
  chunks.push({
    origem_tipo: "titulo",
    aula_id: null,
    bloco_id: null,
    texto: `Módulo: ${modulo.titulo}. ${modulo.descricao ?? ""}`.trim(),
    timestamp_video: null,
  });
  for (const aula of aulas) {
    chunks.push({
      origem_tipo: "titulo",
      aula_id: aula.id,
      bloco_id: null,
      texto: `Módulo: ${modulo.titulo} · Aula: ${aula.titulo}`,
      timestamp_video: null,
    });
    for (const b of blocos.filter((x) => x.aula_id === aula.id)) {
      if (b.tipo === "texto" && b.conteudo_texto) {
        for (const p of quebrarTexto(b.conteudo_texto)) {
          chunks.push({
            origem_tipo: "texto",
            aula_id: aula.id,
            bloco_id: b.id,
            texto: `${modulo.titulo} · ${aula.titulo}: ${p}`,
            timestamp_video: null,
          });
        }
      }
      if (b.tipo === "video" && Array.isArray(b.descritivo)) {
        for (const seg of b.descritivo) {
          if (!seg?.fala || !seg?.tempo) continue;
          chunks.push({
            origem_tipo: "descritivo",
            aula_id: aula.id,
            bloco_id: b.id,
            texto: `${modulo.titulo} · ${aula.titulo} (vídeo em ${seg.tempo}): ${seg.fala}`,
            timestamp_video: seg.tempo,
          });
        }
      }
      // Conhecimento oculto do bloco: alimenta o FAQ, nunca aparece na aula.
      if (b.faq_conhecimento) {
        for (const p of quebrarTexto(b.faq_conhecimento)) {
          chunks.push({
            origem_tipo: "faq",
            aula_id: aula.id,
            bloco_id: b.id,
            texto: `${modulo.titulo} · ${aula.titulo} (nota interna): ${p}`,
            timestamp_video: null,
          });
        }
      }
    }
  }
  return chunks;
}

// ------------------------------------------------------------- Indexação

export async function reindexarModulo(
  moduloId: string,
): Promise<{ chunks: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;

  const { data: modulo, error: e1 } = await db
    .from("treinamento_modulo")
    .select("id,titulo,descricao")
    .eq("id", moduloId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!modulo) throw new Error("Módulo não encontrado");

  const { data: aulas, error: e2 } = await db
    .from("treinamento_aula")
    .select("id,titulo")
    .eq("modulo_id", moduloId)
    .order("ordem", { ascending: true });
  if (e2) throw new Error(e2.message);

  const aulaIds = (aulas ?? []).map((a: AulaRow) => a.id);
  let blocos: BlocoRow[] = [];
  if (aulaIds.length > 0) {
    const { data: b, error: e3 } = await db
      .from("treinamento_bloco")
      .select("id,aula_id,tipo,conteudo_texto,descritivo,faq_conhecimento")
      .in("aula_id", aulaIds);
    if (e3) throw new Error(e3.message);
    blocos = b ?? [];
  }

  await db.from("kb_chunk").delete().eq("modulo_id", moduloId);

  const chunks = montarChunks(modulo as ModuloRow, aulas ?? [], blocos);
  let inseridos = 0;
  for (let i = 0; i < chunks.length; i += EMBED_LOTE) {
    const lote = chunks.slice(i, i + EMBED_LOTE);
    const embs = await embedTexts(lote.map((c) => c.texto));
    const rows = lote.map((c, j) => ({
      origem_tipo: c.origem_tipo,
      modulo_id: moduloId,
      aula_id: c.aula_id,
      bloco_id: c.bloco_id,
      texto: c.texto,
      timestamp_video: c.timestamp_video,
      embedding: JSON.stringify(embs[j]),
      atualizado_em: new Date().toISOString(),
    }));
    const { error } = await db.from("kb_chunk").insert(rows);
    if (error) throw new Error(error.message);
    inseridos += rows.length;
  }
  return { chunks: inseridos };
}

export async function reindexarTudo(): Promise<{
  modulos: number;
  chunks: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;
  const { data, error } = await db.from("treinamento_modulo").select("id");
  if (error) throw new Error(error.message);
  let total = 0;
  for (const m of data ?? []) {
    const r = await reindexarModulo(m.id as string);
    total += r.chunks;
  }
  const faq = await reindexarFaqBase();
  return { modulos: (data ?? []).length, chunks: total + faq.chunks };
}

// ------------------------------------------- Base de conhecimento manual
// Entradas soltas (sem módulo/aula) que só alimentam o FAQ. Ficam em kb_chunk
// com modulo_id NULL e origem_tipo 'faq_manual' — o match as trata como
// visíveis para todos os perfis.

export interface FaqConhecimentoInput {
  id?: string;
  titulo: string;
  conteudo: string;
  ativo: boolean;
}

export async function reindexarFaqBase(): Promise<{ chunks: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;

  await db.from("kb_chunk").delete().eq("origem_tipo", "faq_manual");

  const { data: itens, error } = await db
    .from("faq_conhecimento")
    .select("id,titulo,conteudo")
    .eq("ativo", true)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(error.message);

  const chunks: { texto: string }[] = [];
  for (const it of itens ?? []) {
    for (const p of quebrarTexto(`${it.titulo}\n\n${it.conteudo}`)) {
      chunks.push({ texto: `Base de conhecimento · ${it.titulo}: ${p}` });
    }
  }
  let inseridos = 0;
  for (let i = 0; i < chunks.length; i += EMBED_LOTE) {
    const lote = chunks.slice(i, i + EMBED_LOTE);
    const embs = await embedTexts(lote.map((c) => c.texto));
    const rows = lote.map((c, j) => ({
      origem_tipo: "faq_manual",
      modulo_id: null,
      aula_id: null,
      bloco_id: null,
      texto: c.texto,
      timestamp_video: null,
      embedding: JSON.stringify(embs[j]),
      atualizado_em: new Date().toISOString(),
    }));
    const { error: eIns } = await db.from("kb_chunk").insert(rows);
    if (eIns) throw new Error(eIns.message);
    inseridos += rows.length;
  }
  return { chunks: inseridos };
}

export async function listarFaqBase(
  supabase: any,
): Promise<{ itens: FaqConhecimentoRow[] }> {
  const { data, error } = await supabase
    .from("faq_conhecimento")
    .select("id,titulo,conteudo,ativo,atualizado_em")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return { itens: (data ?? []) as FaqConhecimentoRow[] };
}

export async function salvarFaqBase(
  supabase: any,
  input: FaqConhecimentoInput,
): Promise<{ id: string; chunks: number }> {
  if (input.id) {
    const { error } = await supabase
      .from("faq_conhecimento")
      .update({
        titulo: input.titulo,
        conteudo: input.conteudo,
        ativo: input.ativo,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    const r = await reindexarFaqBase();
    return { id: input.id, chunks: r.chunks };
  }
  const { data, error } = await supabase
    .from("faq_conhecimento")
    .insert({
      titulo: input.titulo,
      conteudo: input.conteudo,
      ativo: input.ativo,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const r = await reindexarFaqBase();
  return { id: data.id as string, chunks: r.chunks };
}

export async function excluirFaqBase(
  supabase: any,
  id: string,
): Promise<{ chunks: number }> {
  const { error } = await supabase.from("faq_conhecimento").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return reindexarFaqBase();
}

// ------------------------------------------------------------- FAQ

const SYSTEM_PROMPT = `Você é o FAQ da Academia Fetély, a central de treinamento do time comercial da Fetély (velas e artigos de celebração, B2B).

Regras inegociáveis:
- Responda SOMENTE com base nos trechos fornecidos. É proibido inventar passos, regras, prazos, valores ou políticas que não estejam nos trechos.
- Se os trechos não responderem à pergunta, diga com clareza: "Ainda não temos um conteúdo sobre isso na Academia." — e não chute.
- Ao usar uma informação, cite o trecho de origem no final da frase, no formato [n].
- Tom Fetély: direto, claro, sem enrolação. Use passo a passo quando fizer sentido.
- Responda sempre em português do Brasil.`;

export async function responderPergunta(
  supabase: any,
  userId: string,
  pergunta: string,
): Promise<FaqResposta> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tipo_vendedor")
    .eq("id", userId)
    .maybeSingle();
  const verInterno = profile?.tipo_vendedor !== "representante";

  const [qEmb] = await embedTexts([pergunta]);
  const { data: matches, error } = await supabase.rpc("match_kb_chunks", {
    p_embedding: JSON.stringify(qEmb),
    p_limit: MATCH_LIMIT,
    p_ver_interno: verInterno,
  });
  if (error) throw new Error(error.message);

  const lista = (matches ?? []) as any[];
  const relevantes = lista.filter((m) => (m.similaridade ?? 0) >= LIMIAR_SIMILARIDADE);

  // Títulos para citação
  const moduloIds = [...new Set(lista.map((m) => m.modulo_id as string))];
  const aulaIds = [
    ...new Set(lista.map((m) => m.aula_id as string | null).filter(Boolean)),
  ] as string[];
  const modMap = new Map<string, string>();
  const aulaMap = new Map<string, string>();
  if (moduloIds.length > 0) {
    const { data: ms } = await supabase
      .from("treinamento_modulo")
      .select("id,titulo")
      .in("id", moduloIds);
    for (const m of ms ?? []) modMap.set(m.id, m.titulo);
  }
  if (aulaIds.length > 0) {
    const { data: as } = await supabase
      .from("treinamento_aula")
      .select("id,titulo")
      .in("id", aulaIds);
    for (const a of as ?? []) aulaMap.set(a.id, a.titulo);
  }

  const fontesDe = (rows: any[]): FaqFonte[] => {
    const seen = new Set<string>();
    const out: FaqFonte[] = [];
    for (const m of rows) {
      const key = `${m.modulo_id}|${m.aula_id ?? ""}|${m.timestamp_video ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        modulo_id: m.modulo_id,
        modulo_titulo: modMap.get(m.modulo_id) ?? "Módulo",
        aula_id: m.aula_id ?? null,
        aula_titulo: m.aula_id ? (aulaMap.get(m.aula_id) ?? null) : null,
        timestamp: m.timestamp_video ?? null,
        trecho: m.texto,
      });
      if (out.length >= 3) break;
    }
    return out;
  };

  let resposta: string;
  let encontrou: boolean;
  let fontes: FaqFonte[];

  if (relevantes.length === 0) {
    encontrou = false;
    fontes = fontesDe(lista.slice(0, 1));
    resposta =
      "Ainda não temos um conteúdo sobre isso na Academia. " +
      (fontes.length > 0
        ? "O material mais próximo é o indicado abaixo — se não ajudar, fale com o time interno para criarmos esse conteúdo."
        : "Assim que um conteúdo relacionado for publicado, passo a responder por aqui.");
  } else {
    const contexto = relevantes
      .map((m, i) => {
        const origem =
          m.origem_tipo === "descritivo"
            ? `Módulo "${modMap.get(m.modulo_id) ?? ""}" · Aula "${aulaMap.get(m.aula_id) ?? ""}" · vídeo em ${m.timestamp_video}`
            : `Módulo "${modMap.get(m.modulo_id) ?? ""}"${m.aula_id ? ` · Aula "${aulaMap.get(m.aula_id) ?? ""}"` : ""}`;
        return `[${i + 1}] ${origem}\n"${m.texto}"`;
      })
      .join("\n\n");
    resposta = await chatCompletar(
      SYSTEM_PROMPT,
      `Pergunta: ${pergunta}\n\nTrechos da base de conhecimento:\n${contexto}`,
    );
    if (!resposta)
      resposta =
        "Ainda não temos um conteúdo sobre isso na Academia. Fale com o time interno para criarmos esse material.";
    encontrou = true;
    fontes = fontesDe(relevantes);
  }

  await supabase.from("faq_pergunta").insert({
    user_id: userId,
    pergunta,
    resposta,
    fontes,
    encontrou_resposta: encontrou,
  });

  return { resposta, encontrou, fontes };
}

// ------------------------------------------------------------- Painel

export async function listarDuvidas(
  supabase: any,
): Promise<{ perguntas: FaqPerguntaRow[] }> {
  const { data, error } = await supabase
    .from("faq_pergunta")
    .select("id,pergunta,resposta,encontrou_resposta,criado_em,user_id")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const userIds = [
    ...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)),
  ] as string[];
  const nomes = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: ps } = await supabase
      .from("profiles")
      .select("id,nome_completo,email")
      .in("id", userIds);
    for (const p of ps ?? [])
      nomes.set(p.id, p.nome_completo || p.email || "Usuário");
  }

  return {
    perguntas: (data ?? []).map((r: any) => ({
      id: r.id,
      pergunta: r.pergunta,
      resposta: r.resposta,
      encontrou_resposta: r.encontrou_resposta,
      criado_em: r.criado_em,
      usuario_nome: r.user_id ? (nomes.get(r.user_id) ?? null) : null,
    })),
  };
}
