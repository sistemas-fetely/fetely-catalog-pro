import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SNCF_URL = "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/catalogo-planilha-fop";
const json = (body: unknown, init?: ResponseInit) => Response.json(body, {
  ...init,
  headers: { "Cache-Control": "no-store", ...init?.headers },
});
const inputSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("pendentes") }).strict(),
  z.object({
    acao: z.literal("confirmar"),
    ids: z.array(z.string().min(1).max(200)).min(1).max(1000),
    status: z.enum(["aplicada", "descartada", "resolvida"]),
    escolha: z.enum(["planilha", "sistema"]),
  }).strict(),
]);

export const Route = createFileRoute("/api/catalogo-planilha-fop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
          if (!jwt) return json({ error: "JWT ausente" }, { status: 401 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
          if (userError || !user) return json({ error: "Token inválido" }, { status: 401 });

          const { data: roles, error: rolesError } = await supabaseAdmin
            .from("user_roles").select("role").eq("user_id", user.id);
          if (rolesError) return json({ error: rolesError.message }, { status: 500 });
          if (!(roles ?? []).some(r => r.role === "admin" || r.role === "master")) {
            return json({ error: "Acesso restrito a admin/master" }, { status: 403 });
          }

          const parsed = inputSchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return json({ error: "Corpo inválido", detalhes: parsed.error.issues }, { status: 400 });
          const payload = parsed.data.acao === "pendentes"
            ? { acao: "pendentes" as const }
            : { ...parsed.data, quem: user.id };

          const { data: token, error: vaultError } = await supabaseAdmin.rpc("get_vault_secret", {
            p_name: "SNCF_OUTBOUND_TOKEN",
          });
          if (vaultError || !token) {
            console.error("[catalogo-planilha-fop] falha ao ler SNCF_OUTBOUND_TOKEN", vaultError);
            return json({ error: "Erro de configuração interna" }, { status: 500 });
          }

          const response = await fetch(SNCF_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const raw = await response.text();
          let body: unknown;
          try { body = JSON.parse(raw); } catch { body = { error: raw || "Resposta sem JSON do SNCF" }; }
          if (!response.ok) {
            const message = typeof body === "object" && body && "error" in body
              ? String((body as { error: unknown }).error)
              : `SNCF retornou HTTP ${response.status}`;
            return json({ ok: false, error: message, sncf_status: response.status }, { status: response.status });
          }
          return json(body, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("[catalogo-planilha-fop] erro", error);
          return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
        }
      },
    },
  },
});
