import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/store/authStore";
import { usePhotos } from "@/store/photoStore";
import "@/store/cartilhasStore"; // side-effect: sincroniza commercial.ts com a cartilha persistida
import { bootstrapFopAfterLogin } from "@/lib/fopBootstrap";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gold">404</h1>
        <h2 className="mt-4 font-display text-2xl">Página não encontrada</h2>
        <p className="mt-2 text-sm text-text-secondary">
          O endereço solicitado não existe neste catálogo.
        </p>
        <a
          href="/"
          className="inline-flex mt-6 items-center justify-center rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  const msg = String(error?.message ?? "");
  const isChunkError =
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module");

  useEffect(() => {
    if (isChunkError && typeof window !== "undefined") {
      // Chunk obsoleto após deploy — recarrega para pegar o bundle novo.
      window.location.reload();
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Atualizando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">Algo deu errado</h1>
        <p className="mt-2 text-sm text-text-secondary">Tente novamente em instantes.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fetély — Sistema B2B de Pedidos" },
      {
        name: "description",
        content: "Catálogo e registro de pedidos B2B para representantes Fetély.",
      },
      { property: "og:title", content: "Fetély — Sistema B2B de Pedidos" },
      { name: "twitter:title", content: "Fetély — Sistema B2B de Pedidos" },
      { name: "description", content: "Fetély Order Pro is a B2B ordering system for luxury celebration items." },
      { property: "og:description", content: "Fetély Order Pro is a B2B ordering system for luxury celebration items." },
      { name: "twitter:description", content: "Fetély Order Pro is a B2B ordering system for luxury celebration items." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dfc78683-f26c-4200-a323-ca692bd3e097/id-preview-f8130124--f24862e9-aac1-42a1-bec2-f14e7decae2e.lovable.app-1779771805394.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dfc78683-f26c-4200-a323-ca692bd3e097/id-preview-f8130124--f24862e9-aac1-42a1-bec2-f14e7decae2e.lovable.app-1779771805394.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeBootstrapScript = `(function(){try{var s=localStorage.getItem('fetely-ui');var t='light';if(s){var p=JSON.parse(s);if(p&&p.state&&p.state.theme){t=p.state.theme;}}document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('light');}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isStand = pathname === "/stand" || pathname.startsWith("/stand/");
  const isQualificacao = pathname === "/qualificacao" || pathname.startsWith("/qualificacao/");
  return (
    <QueryClientProvider client={queryClient}>
      <BootEffects />
      {isStand ? (
        <Outlet />
      ) : isQualificacao ? (
        <div className="min-h-screen bg-background text-text-primary">
          <Outlet />
        </div>
      ) : (
        <div className="min-h-screen bg-background text-text-primary pb-16 md:pb-0">
          <Header />
          <Outlet />
          <BottomNav />
        </div>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}

function BootEffects() {
  const fetchPhotos = usePhotos((s) => s.fetchAll);
  const initAuth = useAuth((s) => s.init);
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const roles = useAuth((s) => s.roles);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    void fetchPhotos();
    initAuth();
  }, [fetchPhotos, initAuth]);

  // Bootstrap FOP: migração one-shot + hidratação dos stores a partir do banco
  useEffect(() => {
    if (session && !loading) {
      void bootstrapFopAfterLogin();
    }
  }, [session?.user?.id, loading]);

  // Guarda de rotas: rotas públicas = /login, /catalog (e subrotas)
  useEffect(() => {
    if (loading) return;
    if (!session) {
      const isPublic =
        pathname === "/login" ||
        pathname === "/catalog" ||
        pathname.startsWith("/catalog/") ||
        pathname === "/stand" ||
        pathname.startsWith("/stand/") ||
        pathname === "/qualificacao";
      if (!isPublic) {
        navigate({ to: "/login", search: { redirect: pathname } as never });
      }
      return;
    }
    // Cliente só pode acessar /portal/* e /catalog/*; demais rotas → /portal
    if (roles.includes("cliente")) {
      const allowed =
        pathname === "/portal" ||
        pathname.startsWith("/portal/") ||
        pathname === "/catalog" ||
        pathname.startsWith("/catalog/") ||
        pathname === "/cart" ||
        pathname === "/confirmation" ||
        pathname === "/stand" ||
        pathname.startsWith("/stand/");
      if (!allowed) {
        navigate({ to: "/portal" });
      }
    }
  }, [loading, session, roles, pathname, navigate]);

  return null;
}

