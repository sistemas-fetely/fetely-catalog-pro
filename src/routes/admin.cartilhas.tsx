import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Calculator,
  Pencil,
  Plus,
  Power,
  Save,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/store/authStore";
import { useCartilhas } from "@/store/cartilhasStore";
import {
  calcularPedido,
  detectarFaixa,
  type Faixa,
  type CondicaoPagamento,
  type RegrasGerais,
} from "@/lib/commercial";
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
import { Switch } from "@/components/ui/switch";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin/cartilhas")({
  component: AdminCartilhasPage,
});

function AdminCartilhasPage() {
  const navigate = useNavigate();
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
    else if (!isAdminOrMaster()) navigate({ to: "/" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const [simOpen, setSimOpen] = useState(false);

  if (loading || !session || !isAdminOrMaster()) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center text-text-secondary">
        Carregando…
      </div>
    );
  }

  const meta = {
    usuarioId: profile?.id ?? session.user.id,
    usuarioNome: profile?.nome_completo ?? profile?.email ?? "admin",
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-text-secondary hover:text-gold"
            >
              <ArrowLeft className="h-3 w-3" /> Configurações
            </Link>
            <span className="text-text-secondary">/</span>
            <h1 className="font-display text-2xl text-text-primary">
              Cartilhas e Níveis
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSimOpen(true)}
            className="border-gold/40 text-gold hover:bg-gold/10"
          >
            <Calculator className="h-4 w-4 mr-1.5" /> Simular pedido
          </Button>
        </div>

        <Tabs defaultValue="faixas" className="w-full">
          <TabsList className="bg-surface border border-border flex-wrap h-auto">
            <TabsTrigger value="faixas">Níveis / Faixas</TabsTrigger>
            <TabsTrigger value="condicoes">Condições de Pagamento</TabsTrigger>
            <TabsTrigger value="frete-uf">Frete por UF</TabsTrigger>
            <TabsTrigger value="regras">Regras Gerais</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="faixas" className="mt-4">
            <FaixasTab meta={meta} />
          </TabsContent>
          <TabsContent value="condicoes" className="mt-4">
            <CondicoesTab meta={meta} />
          </TabsContent>
          <TabsContent value="frete-uf" className="mt-4">
            <FreteUfTab meta={meta} />
          </TabsContent>
          <TabsContent value="regras" className="mt-4">
            <RegrasTab meta={meta} />
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            <HistoricoTab />
          </TabsContent>
        </Tabs>
      </div>

      <SimuladorDialog open={simOpen} onOpenChange={setSimOpen} />
    </div>
  );
}

/* ────────────────────────── FAIXAS ────────────────────────── */

function FaixasTab({ meta }: { meta: { usuarioId: string; usuarioNome: string } }) {
  const faixas = useCartilhas((s) => s.faixas);
  const reorder = useCartilhas((s) => s.reorderFaixas);
  const toggleAtiva = useCartilhas((s) => s.toggleFaixaAtiva);

  const [editing, setEditing] = useState<Faixa | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = useMemo(
    () => [...faixas].sort((a, b) => (a.ordem ?? a.id) - (b.ordem ?? b.id)),
    [faixas],
  );

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const arr = [...sorted];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    reorder(arr.map((f) => f.id), meta);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Use ↑↓ para reordenar · clique no nível para editar
        </p>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="bg-gold text-background hover:bg-gold-light"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nova Faixa
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((f, idx) => (
          <div
            key={f.id}
            className={`flex items-center gap-3 rounded-lg border bg-surface p-4 ${
              f.ativa === false
                ? "border-border opacity-50"
                : "border-border hover:border-gold/40"
            }`}
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="text-text-secondary hover:text-gold disabled:opacity-30"
                aria-label="Mover para cima"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === sorted.length - 1}
                className="text-text-secondary hover:text-gold disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>

            <div
              className="h-12 w-1.5 rounded-full"
              style={{ backgroundColor: f.cor ?? "#C9A84C" }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">
                  {f.ordem ?? f.id}
                </span>
                <span className="font-display text-lg text-text-primary">
                  {f.icone ? `${f.icone} ` : ""}
                  {f.nome.toUpperCase()}
                </span>
                {f.requerSenhaMaster && (
                  <Badge variant="outline" className="border-purple-400/40 text-purple-300 text-[10px]">
                    🔐 Requer Master
                  </Badge>
                )}
                {f.ativa === false && (
                  <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px]">
                    Inativa
                  </Badge>
                )}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {formatBRL(f.valorMin)} —{" "}
                {f.valorMax === Infinity ? "sem limite" : formatBRL(f.valorMax)}{" "}
                · {f.frete} · {f.descontoCelebra}% desc
                {f.bonusPixAplicavel !== false && f.bonusPix > 0
                  ? ` · +${f.bonusPix}% PIX`
                  : ""}{" "}
                · Cartão {f.cartaoAte} · Boleto {f.boletoAte} · Prazo{" "}
                {f.prazoMedioBoleto}d
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => toggleAtiva(f.id, meta)}
              className="text-text-secondary hover:text-gold"
            >
              <Power className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(f)}
              className="border-gold/30 text-gold hover:bg-gold/10"
            >
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <FaixaEditor
          faixa={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          meta={meta}
        />
      )}
    </div>
  );
}

