import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Camera, AlertTriangle, FileText } from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import {
  usePhotos,
  getColecaoPhoto,
  getProdutoPhoto,
  photoStorageBytes,
} from "@/store/photoStore";
import { PhotoUploadModal } from "@/components/photos/PhotoUploadModal";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { CatalogPdfModal } from "@/components/photos/CatalogPdfModal";

const searchSchema = z.object({
  tab: fallback(z.enum(["colecao", "cor"]), "colecao").default("colecao"),
  colecao: fallback(z.string(), "").optional(),
  categoria: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/photos")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Gerenciar Fotos — Fetély B2B" },
      { name: "description", content: "Upload de fotos por coleção e por cor." },
    ],
  }),
  component: PhotosPage,
});

function PhotosPage() {
  const { tab, colecao: paramCol, categoria: paramCat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const products = useCatalog((s) => s.products);
  const photos = usePhotos();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const bytes = photoStorageBytes(photos);
  const warn = bytes > 4 * 1024 * 1024;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            Mídia
          </div>
          <h1 className="font-display text-4xl mt-1">Gerenciar Fotos</h1>
          <p className="text-sm text-text-secondary mt-2 max-w-2xl">
            Suba uma foto principal para cada coleção e fotos específicas por cor.
            Imagens são redimensionadas (800px / JPEG 80%) e salvas localmente.
          </p>
        </div>
        <button
          onClick={() => setCatalogOpen(true)}
          className="flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
        >
          <FileText className="h-3.5 w-3.5" /> Gerar catálogo PDF
        </button>
      </header>

      {warn && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-stock-pre/60 bg-surface-2/60 px-4 py-3 text-xs text-text-secondary">
          <AlertTriangle className="h-4 w-4 text-stock-pre flex-shrink-0 mt-0.5" />
          <div>
            O armazenamento de fotos está em{" "}
            <strong className="text-text-primary">
              {(bytes / 1024 / 1024).toFixed(1)} MB
            </strong>
            . Considere remover fotos antigas para evitar limite do navegador.
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-border">
        {(["colecao", "cor"] as const).map((t) => (
          <button
            key={t}
            onClick={() => navigate({ search: { tab: t, categoria: paramCat, colecao: paramCol } })}
            className={`px-4 py-2.5 text-xs uppercase tracking-wider transition border-b-2 -mb-px ${
              tab === t
                ? "border-gold text-gold"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "colecao" ? "Fotos de Coleção" : "Fotos por Cor"}
          </button>
        ))}
      </div>

      {tab === "colecao" ? (
        <ColecaoTab products={products} photos={photos} />
      ) : (
        <CorTab products={products} photos={photos} initialColecao={paramCol} initialCategoria={paramCat} />
      )}
    </main>
  );
}

function ColecaoTab({
  products,
  photos,
}: {
  products: ReturnType<typeof useCatalog.getState>["products"];
  photos: ReturnType<typeof usePhotos.getState>;
}) {
  // Uma entrada por par (coleção × categoria) para permitir fotos diferentes
  // quando a mesma coleção aparece em mais de uma categoria (ex.: Spirale).
  const colecoes = useMemo(() => {
    const map = new Map<string, { nome: string; categoria: string; grupos: Set<string> }>();
    for (const p of products) {
      const key = `${p.colecao}::${p.categoria}`;
      const cur = map.get(key);
      if (cur) {
        cur.grupos.add(p.grupo);
      } else {
        map.set(key, { nome: p.colecao, categoria: p.categoria, grupos: new Set([p.grupo]) });
      }
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v, grupo: Array.from(v.grupos).join(" · ") }))
      .sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR") || a.categoria.localeCompare(b.categoria, "pt-BR"),
      );
  }, [products]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const setColecaoPhoto = usePhotos((s) => s.setColecaoPhoto);
  const removeColecaoPhoto = usePhotos((s) => s.removeColecaoPhoto);

  const target = colecoes.find((c) => c.key === openKey) ?? null;
  const current = target ? getColecaoPhoto(photos, target.nome, target.categoria) : undefined;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {colecoes.map((c) => {
          const img = getColecaoPhoto(photos, c.nome, c.categoria);
          return (
            <button
              key={c.key}
              onClick={() => setOpenKey(c.key)}
              className="text-left rounded-lg overflow-hidden gold-border gold-border-hover bg-surface transition"
            >
              <div className="relative aspect-[4/3]">
                {img ? (
                  <img src={img} alt={`${c.nome} — ${c.categoria}`} className="h-full w-full object-cover" />
                ) : (
                  <PhotoPlaceholder colecao={c.nome} className="h-full w-full" />
                )}
              </div>
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  {c.categoria}
                </div>
                <div className="font-display text-lg leading-tight mt-0.5">{c.nome}</div>
                <div className="flex items-center gap-1 text-[10px] text-gold mt-1">
                  <Camera className="h-3 w-3" />
                  {img ? "Atualizar foto" : "Adicionar foto"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <PhotoUploadModal
        open={!!openKey}
        onOpenChange={(v) => !v && setOpenKey(null)}
        title={target ? `Foto da coleção ${target.nome}` : ""}
        subtitle={target ? `${target.categoria} · ${target.grupo}` : ""}
        current={current}
        onSave={async (data) => {
          if (target) await setColecaoPhoto(target.nome, target.categoria, data);
        }}
        onRemove={current ? async () => {
          if (target) await removeColecaoPhoto(target.nome, target.categoria);
        } : undefined}
      />
    </>
  );
}

function CorTab({
  products,
  photos,
  initialColecao,
  initialCategoria,
}: {
  products: ReturnType<typeof useCatalog.getState>["products"];
  photos: ReturnType<typeof usePhotos.getState>;
  initialColecao?: string;
  initialCategoria?: string;
}) {
  const categorias = useMemo(
    () => Array.from(new Set(products.map((p) => p.categoria))),
    [products],
  );
  const [categoria, setCategoria] = useState(initialCategoria || categorias[0] || "");
  const colecoes = useMemo(
    () =>
      Array.from(
        new Set(products.filter((p) => p.categoria === categoria).map((p) => p.colecao)),
      ).sort(),
    [products, categoria],
  );
  const [colecao, setColecao] = useState(initialColecao || colecoes[0] || "");

  useEffect(() => {
    if (!colecoes.includes(colecao)) setColecao(colecoes[0] ?? "");
  }, [colecoes, colecao]);

  // Coleções agrupadas por cor (1 foto por cor): talheres e velas numéricas
  const isCutlery = useMemo(
    () => {
      if (!colecao) return false;
      const list = products.filter((p) => p.colecao === colecao);
      if (!list.length) return false;
      const allTalheres = list.every((p) => p.grupo === "Talheres");
      const allNumerica = list.every((p) => p.numeroVela != null);
      return allTalheres || allNumerica;
    },
    [products, colecao],
  );

  const variantes = useMemo(() => {
    if (!colecao) return [];
    const list = products.filter((p) => p.colecao === colecao);
    if (isCutlery) {
      // Talheres: 1 entrada por cor (não por SKU)
      const seen = new Set<string>();
      return list.filter((p) => {
        if (seen.has(p.corNome)) return false;
        seen.add(p.corNome);
        return true;
      });
    }
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.sku)) return false;
      seen.add(p.sku);
      return true;
    });
  }, [products, colecao, isCutlery]);

  const [open, setOpen] = useState<string | null>(null);
  const setProdutoPhoto = usePhotos((s) => s.setProdutoPhoto);
  const removeProdutoPhoto = usePhotos((s) => s.removeProdutoPhoto);

  // Para talheres, "open" é o corNome; para o resto, é o sku.
  const openProduct = variantes.find((p) => (isCutlery ? p.corNome : p.sku) === open) ?? null;
  const photoKey = openProduct ? (isCutlery ? openProduct.corNome : openProduct.sku) : null;
  const current = openProduct && photoKey
    ? getProdutoPhoto(photos, colecao, photoKey) ??
      (isCutlery ? undefined : getProdutoPhoto(photos, colecao, openProduct.corNome))
    : undefined;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <Field label="Categoria">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Coleção">
          <select
            value={colecao}
            onChange={(e) => setColecao(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm min-w-48"
          >
            {colecoes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {variantes.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          Selecione uma coleção para ver os produtos.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {variantes.map((p) => {
            const key = isCutlery ? p.corNome : p.sku;
            const img =
              getProdutoPhoto(
                { colecoes: {}, produtos: photos.produtos },
                colecao,
                key,
              ) ??
              (isCutlery
                ? undefined
                : getProdutoPhoto(
                    { colecoes: {}, produtos: photos.produtos },
                    colecao,
                    p.corNome,
                  ));
            return (
              <button
                key={key}
                onClick={() => setOpen(key)}
                className="text-left rounded-lg overflow-hidden gold-border gold-border-hover bg-surface transition"
              >
                <div className="relative aspect-square">
                  {img ? (
                    <img src={img} alt={p.corNome} className="h-full w-full object-cover" />
                  ) : (
                    <PhotoPlaceholder
                      colecao={colecao}
                      label={isCutlery ? p.corNome : `${p.grupo} ${p.tamanhoNumero}`}
                      className="h-full w-full"
                    />
                  )}
                </div>
                <div className="p-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">
                    {isCutlery ? p.grupo : `${p.grupo} • ${p.tipo}`}
                  </div>
                  <div className="font-display text-base leading-tight mt-0.5">
                    {isCutlery ? p.corNome : p.nomeComercial}
                  </div>
                  {!isCutlery && (
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {p.corNome} · {p.tamanhoNumero}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-gold mt-1">
                    <Camera className="h-3 w-3" />
                    {img ? "Atualizar" : "Adicionar"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <PhotoUploadModal
        open={!!open}
        onOpenChange={(v) => !v && setOpen(null)}
        title={
          openProduct
            ? isCutlery
              ? `Foto da cor ${openProduct.corNome}`
              : `Foto de ${openProduct.nomeComercial}`
            : ""
        }
        subtitle={
          openProduct
            ? isCutlery
              ? `${colecao} · ${openProduct.corNome}`
              : `${colecao} · ${openProduct.corNome} · ${openProduct.tamanhoNumero}`
            : ""
        }
        current={current}
        onSave={async (data) => {
          if (open) await setProdutoPhoto(colecao, open, data);
        }}
        onRemove={
          current
            ? async () => {
                if (open) await removeProdutoPhoto(colecao, open);
              }
            : undefined
        }
      />
    </>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
