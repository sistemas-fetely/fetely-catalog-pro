/**
 * Armazenamento local resiliente a "The quota has been exceeded".
 *
 * Alguns usuários acumulam caches grandes (catálogo, provisões, clientes) e o
 * localStorage estoura. Sem tratamento, o erro é lançado no meio do fluxo de
 * salvar pedido/cotação/provisão e aborta a operação. Aqui nunca lançamos:
 * na falta de espaço liberamos caches descartáveis e tentamos de novo; se
 * ainda não couber, apenas não persistimos (dados vivem no banco).
 */

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

/** Caches recriáveis a partir do banco — podem ser descartados sob pressão. */
const DISPOSABLE_KEYS = [
  "fetely-catalog",
  "fetely_pre_selecoes_v1",
  "fetely_leads_feira_v1",
  "fetely-duplicacao-v1",
  "fetely_provisoes_v1",
  "fetely_clientes_v1",
  "fetely-cartilhas",
];

function isQuotaError(err: unknown): boolean {
  const name = (err as { name?: string } | undefined)?.name ?? "";
  const msg = String((err as { message?: string } | undefined)?.message ?? err ?? "");
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(msg)
  );
}

function evict(ls: Storage, protectKey: string) {
  for (const k of DISPOSABLE_KEYS) {
    if (k === protectKey) continue;
    try {
      if (ls.getItem(k) !== null) ls.removeItem(k);
    } catch {
      /* noop */
    }
  }
}

export function createSafeStorage(): Storage {
  if (typeof window === "undefined") return noopStorage;
  let ls: Storage;
  try {
    ls = window.localStorage;
  } catch {
    return noopStorage;
  }

  return {
    get length() {
      try {
        return ls.length;
      } catch {
        return 0;
      }
    },
    clear: () => {
      try {
        ls.clear();
      } catch {
        /* noop */
      }
    },
    key: (i: number) => {
      try {
        return ls.key(i);
      } catch {
        return null;
      }
    },
    getItem: (k: string) => {
      try {
        return ls.getItem(k);
      } catch {
        return null;
      }
    },
    removeItem: (k: string) => {
      try {
        ls.removeItem(k);
      } catch {
        /* noop */
      }
    },
    setItem: (k: string, v: string) => {
      try {
        ls.setItem(k, v);
        return;
      } catch (err) {
        if (!isQuotaError(err)) return;
      }
      // 1) descarta a própria entrada antiga e tenta de novo
      try {
        ls.removeItem(k);
        ls.setItem(k, v);
        return;
      } catch {
        /* segue */
      }
      // 2) libera caches recriáveis e tenta de novo
      try {
        evict(ls, k);
        ls.setItem(k, v);
        return;
      } catch {
        console.warn(`[safeStorage] sem espaço para "${k}"; persistência ignorada`);
      }
    },
  } as Storage;
}

/** Versão avulsa para código que usa localStorage direto. */
export const safeLocalStorage = createSafeStorage();
