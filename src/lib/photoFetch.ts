// Downloads in bulk failed intermittently and left exports without photos:
// retry each photo, falling back to the direct storage address.
export function directStorageUrl(url: string): string | null {
  const m = url.match(/\/api\/public\/img\?path=([^&]+)/);
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!m?.[1] || !base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${decodeURIComponent(m[1])}`;
}

export async function withPhotoRetry<R>(url: string, once: (u: string) => Promise<R | null>): Promise<R | null> {
  const direct = directStorageUrl(url);
  const tries = [url, url, direct, direct].filter((u): u is string => !!u);
  for (let i = 0; i < tries.length; i++) {
    const r = await once(tries[i]!);
    if (r) return r;
    if (i < tries.length - 1) await new Promise((ok) => setTimeout(ok, 300 * (i + 1)));
  }
  return null;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}
