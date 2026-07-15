// Feature flags do módulo de Reuniões / Catálogo público.
// Fatia 2: gate leve de identidade antes do catálogo.
// A UI de A/B (Fatia 4) irá sobrepor via localStorage; aqui ficam os defaults.

const LS_OVERRIDE = "fetely_feature_flags";

export interface FeatureFlags {
  /** Exige nome + whatsapp antes de abrir o catálogo público. */
  GATE_ENTRADA_ATIVO: boolean;
}

const DEFAULTS: FeatureFlags = {
  GATE_ENTRADA_ATIVO: true,
};

export function getFeatureFlags(): FeatureFlags {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(LS_OVERRIDE);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function setFeatureFlagOverride(patch: Partial<FeatureFlags>): void {
  if (typeof window === "undefined") return;
  const current = getFeatureFlags();
  localStorage.setItem(LS_OVERRIDE, JSON.stringify({ ...current, ...patch }));
}
