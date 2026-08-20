import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_PREFIX = "/storage/v1/object/public/";

/**
 * Proxy de imagens no MESMO domínio do app.
 * Alguns computadores/redes corporativas bloqueiam o domínio do storage,
 * fazendo as fotos não carregarem. Este endpoint entrega a mesma imagem
 * a partir do domínio do sistema.
 *
 * Uso: /api/public/img?path=product-photos/produtos/arquivo.jpg
 */
export const Route = createFileRoute("/api/public/img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
        if (!path || path.includes("..")) {
          return new Response("Bad request", { status: 400 });
        }

        const base =
          process.env["VITE_SUPABASE_URL"] ??
          process.env["SUPABASE_URL"] ??
          "";
        if (!base) return new Response("Not configured", { status: 500 });

        const target = `${base.replace(/\/+$/, "")}${ALLOWED_PREFIX}${path}`;
        const upstream = await fetch(target, {
          headers: { accept: request.headers.get("accept") ?? "image/*" },
        });

        if (!upstream.ok || !upstream.body) {
          return new Response("Not found", { status: upstream.status || 404 });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
