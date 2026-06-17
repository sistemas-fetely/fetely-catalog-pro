import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { ArrowLeft, ChevronRight, Package } from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import { useOrder } from "@/store/orderStore";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { formatBRL, isValidMultiple } from "@/lib/format";

const searchSchema = z.object({
  sku: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/produto")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [{ title: "Detalhes do produto — Fetély B2B" }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { sku } = Route.useSearch();
  const navigate = useNavigate();
  const products = useCatalog((s) => s.products);
  const addItem = useOrder((s) => s.addItem);
  const photos = usePhotos();
  const [qty, setQty] = useState(0);

  const product = useMemo(
    () => products.find((p) => p.sku === sku),
    [products, sku],
  );

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl text-text-primary">
          Produto não encontrado
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          O SKU informado não existe no catálogo.
        </p>
        <Link
          to="/catalog"
          className="mt-6 inline-flex items-center gap-2 text-sm text-gold hover:text-gold-light"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const photo =
    getProdutoPhoto(photos, product.colecao, product.sku) ??
    getProdutoPhoto(photos, product.colecao, product.corNome);
  const indisponivel = product.precoAtacado <= 0;
  const canAdd =
    qty > 0 && isValidMultiple(qty, product.multiplos) && !indisponivel;

  const specs: { label: string; value: string | number | undefined }[] = [
    { label: "SKU", value: product.sku },
    { label: "Cód. Cadastro", value: product.codCadastro },
    { label: "EAN", value: product.ean },
    { label: "Marca", value: product.marca },
    { label: "Linha", value: product.linha },
    { label: "Categoria", value: product.categoria },
    { label: "Departamento", value: product.departamento },
    { label: "Grupo", value: product.grupo },
    { label: "Tipo", value: product.tipo },
    { label: "Família", value: product.familia },
    { label: "Coleção", value: product.colecao },
    { label: "Sub-coleção", value: product.subColecao },
    { label: "Sub-coleção 2", value: product.subColecao2 },
    { label: "Cor (nome)", value: product.corNome },
    { label: "Cor", value: product.cor },
    { label: "Estampa", value: product.estampa },
    { label: "Tamanho", value: product.tamanhoNumero },
    { label: "Referência", value: product.tamanhoRef },
  ];

  const fiscal = [
    { label: "NCM", value: product.ncm },
    { label: "CEST", value: product.cest },
    { label: "Origem Fiscal", value: product.origemFisc },
    { label: "Origem Produto", value: product.origemProd },
  ];

  const embalagem = [
    { label: "Tipo de Embalagem", value: product.tipoEmbalagem },
    { label: "Material", value: product.material },
    { label: "Material Descritivo", value: product.materialDescritivo },
  ];

  const dim = [
    { label: "Peso (g)", value: product.pesoG },
    { label: "Largura (cm)", value: product.larguraCm },
    { label: "Altura (cm)", value: product.alturaCm },
    { label: "Profundidade (cm)", value: product.profundidadeCm },
    { label: "Múltiplos (caixa)", value: product.multiplos },
    { label: "Qtd por kit", value: product.qtdKit },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 sm:mb-6 flex items-center gap-2 text-[11px] sm:text-xs text-text-muted overflow-x-auto whitespace-nowrap scrollbar-thin pb-1">
        <Link to="/catalog" className="hover:text-gold shrink-0">
          Catálogo
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <Link
          to="/catalog"
          search={{ categoria: product.categoria }}
          className="hover:text-gold shrink-0"
        >
          {product.categoria}
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <Link
          to="/catalog"
          search={{ colecao: product.colecao }}
          className="hover:text-gold shrink-0"
        >
          {product.colecao}
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="text-text-secondary truncate">{product.nomeComercial}</span>
      </nav>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1.1fr,1fr]">
        {/* Imagem */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface gold-border">
            {photo ? (
              <img
                src={photo}
                alt={`${product.nomeComercial} — ${product.corNome}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <PhotoPlaceholder
                colecao={product.colecao}
                label={product.corNome}
                className="h-full w-full"
              />
            )}
            <div className="absolute top-3 right-3">
              <StockBadge status={product.statusEstoque} />
            </div>
          </div>
        </div>

        {/* Info comercial */}
        <div className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
              {product.grupo} • {product.tipo}
            </div>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl leading-tight text-text-primary">
              {product.nomeComercial}
            </h1>
            {product.nomeCompleto && product.nomeCompleto !== product.nomeComercial && (
              <p className="mt-2 text-sm text-text-secondary">{product.nomeCompleto}</p>
            )}
          </div>

          {product.metaDescricao && (
            <p className="text-sm leading-relaxed text-text-secondary">
              {product.metaDescricao}
            </p>
          )}

          <div className="flex items-end justify-between gap-4 rounded-lg bg-surface p-4 gold-border">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-gold-muted">
                Atacado
              </div>
              <span className="text-3xl font-semibold text-gold leading-none">
                {indisponivel ? "—" : formatBRL(product.precoAtacado)}
              </span>
            </div>
            {!indisponivel && product.precoVarejo > 0 && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Varejo sugerido
                </div>
                <span className="text-lg text-text-secondary leading-none">
                  {formatBRL(product.precoVarejo)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg bg-surface p-4 gold-border">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
              <Package className="h-3.5 w-3.5" />
              Caixa fechada: {product.multiplos} un. — mínimo
            </div>
            <QuantityInput
              value={qty}
              onChange={setQty}
              multiplos={product.multiplos}
              disabled={indisponivel}
            />
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                addItem(product, qty);
                setQty(0);
              }}
              className="w-full rounded-md bg-gold py-3 text-xs font-semibold uppercase tracking-[0.15em] text-background transition hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {indisponivel ? "Indisponível" : "Adicionar ao pedido"}
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/catalog", search: { colecao: product.colecao } })}
              className="w-full text-[10px] uppercase tracking-wider text-text-muted hover:text-gold"
            >
              ← Ver mais da coleção {product.colecao}
            </button>
          </div>
        </div>
      </div>

      {/* Especificações detalhadas */}
      <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 md:grid-cols-2">
        <SpecBlock title="Identificação & Hierarquia" items={specs} />
        <SpecBlock title="Dimensões & Embalagem" items={[...dim, ...embalagem]} />
        <SpecBlock title="Fiscal" items={fiscal} />
        {(product.descricaoColecao || product.descricaoProduto) && (
          <div className="rounded-lg bg-surface p-5 gold-border">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-gold mb-3">
              Descrição
            </h2>
            {product.descricaoColecao && (
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                <span className="text-text-muted uppercase tracking-wider">Coleção:</span>{" "}
                {product.descricaoColecao}
              </p>
            )}
            {product.descricaoProduto && (
              <p className="text-xs text-text-secondary leading-relaxed">
                {product.descricaoProduto}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SpecBlock({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string | number | undefined }[];
}) {
  const filled = items.filter(
    (i) => i.value !== undefined && i.value !== null && i.value !== "" && i.value !== 0,
  );
  if (filled.length === 0) return null;
  return (
    <div className="rounded-lg bg-surface p-5 gold-border">
      <h2 className="font-display text-sm uppercase tracking-[0.2em] text-gold mb-4">
        {title}
      </h2>
      <dl className="grid grid-cols-1 gap-y-2 text-xs sm:grid-cols-2 sm:gap-x-4">
        {filled.map((i) => (
          <div key={i.label} className="flex justify-between gap-3 border-b border-border/40 py-1.5">
            <dt className="text-text-muted">{i.label}</dt>
            <dd className="text-text-primary text-right font-medium">{String(i.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
