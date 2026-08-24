// Academia Inteligente — chunking, embeddings e FAQ com IA (SOMENTE servidor).
// Trechos com modulo_id NULL vêm da base de conhecimento manual (faq_conhecimento).
// A chave da IA (LOVABLE_API_KEY) nunca sai daqui; o front chama os server fns.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "openai/text-embedding-3-small";
const CHAT_MODEL = "google/gemini-3.7-flash";
const MATCH_LIMIT = 8;
const LIMIAR_SIMILARIDADE = 0.3;
const EMBED_LOTE = 50;

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  FaqConhecimentoRow,
  FaqFonte,
  FaqPerguntaRow,
  FaqResposta,
} from "./academia";

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

// ------------------------------------- Contexto cadastral (tempo real)
// O FAQ responde também com os cadastros oficiais do sistema (produtos,
// preços, estoque/previsões, cartilhas comerciais, fretes, regras gerais),
// consultados ao vivo no banco a cada pergunta — nunca ficam desatualizados.

const STOPWORDS = new Set([
  "de","da","do","das","dos","e","ou","o","a","os","as","um","uma","uns","umas",
  "para","pra","com","sem","por","pelo","pela","qual","quais","quanto","quanta",
  "quantos","quantas","como","onde","quando","que","tem","temos","ter","voce",
  "voces","sobre","entre","esta","este","esse","essa","isso","na","no","nas",
  "nos","em","ao","aos","se","ja","mais","menos","muito","meu","minha","nosso",
  "nossa","ser","sao","foi","vai","vou","pode","podem","quero","preciso",
  "gostaria","fala","fale","me","nos","diz","oi","ola","bom","boa","dia",
  "tarde","noite","valor","valores","preco","precos","item","itens","produto",
  "produtos","colecao","colecoes","linha","fetely","vela","velas","cliente",
]);

