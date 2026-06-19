import { useMemo, useState } from "react";
import { X, FileText, Loader2, Check, FileSpreadsheet } from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import { usePhotos } from "@/store/photoStore";
import {
  buildCatalogPDF,
  downloadCatalogPDF,
  CATALOG_FIELDS,
  DEFAULT_FIELDS,
  type CatalogVersion,
  type CatalogFieldKey,
} from "@/lib/catalogPdf";
import { buildCatalogXLSX, downloadCatalogXLSX } from "@/lib/catalogXlsx";

type ExportFormat = "pdf" | "xlsx";


interface ColecaoEntry {
  nome: string;
  categoria: string;
  count: number;
}

export function CatalogPdfModal({ onClose }: { onClose: () => void }) {
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();

  const grouped = useMemo(() => {
    const map = new Map<string, ColecaoEntry>();
    for (const p of products) {
      if (p.ativo === false) continue;
      const key = `${p.categoria}::${p.colecao}`;
      const cur = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { nome: p.colecao, categoria: p.categoria, count: 1 });
    }
    const byCat = new Map<string, ColecaoEntry[]>();
    for (const e of map.values()) {
      if (!byCat.has(e.categoria)) byCat.set(e.categoria, []);
      byCat.get(e.categoria)!.push(e);
    }
    for (const list of byCat.values()) {
      list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    return Array.from(byCat.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR"),
    );
  }, [products]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState<CatalogVersion>("cliente");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includePhotosXlsx, setIncludePhotosXlsx] = useState(true);
  const [fields, setFields] = useState<Set<CatalogFieldKey>>(
    () => new Set(DEFAULT_FIELDS),
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);

  const fieldsByGroup = useMemo(() => {
    const m = new Map<string, typeof CATALOG_FIELDS>();
    for (const f of CATALOG_FIELDS) {
      if (!m.has(f.group)) m.set(f.group, []);
      m.get(f.group)!.push(f);
    }
    return Array.from(m.entries());
  }, []);

  const toggleField = (k: CatalogFieldKey) => {
    setFields((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };


  const keyOf = (e: ColecaoEntry) => `${e.categoria}::${e.nome}`;

  const toggle = (k: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleCategoria = (cat: string, items: ColecaoEntry[]) => {
    setSelected((s) => {
      const next = new Set(s);
      const allOn = items.every((i) => next.has(keyOf(i)));
      for (const i of items) {
        if (allOn) next.delete(keyOf(i));
        else next.add(keyOf(i));
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    for (const [, items] of grouped) for (const i of items) all.add(keyOf(i));
    setSelected(all);
  };
  const clearAll = () => setSelected(new Set());

  const handleExport = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setProgress({ pct: 0, label: "Preparando..." });
    try {
      const colecoes = Array.from(selected).map((k) => {
        const [categoria, nome] = k.split("::");
        return { nome, categoria };
      });
      if (format === "pdf") {
        const blob = await buildCatalogPDF({
          products,
          photos,
          colecoesSelecionadas: colecoes,
          version,
          fields: Array.from(fields),
          onProgress: (pct, label) => setProgress({ pct, label }),
        });
        downloadCatalogPDF(blob, version);
      } else {
        const blob = await buildCatalogXLSX({
          products,
          photos,
          colecoesSelecionadas: colecoes,
          version,
          fields: Array.from(fields),
          includePhotos: includePhotosXlsx,
          onProgress: (pct, label) => setProgress({ pct, label }),
        });
        downloadCatalogXLSX(blob, version);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert(
        `Erro ao gerar ${format.toUpperCase()}: ` + (err as Error).message,
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-lg border border-gold/40 bg-surface p-6 space-y-5 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold">
              <FileText className="h-3 w-3" /> Catálogo PDF
            </div>
            <h3 className="font-display text-2xl mt-1">Gerar catálogo</h3>
            <p className="text-xs text-text-secondary mt-1">
              Selecione as coleções e a versão desejada.
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Versão</div>
          <div className="grid grid-cols-2 gap-2">
            <VersionOpt
              active={version === "cliente"}
              onClick={() => setVersion("cliente")}
              title="Cliente"
              hint="Apenas preço sugerido (varejo)"
            />
            <VersionOpt
              active={version === "interno"}
              onClick={() => setVersion("interno")}
              title="Interno"
              hint="Atacado + varejo"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Campos exibidos ({fields.size})
            </div>
            <div className="flex gap-2 text-[11px]">
              <button
                onClick={() => setFields(new Set(CATALOG_FIELDS.map((f) => f.key)))}
                className="text-gold hover:underline"
              >
                Todos
              </button>
              <span className="text-border">·</span>
              <button
                onClick={() => setFields(new Set(DEFAULT_FIELDS))}
                className="text-text-muted hover:text-text-primary"
              >
                Padrão
              </button>
              <span className="text-border">·</span>
              <button
                onClick={() => setFields(new Set())}
                className="text-text-muted hover:text-text-primary"
              >
                Nenhum
              </button>
            </div>
          </div>
          <div className="border border-border rounded-md p-3 max-h-44 overflow-y-auto space-y-2">
            {fieldsByGroup.map(([group, items]) => (
              <div key={group}>
                <div className="text-[9px] uppercase tracking-wider text-gold mb-1">
                  {group}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {items.map((f) => {
                    const on = fields.has(f.key);
                    return (
                      <button
                        key={f.key}
                        onClick={() => toggleField(f.key)}
                        className={`flex items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition ${
                          on
                            ? "border border-gold bg-gold/10"
                            : "border border-border hover:bg-surface-2"
                        }`}
                      >
                        <span
                          className={`h-3 w-3 rounded border flex-shrink-0 flex items-center justify-center ${
                            on ? "border-gold bg-gold" : "border-border"
                          }`}
                        >
                          {on && <Check className="h-2 w-2 text-background" />}
                        </span>
                        <span className="truncate">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>


        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            Coleções ({selected.size} selecionadas)
          </div>
          <div className="flex gap-2 text-[11px]">
            <button onClick={selectAll} className="text-gold hover:underline">
              Selecionar todas
            </button>
            <span className="text-border">·</span>
            <button onClick={clearAll} className="text-text-muted hover:text-text-primary">
              Limpar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-border rounded-md p-3 space-y-4">
          {grouped.map(([cat, items]) => {
            const allOn = items.every((i) => selected.has(keyOf(i)));
            return (
              <div key={cat}>
                <button
                  onClick={() => toggleCategoria(cat, items)}
                  className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-gold hover:text-gold-light"
                >
                  <span
                    className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                      allOn ? "border-gold bg-gold" : "border-border"
                    }`}
                  >
                    {allOn && <Check className="h-2.5 w-2.5 text-background" />}
                  </span>
                  {cat}
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 ml-5">
                  {items.map((it) => {
                    const k = keyOf(it);
                    const on = selected.has(k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggle(k)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                          on
                            ? "border-gold bg-gold/10"
                            : "border-border hover:bg-surface-2"
                        }`}
                      >
                        <span
                          className={`h-3.5 w-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                            on ? "border-gold bg-gold" : "border-border"
                          }`}
                        >
                          {on && <Check className="h-2.5 w-2.5 text-background" />}
                        </span>
                        <span className="flex-1 truncate">
                          {it.nome}
                          <span className="text-text-muted ml-1">({it.count})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {progress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> {progress.label}
              </span>
              <span>{Math.round(progress.pct * 100)}%</span>
            </div>
            <div className="h-1 bg-surface-2 rounded overflow-hidden">
              <div
                className="h-full bg-gold transition-all"
                style={{ width: `${progress.pct * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:bg-surface-2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" />
            {busy ? "Gerando..." : "Gerar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionOpt({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2.5 text-left transition ${
        active ? "border-gold bg-gold/10" : "border-border hover:bg-surface-2"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[11px] text-text-muted">{hint}</div>
    </button>
  );
}
