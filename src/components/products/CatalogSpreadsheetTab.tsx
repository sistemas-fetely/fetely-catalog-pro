import { useEffect, useRef, useState } from "react";
import { Download, Upload, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCatalog, loadCatalogRows } from "@/store/catalogStore";
import { createValue, loadLists } from "@/lib/catalogSpreadsheetData";
import { useAuth } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_LABELS, PRODUCT_FIELDS, selectedChanges, validateSheet, normalizeName, type CatalogLists, type SheetPreview } from "@/lib/catalogSpreadsheet";
import { catalogWorkbook, downloadWorkbook, readWorkbook, reportWorkbook } from "@/lib/catalogSpreadsheetExcel";

const display = (value: unknown) => value == null || value === "" ? "—" : typeof value === "boolean" ? value ? "Sim" : "Não" : String(value);
type Outcome = { code: string; name: string; row: number; status: string; message: string; changes?: string };
export function CatalogSpreadsheetTab() {
  const session = useAuth(s => s.session); const profile = useAuth(s => s.profile); const allowed = useAuth(s => s.isAdminOrMaster)();
  const [lists, setLists] = useState<CatalogLists | null>(null); const [loadError, setLoadError] = useState("");
  const [collection, setCollection] = useState("all"); const [phase, setPhase] = useState("except_inactive");
  const [busy, setBusy] = useState(""); const [filename, setFilename] = useState(""); const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [field, setField] = useState("all"); const [confirmOpen, setConfirmOpen] = useState(false); const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function refreshLists() { try { setLists(await loadLists()); setLoadError(""); } catch (e) { setLoadError(e instanceof Error ? e.message : String(e)); } }
  useEffect(() => { if (allowed) void refreshLists(); }, [allowed]);
  if (!allowed) return null;
  const effective = preview ? selectedChanges(preview, selected) : [];
  const fieldsCount = effective.reduce((n, p) => n + p.changes.length, 0);
  async function download() {
    if (!lists) return;
    setBusy("Baixando planilha");
    try {
      const rows = (await loadCatalogRows()).filter(p => (collection === "all" || p.colecao === collection) && (phase === "all" || (phase === "except_inactive" ? p.fase !== "inativo" : p.fase === phase))).sort((a, b) => String(a.cod_cadastro).localeCompare(String(b.cod_cadastro)));
      const filter = `${collection === "all" ? "todas" : normalizeName(collection).replace(/[^a-z0-9]+/g, "_")}_${phase}`;
      await downloadWorkbook(await catalogWorkbook(rows, lists), `catalogo_fop_${filter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }
  async function upload(file: File) {
    setBusy("Validando planilha"); setPreview(null); setOutcomes(null); setSelected(new Set()); setFilename(file.name);
    try {
      const [book, rows, currentLists] = await Promise.all([readWorkbook(file), loadCatalogRows(), loadLists()]); setLists(currentLists);
      const sheet = book.worksheets.find(s => { let found = false; for (let i = 1; i <= Math.min(5, s.rowCount); i++) s.getRow(i).eachCell(c => { if (String(c.value ?? "").trim() === "cod_cadastro") found = true; }); return found; });
      if (!sheet) throw new Error("use a planilha baixada nesta aba");
      setPreview(validateSheet(sheet, rows, currentLists));
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function report(result = false) {
    try {
      const rows = result ? (outcomes ?? []).map(o => [o.row, o.code, o.name, o.status, o.changes ?? "", o.message]) : (preview?.products ?? []).flatMap(p => p.changes.map(c => [p.row, p.product.cod_cadastro, p.product.nome_comercial, p.product.fase, FIELD_LABELS[c.field], display(c.before), display(c.after), c.newKey && !selected.has(c.newKey) ? "Valor novo — não selecionado" : "Incluído"]));
      const headers = result ? ["Linha", "Código", "Nome", "Resultado", "Campos", "Mensagem"] : ["Linha", "Código", "Nome", "Fase", "Campo", "Antes", "Depois", "Seleção"];
      if (!result) rows.push(...(preview?.errors ?? []).map(e => [e.row, e.code, "", "", "ERRO", "", e.message, "Excluído"]));
      await downloadWorkbook(await reportWorkbook(headers, rows), `catalogo_fop_${result ? "resultado" : "previa"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }
  async function confirm() {
    if (!session || !lists || !preview || busy) return;
    setConfirmOpen(false); setBusy("Atualizando produtos");
    const result: Outcome[] = preview.errors.map(e => ({ row: e.row, code: e.code, name: "", status: "Erro de validação", message: e.message }));
    const failures = new Map<string, string>(); const canonical = new Map<string, string>();
    try {
      for (const value of preview.newValues.filter(v => selected.has(v.key))) {
        try { canonical.set(value.key, await createValue(value, lists)); } catch (e) { failures.set(value.key, e instanceof Error ? e.message : String(e)); }
      }
      for (let offset = 0; offset < effective.length; offset += 50) {
        const batch = effective.slice(offset, offset + 50);
        for (const p of batch) {
          const code = String(p.product.cod_cadastro); const name = String(p.product.nome_comercial ?? "");
          try {
            const failed = p.changes.find(c => c.newKey && failures.has(c.newKey)); if (failed?.newKey) throw new Error(failures.get(failed.newKey));
            const patch = Object.fromEntries(p.changes.map(c => [c.field, c.newKey ? canonical.get(c.newKey) ?? c.after : c.after]));
            await useCatalog.getState().saveProductFields(code, patch, { usuarioId: session.user.id, usuarioNome: profile?.nome_completo ?? profile?.login_amigavel ?? session.user.email ?? "—" }, filename);
            result.push({ row: p.row, code, name, status: "Atualizado", message: "", changes: p.changes.map(c => c.field).join(", ") });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            result.push({ row: p.row, code, name, status: message.startsWith("Produto atualizado; auditoria falhou:") ? "Atualizado com erro de auditoria" : "Erro", message });
          }
          setBusy(`Atualizando produtos · ${Math.min(offset + batch.indexOf(p) + 1, effective.length)}/${effective.length}`);
        }
      }
      setOutcomes(result); setPreview(null); await useCatalog.getState().hydrate({ force: true }); await refreshLists();
    } catch (e) { setOutcomes(result); toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }
  return <div className="space-y-6 py-5">
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label>Coleção</Label><Select value={collection} onValueChange={setCollection}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as coleções</SelectItem>{lists?.colecao.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Fase</Label><Select value={phase} onValueChange={setPhase}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{[["except_inactive", "Todos menos inativo"], ["all", "Todas as fases"], ["registrado", "Registrado"], ["pre_venda", "Pré-venda"], ["ativo", "Ativo"], ["inativo", "Inativo"]].map(([v, l]) => <SelectItem key={v} value={v ?? ""}>{l}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="outline" onClick={() => void download()} disabled={!!busy || !lists}><Download className="mr-2 h-4 w-4" />Baixar planilha</Button>
      <Button onClick={() => fileRef.current?.click()} disabled={!!busy || !lists}><Upload className="mr-2 h-4 w-4" />Subir e validar</Button>
      <Input ref={fileRef} type="file" accept=".xlsx" className="hidden" aria-label="Planilha do catálogo" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
    </div>
    {loadError && <div className="text-destructive">{loadError}<Button variant="outline" onClick={() => void refreshLists()} className="ml-3">Tentar novamente</Button></div>}
    {busy && <p role="status" className="flex items-center gap-2 text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
    {preview && <>
      <div className="flex flex-wrap gap-6 border-y border-border py-4 text-sm"><span><strong>{effective.length}</strong> produtos com mudança</span><span><strong>{fieldsCount}</strong> campos mudando</span><span><strong>{preview.errors.length}</strong> erros</span><span><strong>{preview.newValues.length}</strong> valores novos</span></div>
      <p className="text-sm text-text-secondary">{filename} · {preview.ignoredColumns} colunas ignoradas (Operações ou desconhecidas)</p>
      {preview.newValues.length > 0 && <section className="space-y-3"><h3 className="font-semibold">Valores novos</h3>{preview.newValues.map(v => <Label key={v.key} className="flex items-center gap-3"><Checkbox checked={selected.has(v.key)} disabled={!!busy} onCheckedChange={checked => setSelected(prev => { const next = new Set(prev); if (checked === true) next.add(v.key); else next.delete(v.key); return next; })} />Criar este valor: {FIELD_LABELS[v.kind]} — {v.nome}{v.kind === "grupo" && !v.categoriaId && <span className="text-destructive">Categoria não encontrada</span>}</Label>)}</section>}
      <div className="flex flex-wrap items-center gap-3"><Select value={field} onValueChange={setField}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os campos</SelectItem>{PRODUCT_FIELDS.filter(f => preview.products.some(p => p.changes.some(c => c.field === f))).map(f => <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void report()}><Download className="mr-2 h-4 w-4" />Baixar relatório da prévia</Button><Button disabled={!!busy || !effective.length} onClick={() => setConfirmOpen(true)}><Check className="mr-2 h-4 w-4" />Confirmar atualização</Button></div>
      {[true, false].map(active => <section key={String(active)}><h3 className="mb-3 font-semibold">{active ? "Ativos (vai para Shopify/Bling)" : "Não ativos"}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2 text-text-secondary"><tr>{["Código", "Nome atual", "Fase", "Campo", "Antes", "Depois"].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>{preview.products.filter(p => (p.product.fase === "ativo") === active).map(p => <tbody key={p.row} className="border-t border-border">{p.changes.filter(c => field === "all" || field === c.field).map((c, i) => <tr key={c.field} className={c.newKey && !selected.has(c.newKey) ? "text-text-muted" : "text-text-primary"}><td className="p-2 align-top">{i === 0 ? String(p.product.cod_cadastro) : ""}</td><td className="max-w-64 break-words p-2 align-top">{i === 0 ? String(p.product.nome_comercial ?? "") : ""}</td><td className="p-2 align-top">{i === 0 ? String(p.product.fase) : ""}</td><td className="p-2 align-top">{FIELD_LABELS[c.field]}</td><td className="max-w-72 break-words p-2 align-top">{display(c.before)}</td><td className="max-w-72 break-words p-2 align-top">{display(c.after)}{c.newKey && <span className="block text-xs">{selected.has(c.newKey) ? "Valor novo selecionado" : "Valor novo — não será gravado"}</span>}</td></tr>)}</tbody>)}</table></div></section>)}
      {preview.errors.length > 0 && <section><h3 className="mb-2 font-semibold text-destructive">Erros de validação</h3><ul className="space-y-2 text-sm">{preview.errors.map((e, i) => <li key={i}>Linha {e.row} · {e.code}: {e.message}</li>)}</ul></section>}
      {!preview.products.length && <p>Não há mudanças válidas nesta planilha.</p>}
    </>}
    {outcomes && <section className="space-y-3"><h3 className="font-semibold">Resultado</h3><p>{outcomes.filter(o => o.status.startsWith("Atualizado")).length} atualizados / {outcomes.filter(o => o.status !== "Atualizado").length} com erro</p><Button variant="outline" onClick={() => void report(true)}><Download className="mr-2 h-4 w-4" />Baixar resultado</Button><ul className="divide-y divide-border">{outcomes.map((o, i) => <li key={i} className="py-2 text-sm">Linha {o.row} · {o.code} · {o.name} — <span className={o.status === "Atualizado" ? "text-stock-in" : "text-destructive"}>{o.status}</span>{o.message && <p className="break-words text-destructive">{o.message}</p>}</li>)}</ul></section>}
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent><DialogHeader><DialogTitle>Atualizar {effective.length} produtos / {fieldsCount} campos?</DialogTitle><DialogDescription>{filename} · {selected.size} valores novos selecionados. Fase e campos de Operações permanecem sem alteração.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => void confirm()} disabled={!!busy}>Atualizar produtos</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}