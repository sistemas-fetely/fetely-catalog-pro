// Nascimento do Produto — administração do cadastro de produtos.
// Produto novo nasce aqui como RASCUNHO (ativo = false) e só aparece para o
// representante depois de passar no portão de publicação validado pelo SNCF.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Search, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { fichaPendencias } from "@/lib/fichaPendencias.functions";
import { useAuth } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin/nascimento-produto")({
  component: NascimentoProdutoPage,
  head: () => ({
    meta: [
      { title: "Cadastro de Produtos — Nascimento do Produto | Fetély" },
      {
        name: "description",
        content:
          "Administração do cadastro de produtos Fetély: rascunho com ficha técnica completa e publicação validada pelo SNCF.",
      },
      { property: "og:title", content: "Cadastro de Produtos — Nascimento do Produto" },
      {
        property: "og:description",
        content:
          "Cadastre o produto com a ficha técnica completa e publique somente após a validação do SNCF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

// ---------------------------------------------------------------- EAN-13
const PREFIXOS_EAN = ["0631911", "0087946"];

function ean13ValidoDigito(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) return false;
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += Number(ean[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const dv = (10 - (soma % 10)) % 10;
  return dv === Number(ean[12]);
}

function validarEan(ean: string): string | null {
  const v = ean.trim();
  if (!v) return "EAN é obrigatório";
  if (!/^\d{13}$/.test(v)) return "EAN deve ter 13 dígitos numéricos";
  if (!PREFIXOS_EAN.some((p) => v.startsWith(p)))
    return `EAN deve começar com ${PREFIXOS_EAN.join(" ou ")}`;
  if (!ean13ValidoDigito(v)) return "Dígito verificador do EAN-13 inválido";
  return null;
}

// Convenção do corte 02160: a partir dele o sku é igual ao cod_cadastro.
const CORTE_SKU_IGUAL_COD = 2160;

function codNumerico(cod: string): number | null {
  const v = cod.trim();
  if (!/^\d+$/.test(v)) return null;
  return parseInt(v, 10);
}

function skuTravado(cod: string): boolean {
  const n = codNumerico(cod);
  return n !== null && n >= CORTE_SKU_IGUAL_COD;
}

// ---------------------------------------------------------------- tipos
interface ProdutoRow {
  id: string;
  sku: string;
  cod_cadastro: string | null;
  ean: string | null;
  marca: string | null;
  nome_comercial: string;
  categoria: string;
  grupo: string;
  colecao: string;
  cor_nome: string | null;
  tipo: string | null;
  familia: string | null;
  tamanho_numero: string | null;
  estampa: string | null;
  departamento: string | null;
  ncm: string | null;
  cest: string | null;
  origem_fisc: string | null;
  origem_prod: string | null;
  peso_g: number;
  altura_cm: number;
  largura_cm: number;
  profundidade_cm: number | null;
  material: string | null;
  tipo_embalagem: string | null;
  multiplos: number;
  qtd_kit: number;
  preco_atacado: number;
  preco_varejo: number;
  ativo: boolean;
}

interface Pendencia {
  campo: string;
  bloco: string;
  dono: string;
}

function normalizarPendencias(resp: unknown): Pendencia[] {
  const raiz = resp as Record<string, unknown> | null;
  const bruto =
    (Array.isArray(raiz?.["pendencias"]) && raiz?.["pendencias"]) ||
    (Array.isArray(raiz?.["itens"]) && raiz?.["itens"]) ||
    (Array.isArray(raiz?.["data"]) && raiz?.["data"]) ||
    (Array.isArray(resp) ? resp : []);
  return (bruto as Record<string, unknown>[]).map((p) => ({
    campo: String(p["campo"] ?? p["field"] ?? "—"),
    bloco: String(p["bloco"] ?? p["block"] ?? "—"),
    dono: String(p["dono"] ?? p["owner"] ?? "—"),
  }));
}

// ---------------------------------------------------------------- form
interface FormState {
  cod_cadastro: string;
  sku: string;
  ean: string;
  marca: string;
  ncm: string;
  cest: string;
  origem_fisc: string;
  origem_prod: string;
  peso_g: string;
  altura_cm: string;
  largura_cm: string;
  profundidade_cm: string;
  material: string;
  tipo_embalagem: string;
  multiplos: string;
  qtd_kit: string;
  departamento: string;
  categoria: string;
  grupo: string;
  colecao: string;
  cor_nome: string;
  tipo: string;
  familia: string;
  tamanho_numero: string;
  estampa: string;
  nome_comercial: string;
  preco_atacado: string;
  preco_varejo: string;
}

function formVazio(): FormState {
  return {
    cod_cadastro: "",
    sku: "",
    ean: "",
    marca: "Fetély",
    ncm: "",
    cest: "",
    origem_fisc: "",
    origem_prod: "",
    peso_g: "0",
    altura_cm: "0",
    largura_cm: "0",
    profundidade_cm: "",
    material: "",
    tipo_embalagem: "",
    multiplos: "1",
    qtd_kit: "1",
    departamento: "",
    categoria: "",
    grupo: "",
    colecao: "",
    cor_nome: "",
    tipo: "",
    familia: "",
    tamanho_numero: "",
    estampa: "",
    nome_comercial: "",
    preco_atacado: "0",
    preco_varejo: "0",
  };
}

function formDoProduto(p: ProdutoRow): FormState {
  return {
    cod_cadastro: p.cod_cadastro ?? "",
    sku: p.sku,
    ean: p.ean ?? "",
    marca: p.marca ?? "Fetély",
    ncm: p.ncm ?? "",
    cest: p.cest ?? "",
    origem_fisc: p.origem_fisc ?? "",
    origem_prod: p.origem_prod ?? "",
    peso_g: String(p.peso_g ?? 0),
    altura_cm: String(p.altura_cm ?? 0),
    largura_cm: String(p.largura_cm ?? 0),
    profundidade_cm: p.profundidade_cm == null ? "" : String(p.profundidade_cm),
    material: p.material ?? "",
    tipo_embalagem: p.tipo_embalagem ?? "",
    multiplos: String(p.multiplos ?? 1),
    qtd_kit: String(p.qtd_kit ?? 1),
    departamento: p.departamento ?? "",
    categoria: p.categoria,
    grupo: p.grupo,
    colecao: p.colecao,
    cor_nome: p.cor_nome ?? "",
    tipo: p.tipo ?? "",
    familia: p.familia ?? "",
    tamanho_numero: p.tamanho_numero ?? "",
    estampa: p.estampa ?? "",
    nome_comercial: p.nome_comercial,
    preco_atacado: String(p.preco_atacado ?? 0),
    preco_varejo: String(p.preco_varejo ?? 0),
  };
}

const inputCls = "bg-surface border-border";

function Campo({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-text-secondary">{hint}</p>}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface/60 p-4">
      <h3 className="mb-3 text-xs uppercase tracking-[0.18em] text-gold">{titulo}</h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- página
function NascimentoProdutoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!isAdminOrMaster()) navigate({ to: "/catalog" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const usuarioNome =
    profile?.nome_completo ?? profile?.login_amigavel ?? session?.user?.email ?? "—";
  const usuarioId = session?.user?.id ?? null;

  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "rascunho" | "publicado">("rascunho");

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["nascimento-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, sku, cod_cadastro, ean, marca, nome_comercial, categoria, grupo, colecao, cor_nome, tipo, familia, tamanho_numero, estampa, departamento, ncm, cest, origem_fisc, origem_prod, peso_g, altura_cm, largura_cm, profundidade_cm, material, tipo_embalagem, multiplos, qtd_kit, preco_atacado, preco_varejo, ativo",
        )
        .order("cod_cadastro", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as unknown as ProdutoRow[];
    },
  });

  // Dimensões oficiais (gate DEFAULT-DENY do banco resolve os ids por nome)
  const { data: dims } = useQuery({
    queryKey: ["produto-dimensoes"],
    queryFn: async () => {
      const [dep, cat, gru, col, cor] = await Promise.all([
        supabase.from("produto_departamentos").select("id, nome, ativo").order("nome"),
        supabase.from("produto_categorias").select("id, nome, departamento_id, ativo").order("nome"),
        supabase.from("produto_grupos").select("id, nome, categoria_id, ativo").order("nome"),
        supabase.from("produto_colecoes").select("id, nome, ativo").order("nome"),
        supabase.from("produto_cores").select("id, nome, ativo").order("nome"),
      ]);
      return {
        departamentos: dep.data ?? [],
        categorias: cat.data ?? [],
        grupos: gru.data ?? [],
        colecoes: col.data ?? [],
        cores: cor.data ?? [],
      };
    },
  });

  const lista = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return produtos.filter((p) => {
      if (filtro === "rascunho" && p.ativo) return false;
      if (filtro === "publicado" && !p.ativo) return false;
      if (!termo) return true;
      return (
        p.sku.toLowerCase().includes(termo) ||
        (p.cod_cadastro ?? "").toLowerCase().includes(termo) ||
        p.nome_comercial.toLowerCase().includes(termo)
      );
    });
  }, [produtos, q, filtro]);

  const totalRascunhos = produtos.filter((p) => !p.ativo).length;

  // ------------------------------------------------------------ formulário
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<ProdutoRow | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio());
    setFormOpen(true);
  }
  function abrirEdicao(p: ProdutoRow) {
    setEditando(p);
    setForm(formDoProduto(p));
    setFormOpen(true);
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // REGRA DO CÓDIGO: cod_cadastro >= 02160 → sku = cod_cadastro (somente leitura)
      if (k === "cod_cadastro" && skuTravado(String(v))) {
        next.sku = String(v).trim();
      }
      return next;
    });
  }

  const categoriasDoDep = useMemo(() => {
    if (!dims) return [];
    const dep = dims.departamentos.find((d) => d.nome === form.departamento);
    return dep
      ? dims.categorias.filter((c) => c.departamento_id === dep.id)
      : dims.categorias;
  }, [dims, form.departamento]);

  const gruposDaCategoria = useMemo(() => {
    if (!dims) return [];
    const cat = dims.categorias.find((c) => c.nome === form.categoria);
    return cat ? dims.grupos.filter((g) => g.categoria_id === cat.id) : dims.grupos;
  }, [dims, form.categoria]);

  function validarForm(): string | null {
    if (!form.cod_cadastro.trim()) return "cod_cadastro é obrigatório";
    const dup = produtos.find(
      (p) =>
        (p.cod_cadastro ?? "").trim() === form.cod_cadastro.trim() &&
        p.id !== (editando?.id ?? ""),
    );
    if (dup) return `cod_cadastro já usado pelo SKU ${dup.sku}`;
    const eanErr = validarEan(form.ean);
    if (eanErr) return eanErr;
    if (!form.sku.trim()) return "SKU é obrigatório";
    const dupSku = produtos.find(
      (p) => p.sku === form.sku.trim() && p.id !== (editando?.id ?? ""),
    );
    if (dupSku) return "SKU já cadastrado";
    if (!form.categoria) return "Categoria é obrigatória";
    if (!form.grupo) return "Grupo é obrigatório";
    if (!form.colecao) return "Coleção é obrigatória";
    if (!form.cor_nome) return "Cor é obrigatória";
    if (!form.nome_comercial.trim()) return "Nome comercial é obrigatório";
    return null;
  }

  function num(v: string): number {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  async function registrarAudit(
    sku: string,
    nome: string,
    acao: "criado" | "editado" | "reativado" | "desativado",
  ) {
    // Mesmo padrão de auditoria do catálogo (tabela catalog_audit).
    const { error } = await supabase.from("catalog_audit").insert({
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      produto_sku: sku,
      produto_nome: nome,
      acao,
    } as never);
    if (error) console.error("[nascimento-produto] audit falhou:", error);
  }

  async function salvar() {
    const erro = validarForm();
    if (erro) {
      toast.error(erro);
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        cod_cadastro: form.cod_cadastro.trim(),
        ean: form.ean.trim(),
        marca: form.marca.trim() || "Fetély",
        ncm: form.ncm.trim() || null,
        cest: form.cest.trim() || null,
        origem_fisc: form.origem_fisc.trim() || null,
        origem_prod: form.origem_prod.trim() || null,
        peso_g: num(form.peso_g),
        altura_cm: num(form.altura_cm),
        largura_cm: num(form.largura_cm),
        profundidade_cm: form.profundidade_cm.trim() ? num(form.profundidade_cm) : null,
        material: form.material.trim() || null,
        tipo_embalagem: form.tipo_embalagem.trim() || null,
        multiplos: Math.max(1, Math.round(num(form.multiplos))),
        qtd_kit: Math.max(1, Math.round(num(form.qtd_kit))),
        categoria: form.categoria,
        grupo: form.grupo,
        colecao: form.colecao,
        cor_nome: form.cor_nome,
        tipo: form.tipo.trim() || null,
        familia: form.familia.trim() || null,
        tamanho_numero: form.tamanho_numero.trim() || null,
        estampa: form.estampa.trim() || null,
        nome_comercial: form.nome_comercial.trim(),
        preco_atacado: num(form.preco_atacado),
        preco_varejo: num(form.preco_varejo),
      };

      if (editando) {
        const { error } = await supabase
          .from("products")
          .update(payload as never)
          .eq("id", editando.id);
        if (error) throw error;
        await registrarAudit(payload.sku, payload.nome_comercial, "editado");
        toast.success(`Produto ${payload.cod_cadastro} atualizado`);
      } else {
        // rascunho invisível — produto só vira ativo pelo botão Publicar, que
        // valida a ficha no SNCF
        const { error } = await supabase
          .from("products")
          .insert({ ...payload, ativo: false } as never);
        if (error) throw error;
        await registrarAudit(payload.sku, payload.nome_comercial, "criado");
        toast.success(`Rascunho ${payload.cod_cadastro} criado — publique após validar a ficha`);
      }
      setFormOpen(false);
      await qc.invalidateQueries({ queryKey: ["nascimento-produtos"] });
    } catch (e) {
      toast.error(`Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------ portão
  const chamarFichaPendencias = useServerFn(fichaPendencias);
  const [publicandoSku, setPublicandoSku] = useState<string | null>(null);
  const [pendencias, setPendencias] = useState<{ sku: string; itens: Pendencia[] } | null>(null);

  async function publicar(p: ProdutoRow) {
    setPublicandoSku(p.sku);
    try {
      const resp = await chamarFichaPendencias({ data: { skus: [p.sku] } });
      const itens = normalizarPendencias(JSON.parse(resp.json) as unknown).filter((x) => x.campo !== "ficha_bling");
      if (itens.length > 0) {
        setPendencias({ sku: p.sku, itens });
        toast.error(`${itens.length} pendência(s) na ficha — publicação bloqueada`);
        return;
      }
      const { error } = await supabase.from("products").update({ ativo: true }).eq("id", p.id);
      if (error) throw error;
      await registrarAudit(p.sku, p.nome_comercial, "reativado");
      toast.success(`${p.cod_cadastro ?? p.sku} publicado — visível no catálogo`);
      await qc.invalidateQueries({ queryKey: ["nascimento-produtos"] });
    } catch (e) {
      toast.error(`Portão de publicação falhou: ${(e as Error).message}`);
    } finally {
      setPublicandoSku(null);
    }
  }

  const [despublicar, setDespublicar] = useState<ProdutoRow | null>(null);

  async function confirmarDespublicar() {
    const p = despublicar;
    if (!p) return;
    setDespublicar(null);
    try {
      const { error } = await supabase.from("products").update({ ativo: false }).eq("id", p.id);
      if (error) throw error;
      await registrarAudit(p.sku, p.nome_comercial, "desativado");
      toast.success(`${p.cod_cadastro ?? p.sku} volta para rascunho`);
      await qc.invalidateQueries({ queryKey: ["nascimento-produtos"] });
    } catch (e) {
      toast.error(`Falha ao despublicar: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------ render
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-light uppercase tracking-[0.2em] text-gold">
          Cadastro de Produtos
        </h1>
        <p className="mt-1 text-xs text-text-secondary">
          Nascimento do Produto — o produto nasce como rascunho e só aparece no catálogo do
          representante depois de passar no portão de publicação do SNCF.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, SKU ou nome"
            className={`pl-9 ${inputCls}`}
          />
        </div>
        {(["rascunho", "publicado", "todos"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            onClick={() => setFiltro(f)}
            className="text-xs uppercase tracking-wider"
          >
            {f === "rascunho" ? `Rascunho (${totalRascunhos})` : f === "publicado" ? "Publicado" : "Todos"}
          </Button>
        ))}
        <Button onClick={abrirNovo} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface/80 text-[11px] uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Cód. cadastro</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Nome comercial</th>
              <th className="px-3 py-2 text-left">Coleção</th>
              <th className="px-3 py-2 text-right">Atacado</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-text-secondary">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-text-secondary">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
            {lista.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-surface/50">
                <td className="px-3 py-2 font-mono text-base text-gold">{p.cod_cadastro ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">{p.sku}</td>
                <td className="px-3 py-2">{p.nome_comercial}</td>
                <td className="px-3 py-2 text-text-secondary">{p.colecao}</td>
                <td className="px-3 py-2 text-right">{formatBRL(p.preco_atacado)}</td>
                <td className="px-3 py-2">
                  {p.ativo ? (
                    <Badge className="border border-emerald-700 bg-emerald-600/20 text-emerald-300">
                      Publicado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-700 text-amber-300">
                      Rascunho
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => abrirEdicao(p)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    {p.ativo ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDespublicar(p)}
                        className="gap-1"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Despublicar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => publicar(p)}
                        disabled={publicandoSku === p.sku}
                        className="gap-1"
                      >
                        {publicandoSku === p.sku ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        Publicar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* -------------------------------------------------- formulário */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-gold">
              {editando ? `Editar ${editando.cod_cadastro ?? editando.sku}` : "Novo produto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              O produto é salvo como rascunho e só entra no catálogo pelo botão Publicar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Bloco titulo="Identidade">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Cód. cadastro *" hint="Código primário de conversa">
                  <Input
                    value={form.cod_cadastro}
                    onChange={(e) => set("cod_cadastro", e.target.value)}
                    className={inputCls}
                  />
                </Campo>
                <Campo
                  label="SKU *"
                  hint={skuTravado(form.cod_cadastro) ? "Travado: sku = cod_cadastro (corte 02160)" : "Preenchimento manual"}
                >
                  <Input
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    readOnly={skuTravado(form.cod_cadastro)}
                    className={inputCls}
                  />
                </Campo>
                <Campo label="EAN-13 *" hint="Prefixo 0631911 ou 0087946">
                  <Input
                    value={form.ean}
                    onChange={(e) => set("ean", e.target.value.replace(/\D/g, "").slice(0, 13))}
                    className={inputCls}
                  />
                </Campo>
                <Campo label="Marca">
                  <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} className={inputCls} />
                </Campo>
              </div>
            </Bloco>

            <Bloco titulo="Fiscal & Físico">
              <div className="grid gap-3 sm:grid-cols-4">
                <Campo label="NCM">
                  <Input value={form.ncm} onChange={(e) => set("ncm", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="CEST">
                  <Input value={form.cest} onChange={(e) => set("cest", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Origem fiscal">
                  <Input value={form.origem_fisc} onChange={(e) => set("origem_fisc", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Origem produto">
                  <Input value={form.origem_prod} onChange={(e) => set("origem_prod", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Peso (g)">
                  <Input value={form.peso_g} onChange={(e) => set("peso_g", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Altura (cm)">
                  <Input value={form.altura_cm} onChange={(e) => set("altura_cm", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Largura (cm)">
                  <Input value={form.largura_cm} onChange={(e) => set("largura_cm", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Profundidade (cm)">
                  <Input value={form.profundidade_cm} onChange={(e) => set("profundidade_cm", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Material">
                  <Input value={form.material} onChange={(e) => set("material", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Tipo de embalagem">
                  <Input value={form.tipo_embalagem} onChange={(e) => set("tipo_embalagem", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Múltiplos (caixa)">
                  <Input value={form.multiplos} onChange={(e) => set("multiplos", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Qtd. do kit">
                  <Input value={form.qtd_kit} onChange={(e) => set("qtd_kit", e.target.value)} className={inputCls} />
                </Campo>
              </div>
            </Bloco>

            <Bloco titulo="Classificação">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Departamento">
                  <select
                    value={form.departamento}
                    onChange={(e) => set("departamento", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">—</option>
                    {(dims?.departamentos ?? []).map((d) => (
                      <option key={d.id} value={d.nome}>{d.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Categoria *">
                  <select
                    value={form.categoria}
                    onChange={(e) => set("categoria", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">—</option>
                    {categoriasDoDep.map((c) => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Grupo *">
                  <select
                    value={form.grupo}
                    onChange={(e) => set("grupo", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">—</option>
                    {gruposDaCategoria.map((g) => (
                      <option key={g.id} value={g.nome}>{g.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Coleção *">
                  <select
                    value={form.colecao}
                    onChange={(e) => set("colecao", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">—</option>
                    {(dims?.colecoes ?? []).map((c) => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Cor *">
                  <select
                    value={form.cor_nome}
                    onChange={(e) => set("cor_nome", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">—</option>
                    {(dims?.cores ?? []).map((c) => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Tipo">
                  <Input value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Família">
                  <Input value={form.familia} onChange={(e) => set("familia", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Tamanho / número">
                  <Input value={form.tamanho_numero} onChange={(e) => set("tamanho_numero", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Estampa">
                  <Input value={form.estampa} onChange={(e) => set("estampa", e.target.value)} className={inputCls} />
                </Campo>
              </div>
            </Bloco>

            <Bloco titulo="Comercial">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Nome comercial *">
                  <Input value={form.nome_comercial} onChange={(e) => set("nome_comercial", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Preço atacado">
                  <Input value={form.preco_atacado} onChange={(e) => set("preco_atacado", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Preço varejo">
                  <Input value={form.preco_varejo} onChange={(e) => set("preco_varejo", e.target.value)} className={inputCls} />
                </Campo>
              </div>
              <p className="mt-2 text-[10px] text-text-secondary">
                Descrições e textos de conteúdo ficam para o time de conteúdo, depois.
              </p>
            </Bloco>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editando ? "Salvar alterações" : "Salvar rascunho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- pendências */}
      <Dialog open={!!pendencias} onOpenChange={(o) => !o && setPendencias(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-amber-300">
              Ficha incompleta — não publicado
            </DialogTitle>
            <DialogDescription className="text-xs">
              O SNCF apontou pendências para {pendencias?.sku}. Resolva com os donos abaixo e
              tente publicar novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface/80 text-[11px] uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left">Campo</th>
                  <th className="px-3 py-2 text-left">Bloco</th>
                  <th className="px-3 py-2 text-left">Dono</th>
                </tr>
              </thead>
              <tbody>
                {(pendencias?.itens ?? []).map((it, i) => (
                  <tr key={`${it.campo}-${i}`} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{it.campo}</td>
                    <td className="px-3 py-2">{it.bloco}</td>
                    <td className="px-3 py-2 text-text-secondary">{it.dono}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendencias(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- despublicar */}
      <AlertDialog open={!!despublicar} onOpenChange={(o) => !o && setDespublicar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Despublicar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {despublicar?.cod_cadastro ?? despublicar?.sku} volta para rascunho e deixa de
              aparecer no catálogo do representante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDespublicar}>Despublicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
