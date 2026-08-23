import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircleQuestion,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  assinarPaths,
  descritivoParaTexto,
  excluirAula,
  excluirBloco,
  excluirModulo,
  extrairYoutubeId,
  listarModulos,
  obterModulo,
  parseDescritivo,
  salvarAula,
  salvarBloco,
  salvarModulo,
  trocarOrdem,
  uploadAcademia,
  type AulaComBlocos,
  type FaqPerguntaRow,
  type ModuloResumo,
  type TipoBloco,
  type TreinamentoBloco,
  type TreinamentoModulo,
  type VisibilidadeModulo,
  type StatusModulo,
} from "@/lib/academia";
import {
  listarDuvidasAcademia,
  reindexAcademiaModulo,
  reindexAcademiaTudo,
} from "@/lib/academiaAi.functions";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/admin/academia")({
  head: () => ({
    meta: [
      { title: "Gerenciar Academia — Admin Fetély" },
      {
        name: "description",
        content: "Administração dos módulos, aulas e materiais da Academia Fetély.",
      },
    ],
  }),
  component: AdminAcademiaPage,
});

function AdminAcademiaPage() {
  const isAdmin = useAuth((s) => s.isAdminOrMaster)();
  const [modulos, setModulos] = useState<ModuloResumo[] | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [reindexando, setReindexando] = useState(false);

  async function reindexarTudoClick() {
    setReindexando(true);
    try {
      const r = await reindexAcademiaTudo();
      toast.success(
        `FAQ reindexado: ${r.chunks} trechos em ${r.modulos} módulo(s)`,
      );
    } catch (e) {
      toast.error("Falha ao reindexar a base do FAQ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setReindexando(false);
    }
  }

  const recarregar = useCallback(async () => {
    try {
      setModulos(await listarModulos());
    } catch (e) {
      toast.error("Falha ao carregar módulos", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Acesso restrito</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Apenas administradores gerenciam o conteúdo da Academia.
        </p>
      </main>
    );
  }

  async function novoModulo() {
    try {
      const id = await salvarModulo({
        titulo: "Novo módulo",
        descricao: "",
        visibilidade: "todos",
        status: "rascunho",
      });
      await recarregar();
      setEditandoId(id);
    } catch (e) {
      toast.error("Não foi possível criar o módulo", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    if (!modulos) return;
    const a = modulos[idx];
    const b = modulos[idx + dir];
    if (!a || !b) return;
    try {
      await trocarOrdem("treinamento_modulo", a, b);
      await recarregar();
    } catch (e) {
      toast.error("Falha ao reordenar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function remover(m: ModuloResumo) {
    if (!window.confirm(`Excluir o módulo "${m.titulo}" com todas as aulas?`)) return;
    try {
      await excluirModulo(m.id);
      toast.success("Módulo excluído");
      await recarregar();
    } catch (e) {
      toast.error("Falha ao excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  if (editandoId) {
    return (
      <ModuloEditor
        moduloId={editandoId}
        onVoltar={() => {
          setEditandoId(null);
          void recarregar();
        }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <nav className="text-xs text-text-muted">
        <Link to="/academia" className="hover:text-gold">
          Academia
        </Link>{" "}
        / <span className="text-text-secondary">Gerenciar conteúdo</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Academia — Conteúdo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Crie módulos, organize aulas e publique para o time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void reindexarTudoClick()}
            disabled={reindexando}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs uppercase tracking-[0.15em] text-text-secondary hover:border-gold hover:text-gold disabled:opacity-50"
          >
            {reindexando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reindexar FAQ
          </button>
          <button
            onClick={novoModulo}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light"
          >
            <Plus className="h-4 w-4" /> Novo módulo
          </button>
        </div>
      </header>

      {modulos === null ? (
        <p className="mt-16 text-center text-sm text-text-muted">Carregando...</p>
      ) : modulos.length === 0 ? (
        <p className="mt-16 text-center text-sm text-text-secondary">
          Nenhum módulo criado ainda.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {modulos.map((m, i) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="text-text-muted hover:text-gold disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === modulos.length - 1}
                  className="text-text-muted hover:text-gold disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg">{m.titulo}</p>
                <p className="text-xs text-text-muted">
                  {m.total_aulas} {m.total_aulas === 1 ? "aula" : "aulas"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                  m.status === "publicado"
                    ? "bg-gold/15 text-gold"
                    : "bg-surface-2 text-text-muted"
                }`}
              >
                {m.status === "publicado" ? "Publicado" : "Rascunho"}
              </span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] uppercase tracking-wider text-text-muted">
                {m.visibilidade === "interno" ? "Só time interno" : "Todos"}
              </span>
              <button
                onClick={() => setEditandoId(m.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-text-secondary hover:border-gold hover:text-gold"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                onClick={() => remover(m)}
                className="rounded-md border border-border p-2 text-text-muted hover:border-red-500/60 hover:text-red-400"
                aria-label="Excluir módulo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <DuvidasSection />
    </main>
  );
}

// ------------------------------------------------------------- Dúvidas FAQ

function DuvidasSection() {
  const [dados, setDados] = useState<FaqPerguntaRow[] | null>(null);
  const [soSemResposta, setSoSemResposta] = useState(false);

  useEffect(() => {
    listarDuvidasAcademia()
      .then((r) => setDados(r.perguntas))
      .catch(() => setDados([]));
  }, []);

  if (dados === null) return null;
  const semResposta = dados.filter((d) => !d.encontrou_resposta);
  const exibidas = (soSemResposta ? semResposta : dados).slice(0, 15);

  return (
    <section className="mt-10 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5 text-gold" />
          <h2 className="font-display text-xl">Dúvidas do FAQ</h2>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
            {dados.length} perguntas
          </span>
          {semResposta.length > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-400">
              {semResposta.length} sem resposta
            </span>
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={soSemResposta}
            onChange={(e) => setSoSemResposta(e.target.checked)}
            className="accent-gold"
          />
          Só sem resposta
        </label>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Perguntas recorrentes sem boa resposta são candidatas a novos conteúdos.
      </p>

      {exibidas.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          Nenhuma pergunta registrada ainda.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {exibidas.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    d.encontrou_resposta
                      ? "bg-gold/15 text-gold"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {d.encontrou_resposta ? "Respondida" : "Sem resposta"}
                </span>
                <span className="text-[11px] text-text-muted">
                  {new Date(d.criado_em).toLocaleString("pt-BR")}
                  {d.usuario_nome ? ` · ${d.usuario_nome}` : ""}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-text-primary">{d.pergunta}</p>
              {!d.encontrou_resposta && d.resposta && (
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {d.resposta}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Editor

function ModuloEditor({
  moduloId,
  onVoltar,
}: {
  moduloId: string;
  onVoltar: () => void;
}) {
  const [modulo, setModulo] = useState<TreinamentoModulo | null>(null);
  const [aulas, setAulas] = useState<AulaComBlocos[]>([]);
  const [aulaSelId, setAulaSelId] = useState<string | null>(null);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    const data = await obterModulo(moduloId);
    if (!data) {
      toast.error("Módulo não encontrado");
      onVoltar();
      return;
    }
    setModulo(data.modulo);
    setAulas(data.aulas);
    setAulaSelId((prev) =>
      prev && data.aulas.some((a) => a.id === prev)
        ? prev
        : (data.aulas[0]?.id ?? null),
    );
    if (data.modulo.capa_url) {
      const urls = await assinarPaths([data.modulo.capa_url]);
      setCapaUrl(urls[data.modulo.capa_url] ?? null);
    } else {
      setCapaUrl(null);
    }
  }, [moduloId, onVoltar]);

  useEffect(() => {
    void recarregar().catch((e) =>
      toast.error("Falha ao abrir módulo", {
        description: e instanceof Error ? e.message : undefined,
      }),
    );
  }, [recarregar]);

  if (!modulo) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16 text-center text-sm text-text-muted">
        Carregando...
      </main>
    );
  }

  // Reindexa a base do FAQ em segundo plano após qualquer edição de conteúdo.
  function reindexar() {
    void reindexAcademiaModulo({ data: { moduloId } }).catch(() => undefined);
  }

  async function salvarCabecalho(patch: Partial<TreinamentoModulo>) {
    if (!modulo) return;
    setSalvando(true);
    try {
      await salvarModulo({ ...modulo, ...patch });
      setModulo({ ...modulo, ...patch });
      toast.success("Módulo salvo");
      reindexar();
    } catch (e) {
      toast.error("Falha ao salvar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  async function uploadCapa(file: File) {
    try {
      const path = await uploadAcademia(file, "capas");
      await salvarCabecalho({ capa_url: path });
      const urls = await assinarPaths([path]);
      setCapaUrl(urls[path] ?? null);
    } catch (e) {
      toast.error("Falha no upload da capa", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <button
        onClick={onVoltar}
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-muted hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à lista
      </button>

      {/* Cabeçalho do módulo */}
      <section className="mt-4 rounded-xl border border-border bg-surface p-5">
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-text-muted">
              Capa
            </p>
            <label className="flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-2 text-text-muted hover:border-gold">
              {capaUrl ? (
                <img src={capaUrl} alt="Capa do módulo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadCapa(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                Título
              </span>
              <input
                defaultValue={modulo.titulo}
                key={`t-${modulo.id}-${modulo.titulo}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== modulo.titulo) void salvarCabecalho({ titulo: v });
                }}
                title="Enter ou clicar fora salva o título"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">
                Descrição
              </span>
              <textarea
                defaultValue={modulo.descricao ?? ""}
                key={`d-${modulo.id}`}
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (modulo.descricao ?? ""))
                    void salvarCabecalho({ descricao: e.target.value });
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-text-muted">
                  Visibilidade
                </span>
                <select
                  value={modulo.visibilidade}
                  onChange={(e) =>
                    void salvarCabecalho({
                      visibilidade: e.target.value as VisibilidadeModulo,
                    })
                  }
                  className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  <option value="todos">Todos (inclui representantes)</option>
                  <option value="interno">Só time interno</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-text-muted">
                  Status
                </span>
                <select
                  value={modulo.status}
                  onChange={(e) =>
                    void salvarCabecalho({ status: e.target.value as StatusModulo })
                  }
                  className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  <option value="rascunho">Rascunho (invisível)</option>
                  <option value="publicado">Publicado</option>
                </select>
              </label>
              {salvando && (
                <span className="inline-flex items-center gap-1.5 self-end text-xs text-text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Aulas */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <AulasPanel
          moduloId={modulo.id}
          aulas={aulas}
          aulaSelId={aulaSelId}
          onSelect={setAulaSelId}
          onChanged={recarregar}
        />
        <BlocosPanel
          aula={aulas.find((a) => a.id === aulaSelId) ?? null}
          onChanged={recarregar}
          onIndex={reindexar}
        />
      </section>
    </main>
  );
}

// ------------------------------------------------------------------ Aulas

function AulasPanel({
  moduloId,
  aulas,
  aulaSelId,
  onSelect,
  onChanged,
}: {
  moduloId: string;
  aulas: AulaComBlocos[];
  aulaSelId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [novoTitulo, setNovoTitulo] = useState("");

  async function adicionar() {
    const t = novoTitulo.trim();
    if (!t) return;
    try {
      const id = await salvarAula({ modulo_id: moduloId, titulo: t });
      setNovoTitulo("");
      await onChanged();
      onSelect(id);
    } catch (e) {
      toast.error("Falha ao criar aula", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function renomear(a: AulaComBlocos, titulo: string) {
    const t = titulo.trim();
    if (!t || t === a.titulo) return;
    try {
      await salvarAula({ id: a.id, modulo_id: moduloId, titulo: t });
      await onChanged();
    } catch (e) {
      toast.error("Falha ao renomear", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    const a = aulas[idx];
    const b = aulas[idx + dir];
    if (!a || !b) return;
    try {
      await trocarOrdem("treinamento_aula", a, b);
      await onChanged();
    } catch (e) {
      toast.error("Falha ao reordenar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function remover(a: AulaComBlocos) {
    if (!window.confirm(`Excluir a aula "${a.titulo}" e todos os blocos?`)) return;
    try {
      await excluirAula(a.id);
      await onChanged();
    } catch (e) {
      toast.error("Falha ao excluir aula", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
        Aulas ({aulas.length})
      </p>
      <ul className="space-y-1.5">
        {aulas.map((a, i) => (
          <li
            key={a.id}
            className={`rounded-md border px-2 py-1.5 ${
              a.id === aulaSelId ? "border-gold/60 bg-surface" : "border-border bg-surface"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <button
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="text-text-muted hover:text-gold disabled:opacity-30"
                  aria-label="Mover aula para cima"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={i === aulas.length - 1}
                  className="text-text-muted hover:text-gold disabled:opacity-30"
                  aria-label="Mover aula para baixo"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <input
                defaultValue={a.titulo}
                key={a.id + a.titulo}
                onFocus={() => onSelect(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                onBlur={(e) => void renomear(a, e.target.value)}
                title="Enter ou clicar fora salva o nome"
                className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-background"
              />
              <button
                onClick={() => remover(a)}
                className="p-1 text-text-muted hover:text-red-400"
                aria-label="Excluir aula"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1.5">
        <input
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void adicionar();
          }}
          placeholder="Nova aula..."
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-gold"
        />
        <button
          onClick={() => void adicionar()}
          className="rounded-md bg-gold px-2.5 text-background hover:bg-gold-light"
          aria-label="Adicionar aula"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Blocos

const TIPOS: { tipo: TipoBloco; label: string; Icon: typeof Play }[] = [
  { tipo: "video", label: "Vídeo YouTube", Icon: Play },
  { tipo: "texto", label: "Texto", Icon: FileText },
  { tipo: "imagem", label: "Imagem", Icon: ImageIcon },
  { tipo: "anexo", label: "Anexo (PDF...)", Icon: Paperclip },
];

function BlocosPanel({
  aula,
  onChanged,
  onIndex,
}: {
  aula: AulaComBlocos | null;
  onChanged: () => Promise<void>;
  onIndex?: () => void;
}) {
  if (!aula) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-muted">
        {aula === null ? "Crie ou selecione uma aula para editar os blocos." : null}
      </div>
    );
  }

  async function adicionarBloco(tipo: TipoBloco) {
    if (!aula) return;
    try {
      await salvarBloco({
        aula_id: aula.id,
        tipo,
        conteudo_texto: tipo === "texto" ? "" : null,
        youtube_id: tipo === "video" ? "" : null,
      });
      await onChanged();
    } catch (e) {
      toast.error("Falha ao adicionar bloco", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    if (!aula) return;
    const a = aula.blocos[idx];
    const b = aula.blocos[idx + dir];
    if (!a || !b) return;
    try {
      await trocarOrdem("treinamento_bloco", a, b);
      await onChanged();
    } catch (e) {
      toast.error("Falha ao reordenar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function remover(b: TreinamentoBloco) {
    if (!window.confirm("Excluir este bloco?")) return;
    try {
      await excluirBloco(b.id);
      await onChanged();
    } catch (e) {
      toast.error("Falha ao excluir bloco", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
        Conteúdo da aula: <span className="text-gold">{aula.titulo}</span>
      </p>

      <div className="space-y-3">
        {aula.blocos.map((b, i) => (
          <BlocoCard
            key={b.id}
            bloco={b}
            primeiro={i === 0}
            ultimo={i === aula.blocos.length - 1}
            onMover={(dir) => void mover(i, dir)}
            onExcluir={() => void remover(b)}
            onChanged={onChanged}
            onIndex={onIndex}
          />
        ))}
        {aula.blocos.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-muted">
            Nenhum bloco ainda. Adicione o primeiro abaixo.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TIPOS.map(({ tipo, label, Icon }) => (
          <button
            key={tipo}
            onClick={() => void adicionarBloco(tipo)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-text-secondary transition hover:border-gold hover:text-gold"
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlocoCard({
  bloco,
  primeiro,
  ultimo,
  onMover,
  onExcluir,
  onChanged,
  onIndex,
}: {
  bloco: TreinamentoBloco;
  primeiro: boolean;
  ultimo: boolean;
  onMover: (dir: -1 | 1) => void;
  onExcluir: () => void;
  onChanged: () => Promise<void>;
  onIndex?: () => void;
}) {
  const meta = TIPOS.find((t) => t.tipo === bloco.tipo);
  const Icon = meta?.Icon ?? FileText;

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gold" />
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          {meta?.label ?? bloco.tipo}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onMover(-1)}
            disabled={primeiro}
            className="p-1 text-text-muted hover:text-gold disabled:opacity-30"
            aria-label="Mover bloco para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMover(1)}
            disabled={ultimo}
            className="p-1 text-text-muted hover:text-gold disabled:opacity-30"
            aria-label="Mover bloco para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onExcluir}
            className="p-1 text-text-muted hover:text-red-400"
            aria-label="Excluir bloco"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2.5">
        {bloco.tipo === "video" && (
          <VideoEditor bloco={bloco} onChanged={onChanged} onIndex={onIndex} />
        )}
        {bloco.tipo === "texto" && (
          <TextoEditor bloco={bloco} onChanged={onChanged} onIndex={onIndex} />
        )}
        {(bloco.tipo === "imagem" || bloco.tipo === "anexo") && (
          <ArquivoEditor bloco={bloco} onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}

function VideoEditor({
  bloco,
  onChanged,
  onIndex,
}: {
  bloco: TreinamentoBloco;
  onChanged: () => Promise<void>;
  onIndex?: () => void;
}) {
  const urlOriginal = bloco.youtube_id
    ? `https://www.youtube.com/watch?v=${bloco.youtube_id}`
    : "";
  const descOriginal = descritivoParaTexto(bloco.descritivo);
  const [url, setUrl] = useState(urlOriginal);
  const [descritivo, setDescritivo] = useState(descOriginal);
  const [salvando, setSalvando] = useState(false);
  const id = extrairYoutubeId(url);
  const sujo = url !== urlOriginal || descritivo !== descOriginal;

  async function salvarTudo() {
    if (sujo && url.trim() && !id) {
      toast.error("Cole um link válido do YouTube");
      return;
    }
    const mudouDesc = descritivo !== descOriginal;
    const linhasTexto = descritivo.split(/\r?\n/).filter((l) => l.trim()).length;
    let parsed: ReturnType<typeof parseDescritivo> | undefined;
    if (mudouDesc) {
      parsed = parseDescritivo(descritivo);
      // Texto preenchido mas nenhuma linha no formato "mm:ss fala":
      // salvaria um descritivo vazio e o selo de "não salvo" ficaria preso.
      if (linhasTexto > 0 && parsed.length === 0) {
        toast.error("Nenhuma linha tem tempo válido", {
          description:
            "Cada linha precisa começar com mm:ss — ex.: 02:35 Como cadastrar o cliente.",
        });
        return;
      }
    }
    const patch: {
      id: string;
      aula_id: string;
      tipo: "video";
      youtube_id?: string;
      descritivo?: ReturnType<typeof parseDescritivo>;
    } = { id: bloco.id, aula_id: bloco.aula_id, tipo: "video" };
    if (url !== urlOriginal) patch.youtube_id = id ?? "";
    if (parsed !== undefined) patch.descritivo = parsed;
    if (patch.youtube_id === undefined && patch.descritivo === undefined) return;
    setSalvando(true);
    try {
      await salvarBloco(patch);
      // Sincroniza o estado local com o que foi realmente salvo — sem isso o
      // texto digitado (com linhas ignoradas) nunca bate com o descritivo
      // normalizado vindo do banco e o selo "não salvas" nunca some.
      if (patch.youtube_id !== undefined) {
        setUrl(
          patch.youtube_id
            ? `https://www.youtube.com/watch?v=${patch.youtube_id}`
            : "",
        );
      }
      if (parsed !== undefined) {
        setDescritivo(descritivoParaTexto(parsed));
        const ignoradas = linhasTexto - parsed.length;
        if (ignoradas > 0) {
          toast.warning(`${ignoradas} linha(s) ignorada(s)`, {
            description:
              "Linhas sem tempo no formato mm:ss não entram no descritivo.",
          });
        }
      }
      toast.success("Alterações salvas — base do FAQ atualizada");
      if (patch.descritivo !== undefined) onIndex?.();
      await onChanged();
    } catch (e) {
      toast.error("Falha ao salvar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void salvarTudo();
        }}
        placeholder="Cole o link do YouTube (watch, youtu.be, shorts...)"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
      />
      {id && (
        <img
          src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
          alt="Miniatura do vídeo"
          className="h-24 rounded-md border border-border object-cover"
        />
      )}
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          Descritivo do vídeo (alimenta o FAQ)
        </span>
        <textarea
          value={descritivo}
          onChange={(e) => setDescritivo(e.target.value)}
          rows={5}
          placeholder={"Uma linha por trecho: mm:ss fala\n00:00 Abertura e apresentação\n02:35 Como cadastrar o cliente\n05:10 Aplicando o desconto"}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-gold"
        />
        <span className="text-[10px] text-text-muted">
          Formato: <span className="font-mono">mm:ss texto da fala</span> — um
          por linha. Clicável para o aluno e usado nas respostas do FAQ.
        </span>
      </label>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => void salvarTudo()}
          disabled={salvando || !sujo}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
            sujo
              ? "bg-gold text-background hover:bg-gold-light"
              : "cursor-default border border-border text-text-muted"
          }`}
        >
          {salvando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {sujo ? (
          <span className="text-[10px] font-medium uppercase tracking-wider text-gold">
            Há alterações não salvas
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">Tudo salvo</span>
        )}
      </div>
    </div>
  );
}

function TextoEditor({
  bloco,
  onChanged,
  onIndex,
}: {
  bloco: TreinamentoBloco;
  onChanged: () => Promise<void>;
  onIndex?: () => void;
}) {
  const [texto, setTexto] = useState(bloco.conteudo_texto ?? "");
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const sujo = texto !== (bloco.conteudo_texto ?? "");

  function inserir(prefix: string, suffix = "") {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const novo = value.slice(0, s) + prefix + value.slice(s, e) + suffix + value.slice(e);
    setTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, e + prefix.length);
    });
  }

  async function salvar() {
    if (!sujo || salvando) return;
    setSalvando(true);
    try {
      await salvarBloco({
        id: bloco.id,
        aula_id: bloco.aula_id,
        tipo: "texto",
        conteudo_texto: texto,
      });
      toast.success("Texto salvo");
      onIndex?.();
      await onChanged();
    } catch (e) {
      toast.error("Falha ao salvar texto", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {[
          { label: "Título", run: () => inserir("## ") },
          { label: "B", run: () => inserir("**", "**"), title: "Negrito" },
          { label: "I", run: () => inserir("*", "*"), title: "Itálico" },
          { label: "Lista", run: () => inserir("- ") },
          { label: "Link", run: () => inserir("[texto](https://") },
        ].map((b) => (
          <button
            key={b.label}
            title={b.title}
            onClick={b.run}
            className="rounded border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:border-gold hover:text-gold"
          >
            {b.label}
          </button>
        ))}
        <button
          onClick={() => void salvar()}
          disabled={salvando || !sujo}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
            sujo
              ? "bg-gold text-background hover:bg-gold-light"
              : "cursor-default border border-border text-text-muted"
          }`}
        >
          {salvando ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {salvando ? "Salvando..." : "Salvar texto"}
        </button>
      </div>
      <textarea
        ref={ref}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => void salvar()}
        rows={6}
        placeholder="Escreva o conteúdo... Use ## título, **negrito**, *itálico*, - lista, [texto](https://link)"
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-gold"
      />
      <p
        className={`text-[10px] uppercase tracking-wider ${
          sujo ? "font-medium text-gold" : "text-text-muted"
        }`}
      >
        {sujo
          ? "Há alterações não salvas — clique em Salvar texto (ou saia do campo)."
          : "Tudo salvo."}
      </p>
    </div>
  );
}

function ArquivoEditor({
  bloco,
  onChanged,
}: {
  bloco: TreinamentoBloco;
  onChanged: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const ehImagem = bloco.tipo === "imagem";

  async function enviar(file: File) {
    setEnviando(true);
    try {
      const path = await uploadAcademia(file, "blocos");
      await salvarBloco({
        id: bloco.id,
        aula_id: bloco.aula_id,
        tipo: bloco.tipo,
        arquivo_url: path,
        arquivo_nome: file.name,
      });
      toast.success(ehImagem ? "Imagem enviada" : "Anexo enviado");
      await onChanged();
    } catch (e) {
      toast.error("Falha no upload", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs uppercase tracking-wider text-text-secondary hover:border-gold hover:text-gold">
        {enviando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {bloco.arquivo_url ? "Trocar arquivo" : ehImagem ? "Enviar imagem" : "Enviar arquivo"}
        <input
          type="file"
          accept={ehImagem ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"}
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
            e.target.value = "";
          }}
        />
      </label>
      {bloco.arquivo_nome && (
        <span className="truncate text-sm text-text-secondary">{bloco.arquivo_nome}</span>
      )}
    </div>
  );
}
