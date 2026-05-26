import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Check, FileJson, RotateCcw, Upload } from "lucide-react";
import { useState } from "react";
import { useCatalog } from "@/store/catalogStore";
import type { Product } from "@/types";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Importar catálogo — Fetély B2B" },
      { name: "description", content: "Suba o JSON do catálogo de produtos Fetély." },
    ],
  }),
  component: ImportPage,
});

const REQUIRED_FIELDS: (keyof Product)[] = [
  "sku",
  "marca",
  "categoria",
  "grupo",
  "colecao",
  "nomeComercial",
  "multiplos",
  "precoAtacado",
];

interface ValidationResult {
  ok: boolean;
  total: number;
  errors: string[];
  warnings: string[];
  preview: Product[];
}

function validate(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let array: unknown[];
  if (Array.isArray(raw)) array = raw;
  else if (raw && typeof raw === "object" && Array.isArray((raw as any).products))
    array = (raw as any).products;
  else {
    return {
      ok: false,
      total: 0,
      errors: ["O JSON precisa ser um array de produtos ou um objeto { products: [...] }."],
      warnings,
      preview: [],
    };
  }

  const cleaned: Product[] = [];
  array.forEach((row, i) => {
    if (!row || typeof row !== "object") {
      errors.push(`Item ${i}: não é um objeto.`);
      return;
    }
    const r = row as Record<string, any>;
    for (const f of REQUIRED_FIELDS) {
      if (r[f] === undefined || r[f] === null || r[f] === "") {
        errors.push(`Item ${i} (sku=${r.sku ?? "?"}): campo "${f}" faltando.`);
        return;
      }
    }
    const tipo = String(r.tipo ?? "");
    const isVN =
      r.isVelaNumerica !== undefined
        ? Boolean(r.isVelaNumerica)
        : tipo.toLowerCase().includes("numéric") || tipo.toLowerCase().includes("numeric");
    cleaned.push({
      sku: String(r.sku),
      codCadastro: String(r.codCadastro ?? r.sku),
      ean: String(r.ean ?? ""),
      marca: String(r.marca),
      linha: String(r.linha ?? ""),
      categoria: String(r.categoria),
      departamento: r.departamento ? String(r.departamento) : undefined,
      grupo: String(r.grupo),
      tipo,
      familia: String(r.familia ?? r.colecao),
      colecao: String(r.colecao),
      subColecao: r.subColecao ? String(r.subColecao) : undefined,
      subColecao2: r.subColecao2 ? String(r.subColecao2) : undefined,
      corNome: String(r.corNome ?? ""),
      cor: String(r.cor ?? ""),
      estampa: String(r.estampa ?? ""),
      tamanhoNumero: String(r.tamanhoNumero ?? ""),
      tamanhoRef: String(r.tamanhoRef ?? ""),
      nomeComercial: String(r.nomeComercial),
      nomeCompleto: r.nomeCompleto ? String(r.nomeCompleto) : undefined,
      metaDescricao: r.metaDescricao ? String(r.metaDescricao) : undefined,
      descricaoColecao: r.descricaoColecao ? String(r.descricaoColecao) : undefined,
      descricaoProduto: r.descricaoProduto ? String(r.descricaoProduto) : undefined,
      ncm: r.ncm ? String(r.ncm) : undefined,
      cest: r.cest ? String(r.cest) : undefined,
      origemFisc: r.origemFisc ? String(r.origemFisc) : undefined,
      origemProd: r.origemProd ? String(r.origemProd) : undefined,
      tipoEmbalagem: r.tipoEmbalagem ? String(r.tipoEmbalagem) : undefined,
      material: String(r.material ?? ""),
      materialDescritivo: r.materialDescritivo ? String(r.materialDescritivo) : undefined,
      pesoG: Number(r.pesoG) || 0,
      larguraCm: Number(r.larguraCm) || 0,
      alturaCm: Number(r.alturaCm) || 0,
      profundidadeCm: r.profundidadeCm !== undefined ? Number(r.profundidadeCm) || 0 : undefined,
      multiplos: Number(r.multiplos) || 1,
      qtdKit: Number(r.qtdKit) || 1,
      precoVarejo: Number(r.precoVarejo) || 0,
      precoAtacado: Number(r.precoAtacado) || 0,
      statusEstoque: String(r.statusEstoque ?? ""),
      isVelaNumerica: isVN,
      numeroVela:
        r.numeroVela === null || r.numeroVela === undefined ? null : Number(r.numeroVela),
    });

  });

  const skuSet = new Set<string>();
  cleaned.forEach((p) => {
    if (skuSet.has(p.sku)) warnings.push(`SKU duplicado: ${p.sku}`);
    skuSet.add(p.sku);
    if (p.isVelaNumerica && (p.numeroVela === undefined || p.numeroVela === null)) {
      warnings.push(`Vela numérica sem "numeroVela": ${p.sku}`);
    }
  });

  return {
    ok: errors.length === 0 && cleaned.length > 0,
    total: cleaned.length,
    errors: errors.slice(0, 20),
    warnings: warnings.slice(0, 10),
    preview: cleaned.slice(0, 5),
  };
}

