import { toast } from "sonner";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/balcaoPedido";

export function LinkPagamento({ url, nome, telefone, email, pedido, total, compacto = false }: {
  url: string; nome: string; telefone?: string | null; email?: string | null; pedido: string; total: number; compacto?: boolean;
}) {
  const mensagem = `Olá ${nome}! Seu pedido ${pedido} na Fetély ficou em ${brl(total)}. Pague por aqui: ${url}`;
  const whatsapp = `https://wa.me/55${(telefone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;
  const mail = `mailto:${encodeURIComponent(email ?? "")}?subject=${encodeURIComponent(`Pagamento do pedido ${pedido} — Fetély`)}&body=${encodeURIComponent(mensagem)}`;
  const copiar = () => { void navigator.clipboard.writeText(url).then(() => toast.success("Link copiado")).catch(() => toast.error("Não foi possível copiar")); };
  return <div className="space-y-2">
    {!compacto && <><Label htmlFor="resultado-link">Link de pagamento</Label><Input id="resultado-link" readOnly value={url} /></>}
    <div className={compacto ? "flex flex-col items-start gap-1" : "flex flex-wrap gap-2"}>
      <Button variant={compacto ? "ghost" : "outline"} size={compacto ? "sm" : "default"} onClick={copiar}><Copy />{compacto ? "Link" : "Copiar link"}</Button>
      <Button variant={compacto ? "ghost" : "default"} size={compacto ? "sm" : "default"} asChild><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>
      <Button variant={compacto ? "ghost" : "outline"} size={compacto ? "sm" : "default"} asChild><a href={mail}><Mail />E-mail</a></Button>
    </div>
  </div>;
}