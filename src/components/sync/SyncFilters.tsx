import type { SncfStatus } from "@/hooks/useSyncManagement";

export interface SyncFilters {
  statuses: SncfStatus[];
  vendedorId: string | null;
  periodo: "hoje" | "7d" | "30d" | "tudo";
}

interface VendedorOpt {
  id: string;
  nome: string;
}

const STATUSES: { key: SncfStatus; label: string }[] = [
  { key: "nao_enviado", label: "Não enviado" },
  { key: "pendente", label: "Pendente" },
  { key: "rejeitado", label: "Rejeitado" },
  { key: "erro_persistente", label: "Erro técnico" },
  { key: "enviado", label: "Enviado" },
];

export function SyncFiltersBar({
  value,
  onChange,
  vendedores,
  onRefresh,
}: {
  value: SyncFilters;
  onChange: (v: SyncFilters) => void;
  vendedores: VendedorOpt[];
  onRefresh: () => void;
}) {
  const toggleStatus = (s: SncfStatus) => {
    const set = new Set(value.statuses);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    onChange({ ...value, statuses: Array.from(set) });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUSES.map((s) => {
          const active = value.statuses.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleStatus(s.key)}
              className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition ${
                active
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border text-text-secondary hover:border-gold/40"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <select
        value={value.vendedorId ?? ""}
        onChange={(e) =>
          onChange({ ...value, vendedorId: e.target.value || null })
        }
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
      >
        <option value="">Todos vendedores</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nome}
          </option>
        ))}
      </select>

      <select
        value={value.periodo}
        onChange={(e) =>
          onChange({ ...value, periodo: e.target.value as SyncFilters["periodo"] })
        }
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
      >
        <option value="hoje">Hoje</option>
        <option value="7d">Últimos 7 dias</option>
        <option value="30d">Últimos 30 dias</option>
        <option value="tudo">Tudo</option>
      </select>

      <button
        type="button"
        onClick={() => onRefresh()}
        className="rounded-md border border-gold/40 px-3 py-1.5 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/10"
      >
        Recarregar
      </button>
    </div>
  );
}
