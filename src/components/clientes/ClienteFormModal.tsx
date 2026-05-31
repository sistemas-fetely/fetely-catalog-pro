import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchCNPJ, formatCNPJ, isValidCNPJLength, onlyDigits } from "@/lib/cnpj";
import { useClientes } from "@/store/clienteStore";
import { useAuth } from "@/store/authStore";
import { PremissasComercialTab } from "@/components/clientes/PremissasComercialTab";
import { diffPremissas } from "@/lib/premissas";
import {
  CANAL_LABEL,
  DOCUMENTO_TIPOS,
  PAISES_LIST,
  SEGMENTO_LABEL,
  UF_LIST,
  type CanalCliente,
  type Cliente,
  type SegmentoCliente,
  type SituacaoCadastral,
} from "@/types/cliente";

function emptyCliente(vendedorId: string, vendedorNome: string): Cliente {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    criadoEm: now,
    atualizadoEm: now,
    cadastradoPorVendedorId: vendedorId,
    cadastradoPorVendedorNome: vendedorNome,
    cnpj: "",
    cnpjFormatado: "",
    razaoSocial: "",
    nomeFantasia: "",
    inscricaoEstadual: "",
    isentoIE: false,
    situacaoCadastral: "desconhecida",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    enderecoEntregaIgual: true,
    contatoNome: "",
    contatoEmail: "",
    contatoTelefone: "",
    contatoWhatsapp: "",
    telefonesInternacionais: false,
    financeiroNome: "",
    financeiroEmail: "",
    financeiroTelefone: "",
    segmento: "boutique_decoracao",
    canal: "indicacao",
    regiaoAtuacao: "",
    observacoes: "",
    tags: [],
    ativo: true,
    isInternacional: false,
    pais: "",
    documentoTipo: "Passport",
    documentoNumero: "",
  };
}

function mapSituacao(s: string): SituacaoCadastral {
  const v = s.toLowerCase();
  if (v.includes("ativ")) return "ativa";
  if (v.includes("susp")) return "suspensa";
  if (v.includes("inap")) return "inapta";
  if (v.includes("baix")) return "baixada";
  if (v.includes("nula")) return "nula";
  return "desconhecida";
}

export interface ClienteFormModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Cliente | null;
  onSaved?: (c: Cliente) => void;
}

