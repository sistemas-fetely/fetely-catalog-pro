import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DAILY_PAGE_SIZE, dailyColumns, dailyEntryType, dailyFieldBlock, dailyFieldLabel, dailyReadableError, filterDailyEntries, groupDailyProducts, scopedDailySelection, type DailyFilterType } from "@/lib/catalogDailyView";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_LABELS, type CatalogLists, type CatalogRow } from "@/lib/catalogSpreadsheet";
import { createValue, loadLists } from "@/lib/catalogSpreadsheetData";
import { loadCatalogRows, useCatalog } from "@/store/catalogStore";
import { useAuth } from "@/store/authStore";
import {
  callCatalogDaily,
  dailyNewValues,
  dailyPatch,
  mapDailyResponse,
  prepareDailyItems,
  type DailyChoice,
  type DailyData,
  type DailyPrepared,
} from "@/lib/catalogDailyUpdate";

const display = (value: unknown) => value == null || value === "" ? "—" : typeof value === "boolean" ? value ? "Sim" : "Não" : String(value);
type DailyOutcome = { id: string; code: string; field: string; status: "Aplicada" | "Resolvida" | "Descartada" | "Erro"; message?: string };

export function CatalogDailyUpdateSection() {
  const session = useAuth(s => s.session);
  const profile = useAuth(s => s.profile);
  const [data, setData] = useState<DailyData | null>(null);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [lists, setLists] = useState<CatalogLists | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, DailyChoice>>({});
  const [newValues, setNewValues] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<DailyOutcome[]>([]);

  const [fieldFilter, setFieldFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState<DailyFilterType>("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function refresh(showBusy = true) {
    if (showBusy) setBusy("Consultando atualização do dia");
    setError("");
    try {
      const [response, currentRows, currentLists] = await Promise.all([
        callCatalogDaily({ acao: "pendentes" }), loadCatalogRows(), loadLists(),
      ]);
      const mapped = mapDailyResponse(response);
      setData(mapped); setRows(currentRows); setLists(currentLists);
      setSelected(prev => new Set([...prev].filter(id => mapped.itens.some(item => item.id === id))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (showBusy) setBusy(""); }
  }

  useEffect(() => { void refresh(); }, []);
  const prepared = useMemo(() => data && lists ? prepareDailyItems(data.itens, rows, lists, choices) : [], [data, rows, lists, choices]);
  const pendingNewValues = useMemo(() => dailyNewValues(prepared), [prepared]);

  const filtered = useMemo(() => filterDailyEntries(prepared, fieldFilter, typeFilter, search), [prepared, fieldFilter, typeFilter, search]);
  const products = useMemo(() => groupDailyProducts(filtered), [filtered]);
  const fields = useMemo(() => dailyColumns(filtered), [filtered]);
  const availableFields = useMemo(() => dailyColumns(prepared), [prepared]);
  const actionIds = useMemo(() => scopedDailySelection(filtered, selected), [filtered, selected]);
  const pageCount = Math.max(1, Math.ceil(products.length / DAILY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = products.slice((currentPage - 1) * DAILY_PAGE_SIZE, currentPage * DAILY_PAGE_SIZE);
  const allChecked = filtered.length > 0 && filtered.every(entry => selected.has(entry.item.id));
  const someChecked = filtered.some(entry => selected.has(entry.item.id));
  const blocks = fields.reduce<{ name: string; fields: string[] }[]>((groups, field) => {
    const name = dailyFieldBlock(field);
    const last = groups.at(-1);
    if (last?.name === name) last.fields.push(field); else groups.push({ name, fields: [field] });
    return groups;
  }, []);
  const readingErrors = [...(data?.erros ?? []), ...prepared.filter(entry => entry.error).map(entry => `${entry.item.cod_cadastro} · ${dailyFieldLabel(entry.item.campo)}: ${dailyReadableError(entry.error ?? "")}`)];
  useEffect(() => { setPage(1); }, [fieldFilter, typeFilter, search]);

  function toggleEntries(entries: DailyPrepared[], checked: boolean) {
    setSelected(prev => { const next = new Set(prev); for (const entry of entries) { if (checked) next.add(entry.item.id); else next.delete(entry.item.id); } return next; });
  }

  async function confirmOne(entry: DailyPrepared, status: "aplicada" | "resolvida", choice: DailyChoice) {
    await callCatalogDaily({ acao: "confirmar", ids: [entry.item.id], status, escolha: choice });
  }

  async function apply() {
    if (!session || !data || !lists || !actionIds.size || busy) return;
    setBusy("Recalculando e aplicando no FOP"); setOutcomes([]);
    const results: DailyOutcome[] = [];
    try {
      // Recarrega imediatamente antes de gravar: o valor exibido e a detecção de
      // conflito usam o FOP vivo, não a cópia da leitura das 06:30.
      const [freshRows, freshLists] = await Promise.all([loadCatalogRows(), loadLists()]);
      setRows(freshRows); setLists(freshLists);
      const fresh = prepareDailyItems(data.itens.filter(item => actionIds.has(item.id)), freshRows, freshLists, choices);
      const canonical = new Map<string, string>();
      const failures = new Map<string, string>();
      for (const value of dailyNewValues(fresh).filter(value => newValues.has(value.key))) {
        try { canonical.set(value.key, await createValue(value, freshLists)); }
        catch (cause) { failures.set(value.key, cause instanceof Error ? cause.message : String(cause)); }
      }

      const groups = new Map<string, DailyPrepared[]>();
      for (const entry of fresh) {
        const base = { id: entry.item.id, code: entry.item.cod_cadastro, field: entry.item.campo };
        const choice: DailyChoice = entry.choice ?? "planilha";
        const status = entry.item.tipo === "conflito" || entry.drifted ? "resolvida" : "aplicada";
        try {
          if (entry.error) throw new Error(entry.error);
          if ((entry.item.tipo === "conflito" || entry.drifted) && !entry.choice) throw new Error("Escolha planilha ou sistema antes de aplicar");
          if (choice === "sistema") {
            await confirmOne(entry, "resolvida", "sistema");
            results.push({ ...base, status: "Resolvida" }); continue;
          }
          if (!entry.change) {
            await confirmOne(entry, status, "planilha");
            results.push({ ...base, status: status === "resolvida" ? "Resolvida" : "Aplicada" }); continue;
          }
          if (entry.change.newKey && !newValues.has(entry.change.newKey)) throw new Error("Valor novo não selecionado para criação");
          if (entry.change.newKey && failures.has(entry.change.newKey)) throw new Error(failures.get(entry.change.newKey));
          const group = groups.get(entry.item.cod_cadastro) ?? []; group.push(entry); groups.set(entry.item.cod_cadastro, group);
        } catch (cause) {
          results.push({ ...base, status: "Erro", message: cause instanceof Error ? cause.message : String(cause) });
        }
      }

      let done = 0;
      for (const [code, entries] of groups) {
        setBusy(`Gravando ${code} · ${++done}/${groups.size}`);
        const patch = dailyPatch(entries, canonical);
        try {
          await useCatalog.getState().saveProductFields(code, patch, {
            usuarioId: session.user.id,
            usuarioNome: profile?.nome_completo ?? profile?.login_amigavel ?? session.user.email ?? "—",
          }, `Atualização do dia · ${data.leitura?.hora ?? "leitura SNCF"}`);
          for (const entry of entries) {
            const status = entry.item.tipo === "conflito" || entry.drifted ? "resolvida" : "aplicada";
            try {
              await confirmOne(entry, status, "planilha");
              results.push({ id: entry.item.id, code, field: entry.item.campo, status: status === "resolvida" ? "Resolvida" : "Aplicada" });
            } catch (cause) {
              results.push({ id: entry.item.id, code, field: entry.item.campo, status: "Erro", message: `Gravado no FOP, mas a confirmação ao SNCF falhou: ${cause instanceof Error ? cause.message : String(cause)}` });
            }
          }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          for (const entry of entries) results.push({ id: entry.item.id, code, field: entry.item.campo, status: "Erro", message });
        }
      }
      setOutcomes(results);
      if (results.some(result => result.status === "Erro")) toast.error("Há itens não confirmados; confira os erros antes de tentar novamente");
      else toast.success("Atualização aplicada e confirmada ao SNCF");
      await useCatalog.getState().hydrate({ force: true });
      await refresh(false);
    } catch (cause) {
      setOutcomes(results); toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(""); }
  }

  async function discard() {
    if (!data || !actionIds.size || busy) return;
    setBusy("Descartando no SNCF"); setOutcomes([]);
    const results: DailyOutcome[] = [];
    for (const entry of prepared.filter(item => actionIds.has(item.item.id))) {
      try {
        await callCatalogDaily({ acao: "confirmar", ids: [entry.item.id], status: "descartada", escolha: entry.choice ?? "planilha" });
        results.push({ id: entry.item.id, code: entry.item.cod_cadastro, field: entry.item.campo, status: "Descartada" });
      } catch (cause) {
        results.push({ id: entry.item.id, code: entry.item.cod_cadastro, field: entry.item.campo, status: "Erro", message: cause instanceof Error ? cause.message : String(cause) });
      }
    }
    setOutcomes(results);
    if (results.some(result => result.status === "Erro")) toast.error("Alguns descartes não foram confirmados");
    else toast.success("Itens descartados no SNCF");
    await refresh(false); setBusy("");
  }

  return <section className="space-y-4 border-t border-border py-5" aria-labelledby="daily-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="daily-title" className="text-lg font-semibold">Atualização do dia</h2>
        {data && <p className="mt-1 text-sm font-medium">{prepared.filter(entry => dailyEntryType(entry) === "mudanca").length} mudanças · {prepared.filter(entry => entry.item.tipo === "conflito" || entry.drifted).length} conflitos · {readingErrors.length} erros · {data.semCadastro.length} sem cadastro</p>}
        {data?.leitura && <p className="mt-1 text-xs text-text-secondary"><strong>{data.leitura.status}</strong> · Última leitura: {data.leitura.hora}</p>}
      </div>
      <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={!!busy}><RefreshCw className="mr-2 h-4 w-4" />Atualizar fila</Button>
    </div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}<Button variant="outline" size="sm" className="ml-3" onClick={() => void refresh()}>Tentar novamente</Button></div>}
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
    {data && !error && <>
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Buscar código ou nome" placeholder="Buscar código ou nome" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-64" />
        <Select value={fieldFilter} onValueChange={setFieldFilter}><SelectTrigger aria-label="Filtrar por campo" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os campos</SelectItem>{availableFields.map(field => <SelectItem key={field} value={field}>{dailyFieldLabel(field)}</SelectItem>)}</SelectContent></Select>
        <Select value={typeFilter} onValueChange={value => setTypeFilter(value as DailyFilterType)}><SelectTrigger aria-label="Filtrar por tipo" className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os tipos</SelectItem><SelectItem value="mudanca">Mudanças</SelectItem><SelectItem value="conflito">Conflitos</SelectItem><SelectItem value="erro">Erros</SelectItem></SelectContent></Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Selecionar todos do filtro" checked={allChecked ? true : someChecked ? "indeterminate" : false} onCheckedChange={checked => toggleEntries(filtered, checked === true)} disabled={!!busy || !filtered.length} />Selecionar todos do filtro</label>
        <span className="text-xs text-text-secondary">{products.length} produtos · {filtered.length} células · {actionIds.size} células selecionadas</span>
        <Button size="sm" onClick={() => void apply()} disabled={!!busy || !actionIds.size}><Check className="mr-2 h-4 w-4" />Aplicar ({actionIds.size} células)</Button>
        <Button variant="outline" size="sm" onClick={() => void discard()} disabled={!!busy || !actionIds.size}><Trash2 className="mr-2 h-4 w-4" />Descartar ({actionIds.size} células)</Button>
      </div>
      {pendingNewValues.length > 0 && <details className="border-y border-border py-2"><summary className="cursor-pointer text-sm font-medium">Valores novos ({pendingNewValues.length})</summary><div className="mt-2 space-y-2">{pendingNewValues.map(value => <label key={value.key} className="flex items-center gap-2 text-sm"><Checkbox checked={newValues.has(value.key)} disabled={!!busy} onCheckedChange={checked => setNewValues(prev => { const next = new Set(prev); if (checked === true) next.add(value.key); else next.delete(value.key); return next; })} />Criar este valor: {dailyFieldLabel(value.kind)} — {value.nome}</label>)}</div></details>}
      {products.length > 0 ? <div className="max-h-[680px] overflow-auto border border-border" role="region" aria-label="Pendências por produto" tabIndex={0}>
        <table className="w-full border-separate border-spacing-0 text-sm"><thead className="sticky top-0 z-20 bg-surface-2 text-text-secondary">
          <tr><th rowSpan={2} className="sticky left-0 z-30 min-w-60 border-b border-r border-border bg-surface-2 p-3 text-left">Produto</th>{blocks.map(block => <th key={block.name} colSpan={block.fields.length} className="border-b border-r border-border px-3 py-2 text-left font-semibold">{block.name}</th>)}</tr>
          <tr>{fields.map(field => <th key={field} className="min-w-56 border-b border-r border-border px-3 py-2 text-left font-medium">{dailyFieldLabel(field)}</th>)}</tr>
        </thead><tbody>{pageProducts.map(product => {
          const checked = product.entries.every(entry => selected.has(entry.item.id));
          const partial = product.entries.some(entry => selected.has(entry.item.id));
          return <tr key={product.code} className="align-top">
            <td className="sticky left-0 z-10 min-w-60 max-w-64 border-b border-r border-border bg-surface p-3"><div className="flex gap-3"><Checkbox aria-label={`Selecionar produto ${product.code}`} checked={checked ? true : partial ? "indeterminate" : false} disabled={!!busy} onCheckedChange={value => toggleEntries(product.entries, value === true)} /><div><strong>{product.code}</strong><span className="mt-1 block break-words text-xs text-text-secondary">{product.name}</span></div></div></td>
            {fields.map(field => <td key={field} className="min-w-56 max-w-80 border-b border-r border-border p-3">{product.cells.get(field)?.map(entry => {
              const conflict = entry.item.tipo === "conflito" || entry.drifted;
              return <div key={entry.item.id} className={`space-y-2 break-words ${entry.error ? "border-l-2 border-destructive pl-2" : conflict ? "border-l-2 border-primary bg-primary/5 p-2" : ""}`}>
                <div><span className="text-text-secondary">{display(entry.current)}</span><span aria-hidden="true" className="mx-2 text-text-secondary">→</span><strong>{display(entry.item.valor_planilha)}</strong></div>
                {conflict && <><span className="block text-xs font-semibold text-primary">Conflito{entry.drifted && entry.item.tipo !== "conflito" ? " · FOP mudou após a leitura" : ""}</span><dl className="text-xs"><div>Base: {display(entry.item.valor_base)}</div><div>FOP: {display(entry.current)}</div><div>Planilha: {display(entry.item.valor_planilha)}</div></dl><Select value={entry.choice} onValueChange={value => setChoices(prev => ({ ...prev, [entry.item.id]: value as DailyChoice }))} disabled={!!busy}><SelectTrigger aria-label={`Escolha para ${product.code} ${dailyFieldLabel(field)}`} className="w-full"><SelectValue placeholder="Escolher" /></SelectTrigger><SelectContent><SelectItem value="planilha">Planilha</SelectItem><SelectItem value="sistema">FOP</SelectItem></SelectContent></Select></>}
                {entry.error && <p className="text-xs text-destructive">{dailyReadableError(entry.error)}</p>}
              </div>;
            }) ?? <span className="text-text-secondary">—</span>}</td>)}
          </tr>;
        })}</tbody></table>
      </div> : <p className="py-4 text-sm text-text-secondary">{prepared.length ? "Nenhuma pendência corresponde aos filtros." : "Nenhuma mudança pendente do dono Produto."}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary"><span>{products.length ? `${(currentPage - 1) * DAILY_PAGE_SIZE + 1}–${Math.min(currentPage * DAILY_PAGE_SIZE, products.length)} de ${products.length} produtos` : "0 produtos"}</span><div className="flex items-center gap-3"><Button variant="outline" size="icon" aria-label="Página anterior" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button><span>Página {currentPage} de {pageCount}</span><Button variant="outline" size="icon" aria-label="Próxima página" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}><ChevronRight className="h-4 w-4" /></Button></div></div>
      <div className="divide-y divide-border border-y border-border">
        <details className="py-3"><summary className="cursor-pointer text-sm font-medium">Sem cadastro ({data.semCadastro.length})</summary><p className="mt-2 text-sm text-text-secondary">Estes produtos nascem pela Importação de PI no SNCF.</p><ul className="mt-2 max-h-64 list-inside list-disc overflow-auto text-sm">{data.semCadastro.map((item, index) => <li key={index}>{dailyReadableError(item)}</li>)}</ul></details>
        <details className="py-3"><summary className="cursor-pointer text-sm font-medium">Erros ({readingErrors.length})</summary><ul className="mt-2 max-h-64 list-inside list-disc overflow-auto text-sm text-destructive">{readingErrors.map((item, index) => <li key={index}>{dailyReadableError(item)}</li>)}</ul></details>
      </div>
    </>}
    {outcomes.length > 0 && <div><h3 className="font-semibold">Resultado desta operação</h3><ul className="max-h-80 divide-y divide-border overflow-auto text-sm">{outcomes.map(outcome => <li key={outcome.id} className="py-2">{outcome.code} · {dailyFieldLabel(outcome.field)} — <span className={outcome.status === "Erro" ? "text-destructive" : "text-stock-in"}>{outcome.status}</span>{outcome.message && <p className="break-words text-destructive">{outcome.message}</p>}</li>)}</ul></div>}
  </section>;
}
