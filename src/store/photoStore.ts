import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { normalizeKey, proxiedPhotoUrl } from "@/lib/image";
import { supabase } from "@/integrations/supabase/client";
import { createSafeStorage } from "@/lib/safeStorage";

const BUCKET = "product-photos";
// Fotos mudam raramente — revalida no máximo a cada 10 min por sessão/dispositivo.
const PHOTOS_TTL = 10 * 60_000;

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function colKey(colecao: string, categoria?: string | null): string {
  const nc = normalizeKey(colecao);
  const ncat = categoria ? normalizeKey(categoria) : "";
  return ncat ? `${nc}__${ncat}` : nc;
}

interface PhotoState {
  colecoes: Record<string, string>; // `${nc}` ou `${nc}__${ncat}` -> public url
  produtos: Record<string, string>; // `${nc}__${ncor}` -> public url
  paths: Record<string, string>;
  loaded: boolean;
  loading: boolean;
  fetchedAt: number;
  fetchAll: (force?: boolean) => Promise<void>;
  setColecaoPhoto: (colecao: string, categoria: string | null, dataUrl: string) => Promise<void>;
  removeColecaoPhoto: (colecao: string, categoria: string | null) => Promise<void>;
  setProdutoPhoto: (colecao: string, cor: string, dataUrl: string) => Promise<void>;
  removeProdutoPhoto: (colecao: string, cor: string) => Promise<void>;
}

export const usePhotos = create<PhotoState>()((set, get) => ({
  colecoes: {},
  produtos: {},
  paths: {},
  loaded: false,
  loading: false,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from("photos")
      .select("kind, colecao, categoria, cor, url, path");
    if (error) {
      console.error("photos fetch error", error);
      set({ loading: false });
      return;
    }
    const colecoes: Record<string, string> = {};
    const produtos: Record<string, string> = {};
    const paths: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.kind === "colecao") {
        const k = colKey(row.colecao, (row as any).categoria);
        colecoes[k] = proxiedPhotoUrl(row.url)!;
        paths[`c:${k}`] = row.path;
      } else if (row.kind === "produto" && row.cor) {
        const nc = normalizeKey(row.colecao);
        const key = `${nc}__${normalizeKey(row.cor)}`;
        produtos[key] = proxiedPhotoUrl(row.url)!;
        paths[`p:${key}`] = row.path;
      }
    }
    set({ colecoes, produtos, paths, loaded: true, loading: false });
  },

  setColecaoPhoto: async (colecao, categoria, dataUrl) => {
    const k = colKey(colecao, categoria);
    const path = `colecoes/${k}-${Date.now()}.jpg`;
    const blob = await dataUrlToBlob(dataUrl);
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw up.error;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    const oldPath = get().paths[`c:${k}`];

    // Delete existing row for this (colecao, categoria) then insert
    let del = supabase
      .from("photos")
      .delete()
      .eq("kind", "colecao")
      .eq("colecao", colecao);
    del = categoria ? del.eq("categoria", categoria) : del.is("categoria", null);
    await del;
    const ins = await supabase
      .from("photos")
      .insert({ kind: "colecao", colecao, categoria, cor: null, url, path });
    if (ins.error) throw ins.error;

    if (oldPath && oldPath !== path) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    set((s) => ({
      colecoes: { ...s.colecoes, [k]: proxiedPhotoUrl(url)! },
      paths: { ...s.paths, [`c:${k}`]: path },
    }));
  },

  removeColecaoPhoto: async (colecao, categoria) => {
    const k = colKey(colecao, categoria);
    const path = get().paths[`c:${k}`];
    let del = supabase
      .from("photos")
      .delete()
      .eq("kind", "colecao")
      .eq("colecao", colecao);
    del = categoria ? del.eq("categoria", categoria) : del.is("categoria", null);
    await del;
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    set((s) => {
      const colecoes = { ...s.colecoes };
      delete colecoes[k];
      const paths = { ...s.paths };
      delete paths[`c:${k}`];
      return { colecoes, paths };
    });
  },

  setProdutoPhoto: async (colecao, cor, dataUrl) => {
    const nc = normalizeKey(colecao);
    const ncor = normalizeKey(cor);
    const key = `${nc}__${ncor}`;
    const path = `produtos/${key}-${Date.now()}.jpg`;
    const blob = await dataUrlToBlob(dataUrl);
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw up.error;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    const oldPath = get().paths[`p:${key}`];

    await supabase
      .from("photos")
      .delete()
      .eq("kind", "produto")
      .eq("colecao", colecao)
      .eq("cor", cor);
    const ins = await supabase
      .from("photos")
      .insert({ kind: "produto", colecao, cor, url, path });
    if (ins.error) throw ins.error;

    if (oldPath && oldPath !== path) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    set((s) => ({
      produtos: { ...s.produtos, [key]: proxiedPhotoUrl(url)! },
      paths: { ...s.paths, [`p:${key}`]: path },
    }));
  },

  removeProdutoPhoto: async (colecao, cor) => {
    const nc = normalizeKey(colecao);
    const ncor = normalizeKey(cor);
    const key = `${nc}__${ncor}`;
    const path = get().paths[`p:${key}`];
    await supabase
      .from("photos")
      .delete()
      .eq("kind", "produto")
      .eq("colecao", colecao)
      .eq("cor", cor);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    set((s) => {
      const produtos = { ...s.produtos };
      delete produtos[key];
      const paths = { ...s.paths };
      delete paths[`p:${key}`];
      return { produtos, paths };
    });
  },
}));

export function getColecaoPhoto(
  state: { colecoes: Record<string, string> },
  colecao: string,
  categoria?: string | null,
): string | undefined {
  const nc = normalizeKey(colecao);
  if (categoria) {
    const specific = state.colecoes[`${nc}__${normalizeKey(categoria)}`];
    if (specific) return specific;
  }
  return state.colecoes[nc];
}

export function getProdutoPhoto(
  state: { colecoes?: Record<string, string>; produtos: Record<string, string> },
  colecao: string,
  cor: string,
): string | undefined {
  const key = `${normalizeKey(colecao)}__${normalizeKey(cor)}`;
  return state.produtos[key];
}

export function photoStorageBytes(_state: unknown): number {
  return 0;
}