export function ClienteFormModal({
  open,
  onOpenChange,
  initial,
  onSaved,
}: ClienteFormModalProps) {
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const upsert = useClientes((s) => s.upsertCliente);
  const findByCnpj = useClientes((s) => s.findByCnpj);

  const [cliente, setCliente] = useState<Cliente>(() =>
    initial ?? emptyCliente(user?.id ?? "", profile?.nome_completo ?? profile?.email ?? ""),
  );
  const [tab, setTab] = useState("fiscal");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [duplicateWarn, setDuplicateWarn] = useState<Cliente | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setCliente(
        initial ??
          emptyCliente(user?.id ?? "", profile?.nome_completo ?? profile?.email ?? ""),
      );
      setTab("fiscal");
      setCnpjError(null);
      setDuplicateWarn(null);
      setTagInput("");
    }
  }, [open, initial, user, profile]);

  const update = (patch: Partial<Cliente>) =>
    setCliente((c) => ({ ...c, ...patch }));

  const handleCnpjLookup = async () => {
    const d = onlyDigits(cliente.cnpjFormatado || cliente.cnpj);
    if (!isValidCNPJLength(d)) {
      setCnpjError("CNPJ deve ter 14 dígitos.");
      return;
    }
    setCnpjLoading(true);
    setCnpjError(null);
    try {
      const existing = findByCnpj(d);
      if (existing && existing.id !== cliente.id) {
        setDuplicateWarn(existing);
      }
      const r = await fetchCNPJ(d);
      update({
        cnpj: d,
        cnpjFormatado: r.cnpj,
        razaoSocial: r.razaoSocial,
        nomeFantasia: r.nomeFantasia || r.razaoSocial,
        situacaoCadastral: mapSituacao(r.situacao),
        logradouro: r.logradouro || cliente.logradouro,
        numero: r.numero || cliente.numero,
        complemento: r.complemento || cliente.complemento,
        bairro: r.bairro || cliente.bairro,
        cidade: r.municipio || cliente.cidade,
        estado: r.uf || cliente.estado,
        cep: r.cep || cliente.cep,
        contatoEmail: cliente.contatoEmail || r.email,
        contatoTelefone: cliente.contatoTelefone || r.telefone,
      });
    } catch (e) {
      setCnpjError(e instanceof Error ? e.message : "Erro ao consultar CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  };

  const podeSalvar = useMemo(() => {
    const base =
      cliente.razaoSocial.trim().length > 0 &&
      cliente.contatoNome.trim().length > 0 &&
      cliente.contatoTelefone.trim().length > 0;
    if (!base) return false;
    if (cliente.isInternacional) {
      return Boolean(cliente.pais && cliente.documentoNumero?.trim());
    }
    return true;
  }, [cliente]);

  const handleSave = async () => {
    if (!podeSalvar) {
      toast.error("Preencha Razão Social, Nome do contato e Telefone.");
      return;
    }
    if (salvando) return;
    if (!user?.id) {
      toast.error("Sua sessão ainda está carregando. Atualize a página antes de continuar.");
      return;
    }
    let premissasComerciais = cliente.premissasComerciais;
    if (premissasComerciais) {
      const alterados = diffPremissas(initial?.premissasComerciais, premissasComerciais);
      if (alterados.length > 0) {
        const usuario = profile?.nome_completo ?? profile?.email ?? "—";
        premissasComerciais = {
          ...premissasComerciais,
          historico: [
            ...(premissasComerciais.historico ?? []),
            {
              timestamp: new Date().toISOString(),
              usuarioNome: usuario,
              descricao: initial?.premissasComerciais
                ? "Atualização de premissas"
                : "Criação de premissas",
              camposAlterados: alterados,
            },
          ],
        };
      }
    }
    const saved: Cliente = {
      ...cliente,
      premissasComerciais,
      atualizadoEm: new Date().toISOString(),
    };
    setSalvando(true);
    try {
      await upsert(saved);
      toast.success("Cliente salvo.");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar o cliente", {
        description: "Tente novamente. Se persistir, atualize a página.",
        duration: 6000,
      });
    } finally {
      setSalvando(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if ((cliente.tags ?? []).includes(t)) return;
    update({ tags: [...(cliente.tags ?? []), t] });
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-text-primary">
            {initial ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-surface-2 h-auto">
            <TabsTrigger value="fiscal" className="text-xs">Fiscais</TabsTrigger>
            <TabsTrigger value="endereco" className="text-xs">Endereço</TabsTrigger>
            <TabsTrigger value="contatos" className="text-xs">Contatos</TabsTrigger>
            <TabsTrigger value="comercial" className="text-xs">Comercial</TabsTrigger>
            <TabsTrigger value="premissas" className="text-xs text-gold">✦ Premissas</TabsTrigger>
          </TabsList>

          {/* FISCAL */}
          <TabsContent value="fiscal" className="space-y-3 pt-2">
            {!cliente.isInternacional ? (
              <Field label="CNPJ">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    inputMode="numeric"
                    maxLength={18}
                    value={cliente.cnpjFormatado}
                    placeholder="00.000.000/0000-00"
                    onChange={(e) => {
                      const v = formatCNPJ(e.target.value);
                      update({ cnpjFormatado: v, cnpj: onlyDigits(v) });
                      setDuplicateWarn(null);
                      setCnpjError(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCnpjLookup}
                    disabled={cnpjLoading}
                    className="px-3 rounded-md bg-surface-2 border border-border text-gold hover:border-gold disabled:opacity-40"
                    aria-label="Buscar CNPJ"
                  >
                    {cnpjLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {cnpjError && (
                  <p className="mt-1 text-[11px] text-stock-out">{cnpjError}</p>
                )}
                {cliente.situacaoCadastral !== "desconhecida" && !cnpjError && (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-gold-muted">
                    Situação: {cliente.situacaoCadastral}
                  </p>
                )}
                {duplicateWarn && (
                  <p className="mt-1 text-[11px] text-stock-out">
                    CNPJ já cadastrado como{" "}
                    <span className="font-medium">{duplicateWarn.razaoSocial}</span>.
                  </p>
                )}
              </Field>
            ) : null}

            {/* V15.1 — Toggle Cliente Internacional (só antes do CNPJ ser buscado/preenchido) */}
            {!cliente.cnpj && (
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cliente.isInternacional ?? false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    update({
                      isInternacional: checked,
                      ...(checked
                        ? { cnpj: "", cnpjFormatado: "", situacaoCadastral: "desconhecida" }
                        : { pais: "", documentoNumero: "" }),
                    });
                    setCnpjError(null);
                    setDuplicateWarn(null);
                  }}
                />
                🌐 Cliente internacional — isento de CNPJ
              </label>
            )}

            {cliente.isInternacional && (
              <div className="space-y-3 p-3 rounded-md border border-gold/30 bg-gold/5">
                <Field label="País *">
                  <select
                    className="input"
                    value={cliente.pais ?? ""}
                    onChange={(e) => update({ pais: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {PAISES_LIST.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <Field label="Documento">
                    <select
                      className="input"
                      value={cliente.documentoTipo ?? "Passport"}
                      onChange={(e) => update({ documentoTipo: e.target.value })}
                    >
                      {DOCUMENTO_TIPOS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Número do documento *">
                    <input
                      className="input"
                      value={cliente.documentoNumero ?? ""}
                      onChange={(e) => update({ documentoNumero: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-gold-muted">
                  Razão social preenchida manualmente · sem busca na Receita Federal
                </p>
              </div>
            )}

            <Field label="Razão Social *">
              <input
                className="input"
                value={cliente.razaoSocial}
                onChange={(e) => update({ razaoSocial: e.target.value })}
              />
            </Field>
            <Field label="Nome Fantasia">
              <input
                className="input"
                value={cliente.nomeFantasia}
                onChange={(e) => update({ nomeFantasia: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <Field label="Inscrição Estadual">
                <input
                  className="input"
                  value={cliente.inscricaoEstadual ?? ""}
                  disabled={cliente.isentoIE}
                  onChange={(e) => update({ inscricaoEstadual: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs text-text-secondary pb-2">
                <input
                  type="checkbox"
                  checked={cliente.isentoIE ?? false}
                  onChange={(e) => update({ isentoIE: e.target.checked })}
                />
                Isento
              </label>
            </div>
          </TabsContent>

          {/* ENDERECO */}
          <TabsContent value="endereco" className="space-y-3 pt-2">
            <SectionTitle>Endereço principal (cobrança / fiscal)</SectionTitle>
            <Field label="CEP">
              <input
                className="input"
                value={cliente.cep}
                onChange={(e) => update({ cep: e.target.value })}
              />
            </Field>
            <Field label="Logradouro *">
              <input
                className="input"
                value={cliente.logradouro}
                onChange={(e) => update({ logradouro: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Field label="Número *">
                <input
                  className="input"
                  value={cliente.numero}
                  onChange={(e) => update({ numero: e.target.value })}
                />
              </Field>
              <Field label="Complemento">
                <input
                  className="input"
                  value={cliente.complemento ?? ""}
                  onChange={(e) => update({ complemento: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_1fr_100px] gap-3">
              <Field label="Bairro *">
                <input
                  className="input"
                  value={cliente.bairro}
                  onChange={(e) => update({ bairro: e.target.value })}
                />
              </Field>
              <Field label="Cidade *">
                <input
                  className="input"
                  value={cliente.cidade}
                  onChange={(e) => update({ cidade: e.target.value })}
                />
              </Field>
              <Field label="UF *">
                <select
                  className="input"
                  value={cliente.estado}
                  onChange={(e) => update({ estado: e.target.value })}
                >
                  <option value="">--</option>
                  {UF_LIST.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <SectionTitle>Endereço de entrega</SectionTitle>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={cliente.enderecoEntregaIgual}
                onChange={(e) => update({ enderecoEntregaIgual: e.target.checked })}
              />
              Mesmo endereço de cobrança
            </label>
            {!cliente.enderecoEntregaIgual && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <Field label="CEP">
                  <input
                    className="input"
                    value={cliente.entregaCep ?? ""}
                    onChange={(e) => update({ entregaCep: e.target.value })}
                  />
                </Field>
                <Field label="Logradouro">
                  <input
                    className="input"
                    value={cliente.entregaLogradouro ?? ""}
                    onChange={(e) => update({ entregaLogradouro: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <Field label="Número">
                    <input
                      className="input"
                      value={cliente.entregaNumero ?? ""}
                      onChange={(e) => update({ entregaNumero: e.target.value })}
                    />
                  </Field>
                  <Field label="Complemento">
                    <input
                      className="input"
                      value={cliente.entregaComplemento ?? ""}
                      onChange={(e) => update({ entregaComplemento: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_1fr_100px] gap-3">
                  <Field label="Bairro">
                    <input
                      className="input"
                      value={cliente.entregaBairro ?? ""}
                      onChange={(e) => update({ entregaBairro: e.target.value })}
                    />
                  </Field>
                  <Field label="Cidade">
                    <input
                      className="input"
                      value={cliente.entregaCidade ?? ""}
                      onChange={(e) => update({ entregaCidade: e.target.value })}
                    />
                  </Field>
                  <Field label="UF">
                    <select
                      className="input"
                      value={cliente.entregaEstado ?? ""}
                      onChange={(e) => update({ entregaEstado: e.target.value })}
                    >
                      <option value="">--</option>
                      {UF_LIST.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            )}
          </TabsContent>

          {/* CONTATOS */}
          <TabsContent value="contatos" className="space-y-3 pt-2">
            <SectionTitle>Contato principal</SectionTitle>
            <Field label="Nome do contato *">
              <input
                className="input"
                value={cliente.contatoNome}
                onChange={(e) => update({ contatoNome: e.target.value })}
              />
            </Field>
            <Field label="E-mail *">
              <input
                className="input"
                type="email"
                value={cliente.contatoEmail}
                onChange={(e) => update({ contatoEmail: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none pb-1">
              <input
                type="checkbox"
                checked={cliente.telefonesInternacionais ?? false}
                onChange={(e) => update({ telefonesInternacionais: e.target.checked })}
              />
              🌐 Telefones internacionais (ex: +1 555-123-4567)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone *">
                <div className="flex">
                  {cliente.telefonesInternacionais && (
                    <span className="inline-flex items-center px-2 rounded-l-md border border-r-0 border-border bg-surface-2 text-xs text-gold">
                      +
                    </span>
                  )}
                  <input
                    className={cn("input", cliente.telefonesInternacionais ? "rounded-l-none" : "")}
                    placeholder={cliente.telefonesInternacionais ? "1 555-123-4567" : "(11) 99999-9999"}
                    value={cliente.contatoTelefone}
                    onChange={(e) => update({ contatoTelefone: e.target.value })}
                  />
                </div>
              </Field>
              <Field label="WhatsApp">
                <div className="flex">
                  {cliente.telefonesInternacionais && (
                    <span className="inline-flex items-center px-2 rounded-l-md border border-r-0 border-border bg-surface-2 text-xs text-gold">
                      +
                    </span>
                  )}
                  <input
                    className={cn("input", cliente.telefonesInternacionais ? "rounded-l-none" : "")}
                    placeholder={cliente.telefonesInternacionais ? "1 555-123-4567" : "(11) 99999-9999"}
                    value={cliente.contatoWhatsapp ?? ""}
                    onChange={(e) => update({ contatoWhatsapp: e.target.value })}
                  />
                </div>
              </Field>
            </div>

            <SectionTitle>Contato financeiro (opcional)</SectionTitle>
            <Field label="Nome">
              <input
                className="input"
                value={cliente.financeiroNome ?? ""}
                onChange={(e) => update({ financeiroNome: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail">
                <input
                  className="input"
                  value={cliente.financeiroEmail ?? ""}
                  onChange={(e) => update({ financeiroEmail: e.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <div className="flex">
                  {cliente.telefonesInternacionais && (
                    <span className="inline-flex items-center px-2 rounded-l-md border border-r-0 border-border bg-surface-2 text-xs text-gold">
                      +
                    </span>
                  )}
                  <input
                    className={cn("input", cliente.telefonesInternacionais ? "rounded-l-none" : "")}
                    placeholder={cliente.telefonesInternacionais ? "1 555-123-4567" : "(11) 99999-9999"}
                    value={cliente.financeiroTelefone ?? ""}
                    onChange={(e) => update({ financeiroTelefone: e.target.value })}
                  />
                </div>
              </Field>
            </div>
          </TabsContent>

          {/* COMERCIAL */}
          <TabsContent value="comercial" className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Segmento *">
                <select
                  className="input"
                  value={cliente.segmento}
                  onChange={(e) =>
                    update({ segmento: e.target.value as SegmentoCliente })
                  }
                >
                  {Object.entries(SEGMENTO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Canal de origem *">
                <select
                  className="input"
                  value={cliente.canal}
                  onChange={(e) => update({ canal: e.target.value as CanalCliente })}
                >
                  {Object.entries(CANAL_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Região de atuação">
              <input
                className="input"
                value={cliente.regiaoAtuacao ?? ""}
                placeholder='ex: "Grande SP", "Interior SP"'
                onChange={(e) => update({ regiaoAtuacao: e.target.value })}
              />
            </Field>
            <Field label="Tags">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="ex: feira, vip, reativação"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 rounded-md bg-surface-2 border border-border text-gold hover:border-gold"
                  aria-label="Adicionar tag"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {(cliente.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(cliente.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[10px] uppercase tracking-wider text-gold"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            tags: (cliente.tags ?? []).filter((x) => x !== t),
                          })
                        }
                        className="hover:text-stock-out"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Observações">
              <textarea
                className="input resize-none"
                rows={3}
                value={cliente.observacoes ?? ""}
                onChange={(e) => update({ observacoes: e.target.value })}
              />
            </Field>
          </TabsContent>

          {/* PREMISSAS COMERCIAIS (V13) */}
          <TabsContent value="premissas" className="pt-2">
            <PremissasComercialTab cliente={cliente} onChange={update} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!podeSalvar || salvando}
            className="px-5 py-2 rounded-md bg-gold text-background text-xs font-semibold uppercase tracking-[0.15em] hover:bg-gold-light disabled:opacity-40"
          >
            {salvando ? "Salvando..." : "Salvar e selecionar →"}
          </button>
        </div>

        <style>{`
          .input {
            width: 100%;
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            color: var(--text-primary);
            outline: none;
            transition: border-color .15s;
          }
          .input:focus { border-color: var(--gold); }
          .input:disabled { opacity: 0.5; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted pt-2">
      {children}
    </div>
  );
}
