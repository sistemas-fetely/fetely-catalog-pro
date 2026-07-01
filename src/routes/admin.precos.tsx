import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Table as TableIcon, Pencil, Check, X, History, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export const Route = createFileRoute("/admin/precos")({
  component: PrecosTablePage,
});

interface ProductRow {
  id: string;
  sku: string;
  nome_comercial: string;
  colecao: string | null;
  cor_nome: string | null;
  preco_varejo: number;
  preco_atacado: number;
  ativo: boolean;
}

interface HistRow {
  id: string;
  preco_atacado_anterior: number | null;
  preco_varejo_anterior: number | null;
  preco_atacado_novo: number | null;
  preco_varejo_novo: number | null;
  variacao_atacado_percent: number | null;
  variacao_varejo_percent: number | null;
  acao: string;
  alterado_por_nome: string | null;
  observacao: string | null;
  criado_em: string;
}

const DISCOUNTS = [0, 5, 10, 15, 20, 25] as const;

const brl = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(n));

function PrecosTablePage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVarejo, setEditVarejo] = useState("");
  const [editAtacado, setEditAtacado] = useState("");
  const [editObs, setEditObs] = useState("");
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState<ProductRow | null>(null);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, nome_comercial, colecao, cor_nome, preco_varejo, preco_atacado, ativo")
      .order("nome_comercial", { ascending: true })
      .limit(2000);
    if (!error && data) setRows(data as ProductRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyActive && !r.ativo) return false;
      if (!q) return true;
      return (
        r.sku.toLowerCase().includes(q) ||
        (r.nome_comercial ?? "").toLowerCase().includes(q) ||
        (r.colecao ?? "").toLowerCase().includes(q) ||
        (r.cor_nome ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, onlyActive]);

  const startEdit = (r: ProductRow) => {
    setEditingId(r.id);
    setEditVarejo(String(r.preco_varejo ?? 0));
    setEditAtacado(String(r.preco_atacado ?? 0));
    setEditObs("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditObs("");
  };

  const parseNum = (s: string) => {
    const n = Number(String(s).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const saveEdit = async (r: ProductRow) => {
    const novoVarejo = parseNum(editVarejo);
    const novoAtacado = parseNum(editAtacado);
    if (!Number.isFinite(novoVarejo) || !Number.isFinite(novoAtacado) || novoVarejo < 0 || novoAtacado < 0) {
      toast.error("Informe valores numéricos válidos.");
      return;
    }
    if (novoVarejo === Number(r.preco_varejo) && novoAtacado === Number(r.preco_atacado)) {
      toast.info("Nenhuma alteração de preço.");
      cancelEdit();
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    let nomeUsuario: string | null = null;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", uid)
        .maybeSingle();
      nomeUsuario = prof?.nome_completo ?? userData.user?.email ?? null;
    }

    const { error } = await supabase.from("product_prices").insert({
      product_id: r.id,
      preco_atacado: novoAtacado,
      preco_varejo: novoVarejo,
      ativo: true,
      criado_por_id: uid,
      criado_por_nome: nomeUsuario,
      observacao: editObs.trim() || null,
    });

    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success("Preço atualizado e histórico gravado.");
    cancelEdit();
    await loadProducts();
  };

  const openHistory = async (r: ProductRow) => {
    setHistoryFor(r);
    setHistory([]);
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("product_price_history")
      .select(
        "id, preco_atacado_anterior, preco_varejo_anterior, preco_atacado_novo, preco_varejo_novo, variacao_atacado_percent, variacao_varejo_percent, acao, alterado_por_nome, observacao, criado_em",
      )
      .eq("product_id", r.id)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (!error && data) setHistory(data as HistRow[]);
    setHistoryLoading(false);
  };

  const exportarExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Tabela de Preço");

      const headers = [
        "SKU", "Produto", "Coleção", "Cor", "Preço Varejo", "Preço Atacado",
        "Atacado -5%", "Atacado -10%", "Atacado -15%", "Atacado -20%", "Atacado -25%",
      ];
      ws.addRow(headers);

      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      filtered.forEach((r) => {
        const baseAtacado = Number(r.preco_atacado);
        const row = [
          r.sku,
          r.nome_comercial,
          r.colecao ?? "",
          r.cor_nome ?? "",
          Number(r.preco_varejo),
          baseAtacado,
          baseAtacado * 0.95,
          baseAtacado * 0.90,
          baseAtacado * 0.85,
          baseAtacado * 0.80,
          baseAtacado * 0.75,
        ];
        ws.addRow(row);
      });

      ws.columns.forEach((col, idx) => {
        if (idx >= 4) {
          col.numFmt = "R$ #,##0.00";
          col.width = 16;
        } else {
          col.width = idx === 1 ? 40 : 22;
        }
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `tabela-preco-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Planilha exportada com sucesso.");
    } catch (e) {
      toast.error("Erro ao exportar Excel.");
      console.error(e);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <Link
          to="/settings"
          className="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <TableIcon className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-text-primary">Tabela de Preço</h1>
              <p className="text-sm text-text-secondary">
                Fonte da verdade — alterações geram histórico automático
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por SKU, produto, coleção ou cor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
          />
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Apenas ativos
          </label>
          <button
            onClick={exportarExcel}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wider text-text-secondary hover:bg-surface-hover hover:text-gold"
          >
            <Download className="h-3.5 w-3.5" /> Exportar Excel
          </button>
          <span className="text-xs text-text-secondary">
            {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-hover px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Coleção</th>
                <th className="px-4 py-3 text-left">Cor</th>
                <th className="px-4 py-3 text-right">Preço Varejo</th>
                {DISCOUNTS.map((d) => (
                  <th key={d} className="px-4 py-3 text-right">
                    {d === 0 ? "Preço Atacado" : `Atacado -${d}%`}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6 + DISCOUNTS.length} className="px-4 py-8 text-center text-text-secondary">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6 + DISCOUNTS.length} className="px-4 py-8 text-center text-text-secondary">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr key={r.id} className="border-t border-border hover:bg-surface-hover">
                        <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-mono text-xs">{r.sku}</td>
                        <td className="px-4 py-3">{r.nome_comercial}</td>
                        <td className="px-4 py-3 text-text-secondary">{r.colecao ?? "—"}</td>
                        <td className="px-4 py-3 text-text-secondary">{r.cor_nome ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editVarejo}
                              onChange={(e) => setEditVarejo(e.target.value)}
                              className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                            />
                          ) : (
                            brl(r.preco_varejo)
                          )}
                        </td>
                        {DISCOUNTS.map((d) => {
                          const base = isEditing ? parseNum(editAtacado) || 0 : Number(r.preco_atacado);
                          const value = base * (1 - d / 100);
                          if (d === 0 && isEditing) {
                            return (
                              <td key={d} className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editAtacado}
                                  onChange={(e) => setEditAtacado(e.target.value)}
                                  className="w-24 rounded border border-gold bg-background px-2 py-1 text-right text-sm font-semibold"
                                />
                              </td>
                            );
                          }
                          return (
                            <td
                              key={d}
                              className={`px-4 py-3 text-right ${d === 0 ? "font-semibold text-text-primary" : "text-text-primary"}`}
                            >
                              {brl(value)}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => saveEdit(r)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                <Check className="h-3 w-3" /> Salvar
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="inline-flex items-center gap-1 rounded bg-surface-hover px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => startEdit(r)}
                                className="inline-flex items-center gap-1 rounded bg-gold/15 px-2 py-1 text-xs text-gold hover:bg-gold/25"
                              >
                                <Pencil className="h-3 w-3" /> Editar
                              </button>
                              <button
                                onClick={() => openHistory(r)}
                                className="inline-flex items-center gap-1 rounded bg-surface-hover px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                                title="Ver histórico"
                              >
                                <History className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr key={`${r.id}-obs`} className="border-t border-border bg-surface-hover/40">
                          <td colSpan={6 + DISCOUNTS.length} className="px-4 py-2">
                            <input
                              type="text"
                              placeholder="Observação (opcional) — ex: reajuste anual, promoção..."
                              value={editObs}
                              onChange={(e) => setEditObs(e.target.value)}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-text-secondary">
          Ao salvar, é criada uma nova vigência em <code>product_prices</code>, o preço em <code>products</code> é sincronizado e o histórico é gravado automaticamente.
        </p>
      </div>

      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setHistoryFor(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-display text-lg text-text-primary">Histórico — {historyFor.nome_comercial}</h2>
                <p className="font-mono text-xs text-text-secondary">{historyFor.sku}</p>
              </div>
              <button
                onClick={() => setHistoryFor(null)}
                className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-hover text-xs uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Ação</th>
                    <th className="px-4 py-2 text-right">Atacado Ant.</th>
                    <th className="px-4 py-2 text-right">Atacado Novo</th>
                    <th className="px-4 py-2 text-right">Δ</th>
                    <th className="px-4 py-2 text-right">Varejo Ant.</th>
                    <th className="px-4 py-2 text-right">Varejo Novo</th>
                    <th className="px-4 py-2 text-right">Δ</th>
                    <th className="px-4 py-2 text-left">Por</th>
                    <th className="px-4 py-2 text-left">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-center text-text-secondary">
                        Carregando...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-center text-text-secondary">
                        Sem alterações registradas.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="border-t border-border">
                        <td className="px-4 py-2 text-text-secondary">
                          {new Date(h.criado_em).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              h.acao === "create"
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-gold/15 text-gold"
                            }`}
                          >
                            {h.acao === "create" ? "criação" : "alteração"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">{brl(h.preco_atacado_anterior)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{brl(h.preco_atacado_novo)}</td>
                        <td className="px-4 py-2 text-right text-xs text-text-secondary">
                          {h.variacao_atacado_percent != null ? `${h.variacao_atacado_percent}%` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">{brl(h.preco_varejo_anterior)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{brl(h.preco_varejo_novo)}</td>
                        <td className="px-4 py-2 text-right text-xs text-text-secondary">
                          {h.variacao_varejo_percent != null ? `${h.variacao_varejo_percent}%` : "—"}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">{h.alterado_por_nome ?? "—"}</td>
                        <td className="px-4 py-2 text-text-secondary">{h.observacao ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