function ImportPage() {
  const products = useCatalog((s) => s.products);
  const source = useCatalog((s) => s.source);
  const importedAt = useCatalog((s) => s.importedAt);
  const setProducts = useCatalog((s) => s.setProducts);
  const resetToDefault = useCatalog((s) => s.resetToDefault);

  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setRaw(text);
    runValidation(text);
  };

  const runValidation = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      setResult(validate(parsed));
    } catch (e) {
      setResult({
        ok: false,
        total: 0,
        errors: [`JSON inválido: ${(e as Error).message}`],
        warnings: [],
        preview: [],
      });
    }
  };

  const handleConfirm = () => {
    if (!result?.ok) return;
    const parsed = JSON.parse(raw);
    const array = Array.isArray(parsed) ? parsed : parsed.products;
    const validation = validate(array);
    if (validation.ok) {
      const allProducts: Product[] = [];
      array.forEach((r: any) => {
        if (r && typeof r === "object" && r.sku) {
          allProducts.push({
            ...r,
            multiplos: Number(r.multiplos) || 1,
            precoAtacado: Number(r.precoAtacado) || 0,
            precoVarejo: Number(r.precoVarejo) || 0,
            isVelaNumerica: Boolean(r.isVelaNumerica),
          } as Product);
        }
      });
      setProducts(allProducts);
      alert(`Catálogo atualizado com ${allProducts.length} produtos.`);
    }
  };

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-12">
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Administração</div>
        <h1 className="font-display text-5xl mt-2">Importar Catálogo</h1>
        <p className="text-text-secondary text-sm mt-3 max-w-2xl">
          Suba o arquivo JSON com a base completa de produtos Fetély. Os dados ficam
          salvos no navegador e substituem o catálogo padrão.
        </p>
      </div>

      {/* Status atual */}
      <div className="rounded-lg gold-border bg-surface p-5 mb-8 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            Catálogo ativo
          </div>
          <div className="font-display text-2xl mt-1">
            {products.length} produtos
            <span className="ml-3 text-xs text-gold uppercase tracking-wider">
              {source === "imported" ? "Importado" : "Padrão (seed)"}
            </span>
          </div>
          {importedAt && (
            <div className="text-xs text-text-secondary mt-1">
              Último import: {new Date(importedAt).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
        {source === "imported" && (
          <button
            onClick={() => {
              if (confirm("Voltar ao catálogo padrão (seed)? Os imports serão descartados."))
                resetToDefault();
            }}
            className="flex items-center gap-2 rounded-md gold-border px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <section className="rounded-lg gold-border bg-surface p-6 space-y-4">
          <h2 className="font-display text-2xl">1. Selecione o arquivo</h2>

          <label className="block rounded-lg border-2 border-dashed border-gold/40 hover:border-gold bg-surface-2/50 p-10 text-center cursor-pointer transition">
            <Upload className="h-8 w-8 text-gold mx-auto mb-3" />
            <div className="text-sm text-text-primary">
              Clique para escolher o arquivo <code>.json</code>
            </div>
            <div className="text-xs text-text-muted mt-1">
              ou arraste e solte aqui
            </div>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>

          {fileName && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <FileJson className="h-4 w-4 text-gold" /> {fileName}
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Ou cole o JSON manualmente
            </div>
            <textarea
              rows={8}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (e.target.value.trim()) runValidation(e.target.value);
                else setResult(null);
              }}
              placeholder='[{ "sku": "FTL-...", "marca": "Fetély", ... }]'
              className="w-full bg-surface-2 border border-border rounded-md p-3 text-xs font-mono text-text-primary focus:border-gold outline-none resize-none scrollbar-thin"
            />
          </div>
        </section>

        {/* Validação */}
        <section className="rounded-lg gold-border bg-surface p-6 space-y-4">
          <h2 className="font-display text-2xl">2. Validação</h2>

          {!result && (
            <div className="text-sm text-text-muted py-12 text-center">
              Aguardando arquivo...
            </div>
          )}

          {result && (
            <>
              <div
                className={`flex items-center gap-3 rounded-md p-4 ${
                  result.ok
                    ? "bg-stock-in/10 border border-stock-in/30"
                    : "bg-stock-out/10 border border-stock-out/30"
                }`}
              >
                {result.ok ? (
                  <Check className="h-5 w-5 text-stock-in" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-stock-out" />
                )}
                <div>
                  <div className="text-sm text-text-primary">
                    {result.ok
                      ? `${result.total} produtos válidos`
                      : `${result.errors.length} erro(s) encontrado(s)`}
                  </div>
                  {result.warnings.length > 0 && (
                    <div className="text-xs text-stock-pre">
                      {result.warnings.length} aviso(s)
                    </div>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-stock-out">
                    Erros
                  </div>
                  <ul className="text-xs text-text-secondary space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                    {result.errors.map((e, i) => (
                      <li key={i} className="font-mono">• {e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-stock-pre">
                    Avisos
                  </div>
                  <ul className="text-xs text-text-secondary space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="font-mono">• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.preview.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                    Preview dos primeiros 5
                  </div>
                  <div className="bg-surface-2 rounded-md p-3 max-h-48 overflow-y-auto scrollbar-thin">
                    {result.preview.map((p) => (
                      <div key={p.sku} className="text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="font-mono text-gold">{p.sku}</span>
                        <span className="text-text-secondary"> · {p.nomeComercial}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                disabled={!result.ok}
                onClick={handleConfirm}
                className="w-full rounded-md bg-gold py-3 text-xs font-semibold uppercase tracking-[0.18em] text-background hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Confirmar e substituir catálogo
              </button>
            </>
          )}
        </section>
      </div>

      {/* Schema esperado */}
      <details className="mt-8 rounded-lg gold-border bg-surface p-5">
        <summary className="cursor-pointer text-sm font-medium text-gold uppercase tracking-wider">
          Estrutura esperada do JSON
        </summary>
        <div className="mt-4 space-y-3 text-xs text-text-secondary">
          <p>Array de objetos. Campos obrigatórios: <code className="text-gold">{REQUIRED_FIELDS.join(", ")}</code></p>
          <pre className="bg-surface-2 rounded-md p-4 overflow-x-auto font-mono text-[11px] scrollbar-thin">
{`[
  {
    "sku": "FTL-VN-00001",
    "codCadastro": "VN-CLA-0-7cm-PRE",
    "marca": "Fetély",
    "linha": "Lumier",
    "categoria": "Luz e Momento",
    "grupo": "Vela",
    "tipo": "Numérica",
    "colecao": "Classique",
    "familia": "Número 0",
    "corNome": "Noir & Oro",
    "cor": "Preto/Dourado",
    "estampa": "Liso",
    "tamanhoNumero": "7 cm",
    "tamanhoRef": "Grande",
    "nomeComercial": "Vela Classique Nº 0 — Noir & Oro 7 cm",
    "multiplos": 6,
    "qtdKit": 1,
    "precoVarejo": 18.90,
    "precoAtacado": 9.94,
    "statusEstoque": "em estoque",
    "material": "Parafina premium",
    "pesoG": 35,
    "larguraCm": 4,
    "alturaCm": 7,
    "ean": "7890000000000",
    "isVelaNumerica": true,
    "numeroVela": 0
  }
]`}
          </pre>
        </div>
      </details>

      <div className="mt-8 text-center">
        <Link
          to="/"
          className="text-xs uppercase tracking-wider text-text-secondary hover:text-gold"
        >
          ← Voltar ao início
        </Link>
      </div>
    </main>
  );
}
