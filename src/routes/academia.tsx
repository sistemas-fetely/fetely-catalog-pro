import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Lock, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  assinarPaths,
  listarModulos,
  meuProgresso,
  type ModuloResumo,
} from "@/lib/academia";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/academia")({
  head: () => ({
    meta: [
      { title: "Academia Fetély — Central de Treinamento" },
      {
        name: "description",
        content:
          "Treinamentos internos Fetély: módulos em vídeo, textos e materiais de apoio para o time comercial.",
      },
    ],
  }),
  component: AcademiaPage,
});

function AcademiaPage() {
  const user = useAuth((s) => s.user);
  const isAdmin = useAuth((s) => s.isAdminOrMaster)();
  const [modulos, setModulos] = useState<ModuloResumo[] | null>(null);
  const [progresso, setProgresso] = useState<Set<string>>(new Set());
  const [capas, setCapas] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const lista = await listarModulos();
        if (!alive) return;
        setModulos(lista);
        if (user) setProgresso(await meuProgresso(user.id));
        const paths = lista.map((m) => m.capa_url).filter(Boolean) as string[];
        if (paths.length > 0 && alive) setCapas(await assinarPaths(paths));
      } catch (e) {
        toast.error("Não foi possível carregar os treinamentos", {
          description: e instanceof Error ? e.message : undefined,
        });
        if (alive) setModulos([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-gold">
            Central de treinamento
          </p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl">Academia Fetély</h1>
          <p className="mt-2 max-w-xl text-sm text-text-secondary">
            Trilhas de capacitação do time comercial: vídeos, textos e materiais de apoio.
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/admin/academia"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs uppercase tracking-[0.15em] text-text-secondary hover:border-gold hover:text-gold"
          >
            <Settings2 className="h-4 w-4" />
            Gerenciar conteúdo
          </Link>
        )}
      </header>

      {modulos === null ? (
        <div className="mt-16 flex justify-center text-sm text-text-muted">
          Carregando treinamentos...
        </div>
      ) : modulos.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <GraduationCap className="h-10 w-10 text-gold/50" />
          <p className="text-sm text-text-secondary">
            Nenhum treinamento publicado no momento.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m) => (
            <ModuloCard
              key={m.id}
              modulo={m}
              capaUrl={m.capa_url ? capas[m.capa_url] : undefined}
              concluidas={m.aula_ids.filter((id) => progresso.has(id)).length}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ModuloCard({
  modulo,
  capaUrl,
  concluidas,
  isAdmin,
}: {
  modulo: ModuloResumo;
  capaUrl?: string;
  concluidas: number;
  isAdmin: boolean;
}) {
  const pct = useMemo(
    () =>
      modulo.total_aulas > 0
        ? Math.round((concluidas / modulo.total_aulas) * 100)
        : 0,
    [modulo.total_aulas, concluidas],
  );

  return (
    <Link
      to="/academia/$moduloId"
      params={{ moduloId: modulo.id }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-gold/60"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
        {capaUrl ? (
          <img
            src={capaUrl}
            alt={`Capa do módulo ${modulo.titulo}`}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wine/20 via-surface-2 to-gold/10">
            <GraduationCap className="h-12 w-12 text-gold/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {isAdmin && modulo.status === "rascunho" && (
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted backdrop-blur">
              Rascunho
            </span>
          )}
          {isAdmin && modulo.visibilidade === "interno" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold backdrop-blur">
              <Lock className="h-3 w-3" /> Interno
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-display text-lg leading-snug">{modulo.titulo}</h2>
        {modulo.descricao && (
          <p className="line-clamp-2 text-sm text-text-secondary">{modulo.descricao}</p>
        )}
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-text-muted">
            <span>
              {modulo.total_aulas} {modulo.total_aulas === 1 ? "aula" : "aulas"}
            </span>
            <span>{pct}% concluído</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
