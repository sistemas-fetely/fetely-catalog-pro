import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "master" | "admin" | "vendedor" | "cliente";

async function assertAdmin(userId: string): Promise<{ nome: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const list = (roles ?? []).map((r) => r.role as AppRole);
  if (!(list.includes("admin") || list.includes("master"))) {
    throw new Error("Sem permissão");
  }
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("nome_completo")
    .eq("id", userId)
    .maybeSingle();
  return { nome: prof?.nome_completo ?? "" };
}

const acaoEnum = z.enum(["ver", "criar", "editar", "excluir", "exportar", "aprovar"]);
const perfilEnum = z.enum(["master", "admin", "vendedor", "cliente"]);

// ============ PERMISSÕES DO USUÁRIO LOGADO ============
// Devolve a lista crua de (tela_id, acao) já com as 3 camadas aplicadas.
// Chamado uma vez após o login para hidratar o permissoesStore.

export const getMinhasPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computarPermissoesEfetivas } = await import("@/security/permissionEvaluator");

    const [rolesRes, profileRes, perfisOvRes, grupoOvRes, excecoesRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("profiles").select("grupo_permissao_id").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("permissoes_perfis_override").select("perfil, tela_id, acao, permitido"),
      supabaseAdmin.from("permissoes_grupo_overrides").select("grupo_id, tela_id, acao, permitido"),
      supabaseAdmin
        .from("permissoes_usuario_excecoes")
        .select("tela_id, acao, permitido")
        .eq("user_id", userId),
    ]);

    const roles = (rolesRes.data ?? []).map((r) => r.role as string);
    const grupoId = (profileRes.data as { grupo_permissao_id: string | null } | null)
      ?.grupo_permissao_id ?? null;

    const set = computarPermissoesEfetivas({
      roles,
      grupoId,
      perfisOverride: (perfisOvRes.data ?? []) as never,
      grupoOverrides: (grupoOvRes.data ?? []) as never,
      excecoes: (excecoesRes.data ?? []) as never,
    });

    // Devolve como array para serialização
    return Array.from(set).map((k) => {
      const [tela_id, acao] = k.split(":");
      return { tela_id, acao };
    });
  });

// ============ READ-ALL ============

export const carregarPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [perfis, grupos, grupoOv, excecoes] = await Promise.all([
      supabaseAdmin.from("permissoes_perfis_override").select("*"),
      supabaseAdmin.from("permissoes_grupos").select("*").order("nome"),
      supabaseAdmin.from("permissoes_grupo_overrides").select("*"),
      supabaseAdmin.from("permissoes_usuario_excecoes").select("*"),
    ]);
    return {
      perfisOverride: perfis.data ?? [],
      grupos: grupos.data ?? [],
      grupoOverrides: grupoOv.data ?? [],
      excecoes: excecoes.data ?? [],
    };
  });

// ============ PERFIL BASE OVERRIDE ============

const setPerfilSchema = z.object({
  perfil: perfilEnum,
  tela_id: z.string().min(1).max(80),
  acao: acaoEnum,
  permitido: z.boolean(),
  permitido_padrao: z.boolean(),
});

export const setPermissaoPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setPerfilSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { nome } = await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se igual ao padrão → remove override
    if (data.permitido === data.permitido_padrao) {
      await supabaseAdmin
        .from("permissoes_perfis_override")
        .delete()
        .match({ perfil: data.perfil, tela_id: data.tela_id, acao: data.acao });
    } else {
      await supabaseAdmin.from("permissoes_perfis_override").upsert({
        perfil: data.perfil,
        tela_id: data.tela_id,
        acao: data.acao,
        permitido: data.permitido,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
    }

    await supabaseAdmin.from("permissoes_audit").insert({
      admin_id: userId,
      admin_nome: nome,
      alvo_tipo: "perfil_base",
      alvo_id: data.perfil,
      alvo_nome: data.perfil,
      tela_id: data.tela_id,
      acao: data.acao,
      mudanca: data.permitido ? "grant" : "revoke",
      valor_anterior: data.permitido_padrao,
      valor_novo: data.permitido,
    });
    return { ok: true };
  });

// ============ GRUPOS ============

const criarGrupoSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(400).optional().nullable(),
  baseado_em: perfilEnum,
  copiar_de_grupo_id: z.string().uuid().optional().nullable(),
});

