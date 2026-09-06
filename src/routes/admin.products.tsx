import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Copy as CopyIcon,
  Download,
  FileJson,
  History,
  Pencil,
  Plus,
  Power,
  Search,
  Table as TableIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { exportProductsCSV, exportProductsJSON } from "@/lib/productExporter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/store/authStore";
import { Can } from "@/components/security/Can";
import { useCatalog, nextSkuFor } from "@/store/catalogStore";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function emptyProduct(): Product {
  return {
    sku: "",
    codCadastro: "",
    ean: "",
    marca: "Fetély",
    linha: "",
    categoria: "",
    grupo: "",
    tipo: "",
    familia: "",
    colecao: "",
    corNome: "",
    cor: "",
    estampa: "",
    tamanhoNumero: "",
    tamanhoRef: "",
    nomeComercial: "",
    material: "",
    pesoG: 0,
    larguraCm: 0,
    alturaCm: 0,
    multiplos: 1,
    qtdKit: 1,
    precoVarejo: 0,
    precoAtacado: 0,
    statusEstoque: "em estoque",
    isVelaNumerica: false,
    // publicação só pelo botão Publicar, que valida a ficha no SNCF
    ativo: false,
  };
}

function statusBadge(p: Product) {
  if (p.ativo === false)
    return <Badge variant="outline" className="border-zinc-600 text-zinc-400">Inativo</Badge>;
  if (!p.precoAtacado || p.precoAtacado <= 0)
    return <Badge variant="outline" className="border-zinc-600 text-zinc-400">Sem preço</Badge>;
  const s = (p.statusEstoque || "").toLowerCase();
  if (s === "em estoque")
    return <Badge className="bg-emerald-600/20 text-emerald-300 border border-emerald-700">Em estoque</Badge>;
  if (s.startsWith("prev"))
    return <Badge className="bg-amber-600/20 text-amber-300 border border-amber-700">{p.statusEstoque}</Badge>;
  return <Badge variant="outline">{p.statusEstoque || "—"}</Badge>;
}

