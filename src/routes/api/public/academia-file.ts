import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "academia";
const ALLOWED_PREFIXES = ["capas/", "blocos/"];

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

function contentTypeFor(path: string, sniffed: string | null): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (MIME[ext]) return MIME[ext];
  if (sniffed && sniffed !== "application/octet-stream") return sniffed;
  return "application/octet-stream";
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function htmlErro(status: number, msg: string): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Academy Fetély</title></head>` +
      `<body style="font-family:sans-serif;padding:48px;max-width:520px;margin:0 auto;color:#333">` +
      `<h2 style="margin:0 0 12px">Não foi possível abrir o arquivo</h2><p>${msg}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * Proxy autenticado dos arquivos da Academia no MESMO domínio do app.
 * O bucket é privado e o domínio do storage é bloqueado em algumas redes
 * corporativas — aqui o arquivo chega pelo domínio do sistema.
 * Segurança: exige sessão válida (?t= ou Authorization: Bearer) e respeita
 * a visibilidade do módulo (representante não acessa conteúdo interno).
 *
 * Uso: /api/public/academia-file?path=blocos/arquivo.pdf&t=<access_token>
 */
export const Route = createFileRoute("/api/public/academia-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
        if (
          !path ||
          path.includes("..") ||
          !ALLOWED_PREFIXES.some((p) => path.startsWith(p))
        ) {
          return new Response("Bad request", { status: 400 });
        }

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ")
          ? auth.slice(7).trim()
          : (url.searchParams.get("t") ?? "").trim();
        if (!token) {
          return htmlErro(
            401,
            "Sessão não informada. Volte à página da Academia e clique no arquivo novamente.",
          );
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        // Tabelas treinamento_* não constam no types.ts gerado — acesso sem tipagem.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = supabaseAdmin;

        const { data: userData, error: authErr } = await db.auth.getUser(token);
        if (authErr || !userData?.user) {
          return htmlErro(
            401,
            "Sua sessão expirou. Volte à página da Academia, recarregue e clique no arquivo novamente.",
          );
        }

        const { data: profile } = await db
          .from("profiles")
          .select("ativo, tipo_vendedor")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (!profile || profile.ativo === false) {
          return htmlErro(403, "Seu acesso está inativo. Fale com o time Fetély.");
        }

        // Módulos vinculados ao arquivo (como anexo de bloco ou como capa)
        const { data: blocos } = await db
          .from("treinamento_bloco")
          .select("arquivo_nome, aula_id")
          .eq("arquivo_url", path);
        const aulaIds = [
          ...new Set((blocos ?? []).map((b: { aula_id: string }) => b.aula_id)),
        ];
        let modVinculados: { visibilidade: string; status: string }[] = [];
        if (aulaIds.length > 0) {
          const { data: aulas } = await db
            .from("treinamento_aula")
            .select("modulo_id")
            .in("id", aulaIds);
          const modIds = [
            ...new Set(
              (aulas ?? []).map((a: { modulo_id: string }) => a.modulo_id),
            ),
          ];
          if (modIds.length > 0) {
            const { data: mods } = await db
              .from("treinamento_modulo")
              .select("visibilidade, status")
              .in("id", modIds);
            modVinculados = mods ?? [];
          }
        }
        const { data: capas } = await db
          .from("treinamento_modulo")
          .select("visibilidade, status")
          .eq("capa_url", path);
        modVinculados = [...modVinculados, ...(capas ?? [])];

        // Arquivo órfão (sem módulo): libera para qualquer usuário ativo logado.
        if (modVinculados.length > 0) {
          const publico = modVinculados.some(
            (m) => m.visibilidade === "todos" && m.status === "publicado",
          );
          const veInterno = profile.tipo_vendedor !== "representante";
          if (!publico && !veInterno) {
            return htmlErro(
              403,
              "Este material é interno e não está liberado para o seu perfil.",
            );
          }
        }

        // Streaming: o servidor assina a URL no storage (acessível do servidor,
        // mesmo quando a rede do cliente bloqueia o domínio do storage) e
        // repassa o corpo em fluxo — o PDF começa a abrir de imediato, sem
        // precisar baixar o arquivo inteiro na memória antes de responder.
        const { data: signed, error: signErr } = await db.storage
          .from(BUCKET)
          .createSignedUrl(path, 300);
        if (signErr || !signed?.signedUrl) {
          return htmlErro(
            404,
            "Arquivo não encontrado. Ele pode ter sido substituído — recarregue a página da aula.",
          );
        }

        let upstream: globalThis.Response;
        try {
          upstream = await fetch(signed.signedUrl);
        } catch {
          return htmlErro(
            502,
            "Não conseguimos alcançar o armazenamento agora. Tente novamente em instantes.",
          );
        }
        if (!upstream.ok || !upstream.body) {
          return htmlErro(
            404,
            "Arquivo não encontrado. Ele pode ter sido substituído — recarregue a página da aula.",
          );
        }

        const nome =
          (blocos?.[0]?.arquivo_nome as string | undefined) ??
          path.split("/").pop() ??
          "arquivo";

        const headers = new Headers({
          "content-type": contentTypeFor(
            path,
            upstream.headers.get("content-type"),
          ),
          "content-disposition": contentDisposition(nome),
          "cache-control": "private, max-age=300",
        });
        const len = upstream.headers.get("content-length");
        if (len) headers.set("content-length", len);

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
