import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Loader2, RefreshCw, Search, X } from "lucide-react";
import { balcao } from "@/hooks/useBalcao";
import { useAuth } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  colecoesEstoque, filtrarEstoque, normalizarBuscaEstoque, ordenarEstoque, resumoEstoque,
  type BalcaoEstoqueResposta, type OrdenacaoEstoque,
} from "@/lib/balcaoEstoque";

type CdInfo = { codigo: string; rotulo: string; padrao: boolean };
const numero = (valor: number) => valor.toLocaleString("pt-BR");

export function EstoqueTab({ cdPadrao }: { cdPadrao: CdInfo }) {
  const userId = useAuth((s) => s.user?.id);
  const [centroCodigo, setCentroCodigo] = useState(cdPadrao.codigo);
  const [busca, setBusca] = useState("");
  const [buscaColecao, setBuscaColecao] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<OrdenacaoEstoque>({ campo: "nome", direcao: "asc" });

  const cds = useQuery({
    queryKey: ["balcao", "cds", userId],
    queryFn: () => balcao<{ cds: CdInfo[] }>("balcao_cds"),
    enabled: !!userId,
    staleTime: 10 * 60_000,
    throwOnError: false,
    retry: false,
  });
  const estoque = useQuery({
    queryKey: ["balcao", "estoque", userId, centroCodigo],
    queryFn: () => balcao<BalcaoEstoqueResposta>("balcao_estoque", { centro_codigo: centroCodigo }),
    enabled: !!userId,
    throwOnError: false,
    retry: false,
  });

  const listaCds = cds.data?.cds?.length ? cds.data.cds : [cdPadrao];
  const linhas = useMemo(() => estoque.data?.linhas ?? [], [estoque.data]);
  const colecoes = useMemo(() => colecoesEstoque(linhas), [linhas]);
  const colecoesVisiveis = useMemo(() => {
    const termo = normalizarBuscaEstoque(buscaColecao);
    return colecoes.filter((colecao) => normalizarBuscaEstoque(`${colecao.nome} ${colecao.codigo}`).includes(termo));
  }, [colecoes, buscaColecao]);
  const filtradas = useMemo(() => filtrarEstoque(linhas, busca, selecionadas), [linhas, busca, selecionadas]);
  const ordenadas = useMemo(() => ordenarEstoque(filtradas, ordem), [filtradas, ordem]);
  const resumo = useMemo(() => resumoEstoque(filtradas), [filtradas]);
  const carregando = estoque.isPending;
  const atualizando = estoque.isFetching || cds.isFetching;
  const mostrarResumo = !carregando && !estoque.error;

  const atualizar = () => {
    void estoque.refetch();
    if (cds.error) void cds.refetch();
  };
  const trocarCd = (codigo: string) => {
    setCentroCodigo(codigo);
    setSelecionadas([]);
    setBuscaColecao("");
  };
  const alternarColecao = (chave: string) => {
    setSelecionadas((atual) => atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]);
  };
  const ordenarPor = (campo: OrdenacaoEstoque["campo"]) => {
    setOrdem((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
  };
  const iconeOrdem = (campo: OrdenacaoEstoque["campo"]) => {
    if (ordem.campo !== campo) return <ArrowUpDown aria-hidden="true" className="h-4 w-4" />;
    return ordem.direcao === "asc"
      ? <ArrowUp aria-hidden="true" className="h-4 w-4" />
      : <ArrowDown aria-hidden="true" className="h-4 w-4" />;
  };
  const ariaOrdem = (campo: OrdenacaoEstoque["campo"]) => ordem.campo !== campo ? "none" as const
    : ordem.direcao === "asc" ? "ascending" as const : "descending" as const;

  return (
    <section aria-label="Estoque B2C" className="min-w-0 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2 sm:flex-none">
          <Label htmlFor="estoque-cd">CD</Label>
          <Select value={centroCodigo} onValueChange={trocarCd}>
            <SelectTrigger id="estoque-cd" className="h-11 w-full sm:w-72" aria-label="CD do estoque">
              <SelectValue placeholder="Selecione o CD" />
            </SelectTrigger>
            <SelectContent>
              {listaCds.map((c) => (
                <SelectItem key={c.codigo} value={c.codigo}>
                  {c.rotulo}{c.padrao ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="h-11 shrink-0" disabled={atualizando || !userId} onClick={atualizar}>
          <RefreshCw aria-hidden="true" className={atualizando ? "motion-safe:animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      {cds.error && (
        <div role="alert" className="rounded-md border border-border p-3 text-sm text-text-primary">
          {cds.error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 border-y border-border py-4" aria-live="polite" aria-busy={estoque.isFetching}>
        <div>
          <p className="text-sm text-text-secondary">SKUs com saldo</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{mostrarResumo ? numero(resumo.skus) : "—"}</p>
        </div>
        <div>
          <p className="text-sm text-text-secondary">Unidades disponíveis</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{mostrarResumo ? numero(resumo.unidades) : "—"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input aria-label="Buscar estoque por SKU, código ou nome" className="h-11 pl-9" placeholder="Buscar por SKU, código ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Popover onOpenChange={(aberto) => { if (!aberto) setBuscaColecao(""); }}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 w-full justify-between sm:w-64" aria-label="Filtrar por coleções" disabled={carregando || !!estoque.error}>
              <span>{selecionadas.length ? `Coleções (${selecionadas.length})` : "Todas as coleções"}</span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-text-secondary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
            <div className="relative border-b border-border p-2">
              <Search aria-hidden="true" className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <Input aria-label="Buscar coleção" placeholder="Buscar coleção" className="h-11 pl-9" value={buscaColecao} onChange={(e) => setBuscaColecao(e.target.value)} />
            </div>
            <div role="group" aria-label="Coleções do estoque" className="max-h-72 overflow-y-auto p-2">
              {colecoesVisiveis.length === 0 ? (
                <p className="px-2 py-4 text-sm text-text-secondary">Nenhuma coleção encontrada.</p>
              ) : colecoesVisiveis.map((colecao) => (
                <label key={colecao.chave} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-muted">
                  <Checkbox aria-label={colecao.nome} checked={selecionadas.includes(colecao.chave)} onCheckedChange={() => alternarColecao(colecao.chave)} />
                  <span className="min-w-0 flex-1 break-words text-sm">{colecao.nome}</span>
                  <span className="shrink-0 text-xs tabular-nums text-text-secondary">{numero(colecao.quantidade)} SKU{colecao.quantidade === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
            {selecionadas.length > 0 && (
              <div className="border-t border-border p-2">
                <Button variant="ghost" className="h-11 w-full" onClick={() => setSelecionadas([])}>
                  <X aria-hidden="true" />Limpar seleção
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {estoque.error ? (
        <div role="alert" className="space-y-3 rounded-md border border-border p-4 text-sm text-text-primary">
          <p className="break-words">{estoque.error.message}</p>
          <Button variant="outline" className="h-11" disabled={estoque.isFetching} onClick={() => void estoque.refetch()}>
            <RefreshCw aria-hidden="true" className={estoque.isFetching ? "motion-safe:animate-spin" : ""} />
            Tentar novamente
          </Button>
        </div>
      ) : carregando ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-text-secondary">
          <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />Carregando estoque…
        </div>
      ) : ordenadas.length === 0 ? (
        <p role="status" className="py-12 text-center text-sm text-text-secondary">Nenhum produto com saldo neste recorte</p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="table-fixed" aria-label="Estoque por produto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead className="w-[38%]" aria-sort={ariaOrdem("nome")}>
                    <Button variant="ghost" className="-ml-3" aria-label="Ordenar por nome" onClick={() => ordenarPor("nome")}>Nome{iconeOrdem("nome")}</Button>
                  </TableHead>
                  <TableHead aria-sort={ariaOrdem("colecao")}>
                    <Button variant="ghost" className="-ml-3" aria-label="Ordenar por coleção" onClick={() => ordenarPor("colecao")}>Coleção{iconeOrdem("colecao")}</Button>
                  </TableHead>
                  <TableHead className="w-36 text-right" aria-sort={ariaOrdem("disponivel")}>
                    <Button variant="ghost" className="-mr-3" aria-label="Ordenar por disponível" onClick={() => ordenarPor("disponivel")}>Disponível{iconeOrdem("disponivel")}</Button>
                  </TableHead>
                  <TableHead className="w-28 text-right">Reservado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenadas.map((linha) => (
                  <TableRow key={linha.sku}>
                    <TableCell className="break-words tabular-nums text-text-secondary">{linha.cod_cadastro || "—"}</TableCell>
                    <TableCell className="break-words py-4 font-medium text-text-primary">{linha.nome}</TableCell>
                    <TableCell className="break-words text-text-secondary">{linha.colecao || "—"}</TableCell>
                    <TableCell className="text-right text-base font-bold tabular-nums text-text-primary">{numero(linha.disponivel)}</TableCell>
                    <TableCell className="text-right tabular-nums text-text-secondary">{numero(linha.reservado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            <div className="flex items-center gap-2">
              <Select value={ordem.campo} onValueChange={(campo: OrdenacaoEstoque["campo"]) => setOrdem({ campo, direcao: "asc" })}>
                <SelectTrigger aria-label="Ordenar estoque" className="h-11 min-w-0 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="colecao">Coleção</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={ordem.direcao === "asc" ? "Ordenar decrescente" : "Ordenar crescente"} title={ordem.direcao === "asc" ? "Ordenar decrescente" : "Ordenar crescente"} onClick={() => ordenarPor(ordem.campo)}>
                {iconeOrdem(ordem.campo)}
              </Button>
            </div>
            <ul aria-label="Estoque por produto" className="space-y-2">
              {ordenadas.map((linha) => (
                <li key={linha.sku} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-border bg-card p-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-text-primary">{linha.nome}</p>
                    <p className="mt-1 break-words text-xs text-text-secondary">{linha.colecao || "Sem coleção"}</p>
                    <p className="mt-2 break-all text-xs tabular-nums text-text-secondary">Código {linha.cod_cadastro || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-text-primary">{numero(linha.disponivel)}</p>
                    <p className="text-xs text-text-secondary">Disponível</p>
                    <p className="mt-2 text-xs tabular-nums text-text-secondary">Reservado {numero(linha.reservado)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}