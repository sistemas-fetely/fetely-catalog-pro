import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "catalogos";
const ALLOWED_PREFIXES = ["pdfs/", "capas/"];

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeFor(path: string, sniffed: string | null): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (MIME[ext]) return MIME[ext];
  if (sniffed && sniffed !== "application/octet-stream") return sniffed;
  return "application/octet-stream";
}

function disposition(filename: string, download: boolean): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  const tipo = download ? "attachment" : "inline";
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Proxy PÚBLICO dos catálogos (bucket privado, mesmo domínio do app).
 * Só serve arquivos referenciados por um catálogo ATIVO — nada mais do bucket
 * fica acessível. O cliente recebe o link da página /catalogos e abre ou baixa.
 *
 * Uso: /api/public/catalogo-file?path=pdfs/arquivo.pdf[&dl=1]
 */
export const Route = createFileRoute("/api/public/catalogo-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
        const download = url.searchParams.get("dl") === "1";
        if (
          !path ||
          path.includes("..") ||
          !ALLOWED_PREFIXES.some((p) => path.startsWith(p))
        ) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: catalogo } = await supabaseAdmin
          .from("catalogos_pdf")
          .select("nome, pdf_path, capa_path, ativo")
          .or(`pdf_path.eq.${path},capa_path.eq.${path}`)
          .eq("ativo", true)
          .maybeSingle();
        if (!catalogo) {
          return new Response("Arquivo não disponível", { status: 404 });
        }

        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, 300);
        if (signErr || !signed?.signedUrl) {
          return new Response("Arquivo não encontrado", { status: 404 });
        }

        let upstream: globalThis.Response;
        try {
          upstream = await fetch(signed.signedUrl);
        } catch {
          return new Response("Armazenamento indisponível", { status: 502 });
        }
        if (!upstream.ok || !upstream.body) {
          return new Response("Arquivo não encontrado", { status: 404 });
        }

        const ext = path.split(".").pop()?.toLowerCase() ?? "pdf";
        const isPdf = catalogo.pdf_path === path;
        const nome = isPdf
          ? `${catalogo.nome}.${ext}`
          : (path.split("/").pop() ?? "arquivo");

        const headers = new Headers({
          "content-type": contentTypeFor(
            path,
            upstream.headers.get("content-type"),
          ),
          "content-disposition": disposition(nome, download),
          "cache-control": "public, max-age=600",
        });
        const len = upstream.headers.get("content-length");
        if (len) headers.set("content-length", len);

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
