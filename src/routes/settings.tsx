import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Camera,
  ChevronRight,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);
  const session = useAuth((s) => s.session);

  const items = [
    {
      label: "Importar",
      description: "Importar dados do sistema via planilhas",
      to: "/import",
      icon: Upload,
    },
    {
      label: "Cartilhas",
      description: "Gerenciar cartilhas comerciais",
      to: "/commercial",
      icon: BookOpen,
    },
    {
      label: "Fotos",
      description: "Gerenciar fotos do catálogo",
      to: "/photos",
      icon: Camera,
    },
  ];

  if (session && isAdminOrMaster()) {
    items.unshift({
      label: "Usuários",
      description: "Gerenciar vendedores e acessos do sistema",
      to: "/admin/users",
      icon: Users,
    });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <Settings className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-text-primary">
              Configurações
            </h1>
            <p className="text-sm text-text-secondary">
              Gerencie os módulos e opções do sistema
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-5 transition hover:border-gold/40 hover:bg-surface-hover"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 transition group-hover:bg-gold/20">
                <item.icon className="h-5 w-5 text-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  {item.label}
                </h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {item.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary transition group-hover:translate-x-1 group-hover:text-gold" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
