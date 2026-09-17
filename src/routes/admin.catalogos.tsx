import { useCallback, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  alternarAtivo,
  excluirCatalogo,
  formatarTamanho,
  listarCatalogos,
  salvarCatalogo,
  uploadCatalogoArquivo,
  urlArquivo,
  type CatalogoPdf,
} from "@/lib/catalogosPdf";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/admin/catalogos")({
  head: () => ({
    meta: [
      { title: "Gerenciar Catálogos PDF — Admin Fetély" },
      {
        name: "description",
        content:
          "Cadastro interno dos catálogos em PDF das coleções, com capa e nome.",
      },
    ],
  }),
  component: AdminCatalogosPage,
});

interface FormState {
  id?: string;
  nome: string;
  colecao: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  pdf_path: string | null;
  capa_path: string | null;
  tamanho_bytes: number | null;
}

const vazio: FormState = {
  nome: "",
  colecao: "",
  descricao: "",
  ordem: 0,
  ativo: true,
  pdf_path: null,
  capa_path: null,
  tamanho_bytes: null,
};

function AdminCatalogosPage() {
  const isAdmin = useAuth((s) => s.isAdminOrMaster)();
  const [itens, setItens] = useState<CatalogoPdf[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState<"pdf" | "capa" | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setItens(await listarCatalogos(true));
    } catch (e) {
      toast.error("Falha ao carregar catálogos", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center text-sm text-text-muted">
        Esta área é restrita a administradores.
      </div>
    );
  }

  async function enviarArquivo(
    file: File,
    tipo: "pdfs" | "capas",
  ): Promise<void> {
    if (!form) return;
    if (tipo === "pdfs" && file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (tipo === "capas" && !file.type.startsWith("image/")) {
      toast.error("A capa precisa ser uma imagem (JPG, PNG ou WEBP).");
      return;
    }
    setEnviando(tipo === "pdfs" ? "pdf" : "capa");
    try {
      const path = await uploadCatalogoArquivo(
        file,
        tipo,
        form.nome || file.name,
      );
      setForm((f) =>
        f
          ? tipo === "pdfs"
            ? { ...f, pdf_path: path, tamanho_bytes: file.size }
            : { ...f, capa_path: path }
          : f,
      );
      toast.success(tipo === "pdfs" ? "PDF enviado" : "Capa enviada");
    } catch (e) {
      toast.error("Falha no envio do arquivo", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setEnviando(null);
    }
  }

  async function salvar() {
    if (!form) return;
    if (!form.nome.trim()) {
      toast.error("Dê um nome ao catálogo.");
      return;
    }
    if (!form.pdf_path) {
      toast.error("Envie o arquivo PDF do catálogo.");
      return;
    }
    setSalvando(true);
    try {
      await salvarCatalogo({
        id: form.id,
        nome: form.nome.trim(),
        colecao: form.colecao.trim() || null,
        descricao: form.descricao.trim() || null,
        ordem: form.ordem,
        ativo: form.ativo,
        pdf_path: form.pdf_path,
        capa_path: form.capa_path,
        tamanho_bytes: form.tamanho_bytes,
      } as never);
      toast.success("Catálogo salvo");
      setForm(null);
      await recarregar();
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
          <h1 className="font-display text-3xl mt-2">Catálogos PDF</h1>
          <p className="text-xs text-text-secondary mt-1">
            Cada catálogo tem nome, capa e arquivo PDF. Os ativos aparecem na
            página pública que você envia ao cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/catalogos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:bg-surface-2"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver página do cliente
          </a>
          <button
            onClick={() => setForm({ ...vazio })}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-background hover:bg-gold-light"
          >
            <Plus className="h-3.5 w-3.5" /> Novo catálogo
          </button>
        </div>
      </div>

      {form && (
        <div className="rounded-lg border border-gold/40 bg-surface p-5 space-y-4">
          <h2 className="font-display text-xl">
            {form.id ? "Editar catálogo" : "Novo catálogo"}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Nome do catálogo *
              </span>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Catálogo Solar Tropical 2026"
                className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Coleção (opcional)
              </span>
              <input
                value={form.colecao}
                onChange={(e) => setForm({ ...form, colecao: e.target.value })}
                placeholder="Solar Tropical"
                className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              Descrição (opcional)
            </span>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold">
                <FileText className="h-3 w-3" /> Arquivo PDF *
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviarArquivo(f, "pdfs");
                }}
                className="mt-2 w-full text-xs"
              />
              <div className="mt-2 text-[11px] text-text-muted">
                {enviando === "pdf" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                  </span>
                ) : form.pdf_path ? (
                  <a
                    href={urlArquivo(form.pdf_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:underline"
                  >
                    PDF enviado · {formatarTamanho(form.tamanho_bytes)}
                  </a>
                ) : (
                  "Nenhum PDF enviado ainda."
                )}
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold">
                <ImageIcon className="h-3 w-3" /> Capa do catálogo
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void enviarArquivo(f, "capas");
                }}
                className="mt-2 w-full text-xs"
              />
              <div className="mt-2 flex items-center gap-2 text-[11px] text-text-muted">
                {enviando === "capa" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                  </span>
                ) : form.capa_path ? (
                  <img
                    src={urlArquivo(form.capa_path)}
                    alt="Capa selecionada"
                    className="h-16 w-12 rounded object-cover border border-border"
                  />
                ) : (
                  "Sem capa — a página mostra um ícone."
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              Ordem
              <input
                type="number"
                value={form.ordem}
                onChange={(e) =>
                  setForm({ ...form, ordem: Number(e.target.value) || 0 })
                }
                className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="accent-gold"
              />
              Visível para o cliente
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setForm(null)}
              disabled={salvando}
              className="rounded-md border border-border px-4 py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              onClick={() => void salvar()}
              disabled={salvando || enviando !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-40"
            >
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar
            </button>
          </div>
        </div>
      )}

      {itens === null ? (
        <div className="flex justify-center py-16 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-text-muted py-10 text-center">
          Nenhum catálogo cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {itens.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3"
            >
              <div className="h-16 w-12 flex-shrink-0 rounded bg-surface-2 overflow-hidden flex items-center justify-center">
                {c.capa_path ? (
                  <img
                    src={urlArquivo(c.capa_path)}
                    alt={`Capa de ${c.nome}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen className="h-5 w-5 text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.nome}</div>
                <div className="text-[11px] text-text-muted truncate">
                  {c.colecao ? `${c.colecao} · ` : ""}
                  {formatarTamanho(c.tamanho_bytes)} · ordem {c.ordem}
                  {c.ativo ? "" : " · oculto"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={urlArquivo(c.pdf_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir PDF"
                  className="rounded p-2 text-text-muted hover:text-gold"
                >
                  <FileText className="h-4 w-4" />
                </a>
                <button
                  title={c.ativo ? "Ocultar do cliente" : "Mostrar ao cliente"}
                  onClick={async () => {
                    try {
                      await alternarAtivo(c.id, !c.ativo);
                      await recarregar();
                    } catch (e) {
                      toast.error("Falha ao alterar visibilidade", {
                        description:
                          e instanceof Error ? e.message : undefined,
                      });
                    }
                  }}
                  className="rounded p-2 text-text-muted hover:text-gold"
                >
                  {c.ativo ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
                <button
                  title="Editar"
                  onClick={() =>
                    setForm({
                      id: c.id,
                      nome: c.nome,
                      colecao: c.colecao ?? "",
                      descricao: c.descricao ?? "",
                      ordem: c.ordem,
                      ativo: c.ativo,
                      pdf_path: c.pdf_path,
                      capa_path: c.capa_path,
                      tamanho_bytes: c.tamanho_bytes,
                    })
                  }
                  className="rounded p-2 text-text-muted hover:text-gold"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  title="Excluir"
                  onClick={async () => {
                    if (!confirm(`Excluir o catálogo "${c.nome}"?`)) return;
                    try {
                      await excluirCatalogo(c.id);
                      toast.success("Catálogo excluído");
                      await recarregar();
                    } catch (e) {
                      toast.error("Falha ao excluir", {
                        description:
                          e instanceof Error ? e.message : undefined,
                      });
                    }
                  }}
                  className="rounded p-2 text-text-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-text-muted flex items-center gap-1.5">
        <Upload className="h-3 w-3" /> Link para enviar ao cliente:{" "}
        <span className="font-mono">/catalogos</span>
      </p>
    </div>
  );
}
