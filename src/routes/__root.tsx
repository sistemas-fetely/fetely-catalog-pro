import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Header } from "@/components/layout/Header";
import { useAuth as useAuthStore } from "@/store/authStore";

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
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
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
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const isLogin = pathname === "/login";
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <div className="min-h-screen bg-background text-text-primary">
          {!isLogin && <Header />}
          <Outlet />
        </div>
      </AuthGate>
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((s) => s.init);
  const loading = useAuthStore((s) => s.loading);
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const isPublic = pathname === "/login";

  React.useEffect(() => {
    init();
  }, [init]);

  React.useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      router.navigate({ to: "/login" });
    }
  }, [loading, session, isPublic, router]);

  if (loading && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-text-secondary text-sm">
        Carregando...
      </div>
    );
  }
  if (!session && !isPublic) return null;
  return <>{children}</>;
}
