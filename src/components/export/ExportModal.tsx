import { useMemo, useState } from "react";
import { Download, X, FileText, Table as TableIcon, Braces, Archive } from "lucide-react";
import type { SavedOrder } from "@/types";
import {
  buildPedidoExportavel,
  exportarPDF,
  exportarCSV,
  exportarJSON,
  exportarZIP,
  DEFAULT_OPTIONS,
  type ExportOptions,
} from "@/lib/exporter";
import { useAuth } from "@/store/authStore";
import { formatBRL } from "@/lib/format";

type Formato =
  | "pdf_cliente"
  | "pdf_interno"
  | "csv"
  | "json"
  | "lote_csv_unico"
  | "lote_csv_zip"
  | "lote_pdf_zip"
  | "lote_json";

export function ExportModal({
  orders,
  onClose,
}: {
  orders: SavedOrder[];
  onClose: () => void;
}) {
  const isBatch = orders.length > 1;
  const isAdminOrMaster = useAuth(
    (s) => s.roles.includes("admin") || s.roles.includes("master"),
  );

  const [formato, setFormato] = useState<Formato>(isBatch ? "lote_csv_unico" : "pdf_cliente");
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);

  const totalLote = useMemo(
    () => orders.reduce((s, o) => s + o.total, 0),
    [orders],
  );

  const handleExport = async () => {
    setBusy(true);
    try {
      const pedidos = orders.map(buildPedidoExportavel);
      if (formato === "pdf_cliente") exportarPDF(pedidos[0], "cliente", opts);
      else if (formato === "pdf_interno") exportarPDF(pedidos[0], "interno", opts);
      else if (formato === "csv") exportarCSV(pedidos);
      else if (formato === "json") exportarJSON(pedidos);
      else if (formato === "lote_csv_unico") {
        const header = `FETÉLY B2B ORDERS — Exportação em lote\nPedidos: ${pedidos.length} | Total líquido: ${formatBRL(totalLote)}\nGerado em: ${new Date().toLocaleString("pt-BR")}`;
        exportarCSV(pedidos, header);
      } else if (formato === "lote_csv_zip") await exportarZIP(pedidos, "csv", opts);
      else if (formato === "lote_pdf_zip") await exportarZIP(pedidos, "pdf", opts, "cliente");
      else if (formato === "lote_json") exportarJSON(pedidos);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-lg border border-gold/40 bg-surface p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold">
              <Download className="h-3 w-3" /> Exportar
            </div>
            <h3 className="font-display text-2xl mt-1">
              {isBatch ? `${orders.length} pedidos selecionados` : `Pedido ${orders[0].id}`}
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              {isBatch
                ? `Total: ${formatBRL(totalLote)}`
                : `${orders[0].meta.cliente || "—"} · ${formatBRL(orders[0].total)}`}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Formato</div>
          {!isBatch ? (
            <>
              <RadioOpt
                icon={<FileText className="h-4 w-4" />}
                label="PDF — Resumo do pedido"
                hint="Para enviar ao cliente"
                value="pdf_cliente"
                current={formato}
                onChange={setFormato}
              />
              {isAdminOrMaster && (
                <RadioOpt
                  icon={<FileText className="h-4 w-4" />}
                  label="PDF — Pedido interno"
                  hint="Com dados de custo e negociação"
                  value="pdf_interno"
                  current={formato}
                  onChange={setFormato}
                />
              )}
              <RadioOpt
                icon={<TableIcon className="h-4 w-4" />}
                label="CSV — Planilha completa"
                hint="ERP / Excel"
                value="csv"
                current={formato}
                onChange={setFormato}
              />
              <RadioOpt
                icon={<Braces className="h-4 w-4" />}
                label="JSON — Dados estruturados"
                hint="Integração / Mercos"
                value="json"
                current={formato}
                onChange={setFormato}
              />
            </>
          ) : (
            <>
              <RadioOpt
                icon={<TableIcon className="h-4 w-4" />}
                label="CSV único"
                hint="Todos os pedidos em uma planilha"
                value="lote_csv_unico"
                current={formato}
                onChange={setFormato}
              />
              <RadioOpt
                icon={<Archive className="h-4 w-4" />}
                label="CSV separado por pedido (.zip)"
                value="lote_csv_zip"
                current={formato}
                onChange={setFormato}
              />
              <RadioOpt
                icon={<Archive className="h-4 w-4" />}
                label="PDF por pedido (.zip)"
                value="lote_pdf_zip"
                current={formato}
                onChange={setFormato}
              />
              <RadioOpt
                icon={<Braces className="h-4 w-4" />}
                label="JSON — array de pedidos"
                value="lote_json"
                current={formato}
                onChange={setFormato}
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Opções</div>
          <CheckOpt
            label="Incluir dados do vendedor"
            checked={opts.incluirVendedor}
            onChange={(v) => setOpts({ ...opts, incluirVendedor: v })}
          />
          <CheckOpt
            label="Incluir endereço de entrega"
            checked={opts.incluirEnderecoEntrega}
            onChange={(v) => setOpts({ ...opts, incluirEnderecoEntrega: v })}
          />
          <CheckOpt
            label="Incluir especificações técnicas (EAN, NCM, dimensões)"
            checked={opts.incluirEspecsTecnicas}
            onChange={(v) => setOpts({ ...opts, incluirEspecsTecnicas: v })}
          />
          <CheckOpt
            label="Incluir detalhamento de descontos"
            checked={opts.incluirDetalhamentoDescontos}
            onChange={(v) => setOpts({ ...opts, incluirDetalhamentoDescontos: v })}
          />
          {isAdminOrMaster && (
            <CheckOpt
              label="Incluir observações internas (não recomendado p/ cliente)"
              checked={opts.incluirObservacoesInternas}
              onChange={(v) => setOpts({ ...opts, incluirObservacoesInternas: v })}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {busy ? "Gerando..." : "Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RadioOpt<T extends string>({
  icon, label, hint, value, current, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`w-full flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition ${
        active ? "border-gold bg-gold/10" : "border-border hover:bg-surface-2"
      }`}
    >
      <span className={active ? "text-gold" : "text-text-muted"}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-text-muted">{hint}</span>}
      </span>
      <span
        className={`h-3.5 w-3.5 rounded-full border ${
          active ? "border-gold bg-gold" : "border-border"
        }`}
      />
    </button>
  );
}

function CheckOpt({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-gold h-4 w-4"
      />
      <span className="text-text-secondary">{label}</span>
    </label>
  );
}
