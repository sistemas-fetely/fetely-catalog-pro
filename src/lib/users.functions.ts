import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AppRole = "master" | "admin" | "vendedor";

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

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  nome_completo: z.string().trim().min(1).max(120),
  telefone: z.string().trim().max(40).optional().nullable(),
  codigo_vendedor: z.string().trim().max(20).optional().nullable(),
  role: z.enum(["master", "admin", "vendedor"]),
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

    // Profile is auto-created by trigger; make sure data is set
    await supabaseAdmin
      .from("profiles")
      .update({
        nome_completo: data.nome_completo,
        telefone: data.telefone ?? null,
        codigo_vendedor: data.codigo_vendedor ?? null,
      })
      .eq("id", newUserId);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { id: newUserId };
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

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
