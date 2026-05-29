// Server functions for managing client portal access (V12)
// Admin/master only. Creates Supabase auth users with role='cliente'
// linked to the lojista Cliente via profiles.cliente_id.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AppRole = "master" | "admin" | "vendedor" | "cliente";

async function assertAdminOrMaster(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  if (!(roles.includes("master") || roles.includes("admin"))) {
    throw new Error("Apenas admin ou master pode gerenciar acessos de cliente");
  }
}

/** Senha padrão: primeiros 4 dígitos do CNPJ + "@Fetely" */
export function defaultPortalPassword(cnpjDigits: string): string {
  const head = (cnpjDigits.replace(/\D/g, "").slice(0, 4) || "0000").padEnd(4, "0");
  return `${head}@Fetely`;
}

function randomPassword(): string {
  // 12 chars, mistura letras+números — usado em reset
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}@F`;
}

const createSchema = z.object({
  clienteId: z.string().min(1).max(64),
  email: z.string().trim().email().max(255),
  nomeEmpresa: z.string().trim().min(1).max(160),
  cnpjDigits: z.string().trim().min(0).max(20),
  password: z.string().min(8).max(72).optional(),
});

export const createPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminOrMaster(userId);

    const password = data.password ?? defaultPortalPassword(data.cnpjDigits);

    let newUserId: string;
    let createdNow = false;

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: {
          nome_completo: data.nomeEmpresa,
          cliente_id: data.clienteId,
        },
      });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "";
      const code = (createErr as { code?: string } | null)?.code ?? "";
      const isDuplicate =
        code === "email_exists" ||
        /already.*registered|already exists|email_exists|duplicate/i.test(msg);
      if (!isDuplicate) {
        throw new Error(msg || "Falha ao criar usuário do portal");
      }

      // Usuário já existe no Auth — localizar e reaproveitar
      const { data: list, error: listErr } =
        await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw new Error(listErr.message);
      const existing = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (!existing) {
        throw new Error(
          "E-mail já registrado no sistema, mas não foi possível localizar o usuário. Use outro e-mail.",
        );
      }

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("cliente_id")
        .eq("id", existing.id)
        .maybeSingle();
      if (
        existingProfile?.cliente_id &&
        existingProfile.cliente_id !== data.clienteId
      ) {
        throw new Error(
          "Este e-mail já está vinculado a outro cliente. Use um e-mail diferente.",
        );
      }

      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
      newUserId = existing.id;
    } else {
      newUserId = created.user.id;
      createdNow = true;
    }

    // profile é auto-criado por trigger; atualizar com nome e cliente_id
    await supabaseAdmin
      .from("profiles")
      .update({
        nome_completo: data.nomeEmpresa,
        cliente_id: data.clienteId,
        empresa: data.nomeEmpresa,
        ativo: true,
      })
      .eq("id", newUserId);

    // Garante role 'cliente' (idempotente)
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", newUserId)
      .eq("role", "cliente")
      .maybeSingle();

    if (!existingRole) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "cliente" });
      if (roleErr) {
        if (createdNow) {
          await supabaseAdmin.auth.admin.deleteUser(newUserId);
        }
        throw new Error(roleErr.message);
      }
    }

    return { userId: newUserId, email: data.email, password };
  });

const resetSchema = z.object({
  userId: z.string().uuid(),
});

export const resetPortalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminOrMaster(userId);

    const password = randomPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password,
    });
    if (error) throw new Error(error.message);
    return { password };
  });

const updateEmailSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email().max(255),
});

export const updatePortalEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminOrMaster(userId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({ email: data.email })
      .eq("id", data.userId);

    return { ok: true };
  });

const disableSchema = z.object({
  userId: z.string().uuid(),
});

export const disablePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => disableSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminOrMaster(userId);

    // Deleta o auth user (cascade remove user_roles via FK; profile permanece para auditoria)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === Self-service: cliente troca a própria senha no portal ===
const changeOwnSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export const changeOwnPortalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => changeOwnSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as {
      userId: string;
      supabase: { auth: { getUser: () => Promise<{ data: { user: { email: string | null } | null } }> } };
    };
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email;
    if (!email) throw new Error("Sessão inválida");

    // Re-autentica com a senha atual antes de trocar
    const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (signInErr) throw new Error("Senha atual incorreta");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