export const criarGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => criarGrupoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: novo, error } = await supabaseAdmin
      .from("permissoes_grupos")
      .insert({
        nome: data.nome,
        descricao: data.descricao ?? null,
        baseado_em: data.baseado_em,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.copiar_de_grupo_id) {
      const { data: orig } = await supabaseAdmin
        .from("permissoes_grupo_overrides")
        .select("tela_id, acao, permitido")
        .eq("grupo_id", data.copiar_de_grupo_id);
      if (orig && orig.length > 0) {
        await supabaseAdmin.from("permissoes_grupo_overrides").insert(
          orig.map((o) => ({
            grupo_id: novo.id,
            tela_id: o.tela_id,
            acao: o.acao,
            permitido: o.permitido,
          })),
        );
      }
    }
    return novo;
  });

const atualizarGrupoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(80).optional(),
  descricao: z.string().trim().max(400).optional().nullable(),
});

export const atualizarGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => atualizarGrupoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("permissoes_grupos")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const excluirGrupoSchema = z.object({ id: z.string().uuid() });
export const excluirGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => excluirGrupoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("permissoes_grupos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const setGrupoPermSchema = z.object({
  grupo_id: z.string().uuid(),
  grupo_nome: z.string().min(1).max(80),
  tela_id: z.string().min(1).max(80),
  acao: acaoEnum,
  permitido: z.boolean(),
  permitido_base: z.boolean(),
});

export const setPermissaoGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setGrupoPermSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { nome } = await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.permitido === data.permitido_base) {
      await supabaseAdmin
        .from("permissoes_grupo_overrides")
        .delete()
        .match({ grupo_id: data.grupo_id, tela_id: data.tela_id, acao: data.acao });
    } else {
      await supabaseAdmin.from("permissoes_grupo_overrides").upsert({
        grupo_id: data.grupo_id,
        tela_id: data.tela_id,
        acao: data.acao,
        permitido: data.permitido,
        updated_at: new Date().toISOString(),
      });
    }
    await supabaseAdmin.from("permissoes_audit").insert({
      admin_id: userId,
      admin_nome: nome,
      alvo_tipo: "grupo",
      alvo_id: data.grupo_id,
      alvo_nome: data.grupo_nome,
      tela_id: data.tela_id,
      acao: data.acao,
      mudanca: data.permitido ? "grant" : "revoke",
      valor_anterior: data.permitido_base,
      valor_novo: data.permitido,
    });
    return { ok: true };
  });

// ============ EXCEÇÕES INDIVIDUAIS ============

const setExcecaoSchema = z.object({
  user_id: z.string().uuid(),
  user_nome: z.string().min(1).max(120),
  tela_id: z.string().min(1).max(80),
  acao: acaoEnum,
  permitido: z.boolean(),
  permitido_atual: z.boolean(),
});

export const setExcecaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setExcecaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { nome } = await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("permissoes_usuario_excecoes").upsert({
      user_id: data.user_id,
      tela_id: data.tela_id,
      acao: data.acao,
      permitido: data.permitido,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    await supabaseAdmin.from("permissoes_audit").insert({
      admin_id: userId,
      admin_nome: nome,
      alvo_tipo: "usuario",
      alvo_id: data.user_id,
      alvo_nome: data.user_nome,
      tela_id: data.tela_id,
      acao: data.acao,
      mudanca: data.permitido ? "grant" : "revoke",
      valor_anterior: data.permitido_atual,
      valor_novo: data.permitido,
    });
    return { ok: true };
  });

const removeExcecaoSchema = z.object({
  user_id: z.string().uuid(),
  tela_id: z.string().min(1).max(80),
  acao: acaoEnum,
});

export const removerExcecaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeExcecaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("permissoes_usuario_excecoes")
      .delete()
      .match({ user_id: data.user_id, tela_id: data.tela_id, acao: data.acao });
    return { ok: true };
  });

const setGrupoUsuarioSchema = z.object({
  user_id: z.string().uuid(),
  grupo_id: z.string().uuid().nullable(),
});

export const setGrupoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setGrupoUsuarioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ grupo_permissao_id: data.grupo_id })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ AUDITORIA ============

export const listarAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("permissoes_audit")
      .select("*")
      .order("ts", { ascending: false })
      .limit(200);
    return data ?? [];
  });
