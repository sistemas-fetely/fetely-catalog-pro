import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { normalizeKey, estimateBytes } from "@/lib/image";

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};
const safeStorage = (): Storage =>
  typeof window !== "undefined" ? window.localStorage : noopStorage;

interface PhotoState {
  colecoes: Record<string, string>;
  produtos: Record<string, string>;
  setColecaoPhoto: (colecao: string, dataUrl: string) => void;
  removeColecaoPhoto: (colecao: string) => void;
  setProdutoPhoto: (colecao: string, cor: string, dataUrl: string) => void;
  removeProdutoPhoto: (colecao: string, cor: string) => void;
  clearAll: () => void;
}

export const usePhotos = create<PhotoState>()(
  persist(
    (set) => ({
      colecoes: {},
      produtos: {},
      setColecaoPhoto: (colecao, dataUrl) =>
        set((s) => ({ colecoes: { ...s.colecoes, [normalizeKey(colecao)]: dataUrl } })),
      removeColecaoPhoto: (colecao) =>
        set((s) => {
          const k = normalizeKey(colecao);
          const next = { ...s.colecoes };
          delete next[k];
          return { colecoes: next };
        }),
      setProdutoPhoto: (colecao, cor, dataUrl) =>
        set((s) => ({
          produtos: {
            ...s.produtos,
            [`${normalizeKey(colecao)}__${normalizeKey(cor)}`]: dataUrl,
          },
        })),
      removeProdutoPhoto: (colecao, cor) =>
        set((s) => {
          const k = `${normalizeKey(colecao)}__${normalizeKey(cor)}`;
          const next = { ...s.produtos };
          delete next[k];
          return { produtos: next };
        }),
      clearAll: () => set({ colecoes: {}, produtos: {} }),
    }),
    { name: "fetely_photos", storage: createJSONStorage(safeStorage) },
  ),
);

export function getColecaoPhoto(
  state: { colecoes: Record<string, string> },
  colecao: string,
): string | undefined {
  return state.colecoes[normalizeKey(colecao)];
}

export function getProdutoPhoto(
  state: { colecoes: Record<string, string>; produtos: Record<string, string> },
  colecao: string,
  cor: string,
): string | undefined {
  const key = `${normalizeKey(colecao)}__${normalizeKey(cor)}`;
  return state.produtos[key] ?? state.colecoes[normalizeKey(colecao)];
}

export function photoStorageBytes(state: {
  colecoes: Record<string, string>;
  produtos: Record<string, string>;
}): number {
  let total = 0;
  for (const v of Object.values(state.colecoes)) total += estimateBytes(v);
  for (const v of Object.values(state.produtos)) total += estimateBytes(v);
  return total;
}
