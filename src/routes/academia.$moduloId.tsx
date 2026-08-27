import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  urlsAcademia,
  marcarAula,
  meuProgresso,
  obterModulo,
  renderRichText,
  tempoParaSegundos,
  type AulaComBlocos,
  type TreinamentoBloco,
  type TreinamentoModulo,
} from "@/lib/academia";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/academia/$moduloId")({
  validateSearch: (s: Record<string, unknown>) => ({
    aula: typeof s.aula === "string" ? s.aula : undefined,
    t:
      typeof s.t === "string" || typeof s.t === "number"
        ? String(s.t)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Academy Fetély — Módulo" },
      { name: "description", content: "Aulas do módulo de treinamento Fetély." },
    ],
  }),
  component: ModuloPage,
});

function ModuloPage() {
  const { moduloId } = Route.useParams();
  const search = Route.useSearch();
  const user = useAuth((s) => s.user);
  const [modulo, setModulo] = useState<TreinamentoModulo | null>(null);
  const [aulas, setAulas] = useState<AulaComBlocos[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const [progresso, setProgresso] = useState<Set<string>>(new Set());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [deepSeek, setDeepSeek] = useState<{ blocoId: string; sec: number } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await obterModulo(moduloId);
        if (!alive) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setModulo(data.modulo);
        setAulas(data.aulas);
        // Deep link vindo do FAQ: abre a aula certa e posiciona o vídeo.
        let deepLinked = false;
        if (search.aula) {
          const idx = data.aulas.findIndex((a) => a.id === search.aula);
          if (idx >= 0) {
            deepLinked = true;
            setSelIdx(idx);
            if (search.t) {
              const sec = tempoParaSegundos(search.t);
              const vb = data.aulas[idx].blocos.find(
                (b) => b.tipo === "video" && b.youtube_id,
              );
              if (vb) setDeepSeek({ blocoId: vb.id, sec });
            }
          }
        }
        // Progresso + assinatura de arquivos em paralelo.
        const paths: string[] = [];
        if (data.modulo.capa_url) paths.push(data.modulo.capa_url);
        for (const a of data.aulas)
          for (const b of a.blocos) if (b.arquivo_url) paths.push(b.arquivo_url);
        const [prog, urlsMap] = await Promise.all([
          user ? meuProgresso(user.id) : Promise.resolve(new Set<string>()),
          paths.length > 0 ? urlsAcademia(paths) : Promise.resolve({} as Record<string, string>),
        ]);
        if (!alive) return;
        setUrls(urlsMap);
        if (user) {
          setProgresso(prog);
          // Abre na primeira aula não concluída (exceto quando veio deep link)
          if (!deepLinked) {
            const firstOpen = data.aulas.findIndex((a) => !prog.has(a.id));
            setSelIdx(firstOpen >= 0 ? firstOpen : 0);
          }
        }
      } catch (e) {
        toast.error("Não foi possível abrir o módulo", {
          description: e instanceof Error ? e.message : undefined,
        });
        if (alive) setNotFound(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [moduloId, user?.id]);

  const aula = aulas[selIdx] ?? null;
  const total = aulas.length;
  const concluidasCount = useMemo(
    () => aulas.filter((a) => progresso.has(a.id)).length,
    [aulas, progresso],
  );
  const pct = total > 0 ? Math.round((concluidasCount / total) * 100) : 0;
  const aulaConcluida = aula ? progresso.has(aula.id) : false;

  async function toggleConcluida() {
    if (!user || !aula) return;
    const novo = !progresso.has(aula.id);
    setSalvando(true);
    try {
      await marcarAula(user.id, aula.id, novo);
      setProgresso((prev) => {
        const next = new Set(prev);
        if (novo) next.add(aula.id);
        else next.delete(aula.id);
        return next;
      });
    } catch (e) {
      toast.error("Não foi possível salvar o progresso", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
        <GraduationCap className="h-10 w-10 text-gold/50" />
        <h1 className="font-display text-2xl">Módulo não disponível</h1>
        <p className="text-sm text-text-secondary">
          Este treinamento não existe, ainda é rascunho ou não está liberado para o seu perfil.
        </p>
        <Link
          to="/academia"
          className="mt-3 rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light"
        >
          Voltar para a Academy
        </Link>
      </main>
    );
  }

  if (!modulo) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16 text-center text-sm text-text-muted">
        Carregando módulo...
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <nav className="text-xs text-text-muted">
        <Link to="/academia" className="hover:text-gold">
          Academy
        </Link>{" "}
        / <span className="text-text-secondary">{modulo.titulo}</span>
      </nav>

      <header className="mt-3">
        <h1 className="font-display text-3xl">{modulo.titulo}</h1>
        {modulo.descricao && (
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">{modulo.descricao}</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] uppercase tracking-wider text-text-muted">
            {concluidasCount}/{total} aulas · {pct}%
          </span>
        </div>
      </header>

      {total === 0 ? (
        <p className="mt-10 text-sm text-text-secondary">
          Este módulo ainda não possui aulas publicadas.
        </p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Lista de aulas */}
          <aside>
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
              Aulas
            </p>
            <ul className="space-y-1">
              {aulas.map((a, i) => {
                const done = progresso.has(a.id);
                const active = i === selIdx;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelIdx(i)}
                      className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "border-gold/60 bg-surface text-text-primary"
                          : "border-transparent text-text-secondary hover:bg-surface-2"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-text-muted" />
                      )}
                      <span className="line-clamp-2">
                        <span className="mr-1.5 text-[11px] text-text-muted">{i + 1}.</span>
                        {a.titulo}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Conteúdo da aula */}
          <section className="min-w-0">
            {aula && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl">{aula.titulo}</h2>
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">
                    Aula {selIdx + 1} de {total}
                  </span>
                </div>

                <div className="mt-5 space-y-6">
                  {aula.blocos.length === 0 && (
                    <p className="text-sm text-text-muted">
                      Esta aula ainda não tem conteúdo.
                    </p>
                  )}
                  {aula.blocos.map((b) => (
                    <BlocoView
                      key={b.id}
                      bloco={b}
                      urls={urls}
                      seek={deepSeek?.blocoId === b.id ? deepSeek.sec : null}
                    />
                  ))}
                </div>

                {/* Navegação + conclusão */}
                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <button
                    onClick={() => setSelIdx((i) => Math.max(0, i - 1))}
                    disabled={selIdx === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary transition hover:border-gold hover:text-gold disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </button>

                  <button
                    onClick={toggleConcluida}
                    disabled={salvando}
                    className={`inline-flex items-center gap-2 rounded-md px-5 py-2 text-xs uppercase tracking-[0.15em] transition ${
                      aulaConcluida
                        ? "border border-gold/60 text-gold hover:bg-gold/10"
                        : "bg-gold text-background hover:bg-gold-light"
                    } disabled:opacity-50`}
                  >
                    <Check className="h-4 w-4" />
                    {aulaConcluida ? "Concluída" : "Marcar como concluída"}
                  </button>

                  <button
                    onClick={() => setSelIdx((i) => Math.min(total - 1, i + 1))}
                    disabled={selIdx >= total - 1}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary transition hover:border-gold hover:text-gold disabled:opacity-40"
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function BlocoView({
  bloco,
  urls,
  seek,
}: {
  bloco: TreinamentoBloco;
  urls: Record<string, string>;
  seek?: number | null;
}) {
  if (bloco.tipo === "video" && bloco.youtube_id) {
    return <VideoBloco bloco={bloco} initialSeek={seek ?? null} />;
  }

  if (bloco.tipo === "texto" && bloco.conteudo_texto) {
    return (
      <div
        className="rounded-xl border border-border bg-surface p-5 text-sm text-text-primary [&_strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: renderRichText(bloco.conteudo_texto) }}
      />
    );
  }

  if (bloco.tipo === "imagem" && bloco.arquivo_url) {
    const src = urls[bloco.arquivo_url];
    return (
      <figure className="overflow-hidden rounded-xl border border-border">
        {src ? (
          <img
            src={src}
            alt={bloco.arquivo_nome ?? "Imagem da aula"}
            className="w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-surface-2 text-text-muted">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </figure>
    );
  }

  if (bloco.tipo === "link" && bloco.conteudo_texto) {
    const href = bloco.conteudo_texto;
    const capa = bloco.arquivo_url ? urls[bloco.arquivo_url] : undefined;
    let dominio = href;
    try {
      dominio = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      // mantém o href bruto se a URL for inválida
    }

    async function copiarLink() {
      try {
        await navigator.clipboard.writeText(href);
        toast.success("Link copiado!");
      } catch {
        toast.error("Não foi possível copiar o link");
      }
    }

    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface transition hover:border-gold/60">
        {capa && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video w-full overflow-hidden bg-surface-2"
          >
            <img
              src={capa}
              alt={bloco.arquivo_nome ?? "Capa do link"}
              className="h-full w-full object-cover transition hover:scale-[1.02]"
              loading="lazy"
            />
          </a>
        )}
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
            <ExternalLink className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text-primary">
              {bloco.arquivo_nome?.trim() || dominio}
            </span>
            <span className="block truncate text-xs text-text-muted">{dominio}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 pb-4 pt-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-primary transition hover:border-gold hover:text-gold"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </a>
          <button
            onClick={copiarLink}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-primary transition hover:border-gold hover:text-gold"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar Link
          </button>
        </div>
      </div>
    );
  }

  if (bloco.tipo === "anexo" && bloco.arquivo_url) {
    const href = urls[bloco.arquivo_url];
    return (
      <a
        href={href ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-gold/60"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {bloco.arquivo_nome ?? "Material de apoio"}
          </span>
          <span className="block text-xs text-text-muted">
            {href ? "Clique para abrir ou baixar" : "Carregando link..."}
          </span>
        </span>
        <Download className="h-4 w-4 shrink-0 text-gold" />
      </a>
    );
  }

  if (bloco.tipo === "video") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
        <Play className="h-4 w-4" /> Vídeo indisponível.
      </div>
    );
  }
  return null;
}

// Player de vídeo com descritivo (tempos + falas) e seek por timestamp.
function VideoBloco({
  bloco,
  initialSeek,
}: {
  bloco: TreinamentoBloco;
  initialSeek?: number | null;
}) {
  const [start, setStart] = useState<number | null>(
    initialSeek && initialSeek > 0 ? initialSeek : null,
  );
  const id = bloco.youtube_id as string;
  const src =
    start != null && start > 0
      ? `https://www.youtube.com/embed/${id}?start=${start}&autoplay=1`
      : `https://www.youtube.com/embed/${id}`;
  const descritivo = bloco.descritivo ?? [];

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <div className="aspect-video w-full">
          <iframe
            key={start ?? 0}
            src={src}
            title="Vídeo da aula"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {descritivo.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
            Neste vídeo
          </p>
          <ul className="space-y-1">
            {descritivo.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => setStart(tempoParaSegundos(s.tempo))}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface-2"
                >
                  <span className="shrink-0 rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[11px] text-gold">
                    {s.tempo}
                  </span>
                  <span className="text-text-secondary">{s.fala}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
