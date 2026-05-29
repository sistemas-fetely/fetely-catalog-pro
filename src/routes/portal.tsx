import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/store/authStore";
import { PortalSidebar } from "@/components/layout/PortalSidebar";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal do Cliente — Fetély" },
      { name: "description", content: "Portal do lojista Fetély." },
    ],
  }),
  component: PortalLayout,
});

function PortalLayout() {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const roles = useAuth((s) => s.roles);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (!roles.includes("cliente")) {
      // não é cliente — manda pro catálogo do sistema interno
      navigate({ to: "/catalog" });
    }
  }, [loading, session, roles, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-text-secondary text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex">
      <PortalSidebar />
      <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
