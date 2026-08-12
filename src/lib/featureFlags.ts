// Feature flags do módulo de Reuniões / Catálogo público.
// Fonte da verdade: tabela `feature_flags` (RLS: leitura livre, escrita admin/master).
// LocalStorage pode sobrescrever (para testes A/B locais / preview).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeStorage";

const LS_OVERRIDE = "fetely_feature_flags";

export interface FeatureFlags {
  GATE_ENTRADA_ATIVO: boolean;
}

const DEFAULTS: FeatureFlags = {
  GATE_ENTRADA_ATIVO: true,
};

function readOverride(): Partial<FeatureFlags> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_OVERRIDE);
    return raw ? (JSON.parse(raw) as Partial<FeatureFlags>) : {};
  } catch {
    return {};
  }
}

export function setFeatureFlagOverride(patch: Partial<FeatureFlags>): void {
  if (typeof window === "undefined") return;
  const current = { ...readOverride(), ...patch };
  safeLocalStorage.setItem(LS_OVERRIDE, JSON.stringify(current));
}

export function clearFeatureFlagOverride(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_OVERRIDE);
}

/** Snapshot síncrono (usa override local; se ausente, fallback DEFAULTS). */
export function getFeatureFlagsSync(): FeatureFlags {
  return { ...DEFAULTS, ...readOverride() };
}

/** Hook: lê flags do banco (com fallback local). */
export function useFeatureFlags(): { flags: FeatureFlags; loading: boolean; reload: () => void } {
  const [flags, setFlags] = useState<FeatureFlags>(() => getFeatureFlagsSync());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("key, enabled")
          .in("key", ["GATE_ENTRADA_ATIVO"]);
        if (error) throw error;
        if (cancel) return;
        const dbFlags: Partial<FeatureFlags> = {};
        for (const row of data ?? []) {
          if (row.key === "GATE_ENTRADA_ATIVO") dbFlags.GATE_ENTRADA_ATIVO = !!row.enabled;
        }
        setFlags({ ...DEFAULTS, ...dbFlags, ...readOverride() });
      } catch (e) {
        console.warn("[featureFlags] load falhou", e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tick]);

  return { flags, loading, reload: () => setTick((t) => t + 1) };
}

/** Escreve flag no banco (apenas admin/master via RLS). */
export async function updateFeatureFlag(key: keyof FeatureFlags, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("feature_flags")
    .upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw error;
}
