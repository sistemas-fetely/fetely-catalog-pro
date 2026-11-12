import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { formatCEP } from "@/lib/documento";
import type { ClienteForm } from "./types";

export function EnderecoFields({ form, onChange, prefixo, disabled, buscandoCep, onCepBlur }: {
  form: ClienteForm; onChange: (key: keyof ClienteForm, value: string) => void; prefixo: string;
  disabled?: boolean; buscandoCep: boolean; onCepBlur: () => void;
}) {
  return <fieldset disabled={disabled} className="grid grid-cols-6 gap-3">
    {([
      ["cep", "CEP", "col-span-6 sm:col-span-2"],
      ["logradouro", "Logradouro", "col-span-6 sm:col-span-4"],
      ["numero", "Número", "col-span-2 sm:col-span-1"],
      ["complemento", "Complemento", "col-span-4 sm:col-span-2"],
      ["bairro", "Bairro", "col-span-6 sm:col-span-3"],
      ["cidade", "Cidade", "col-span-4"],
      ["uf", "UF", "col-span-2"],
    ] as const).map(([key, label, classe]) => <div key={key} className={`min-w-0 space-y-1.5 ${classe}`}>
      <Label htmlFor={`${prefixo}-${key}`}>{label}</Label>
      <div className="relative">
        <Input id={`${prefixo}-${key}`} value={form[key]} inputMode={key === "cep" ? "numeric" : undefined}
          autoComplete={key === "cep" ? "postal-code" : undefined} placeholder={key === "cep" ? "00000-000" : undefined}
          maxLength={key === "uf" ? 2 : undefined} onBlur={key === "cep" ? onCepBlur : undefined}
          onChange={e => onChange(key, key === "cep" ? formatCEP(e.target.value) : key === "uf" ? e.target.value.toUpperCase() : e.target.value)}
          className={key === "cep" && buscandoCep ? "pr-9" : ""} />
        {key === "cep" && buscandoCep && <Loader2 aria-label="Buscando CEP" className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>)}
  </fieldset>;
}