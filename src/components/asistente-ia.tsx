import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Sparkles, Send, Bot } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

const SUGERENCIAS = [
  "Hacé un análisis general de mi pipeline",
  "¿Qué oportunidades necesito priorizar hoy?",
  "¿Cómo está mi tasa de conversión?",
  "¿Qué leads se están enfriando y necesitan atención?",
  "Dame un plan de acción para esta semana",
];

const NO_CONECTADO =
  "🔌 Todavía no estoy conectado. Me activan cuando carguen la API key de Anthropic. La interfaz ya está lista — falta enchufar el cerebro.";

export function AsistenteIA() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || sending) return;
    const nuevos: Msg[] = [...messages, { role: "user", text: pregunta }];
    setMessages(nuevos);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("asistente-ia", {
        body: { pregunta, historial: messages },
      });
      const respuesta = !error && data?.respuesta ? (data.respuesta as string) : NO_CONECTADO;
      setMessages([...nuevos, { role: "assistant", text: respuesta }]);
    } catch {
      setMessages([...nuevos, { role: "assistant", text: NO_CONECTADO }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </span>
          Gerente Comercial IA · Carlos
        </CardTitle>
        <CardDescription>Análisis en tiempo real de tu CRM.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="h-7 w-7 text-primary mx-auto mb-2" />
            <p className="font-medium">¡Hola! Soy Carlos, tu gerente comercial con IA.</p>
            <p className="text-sm text-muted-foreground">
              Tengo acceso a los datos de tu CRM. ¿En qué te puedo ayudar?
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-muted-foreground">Carlos está pensando…</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => enviar(s)}
              disabled={sending}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntale a Carlos sobre tu pipeline, oportunidades, equipo…"
            disabled={sending}
          />
          <Button type="submit" size="icon" className="shrink-0" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