function normTxt(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function extrairTermos(pergunta: string): string[] {
  const brutos = normTxt(pergunta).split(/[^a-z0-9]+/).filter(Boolean);
  const termos: string[] = [];
  for (const t of brutos) {
    if (t.length < 3 && !/^\d+$/.test(t)) continue;
    if (STOPWORDS.has(t)) continue;
    if (!termos.includes(t)) termos.push(t);
    if (termos.length >= 8) break;
  }
  return termos;
}

const brl = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "-"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ContextoCadastral {
  texto: string;
  produtosEncontrados: number;
}

async function buildContextoCadastros(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pergunta: string,
): Promise<ContextoCadastral> {
  const vazio: ContextoCadastral = { texto: "", produtosEncontrados: 0 };
  const secoes: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seguro = async (p: PromiseLike<{ data: any; error: any }>): Promise<any> => {
    try {
      const { data, error } = await p;
      return error ? null : data;
    } catch {
      return null;
    }
  };

  try {
    const [regras, faixas, condicoes, regioes, fretes, produtos] =
      await Promise.all([
        seguro(
          supabase
            .from("regras_gerais")
            .select(
              "pedido_minimo,desconto_master_max,bonus_pix_padrao,faixa_reservada_nome,provisao_expirar_dias,frete_fallback_percent",
            )
            .limit(1)
            .maybeSingle(),
        ),
        seguro(
          supabase
            .from("faixas")
            .select(
              "nome,valor_min,valor_max,frete,desconto_celebra,bonus_pix,bonus_pix_aplicavel,cartao_ate,boleto_ate,prazo_medio_boleto,requer_senha_master,frete_observacao",
            )
            .eq("ativa", true)
            .order("ordem", { ascending: true }),
        ),
        seguro(
          supabase
            .from("condicoes_pagamento")
            .select(
              "descricao,tipo,valor_minimo,numero_parcelas,dias_parcelas,sem_juros,tem_bonus_pix",
            )
            .eq("ativa", true)
            .order("ordem", { ascending: true }),
        ),
        seguro(
          supabase
            .from("regioes")
            .select("nome")
            .eq("ativo", true)
            .order("ordem", { ascending: true }),
        ),
        seguro(
          supabase
            .from("frete_uf")
            .select("uf,percentual,ativo")
            .order("uf", { ascending: true }),
        ),
        seguro(
          supabase
            .from("products")
            .select(
              "sku,nome_comercial,colecao,categoria,grupo,cor_nome,tamanho_numero,preco_atacado,preco_varejo,multiplos,estoque_disponivel,status_estoque,pronta_entrega,created_at",
            )
            .eq("ativo", true),
        ),
      ]);

    if (regras) {
      secoes.push(
        `### Regras comerciais gerais\n` +
          `- Pedido mínimo: ${brl(Number(regras.pedido_minimo))}\n` +
          `- Desconto master máximo (com senha master): ${Number(regras.desconto_master_max)}%\n` +
          `- Bônus PIX padrão: ${Number(regras.bonus_pix_padrao)}%\n` +
          `- Faixa reservada (senha master): ${regras.faixa_reservada_nome}\n` +
          `- Provisões expiram em ${regras.provisao_expirar_dias} dias`,
      );
    }

    if (Array.isArray(faixas) && faixas.length > 0) {
      const linhas = faixas.map(
        (f: any) =>
          `- ${f.nome}: pedido de ${brl(Number(f.valor_min))}` +
          `${f.valor_max != null ? ` a ${brl(Number(f.valor_max))}` : " ou mais"}` +
          ` · frete ${f.frete} · desconto Celebra ${Number(f.desconto_celebra)}%` +
          ` · bônus PIX ${f.bonus_pix_aplicavel ? `${Number(f.bonus_pix)}%` : "não aplicável"}` +
          ` · cartão até ${f.cartao_ate} · boleto até ${f.boleto_ate} (prazo médio ${f.prazo_medio_boleto} dias)` +
          `${f.requer_senha_master ? " · REQUER SENHA MASTER" : ""}` +
          `${f.frete_observacao ? ` · obs: ${f.frete_observacao}` : ""}`,
      );
      secoes.push(`### Faixas comerciais ativas (cartilha)\n${linhas.join("\n")}`);
    }

    if (Array.isArray(condicoes) && condicoes.length > 0) {
      const linhas = condicoes.map(
        (c: any) =>
          `- ${c.descricao} (${c.tipo})` +
          `${c.numero_parcelas ? ` · ${c.numero_parcelas}x${Array.isArray(c.dias_parcelas) && c.dias_parcelas.length ? ` em ${c.dias_parcelas.join("/")} dias` : ""}${c.sem_juros ? " sem juros" : ""}` : ""}` +
          ` · pedido mínimo ${brl(Number(c.valor_minimo))}` +
          `${c.tem_bonus_pix ? " · tem bônus PIX" : ""}`,
      );
      secoes.push(`### Condições de pagamento ativas\n${linhas.join("\n")}`);
    }

    if (Array.isArray(fretes) && fretes.length > 0) {
      const ativos = fretes.filter((f: any) => f.ativo);
      const linha = ativos
        .map((f: any) => `${f.uf} ${Number(f.percentual)}%`)
        .join(" · ");
      const fallback = Number(regras?.frete_fallback_percent ?? 5);
      secoes.push(
        `### Frete FOB por UF (tabela oficial)\n` +
          `- ${linha}\n` +
          `- UF sem tabela cadastrada: ${fallback}% (percentual padrão de fallback)\n` +
          `- Frete CIF (definido pela faixa ou por premissa do cliente) e frete grátis negociado têm prioridade sobre esta tabela.`,
      );
    }

    if (Array.isArray(regioes) && regioes.length > 0) {
      secoes.push(
        `### Regiões de atuação cadastradas\n- ${regioes.map((r: any) => r.nome).join(", ")}`,
      );
    }

    // ------------------------------------------------ Catálogo de produtos
    let produtosEncontrados = 0;
    const prods = (Array.isArray(produtos) ? produtos : []) as any[];
    if (prods.length > 0) {
      const porColecao = new Map<
        string,
        {
          skus: number;
          pronta: number;
          min: number;
          max: number;
          status: Set<string>;
          cats: Set<string>;
        }
      >();
      for (const p of prods) {
        const c = porColecao.get(p.colecao) ?? {
          skus: 0,
          pronta: 0,
          min: Infinity,
          max: -Infinity,
          status: new Set<string>(),
          cats: new Set<string>(),
        };
        c.skus += 1;
        if (p.pronta_entrega) c.pronta += 1;
        c.min = Math.min(c.min, Number(p.preco_atacado));
        c.max = Math.max(c.max, Number(p.preco_atacado));
        if (p.status_estoque) c.status.add(String(p.status_estoque));
        if (p.categoria) c.cats.add(String(p.categoria));
        porColecao.set(p.colecao, c);
      }
      const linhasCol = [...porColecao.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([nome, c]) => {
          const status = [...c.status].join(", ") || "sem status";
          return (
            `- ${nome} (${[...c.cats].join("/")}): ${c.skus} SKUs` +
            ` · atacado ${brl(c.min)}–${brl(c.max)}` +
            ` · pronta entrega: ${c.pronta > 0 ? `${c.pronta} de ${c.skus} SKUs` : "não (sob encomenda/previsão)"}` +
            ` · estoque/previsão: ${status}`
          );
        });
      secoes.push(
        `### Coleções do catálogo (resumo ao vivo — ${prods.length} produtos ativos)\n${linhasCol.join("\n")}`,
      );

      const termos = extrairTermos(pergunta);
      if (termos.length > 0) {
        const marcados = prods
          .map((p) => {
            const hay = normTxt(
              [
                p.nome_comercial,
                p.colecao,
                p.categoria,
                p.grupo,
                p.cor_nome,
                p.tamanho_numero,
              ]
                .filter(Boolean)
                .join(" "),
            );
            const skuNorm = normTxt(String(p.sku ?? ""));
            let score = 0;
            for (const t of termos) {
              if (/^\d+$/.test(t)) {
                if (skuNorm.includes(t)) score += 3;
                else if (hay.includes(t)) score += 1;
              } else if (hay.includes(t)) {
                score += t.length >= 5 ? 2 : 1;
              }
            }
            return { p, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 15);
        produtosEncontrados = marcados.length;
        if (marcados.length > 0) {
          const linhasP = marcados.map(({ p }) => {
            const cadastro = p.created_at
              ? new Date(p.created_at).toLocaleDateString("pt-BR")
              : "-";
            return (
              `- SKU ${p.sku} · ${p.nome_comercial} · Coleção ${p.colecao}` +
              `${p.cor_nome ? ` · Cor ${p.cor_nome}` : ""}` +
              ` · atacado ${brl(Number(p.preco_atacado))} · varejo sugerido ${brl(Number(p.preco_varejo))}` +
              ` · múltiplo de ${p.multiplos} · estoque disponível: ${p.estoque_disponivel ?? 0}` +
              ` · status: ${p.status_estoque}${p.pronta_entrega ? " · PRONTA ENTREGA" : " · sob previsão/encomenda"}` +
              ` · cadastrado em ${cadastro}`
            );
          });
          secoes.push(
            `### Produtos do catálogo relacionados à pergunta (dados ao vivo)\n${linhasP.join("\n")}`,
          );
        }
      }
      return { texto: secoes.join("\n\n"), produtosEncontrados };
    }

    return { texto: secoes.join("\n\n"), produtosEncontrados };
  } catch {
    return vazio;
  }
}

const FONTE_CADASTROS: FaqFonte = {
  modulo_id: null,
  modulo_titulo: "Cadastros do sistema (tempo real)",
  aula_id: null,
  aula_titulo: null,
  timestamp: null,
  trecho:
    "Produtos, preços, estoque/previsões, cartilhas comerciais, condições de pagamento e frete por UF — consultados ao vivo no banco de dados.",
};

const SYSTEM_PROMPT = `Você é a IA da Academy Fetély — assistente de conhecimento do time comercial da Fetély (velas e artigos de celebração, B2B). Você é alimentada por DUAS fontes fornecidas a cada pergunta: (1) DADOS CADASTRAIS AO VIVO do sistema — catálogo de produtos, preços, estoque e previsões, cartilhas comerciais/faixas, condições de pagamento, frete por UF e regras gerais; e (2) TRECHOS da base de conhecimento — treinamentos, transcrições de vídeos e notas internas do time.

Hierarquia das fontes:
- Para valores, percentuais, preços, fretes, condições de pagamento, estoque, previsões de lançamento e regras comerciais, os DADOS CADASTRAIS são a fonte OFICIAL e mais atualizada. Se um trecho de treinamento conflitar com eles, prevalecem os dados cadastrais.
- Os trechos da Academy complementam com processos, explicações e boas práticas.

Estrutura obrigatória da resposta (Markdown simples):
1. Primeira linha: resposta direta à pergunta em 1–2 frases, com os pontos-chave em **negrito**.
2. Em seguida, organize o detalhe conforme o tipo de pergunta:
   - Processo ou tarefa → passo a passo numerado ("1. ", "2. ", "3. "), uma ação por linha.
   - Regras, condições, valores ou lista de itens → bullets com "- ".
   - Mais de um assunto na mesma resposta → separe com títulos "### Nome do assunto".
3. Exceções, prazos ou alertas presentes nas fontes → bullet começando com "**Atenção:**".
4. Ao usar uma informação de um trecho, cite a origem no final da frase, no formato [n]. Ao usar um dado cadastral, cite [DADOS].
5. Combine informações de trechos e dados cadastrais quando a resposta exigir — mas só o que estiver escrito neles.

Regras inegociáveis:
- Responda SOMENTE com base nas fontes fornecidas (trechos + dados cadastrais). É proibido inventar passos, regras, prazos, valores, fretes ou políticas que não estejam nas fontes.
- Se nada nas fontes responder à pergunta, diga com clareza: "Ainda não temos um conteúdo sobre isso na Academia." — e não chute.
- Se as fontes responderem só em parte, responda a parte coberta e sinalize o que ficou de fora.
- Tom Fetély: direto, claro, profissional, sem enrolação.
- Responda sempre em português do Brasil.
- Use apenas esta formatação: **negrito**, "- " para bullets, "1. " para passos numerados, "### " para títulos de seção. Nunca use tabelas, código ou imagens.`;

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

  // Embedding da pergunta + contexto cadastral ao vivo em paralelo
  const [[qEmb], cadastros] = await Promise.all([
    embedTexts([pergunta]),
    buildContextoCadastros(supabase, pergunta),
  ]);
  const { data: matches, error } = await supabase.rpc("match_kb_chunks", {
    p_embedding: JSON.stringify(qEmb),
    p_limit: MATCH_LIMIT,
    p_ver_interno: verInterno,
  });
  if (error) throw new Error(error.message);

  const lista = (matches ?? []) as any[];
  const relevantes = lista.filter((m) => (m.similaridade ?? 0) >= LIMIAR_SIMILARIDADE);

  // Títulos para citação (trechos da base manual têm modulo_id NULL)
  const moduloIds = [
    ...new Set(lista.map((m) => m.modulo_id as string | null).filter(Boolean)),
  ] as string[];
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
        modulo_id: m.modulo_id ?? null,
        modulo_titulo: m.modulo_id
          ? (modMap.get(m.modulo_id) ?? "Módulo")
          : "Base de conhecimento",
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
        const origem = !m.modulo_id
          ? "Base de conhecimento (nota interna do time)"
          : m.origem_tipo === "descritivo"
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
