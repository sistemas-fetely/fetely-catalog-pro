import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { decodePreSelecao } from "@/lib/preSelecao";
import { usePreSelecao } from "@/store/preSelecaoStore";
import { toast } from "sonner";

export const Route = createFileRoute("/reunioes/importar")({
  head: () => ({ meta: [{ title: "Importar pré-seleção — Fetély" }] }),
  component: ImportarPage,
});

function ImportarPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "erro" | "manual">("loading");
  const [msg, setMsg] = useState("");
  const [textInput, setTextInput] = useState("");
  const adicionar = usePreSelecao((s) => s.adicionar);
  const hydrate = usePreSelecao((s) => s.hydrate);
  const todas = usePreSelecao((s) => s.todas);
  const navigate = useNavigate();

  useEffect(() => {
    hydrate();
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash) {
      setStatus("manual");
      return;
    }
    importar(hash);
  }, [hydrate]);

  function importar(payload: string) {
    const pre = decodePreSelecao(payload);
    if (!pre) {
      setStatus("erro");
      setMsg("Payload inválido ou corrompido.");
      return;
    }
    // Evita duplicar se já existe
    if (todas.some((p) => p.id === pre.id)) {
      setStatus("ok");
      setMsg(`Pré-seleção #${pre.id} já existe no sistema.`);
      return;
    }
    adicionar(pre);
    setStatus("ok");
    setMsg(`Pré-seleção #${pre.id} importada com sucesso!`);
    toast.success(`Pré-seleção #${pre.id} recebida`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="text-5xl text-gold mb-4">✦</div>
      {status === "loading" && <p className="text-text-secondary">Importando pré-seleção...</p>}
      {status === "ok" && (
        <>
          <h1 className="font-display text-3xl mb-2">{msg}</h1>
          <Button className="mt-4 bg-gold text-background hover:bg-gold-light" onClick={() => navigate({ to: "/reunioes" })}>
            Ver em Reuniões
          </Button>
        </>
      )}
      {status === "erro" && (
        <>
          <h1 className="font-display text-3xl mb-2">Não foi possível importar</h1>
          <p className="text-sm text-text-secondary">{msg}</p>
        </>
      )}
      {status === "manual" && (
        <>
          <h1 className="font-display text-3xl mb-2">Importar pré-seleção</h1>
          <p className="text-sm text-text-secondary mb-4">Cole o código recebido do cliente:</p>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-input bg-transparent p-3 text-xs font-mono"
            placeholder="Cole o código base64 aqui..."
          />
          <Button
            className="mt-3 bg-gold text-background hover:bg-gold-light"
            disabled={!textInput.trim()}
            onClick={() => importar(textInput.trim())}
          >
            Importar
          </Button>
        </>
      )}
    </div>
  );
}
