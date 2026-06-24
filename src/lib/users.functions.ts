import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AppRole = "master" | "admin" | "vendedor" | "cliente";

async function assertCallerCan(
  userId: string,
  targetRole: AppRole,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  const isMaster = roles.includes("master");
  const isAdmin = roles.includes("admin");
  if (targetRole === "vendedor" && !(isMaster || isAdmin)) {
    throw new Error("Sem permissão para criar vendedor");
  }
  if ((targetRole === "admin" || targetRole === "master") && !isMaster) {
    throw new Error("Apenas o master pode criar admins ou outros masters");
  }
}

function slugifyNome(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function baseLogin(nome: string, tipo: "interno" | "representante" | null | undefined): string {
  const partes = slugifyNome(nome).split(" ").filter(Boolean);
  const primeiro = partes[0] ?? "user";
  const ultimaInicial = partes.length > 1 ? partes[partes.length - 1][0] : "";
  const prefixo = tipo === "representante" ? "rep" : "int";
  return `${prefixo}.${primeiro}${ultimaInicial}`;
}

async function gerarLoginUnico(
  nome: string,
  tipo: "interno" | "representante" | null | undefined,
): Promise<string> {
  const base = baseLogin(nome, tipo);
  let candidato = base;
  let n = 2;
  while (true) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("login_amigavel", candidato)
      .maybeSingle();
    if (!data) return candidato;
    candidato = `${base}${n}`;
    n++;
  }
}

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  nome_completo: z.string().trim().min(1).max(120),
  telefone: z.string().trim().max(40).optional().nullable(),
  codigo_vendedor: z.string().trim().max(20).optional().nullable(),
  role: z.enum(["master", "admin", "vendedor"]),
  tipo_vendedor: z.enum(["interno", "representante"]).optional().nullable(),
  regiao: z.string().trim().max(60).optional().nullable(),
  comissao_percent: z.number().min(0).max(100).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  supervisor: z.string().trim().max(120).optional().nullable(),
  cnpj_cpf: z.string().trim().max(20).optional().nullable(),
  empresa: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertCallerCan(userId, data.role);

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          nome_completo: data.nome_completo,
          telefone: data.telefone ?? null,
          codigo_vendedor: data.codigo_vendedor ?? null,
        },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário");
    }

    const newUserId = created.user.id;

    const loginAmigavel =
      data.role === "vendedor"
        ? await gerarLoginUnico(data.nome_completo, data.tipo_vendedor ?? "interno")
        : null;

    // Profile is auto-created by trigger; make sure data is set
    await supabaseAdmin
      .from("profiles")
      .update({
        nome_completo: data.nome_completo,
        telefone: data.telefone ?? null,
        codigo_vendedor: data.codigo_vendedor ?? null,
        tipo_vendedor: data.tipo_vendedor ?? null,
        regiao: data.regiao ?? null,
        comissao_percent: data.comissao_percent ?? null,
        cargo: data.cargo ?? null,
        supervisor: data.supervisor ?? null,
        cnpj_cpf: data.cnpj_cpf ?? null,
        empresa: data.empresa ?? null,
        observacoes: data.observacoes ?? null,
        login_amigavel: loginAmigavel,
      })
      .eq("id", newUserId);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    await supabaseAdmin.rpc("log_access_event", {
      p_user_id: newUserId,
      p_evento: "usuario_criado",
      p_descricao: `Usuário ${data.role} criado: ${data.nome_completo}`,
      p_metadata: { role: data.role, email: data.email },
    });

    return { id: newUserId, login_amigavel: loginAmigavel };
  });


const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  nome_completo: z.string().trim().min(1).max(120).optional(),
  telefone: z.string().trim().max(40).optional().nullable(),
  codigo_vendedor: z.string().trim().max(20).optional().nullable(),
  tipo_vendedor: z.enum(["interno", "representante"]).optional().nullable(),
  regiao: z.string().trim().max(60).optional().nullable(),
  comissao_percent: z.number().min(0).max(100).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  supervisor: z.string().trim().max(120).optional().nullable(),
  cnpj_cpf: z.string().trim().max(20).optional().nullable(),
  empresa: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertCallerCan(userId, "vendedor");
    const { user_id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    // Only admin or master can list everyone
    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (myRoles ?? []).map((r) => r.role as AppRole);
    if (!(roles.includes("master") || roles.includes("admin"))) {
      throw new Error("Sem permissão");
    }

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: allRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of allRoles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      rolesByUser.set(r.user_id, list);
    }

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

const toggleSchema = z.object({
  user_id: z.string().uuid(),
  ativo: z.boolean(),
});

export const setUserAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => toggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertCallerCan(userId, "vendedor");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.rpc("log_access_event", {
      p_user_id: data.user_id,
      p_evento: data.ativo ? "usuario_ativado" : "usuario_desativado",
      p_descricao: data.ativo ? "Usuário ativado" : "Usuário desativado",
      p_metadata: {},
    });

    return { ok: true };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {

    const { userId } = context as { userId: string };
    // Need master OR admin (admin can only delete vendedores - check target roles)
    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (myRoles ?? []).map((r) => r.role as AppRole);
    const isMaster = roles.includes("master");
    const isAdmin = roles.includes("admin");
    if (!isMaster && !isAdmin) throw new Error("Sem permissão");
    if (data.user_id === userId) throw new Error("Não é possível excluir a si mesmo");

    if (!isMaster) {
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user_id);
      const t = (targetRoles ?? []).map((r) => r.role as AppRole);
      if (t.includes("master") || t.includes("admin")) {
        throw new Error("Admin só pode excluir vendedores");
      }
    }

    await supabaseAdmin.rpc("log_access_event", {
      p_user_id: data.user_id,
      p_evento: "usuario_excluido",
      p_descricao: "Usuário excluído do sistema",
      p_metadata: {},
    });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["master", "admin", "vendedor", "cliente"]),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (myRoles ?? []).map((r) => r.role as AppRole);
    const isMaster = roles.includes("master");
    const isAdmin = roles.includes("admin");
    if (!isMaster && !isAdmin) throw new Error("Sem permissão");
    // Only master can promote to admin or master
    if ((data.role === "admin" || data.role === "master") && !isMaster) {
      throw new Error("Apenas o master pode definir admin ou master");
    }
    if (data.user_id === userId && (data.role !== "master" && data.role !== "admin")) {
      throw new Error("Não é possível rebaixar a si mesmo");
    }
    // Replace existing roles with the new single role
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });
