import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { cpfPrivado } from "@/lib/balcaoPedido";
import { formatCPF, isValidCPF } from "@/lib/documento";
import { EnderecoFields } from "./EnderecoFields";
import type { BalcaoCliente, ClienteForm } from "./types";

export function ClienteCard({ cliente, novo, edicao, podeCliente, form, onCampo, busca, onBusca, resultados, buscando,
  onSelecionar, onNovo, onTrocar, onCancelar, buscandoCep, onCepBlur, emailObrigatorio, modoBalcao = false, disabled, erro, erroCep }: {
  cliente: BalcaoCliente | null; novo: boolean; edicao: boolean; podeCliente: boolean; form: ClienteForm;
  onCampo: (k: keyof ClienteForm, v: string) => void; busca: string; onBusca: (v: string) => void;
  resultados: BalcaoCliente[]; buscando: boolean; onSelecionar: (c: BalcaoCliente) => void;
  onNovo: () => void; onTrocar: () => void; onCancelar: () => void; buscandoCep: boolean; onCepBlur: () => void;
  emailObrigatorio: boolean; modoBalcao?: boolean; disabled: boolean; erro?: string; erroCep?: string;
}) {
  return <Card id="balcao-card-cliente" className="rounded-lg scroll-mt-4">
    <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4 sm:p-6">
      <CardTitle className="text-base tracking-normal">Cliente</CardTitle>
      {!edicao && !novo && <Button variant="outline" size="sm" onClick={onNovo} disabled={disabled}><UserPlus />Novo cliente</Button>}
    </CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      {edicao && <p className="text-sm text-muted-foreground">O cliente não pode ser trocado na edição. Os campos liberados pelo SNCF podem ser atualizados.</p>}
      {!cliente && !novo && <>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input id="balcao-busca-cliente" className="h-10 pl-9" placeholder="Buscar por nome, CPF ou telefone…" value={busca} onChange={e => onBusca(e.target.value)} disabled={disabled} />
          {buscando && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {resultados.length > 0 && <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border">{resultados.map(c => <li key={c.id}>
          <Button variant="ghost" className="h-auto w-full flex-col items-start gap-1 whitespace-normal rounded-none px-3 py-3 text-left" onClick={() => onSelecionar(c)} disabled={disabled}>
            <span className="font-semibold">{c.nome}</span><span className="text-xs text-muted-foreground">{cpfPrivado(c.cpf)}{c.telefone ? ` · ${c.telefone}` : ""}</span>
          </Button>
        </li>)}</ul>}
        {!buscando && !erro && busca.trim().length >= 2 && !resultados.length && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>}
      </>}
      {cliente && <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="min-w-0 space-y-1"><p className="font-semibold">{cliente.nome}</p><p className="break-words text-sm text-muted-foreground">{cpfPrivado(cliente.cpf)}{cliente.telefone ? ` · ${cliente.telefone}` : ""}{cliente.email ? ` · ${cliente.email}` : ""}</p>
          {!cliente.cpf && <p className="text-sm text-destructive">CPF obrigatório para a NF</p>}
        </div>
        {!edicao && <Button variant="ghost" size="icon" title="Trocar cliente" aria-label="Trocar cliente" onClick={onTrocar} disabled={disabled}><X /></Button>}
      </div>}
      {modoBalcao && cliente && !cliente.email && !edicao && <div className="space-y-1.5">
        <Label htmlFor="balcao-cliente-email">E-mail *</Label>
        <Input id="balcao-cliente-email" type="email" autoComplete="email" value={form.email} onChange={e => onCampo("email", e.target.value)} disabled={disabled} required />
        <p className="text-sm text-muted-foreground">A NF vai por e-mail ao cliente</p>
      </div>}
      {(novo || edicao) && <>
        <fieldset disabled={disabled || !podeCliente} className="grid grid-cols-6 gap-3">
          <div className="col-span-6 space-y-1.5"><Label htmlFor="balcao-cliente-nome">Nome *</Label><Input id="balcao-cliente-nome" autoComplete="name" value={form.nome} onChange={e => onCampo("nome", e.target.value)} /></div>
          <div className="col-span-6 space-y-1.5 sm:col-span-2"><Label htmlFor="balcao-cliente-cpf">CPF *</Label><Input id="balcao-cliente-cpf" inputMode="numeric" placeholder="000.000.000-00" disabled={edicao && !!cliente?.cpf} value={form.cpf} onChange={e => onCampo("cpf", formatCPF(e.target.value))} aria-invalid={!!form.cpf && !isValidCPF(form.cpf)} />{form.cpf && !isValidCPF(form.cpf) && <p className="text-xs text-destructive">CPF inválido</p>}</div>
          <div className="col-span-6 space-y-1.5 sm:col-span-2"><Label htmlFor="balcao-cliente-telefone">Telefone/WhatsApp *</Label><Input id="balcao-cliente-telefone" inputMode="tel" autoComplete="tel" value={form.telefone} onChange={e => onCampo("telefone", e.target.value)} /></div>
          <div className="col-span-6 space-y-1.5 sm:col-span-2"><Label htmlFor="balcao-cliente-email">E-mail{emailObrigatorio ? " *" : ""}</Label><Input id="balcao-cliente-email" type="email" autoComplete="email" required={emailObrigatorio} value={form.email} onChange={e => onCampo("email", e.target.value)} />{modoBalcao && <p className="text-xs text-muted-foreground">A NF vai por e-mail ao cliente</p>}</div>
        </fieldset>
        {novo && !modoBalcao && <EnderecoFields form={form} onChange={onCampo} prefixo="balcao-novo-cliente" disabled={disabled} buscandoCep={buscandoCep} onCepBlur={onCepBlur} />}
        {novo && !modoBalcao && erroCep && <p role="alert" className="text-sm text-destructive">{erroCep}</p>}
        {novo && <Button variant="link" className="h-auto p-0" onClick={onCancelar} disabled={disabled}>Cancelar novo cliente</Button>}
      </>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </CardContent>
  </Card>;
}