function FaixaEditor({
  faixa,
  onClose,
  meta,
}: {
  faixa: Faixa | null;
  onClose: () => void;
  meta: { usuarioId: string; usuarioNome: string };
}) {
  const condicoes = useCartilhas((s) => s.condicoes);
  const faixas = useCartilhas((s) => s.faixas);
  const upsert = useCartilhas((s) => s.upsertFaixa);

  const isNew = !faixa;
  const newId = isNew ? faixas.reduce((m, x) => Math.max(m, x.id), 0) + 1 : 0;

  const [form, setForm] = useState<Faixa>(
    faixa ?? {
      id: newId,
      nome: "",
      valorMin: 0,
      valorMax: Infinity,
      frete: "FOB",
      descontoCelebra: 0,
      bonusPix: 2.5,
      totalComPix: 2.5,
      cartaoAte: "à vista",
      boletoAte: "à vista",
      prazoMedioBoleto: 0,
      condicoesDisponiveis: [],
      ativa: true,
      bonusPixAplicavel: true,
      cor: "#C9A84C",
      ordem: faixas.length + 1,
    },
  );
  const [semLimite, setSemLimite] = useState(form.valorMax === Infinity);

  function toggleCondicao(id: number) {
    setForm((s) => ({
      ...s,
      condicoesDisponiveis: s.condicoesDisponiveis.includes(id)
        ? s.condicoesDisponiveis.filter((x) => x !== id)
        : [...s.condicoesDisponiveis, id].sort((a, b) => a - b),
    }));
  }

  function handleSave() {
    const out = { ...form, valorMax: semLimite ? Infinity : form.valorMax };
    const res = upsert(out, meta);
    if (!res.ok) return toast.error(res.error);
    toast.success("Faixa salva. As novas regras já estão ativas.");
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Nova Faixa" : `Editar — ${faixa?.nome}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identidade */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Identidade</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Ícone / Emoji</Label>
                <Input
                  value={form.icone ?? ""}
                  onChange={(e) => setForm({ ...form, icone: e.target.value })}
                  placeholder="✨"
                />
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <Input
                  type="color"
                  value={form.cor ?? "#C9A84C"}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  className="h-10 cursor-pointer"
                />
              </div>
              <div>
                <Label className="text-xs">Ordem</Label>
                <Input
                  type="number"
                  value={form.ordem ?? 1}
                  onChange={(e) =>
                    setForm({ ...form, ordem: parseInt(e.target.value || "1", 10) })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.descricao ?? ""}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={form.ativa ?? true}
                onCheckedChange={(v) => setForm({ ...form, ativa: v })}
              />
              Faixa ativa
            </label>
          </section>

          {/* Valor */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Faixa de Valor</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor mínimo (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valorMin}
                  onChange={(e) =>
                    setForm({ ...form, valorMin: parseFloat(e.target.value || "0") })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Valor máximo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={semLimite ? "" : form.valorMax}
                  disabled={semLimite}
                  onChange={(e) =>
                    setForm({ ...form, valorMax: parseFloat(e.target.value || "0") })
                  }
                />
                <label className="flex items-center gap-2 text-[11px] mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={semLimite}
                    onChange={(e) => setSemLimite(e.target.checked)}
                  />
                  Sem limite superior
                </label>
              </div>
            </div>
          </section>

          {/* Frete */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Frete</h3>
            <div className="flex gap-3">
              {(["CIF", "FOB"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex-1 cursor-pointer rounded-md border p-3 text-sm ${
                    form.frete === t
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.frete === t}
                    onChange={() => setForm({ ...form, frete: t })}
                  />
                  <div className="font-semibold">{t}</div>
                  <div className="text-[10px] text-text-secondary">
                    {t === "CIF" ? "Fetély paga" : "Lojista paga"}
                  </div>
                </label>
              ))}
            </div>
            <div>
              <Label className="text-xs">Observação do frete</Label>
              <Input
                value={form.freteObservacao ?? ""}
                onChange={(e) => setForm({ ...form, freteObservacao: e.target.value })}
              />
            </div>
          </section>

          {/* Descontos */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Descontos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Desconto Celebra (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.descontoCelebra}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      descontoCelebra: parseFloat(e.target.value || "0"),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Bônus PIX (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.bonusPix}
                  onChange={(e) =>
                    setForm({ ...form, bonusPix: parseFloat(e.target.value || "0") })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={form.bonusPixAplicavel ?? true}
                onCheckedChange={(v) => setForm({ ...form, bonusPixAplicavel: v })}
              />
              Bônus PIX aplicável nesta faixa
            </label>
            <div className="rounded-md border border-gold/30 bg-gold/5 p-3 text-xs">
              Total com PIX:{" "}
              <strong className="text-gold">
                {(
                  form.descontoCelebra +
                  (form.bonusPixAplicavel === false ? 0 : form.bonusPix)
                ).toFixed(1)}
                %
              </strong>
            </div>
          </section>

          {/* Condições */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">
              Condições de Pagamento Liberadas
            </h3>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
              {(["pix", "boleto", "cartao"] as const).map((tipo) => {
                const lista = condicoes.filter((c) => c.tipo === tipo);
                if (lista.length === 0) return null;
                return (
                  <div key={tipo}>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mt-2 mb-1">
                      {tipo}
                    </div>
                    {lista.map((c) => {
                      const dispVal = !semLimite && c.valorMinimo > form.valorMax;
                      const ativa = form.condicoesDisponiveis.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                            dispVal ? "opacity-50" : "hover:bg-surface-2/40 cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ativa}
                            disabled={dispVal}
                            onChange={() => toggleCondicao(c.id)}
                          />
                          <span className="flex-1">{c.descricao}</span>
                          <span className="text-text-secondary text-[10px]">
                            min {formatBRL(c.valorMinimo)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Parcelamento */}
          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">
              Resumo Parcelamento (texto exibido)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cartão até</Label>
                <Input
                  value={form.cartaoAte}
                  onChange={(e) => setForm({ ...form, cartaoAte: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Boleto até</Label>
                <Input
                  value={form.boletoAte}
                  onChange={(e) => setForm({ ...form, boletoAte: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Prazo médio boleto (dias)</Label>
                <Input
                  type="number"
                  value={form.prazoMedioBoleto}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      prazoMedioBoleto: parseInt(e.target.value || "0", 10),
                    })
                  }
                />
              </div>
              <label className="flex items-end gap-2 text-xs cursor-pointer pb-2">
                <Switch
                  checked={form.requerSenhaMaster ?? false}
                  onCheckedChange={(v) => setForm({ ...form, requerSenhaMaster: v })}
                />
                Requer Senha Master
              </label>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-gold text-background hover:bg-gold-light">
            <Save className="h-4 w-4 mr-1.5" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────── CONDIÇÕES ────────────────────────── */

function CondicoesTab({ meta }: { meta: { usuarioId: string; usuarioNome: string } }) {
  const condicoes = useCartilhas((s) => s.condicoes);
  const reorder = useCartilhas((s) => s.reorderCondicoes);
  const toggleAtiva = useCartilhas((s) => s.toggleCondicaoAtiva);
  const faixas = useCartilhas((s) => s.faixas);
  const [editing, setEditing] = useState<CondicaoPagamento | null>(null);
  const [creating, setCreating] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "pix" | "boleto" | "cartao" | "inativas">(
    "todos",
  );

  const sorted = useMemo(
    () => [...condicoes].sort((a, b) => (a.ordem ?? a.id) - (b.ordem ?? b.id)),
    [condicoes],
  );
  const filtered = sorted.filter((c) => {
    if (filtro === "inativas") return c.ativa === false;
    if (filtro === "todos") return c.ativa !== false;
    return c.tipo === filtro && c.ativa !== false;
  });

  function move(id: number, dir: -1 | 1) {
    const idx = sorted.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const arr = [...sorted];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    reorder(arr.map((c) => c.id), meta);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {(["todos", "pix", "boleto", "cartao", "inativas"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={`text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded border ${
                filtro === t
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-text-secondary hover:border-gold/30"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="bg-gold text-background hover:bg-gold-light"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nova Condição
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/40 text-[10px] uppercase tracking-[0.2em] text-text-secondary">
            <tr>
              <th className="text-left p-3 w-16">Ord.</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Mín.</th>
              <th className="text-left p-3">Faixas</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const faixasUsando = faixas.filter((f) =>
                f.condicoesDisponiveis.includes(c.id),
              ).length;
              return (
                <tr
                  key={c.id}
                  className={`border-t border-border ${
                    c.ativa === false ? "opacity-50" : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => move(c.id, -1)}
                        className="text-text-secondary hover:text-gold"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <span className="text-[10px] text-text-secondary text-center">
                        {c.ordem ?? c.id}
                      </span>
                      <button
                        onClick={() => move(c.id, 1)}
                        className="text-text-secondary hover:text-gold"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {c.descricao}
                      {c.destaque && (
                        <Star className="h-3 w-3 text-gold" fill="currentColor" />
                      )}
                    </div>
                  </td>
                  <td className="p-3 uppercase text-[11px] text-text-secondary">
                    {c.tipo}
                  </td>
                  <td className="p-3 text-text-secondary">
                    {formatBRL(c.valorMinimo)}
                  </td>
                  <td className="p-3 text-text-secondary text-xs">
                    {faixasUsando} faixa{faixasUsando !== 1 ? "s" : ""}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleAtiva(c.id, meta)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(c)}
                      className="border-gold/30 text-gold hover:bg-gold/10 ml-1"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-text-secondary">
                  Nenhuma condição.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <CondicaoEditor
          condicao={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          meta={meta}
        />
      )}
    </div>
  );
}

function CondicaoEditor({
  condicao,
  onClose,
  meta,
}: {
  condicao: CondicaoPagamento | null;
  onClose: () => void;
  meta: { usuarioId: string; usuarioNome: string };
}) {
  const condicoes = useCartilhas((s) => s.condicoes);
  const upsert = useCartilhas((s) => s.upsertCondicao);
  const faixas = useCartilhas((s) => s.faixas);
  const isNew = !condicao;
  const newId = isNew ? condicoes.reduce((m, x) => Math.max(m, x.id), 0) + 1 : 0;

  const [form, setForm] = useState<CondicaoPagamento>(
    condicao ?? {
      id: newId,
      descricao: "",
      valorMinimo: 2500,
      tipo: "boleto",
      numeroParcelas: 1,
      diasParcelas: [0],
      ativa: true,
      exibirParaVendedor: true,
      destaque: false,
      ordem: condicoes.length + 1,
    },
  );

  function updateParcelas(n: number) {
    n = Math.max(1, Math.min(12, n));
    const cur = form.diasParcelas ?? [];
    const novo = Array.from(
      { length: n },
      (_, i) => cur[i] ?? (i === 0 ? 0 : (cur[i - 1] ?? 0) + 30),
    );
    setForm({ ...form, numeroParcelas: n, diasParcelas: novo });
  }

  function updateDia(i: number, v: number) {
    const dias = [...(form.diasParcelas ?? [])];
    dias[i] = v;
    setForm({ ...form, diasParcelas: dias });
  }

  function handleSave() {
    const res = upsert(form, meta);
    if (!res.ok) return toast.error(res.error);
    toast.success("Condição salva.");
    onClose();
  }

  const faixasComEsta = faixas.filter((f) => f.condicoesDisponiveis.includes(form.id));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Nova Condição" : `Editar — ${condicao?.descricao}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Tipo *</Label>
            <div className="flex gap-2 mt-1">
              {(["pix", "boleto", "cartao"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex-1 cursor-pointer rounded-md border p-2 text-xs text-center uppercase ${
                    form.tipo === t ? "border-gold bg-gold/10 text-gold" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.tipo === t}
                    onChange={() => setForm({ ...form, tipo: t })}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nº de parcelas *</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.numeroParcelas ?? 1}
                onChange={(e) => updateParcelas(parseInt(e.target.value || "1", 10))}
              />
            </div>
            <div>
              <Label className="text-xs">Valor mínimo (R$) *</Label>
              <Input
                type="number"
                value={form.valorMinimo}
                onChange={(e) =>
                  setForm({ ...form, valorMinimo: parseFloat(e.target.value || "0") })
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Dias de cada parcela</Label>
            <div className="grid grid-cols-6 gap-2 mt-1">
              {(form.diasParcelas ?? []).map((d, i) => (
                <Input
                  key={i}
                  type="number"
                  value={d}
                  onChange={(e) => updateDia(i, parseInt(e.target.value || "0", 10))}
                  className="text-center"
                />
              ))}
            </div>
            <p className="text-[10px] text-text-secondary mt-1">
              Preview: {(form.diasParcelas ?? []).map((d) => (d === 0 ? "entrada" : `${d}d`)).join(" + ")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={form.semJuros ?? false}
                onCheckedChange={(v) => setForm({ ...form, semJuros: v })}
              />
              Sem juros
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={form.temBonusPix ?? false}
                onCheckedChange={(v) => setForm({ ...form, temBonusPix: v })}
              />
              Bônus PIX
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={form.destaque ?? false}
                onCheckedChange={(v) => setForm({ ...form, destaque: v })}
              />
              Destaque ("RECOMENDADO")
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={form.exibirParaVendedor ?? true}
                onCheckedChange={(v) => setForm({ ...form, exibirParaVendedor: v })}
              />
              Exibir p/ vendedor
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer col-span-2">
              <Switch
                checked={form.ativa ?? true}
                onCheckedChange={(v) => setForm({ ...form, ativa: v })}
              />
              Condição ativa
            </label>
          </div>

          {!isNew && (
            <div className="rounded-md border border-border bg-surface-2/30 p-3 text-xs">
              <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-1">
                Faixas que incluem esta condição
              </div>
              {faixas.map((f) => (
                <div key={f.id} className="flex justify-between py-0.5">
                  <span>
                    {f.nome} ({f.id})
                  </span>
                  <span className={faixasComEsta.includes(f) ? "text-gold" : "text-text-secondary"}>
                    {faixasComEsta.includes(f) ? "✓" : "—"}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-text-secondary mt-1">
                Editável na aba de Faixas.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-gold text-background hover:bg-gold-light">
            <Save className="h-4 w-4 mr-1.5" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────── REGRAS GERAIS ────────────────────────── */

function RegrasTab({ meta }: { meta: { usuarioId: string; usuarioNome: string } }) {
  const regras = useCartilhas((s) => s.regras);
  const updateRegras = useCartilhas((s) => s.updateRegras);
  const [form, setForm] = useState<RegrasGerais>(regras);

  useEffect(() => setForm(regras), [regras]);

  function save() {
    updateRegras(form, meta);
    toast.success("Regras gerais atualizadas.");
  }

  return (
    <div className="max-w-2xl rounded-lg border border-border bg-surface p-6 space-y-6">
      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Pedido</h3>
        <div>
          <Label className="text-xs">Valor mínimo do pedido (R$) *</Label>
          <Input
            type="number"
            value={form.pedidoMinimo}
            onChange={(e) => setForm({ ...form, pedidoMinimo: parseFloat(e.target.value || "0") })}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Modo Negociação</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Desconto master máx. (%) *</Label>
            <Input
              type="number"
              value={form.descontoMasterMax}
              onChange={(e) =>
                setForm({ ...form, descontoMasterMax: parseFloat(e.target.value || "0") })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Tentativas senha *</Label>
            <Input
              type="number"
              value={form.tentativasSenhaMaster}
              onChange={(e) =>
                setForm({ ...form, tentativasSenhaMaster: parseInt(e.target.value || "0", 10) })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Bloqueio (min) *</Label>
            <Input
              type="number"
              value={form.bloqueioSenhaMasterMinutos}
              onChange={(e) =>
                setForm({
                  ...form,
                  bloqueioSenhaMasterMinutos: parseInt(e.target.value || "0", 10),
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Provisões</h3>
        <div>
          <Label className="text-xs">Expiração automática (dias) *</Label>
          <Input
            type="number"
            value={form.provisaoExpirarDias}
            onChange={(e) =>
              setForm({ ...form, provisaoExpirarDias: parseInt(e.target.value || "0", 10) })
            }
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-gold">Faixas</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nome da faixa reservada *</Label>
            <Input
              value={form.faixaReservadaNome}
              onChange={(e) => setForm({ ...form, faixaReservadaNome: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Bônus PIX padrão (%) *</Label>
            <Input
              type="number"
              step="0.1"
              value={form.bonusPixPadrao}
              onChange={(e) =>
                setForm({ ...form, bonusPixPadrao: parseFloat(e.target.value || "0") })
              }
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" onClick={() => setForm(regras)}>
          Cancelar
        </Button>
        <Button onClick={save} className="bg-gold text-background hover:bg-gold-light">
          <Save className="h-4 w-4 mr-1.5" /> Salvar Regras Gerais
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────── HISTÓRICO ────────────────────────── */

function HistoricoTab() {
  const audit = useCartilhas((s) => s.audit);
  if (audit.length === 0)
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-text-secondary text-sm">
        Nenhuma alteração registrada ainda.
      </div>
    );
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2/40 text-[10px] uppercase tracking-[0.2em] text-text-secondary">
          <tr>
            <th className="text-left p-3">Data / Hora</th>
            <th className="text-left p-3">Usuário</th>
            <th className="text-left p-3">Entidade</th>
            <th className="text-left p-3">Ação</th>
            <th className="text-left p-3">Alterações</th>
          </tr>
        </thead>
        <tbody>
          {audit.slice(0, 200).map((a) => (
            <tr key={a.id} className="border-t border-border align-top">
              <td className="p-3 text-text-secondary text-xs">
                {new Date(a.timestamp).toLocaleString("pt-BR")}
              </td>
              <td className="p-3 text-xs">{a.usuarioNome}</td>
              <td className="p-3 text-xs">
                <span className="text-text-secondary uppercase tracking-wider text-[10px]">
                  {a.entidade}
                </span>{" "}
                — {a.entidadeNome}
              </td>
              <td className="p-3 text-xs">{a.acao}</td>
              <td className="p-3 text-xs text-text-secondary">
                {a.camposAlterados && a.camposAlterados.length > 0
                  ? a.camposAlterados
                      .slice(0, 4)
                      .map((c) => `${c.campo}: ${c.valorAnterior} → ${c.valorNovo}`)
                      .join(" · ")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────── SIMULADOR ────────────────────────── */

function SimuladorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const condicoes = useCartilhas((s) => s.condicoes);
  const [bruto, setBruto] = useState(6500);
  const [condId, setCondId] = useState<number | null>(null);
  const [negociacao, setNegociacao] = useState(false);
  const [masterPct, setMasterPct] = useState(0);

  const condicao = useMemo(
    () => condicoes.find((c) => c.id === condId) ?? null,
    [condId, condicoes],
  );
  const calc = useMemo(
    () =>
      calcularPedido({
        bruto,
        usarReservada: negociacao,
        descontoMasterPct: negociacao ? masterPct : 0,
        condicao,
      }),
    [bruto, condicao, negociacao, masterPct],
  );
  const faixa = detectarFaixa(bruto, negociacao);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-gold" /> Simulador de Regras
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Valor bruto do pedido (R$)</Label>
            <Input
              type="number"
              value={bruto}
              onChange={(e) => setBruto(parseFloat(e.target.value || "0"))}
            />
          </div>
          <div>
            <Label className="text-xs">Condição de pagamento</Label>
            <select
              value={condId ?? ""}
              onChange={(e) => setCondId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            >
              <option value="">— nenhuma —</option>
              {condicoes
                .filter((c) => c.ativa !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao}
                  </option>
                ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={negociacao} onCheckedChange={setNegociacao} />
            Modo negociação (faixa reservada)
          </label>
          {negociacao && (
            <div>
              <Label className="text-xs">Desconto master adicional (%)</Label>
              <Input
                type="number"
                value={masterPct}
                onChange={(e) => setMasterPct(parseFloat(e.target.value || "0"))}
              />
            </div>
          )}

          <div className="rounded-md border border-gold/30 bg-gold/5 p-3 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Resultado</div>
            <div>
              Faixa: <strong>{faixa ? `${faixa.nome} (${faixa.id})` : "abaixo do mínimo"}</strong>
            </div>
            {faixa && (
              <>
                <div>Frete: <strong>{faixa.frete}</strong></div>
                <div>
                  Desconto Celebra: <strong>{faixa.descontoCelebra}%</strong> →{" "}
                  – {formatBRL(calc.descontoCelebraValor)}
                </div>
                {calc.descontoMasterValor > 0 && (
                  <div>
                    Desconto master: – {formatBRL(calc.descontoMasterValor)}
                  </div>
                )}
                <div>
                  Bônus PIX: {calc.aplicouPix ? `– ${formatBRL(calc.bonusPixValor)}` : "n/a"}
                </div>
                <div className="border-t border-gold/20 pt-1 mt-1 font-display text-base text-gold">
                  Total: {formatBRL(calc.total)}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