function AdminProductsPage() {
  const navigate = useNavigate();
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!isAdminOrMaster()) navigate({ to: "/" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const products = useCatalog((s) => s.products);
  const audit = useCatalog((s) => s.audit);
  const upsertProduct = useCatalog((s) => s.upsertProduct);
  const toggleAtivo = useCatalog((s) => s.toggleAtivo);
  const duplicateProduct = useCatalog((s) => s.duplicateProduct);

  const auditMeta = useMemo(
    () => ({
      usuarioId: session?.user?.id ?? "anon",
      usuarioNome: profile?.nome_completo ?? profile?.login_amigavel ?? session?.user?.email ?? "—",
    }),
    [session, profile],
  );

  // Filters
  const [search, setSearch] = useState("");
  const [fMarca, setFMarca] = useState("");
  const [fLinha, setFLinha] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fColecao, setFColecao] = useState("");
  const [fGrupo, setFGrupo] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fAtivo, setFAtivo] = useState<"" | "sim" | "nao">("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const opts = useMemo(() => {
    const uniq = (k: keyof Product) =>
      Array.from(new Set(products.map((p) => String(p[k] ?? "")).filter(Boolean))).sort();
    return {
      marca: uniq("marca"),
      linha: uniq("linha"),
      categoria: uniq("categoria"),
      colecao: uniq("colecao"),
      grupo: uniq("grupo"),
      status: uniq("statusEstoque"),
    };
  }, [products]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (fMarca && p.marca !== fMarca) return false;
      if (fLinha && p.linha !== fLinha) return false;
      if (fCategoria && p.categoria !== fCategoria) return false;
      if (fColecao && p.colecao !== fColecao) return false;
      if (fGrupo && p.grupo !== fGrupo) return false;
      if (fStatus && p.statusEstoque !== fStatus) return false;
      if (fAtivo === "sim" && p.ativo === false) return false;
      if (fAtivo === "nao" && p.ativo !== false) return false;
      if (s) {
        const hay = `${p.sku} ${p.nomeComercial} ${p.colecao} ${p.ean ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [products, search, fMarca, fLinha, fCategoria, fColecao, fGrupo, fStatus, fAtivo]);

  useEffect(() => { setPage(1); }, [search, fMarca, fLinha, fCategoria, fColecao, fGrupo, fStatus, fAtivo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Editor state
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingOriginalSku, setEditingOriginalSku] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function openEdit(p: Product) {
    setEditing({ ...p });
    setEditingOriginalSku(p.sku);
    setCreating(false);
  }
  function openNew() {
    const np = emptyProduct();
    setEditing(np);
    setEditingOriginalSku(null);
    setCreating(true);
  }
  function close() {
    setEditing(null);
    setEditingOriginalSku(null);
    setCreating(false);
  }

  function save() {
    if (!editing) return;
    // Validations
    const errs: string[] = [];
    if (!editing.sku.trim()) errs.push("SKU é obrigatório");
    if (/\s/.test(editing.sku)) errs.push("SKU não pode conter espaços");
    if (!editing.marca) errs.push("Marca");
    if (!editing.categoria) errs.push("Categoria");
    if (!editing.grupo) errs.push("Grupo");
    if (!editing.colecao) errs.push("Coleção");
    if (!editing.nomeComercial.trim()) errs.push("Nome Comercial");
    if (editing.nomeComercial.length > 120) errs.push("Nome Comercial > 120 chars");
    if (!(editing.precoAtacado > 0)) errs.push("Preço Atacado deve ser > 0");
    if (!(editing.precoVarejo > editing.precoAtacado)) errs.push("Preço Varejo deve ser > Atacado");
    if (!(editing.multiplos >= 1)) errs.push("Múltiplos deve ser ≥ 1");
    if (!editing.statusEstoque) errs.push("Status Estoque");

    // Duplicate check on create or SKU change
    if (creating || editingOriginalSku !== editing.sku) {
      if (products.some((x) => x.sku === editing.sku))
        errs.push("SKU já cadastrado");
    }

    if (errs.length) {
      toast.error("Corrija os campos: " + errs.join(", "));
      return;
    }
    const res = upsertProduct(editing, auditMeta);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(creating ? "Produto criado" : "Produto salvo");
    close();
  }

  function handleDuplicate(p: Product) {
    const copy = duplicateProduct(p.sku, auditMeta);
    if (copy) {
      toast.success(`Duplicado como ${copy.sku}`);
      openEdit(copy);
    }
  }

  function handleToggle(p: Product) {
    const ativo = p.ativo !== false;
    if (!confirm(ativo ? `Desativar ${p.sku}?` : `Reativar ${p.sku}?`)) return;
    toggleAtivo(p.sku, auditMeta);
    toast.success(ativo ? "Produto desativado" : "Produto reativado");
  }

  if (loading || !session || !isAdminOrMaster()) {
    return <div className="p-8 text-text-secondary">Carregando…</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-text-primary">Gestão de Produtos</h1>
            <p className="text-sm text-text-secondary">
              {filtered.length} de {products.length} produtos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Can tela="cfg_produtos" acao="exportar">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-border">
                    <Download className="mr-2 h-4 w-4" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Cadastro de produtos</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      exportProductsCSV(filtered, ";");
                      toast.success(`CSV exportado (${filtered.length} produtos)`);
                    }}
                  >
                    <TableIcon className="mr-2 h-4 w-4" />
                    CSV filtrado ({filtered.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      exportProductsCSV(products, ";");
                      toast.success(`CSV exportado (${products.length} produtos)`);
                    }}
                  >
                    <TableIcon className="mr-2 h-4 w-4" />
                    CSV completo ({products.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      exportProductsJSON(filtered);
                      toast.success(`JSON exportado (${filtered.length} produtos)`);
                    }}
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    JSON filtrado ({filtered.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      exportProductsJSON(products);
                      toast.success(`JSON exportado (${products.length} produtos)`);
                    }}
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    JSON completo ({products.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Can>
            <Button asChild variant="outline" className="border-border">
              <Link to="/admin/precos">
                <History className="mr-2 h-4 w-4" /> Tabela de Preço
              </Link>
            </Button>
            <Can tela="cfg_produtos" acao="criar">
              <Button onClick={openNew} className="bg-gold text-black hover:bg-gold/90">
                <Plus className="mr-2 h-4 w-4" /> Novo Produto
              </Button>
            </Can>
          </div>
        </div>

        {/* Search + filters */}
        <div className="mb-4 space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU, nome, coleção, EAN..."
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
            <FilterSelect label="Marca" value={fMarca} onChange={setFMarca} options={opts.marca} />
            <FilterSelect label="Linha" value={fLinha} onChange={setFLinha} options={opts.linha} />
            <FilterSelect label="Categoria" value={fCategoria} onChange={setFCategoria} options={opts.categoria} />
            <FilterSelect label="Coleção" value={fColecao} onChange={setFColecao} options={opts.colecao} />
            <FilterSelect label="Grupo" value={fGrupo} onChange={setFGrupo} options={opts.grupo} />
            <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={opts.status} />
            <FilterSelect
              label="Publicação"
              value={fAtivo}
              onChange={(v) => setFAtivo(v as "" | "sim" | "nao")}
              options={["sim", "nao"]}
              labels={{ sim: "Publicado", nao: "Não publicado" }}
            />
          </div>
          {(search || fMarca || fLinha || fCategoria || fColecao || fGrupo || fStatus || fAtivo) && (
            <button
              onClick={() => {
                setSearch(""); setFMarca(""); setFLinha(""); setFCategoria("");
                setFColecao(""); setFGrupo(""); setFStatus(""); setFAtivo("");
              }}
              className="text-xs text-gold underline-offset-4 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-100">
              <tr>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Nome Comercial</th>
                <th className="px-3 py-2 text-left">Coleção</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-right">Atacado</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr
                  key={p.sku}
                  onClick={() => openEdit(p)}
                  className={`cursor-pointer border-t border-border hover:bg-surface-hover ${p.ativo === false ? "opacity-50" : ""}`}
                  title="Clique para visualizar / editar"
                >
                  <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2">{p.nomeComercial}</td>
                  <td className="px-3 py-2 text-text-secondary">{p.colecao}</td>
                  <td className="px-3 py-2 text-text-secondary">{p.grupo}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(p.precoAtacado || 0)}</td>
                  <td className="px-3 py-2">{statusBadge(p)}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded p-1.5 hover:bg-zinc-800"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(p)}
                        className="rounded p-1.5 hover:bg-zinc-800"
                        title="Duplicar"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(p)}
                        className="rounded p-1.5 hover:bg-zinc-800"
                        title={p.ativo === false ? "Reativar" : "Desativar"}
                      >
                        <Power className={`h-4 w-4 ${p.ativo === false ? "text-emerald-400" : "text-red-400"}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-text-secondary">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-text-secondary">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>

        {/* Recent audit */}
        {audit.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Histórico recente
            </h2>
            <div className="rounded-lg border border-border bg-surface">
              <ul className="divide-y divide-border text-xs">
                {audit.slice(0, 10).map((e) => (
                  <li key={e.id} className="px-3 py-2">
                    <span className="text-text-secondary">
                      {new Date(e.timestamp).toLocaleString("pt-BR")}
                    </span>{" "}
                    · <span className="text-gold">{e.usuarioNome}</span> ·{" "}
                    <span className="font-mono">{e.produtoSku}</span>{" "}
                    <span className="text-text-secondary">({e.produtoNome})</span> ·{" "}
                    <span className="uppercase">{e.acao}</span>
                    {e.camposAlterados && e.camposAlterados.length > 0 && (
                      <div className="mt-1 text-text-secondary">
                        {e.camposAlterados.slice(0, 4).map((c) => (
                          <span key={c.campo} className="mr-3">
                            {c.campo}: {c.valorAnterior || "—"} → {c.valorNovo || "—"}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <ProductEditor
          product={editing}
          setProduct={setEditing}
          creating={creating}
          allProducts={products}
          onClose={close}
          onSave={save}
          onToggleAtivo={() => {
            handleToggle(editing);
            close();
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProductEditor({
  product,
  setProduct,
  creating,
  allProducts,
  onClose,
  onSave,
  onToggleAtivo,
}: {
  product: Product;
  setProduct: (p: Product) => void;
  creating: boolean;
  allProducts: Product[];
  onClose: () => void;
  onSave: () => void;
  onToggleAtivo: () => void;
}) {
  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setProduct({ ...product, [k]: v });

  const margem = product.precoVarejo > 0
    ? ((product.precoVarejo - product.precoAtacado) / product.precoVarejo) * 100
    : 0;
  const margemColor = margem > 40 ? "text-emerald-400" : margem >= 20 ? "text-amber-400" : "text-red-400";

  const colecoes = useMemo(
    () => Array.from(new Set(allProducts.map((p) => p.colecao).filter(Boolean))).sort(),
    [allProducts],
  );

  const skuDup = !creating
    ? false
    : allProducts.some((x) => x.sku === product.sku);

  // Status estoque smart selector
  const isPrev = (product.statusEstoque || "").toLowerCase().startsWith("prev");
  const prevParts = isPrev ? product.statusEstoque.match(/Prev\.\s*(\w+)\s*(\d{4})/) : null;
  const [prevMes, setPrevMes] = useState(prevParts?.[1] ?? "Jun");
  const [prevAno, setPrevAno] = useState(prevParts?.[2] ?? "2026");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {creating ? "Novo Produto" : `Editar: ${product.sku}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ident" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ident">Hierarquia</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="preco">Preços</TabsTrigger>
            <TabsTrigger value="tec">Técnico</TabsTrigger>
          </TabsList>

          <TabsContent value="ident" className="space-y-3 pt-4">
            <Field label="SKU *">
              <Input value={product.sku} onChange={(e) => set("sku", e.target.value.trim())} />
              {skuDup && <p className="mt-1 text-xs text-red-400">SKU já cadastrado</p>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cód. Cadastro"><Input value={product.codCadastro} onChange={(e) => set("codCadastro", e.target.value)} /></Field>
              <Field label="EAN"><Input value={product.ean} onChange={(e) => set("ean", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca *"><Input value={product.marca} onChange={(e) => set("marca", e.target.value)} /></Field>
              <Field label="Linha *"><Input value={product.linha} onChange={(e) => set("linha", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria *"><Input value={product.categoria} onChange={(e) => set("categoria", e.target.value)} /></Field>
              <Field label="Departamento"><Input value={product.departamento ?? ""} onChange={(e) => set("departamento", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grupo *">
                <Input
                  list="grupos-list"
                  value={product.grupo}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("grupo", v);
                    if (creating && !product.sku) set("sku", nextSkuFor(v, allProducts));
                  }}
                />
                <datalist id="grupos-list">
                  {["Vela", "Prato", "Guardanapo", "Jogo Americano", "Travessa", "Copos e Taças", "Talheres"].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Field>
              <Field label="Tipo *"><Input value={product.tipo} onChange={(e) => set("tipo", e.target.value)} /></Field>
            </div>
            <Field label="Coleção *">
              <Input
                list="colecoes-list"
                value={product.colecao}
                onChange={(e) => set("colecao", e.target.value)}
              />
              <datalist id="colecoes-list">
                {colecoes.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sub-coleção"><Input value={product.subColecao ?? ""} onChange={(e) => set("subColecao", e.target.value)} /></Field>
              <Field label="Família"><Input value={product.familia} onChange={(e) => set("familia", e.target.value)} /></Field>
            </div>
            <div className="rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={product.isVelaNumerica}
                  onChange={(e) => set("isVelaNumerica", e.target.checked)}
                />
                Vela Numérica
              </label>
              {product.isVelaNumerica && (
                <Field label="Número" className="mt-2">
                  <select
                    value={product.numeroVela ?? 0}
                    onChange={(e) => set("numeroVela", parseInt(e.target.value, 10))}
                    className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  >
                    {Array.from({ length: 10 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </TabsContent>

          <TabsContent value="visual" className="space-y-3 pt-4">
            <Field label="Nome Comercial *">
              <Input
                value={product.nomeComercial}
                maxLength={120}
                onChange={(e) => set("nomeComercial", e.target.value)}
              />
            </Field>
            <Field label="Nome Completo">
              <Input value={product.nomeCompleto ?? ""} onChange={(e) => set("nomeCompleto", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor (nome)"><Input value={product.corNome} onChange={(e) => set("corNome", e.target.value)} /></Field>
              <Field label="Cor (base)"><Input value={product.cor} onChange={(e) => set("cor", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Estampa"><Input value={product.estampa} onChange={(e) => set("estampa", e.target.value)} /></Field>
              <Field label="Tamanho (nº)"><Input value={product.tamanhoNumero} onChange={(e) => set("tamanhoNumero", e.target.value)} /></Field>
              <Field label="Tamanho (ref)"><Input value={product.tamanhoRef} onChange={(e) => set("tamanhoRef", e.target.value)} /></Field>
            </div>
            <Field label="Descrição do Produto">
              <Textarea
                rows={3}
                value={product.descricaoProduto ?? ""}
                onChange={(e) => set("descricaoProduto", e.target.value)}
              />
            </Field>
            <Field label="Descrição da Coleção">
              <Textarea
                rows={2}
                value={product.descricaoColecao ?? ""}
                onChange={(e) => set("descricaoColecao", e.target.value)}
              />
            </Field>
          </TabsContent>

          <TabsContent value="preco" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço Varejo (R$) *">
                <Input
                  type="number" step="0.01"
                  value={product.precoVarejo}
                  onChange={(e) => set("precoVarejo", parseFloat(e.target.value) || 0)}
                  readOnly={!creating}
                  disabled={!creating}
                />
              </Field>
              <Field label="Preço Atacado (R$) *">
                <Input
                  type="number" step="0.01"
                  value={product.precoAtacado}
                  onChange={(e) => set("precoAtacado", parseFloat(e.target.value) || 0)}
                  readOnly={!creating}
                  disabled={!creating}
                />
              </Field>
            </div>
            <p className="text-xs">
              Margem implícita: <span className={`font-semibold ${margemColor}`}>{margem.toFixed(1)}%</span>
            </p>
            {!creating && (
              <div className="rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-text-secondary">
                Os preços deste produto são gerenciados na{" "}
                <Link to="/admin/precos" className="font-semibold text-gold hover:underline">
                  Tabela de Preço
                </Link>
                . Toda alteração lá gera histórico automático.
              </div>
            )}
            {creating && (
              <p className="text-xs text-text-secondary">
                Defina os preços iniciais. Após criar o produto, as alterações devem ser feitas na Tabela de Preço.
              </p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Múltiplos *">
                <Input
                  type="number" min={1}
                  value={product.multiplos}
                  onChange={(e) => set("multiplos", parseInt(e.target.value) || 1)}
                />
              </Field>
              <Field label="Qtd x Kit">
                <Input
                  type="number" min={1}
                  value={product.qtdKit}
                  onChange={(e) => set("qtdKit", parseInt(e.target.value) || 1)}
                />
              </Field>
              <Field label="Tipo de Embalagem">
                <Input value={product.tipoEmbalagem ?? ""} onChange={(e) => set("tipoEmbalagem", e.target.value)} />
              </Field>
            </div>
            <Field label="Status de Estoque *">
              <select
                value={isPrev ? "prev" : product.statusEstoque}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "prev") set("statusEstoque", `Prev. ${prevMes} ${prevAno}`);
                  else set("statusEstoque", v);
                }}
                className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              >
                <option value="em estoque">em estoque</option>
                <option value="prev">Prev. (mês/ano)</option>
                <option value="sob consulta">sob consulta</option>
              </select>
            </Field>
            {isPrev && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mês">
                  <select
                    value={prevMes}
                    onChange={(e) => { setPrevMes(e.target.value); set("statusEstoque", `Prev. ${e.target.value} ${prevAno}`); }}
                    className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  >
                    {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Ano">
                  <select
                    value={prevAno}
                    onChange={(e) => { setPrevAno(e.target.value); set("statusEstoque", `Prev. ${prevMes} ${e.target.value}`); }}
                    className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  >
                    {["2026", "2027", "2028"].map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
              </div>
            )}
            {/* publicação só pelo botão Publicar, que valida a ficha no SNCF */}
          </TabsContent>

          <TabsContent value="tec" className="space-y-3 pt-4">
            <Field label="Material"><Input value={product.material} onChange={(e) => set("material", e.target.value)} /></Field>
            <Field label="Material (descritivo)">
              <Input value={product.materialDescritivo ?? ""} onChange={(e) => set("materialDescritivo", e.target.value)} />
            </Field>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Peso (g)">
                <Input type="number" step="0.1" value={product.pesoG} onChange={(e) => set("pesoG", parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label="Largura (cm)">
                <Input type="number" step="0.1" value={product.larguraCm} onChange={(e) => set("larguraCm", parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label="Altura (cm)">
                <Input type="number" step="0.1" value={product.alturaCm} onChange={(e) => set("alturaCm", parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label="Prof. (cm)">
                <Input type="number" step="0.1" value={product.profundidadeCm ?? 0} onChange={(e) => set("profundidadeCm", parseFloat(e.target.value) || 0)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NCM"><Input value={product.ncm ?? ""} onChange={(e) => set("ncm", e.target.value)} /></Field>
              <Field label="CEST"><Input value={product.cest ?? ""} onChange={(e) => set("cest", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origem Fiscal"><Input value={product.origemFisc ?? ""} onChange={(e) => set("origemFisc", e.target.value)} /></Field>
              <Field label="Origem Produção"><Input value={product.origemProd ?? ""} onChange={(e) => set("origemProd", e.target.value)} /></Field>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="!justify-between gap-2 sm:!justify-between">
          {!creating ? (
            <Button variant="outline" onClick={onToggleAtivo} className="border-red-700 text-red-400 hover:bg-red-950">
              <Power className="mr-2 h-4 w-4" />
              {product.ativo === false ? "Reativar" : "Desativar"}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={onSave} className="bg-gold text-black hover:bg-gold/90">
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
