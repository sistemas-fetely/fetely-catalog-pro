import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { useCatalog } from "@/store/catalogStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";

export function ProdutoThumb({ colecao, corNome, sku, nome, tamanho = 40 }: {
  colecao: string | null; corNome: string | null; sku: string; nome: string; tamanho?: 40 | 64;
}) {
  const photos = usePhotos();
  const produto = useCatalog(s => s.products.find(p => p.sku === sku || p.codCadastro === sku));
  const col = colecao || produto?.colecao;
  const cor = corNome || produto?.corNome;
  const foto = col ? getProdutoPhoto(photos, col, sku) ?? getProdutoPhoto(photos, col, produto?.sku ?? "") ?? getProdutoPhoto(photos, col, cor ?? "") : undefined;
  const classe = tamanho === 64 ? "h-16 w-16 shrink-0 rounded object-cover" : "h-10 w-10 shrink-0 rounded object-cover";
  return foto ? <img loading="lazy" decoding="async" src={foto} alt={nome} className={classe} /> :
    <PhotoPlaceholder colecao={col ?? nome} label={nome} className={classe} showIcon={false} />;
}