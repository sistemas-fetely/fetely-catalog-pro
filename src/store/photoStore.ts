import { create } from "zustand";
import { normalizeKey } from "@/lib/image";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-photos";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

interface PhotoState {
  colecoes: Record<string, string>; // normalized colecao -> public url
  produtos: Record<string, string>; // `${nc}__${ncor}` -> public url
  paths: Record<string, string>; // same keys -> storage path (for delete)
  loaded: boolean;
  loading: boolean;
  fetchAll: () => Promise<void>;
  setColecaoPhoto: (colecao: string, dataUrl: string) => Promise<void>;
  removeColecaoPhoto: (colecao: string) => Promise<void>;
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
      .select("kind, colecao, cor, url, path");
    if (error) {
      console.error("photos fetch error", error);
      set({ loading: false });
      return;
    }
    const colecoes: Record<string, string> = {};
    const produtos: Record<string, string> = {};
    const paths: Record<string, string> = {};
    for (const row of data ?? []) {
      const nc = normalizeKey(row.colecao);
      if (row.kind === "colecao") {
        colecoes[nc] = row.url;
        paths[`c:${nc}`] = row.path;
      } else if (row.kind === "produto" && row.cor) {
        const key = `${nc}__${normalizeKey(row.cor)}`;
        produtos[key] = row.url;
        paths[`p:${key}`] = row.path;
      }
    }
    set({ colecoes, produtos, paths, loaded: true, loading: false });
  },

  setColecaoPhoto: async (colecao, dataUrl) => {
    const nc = normalizeKey(colecao);
    const path = `colecoes/${nc}-${Date.now()}.jpg`;
    const blob = await dataUrlToBlob(dataUrl);
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw up.error;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    // Remove old file if exists
    const oldPath = get().paths[`c:${nc}`];

    const { error } = await supabase
      .from("photos")
      .upsert(
        { kind: "colecao", colecao, cor: null, url, path },
        { onConflict: "colecao", ignoreDuplicates: false },
      );
    // The unique partial index requires a manual merge since onConflict doesn't match partial indexes
    if (error) {
      // Fallback: delete existing then insert
      await supabase.from("photos").delete().eq("kind", "colecao").eq("colecao", colecao);
      const ins = await supabase
        .from("photos")
        .insert({ kind: "colecao", colecao, cor: null, url, path });
      if (ins.error) throw ins.error;
    }

    if (oldPath && oldPath !== path) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    set((s) => ({
      colecoes: { ...s.colecoes, [nc]: url },
      paths: { ...s.paths, [`c:${nc}`]: path },
    }));
  },

  removeColecaoPhoto: async (colecao) => {
    const nc = normalizeKey(colecao);
    const path = get().paths[`c:${nc}`];
    await supabase.from("photos").delete().eq("kind", "colecao").eq("colecao", colecao);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    set((s) => {
      const colecoes = { ...s.colecoes };
      delete colecoes[nc];
      const paths = { ...s.paths };
      delete paths[`c:${nc}`];
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
      produtos: { ...s.produtos, [key]: url },
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
): string | undefined {
  return state.colecoes[normalizeKey(colecao)];
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
  // Photos now live in remote storage; local usage not tracked.
  return 0;
}
