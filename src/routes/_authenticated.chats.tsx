import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil } from "@/lib/perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Bot, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chats")({
  component: ChatsPage,
});

type Profesional = { id: string; nombre: string | null };
type Conversacion = {
  id: string;
  lead_id: string | null;
  estado: string | null;
  bot_activo: boolean;
  ultimo_mensaje_at: string | null;
  leads: { nombre: string | null } | null;
};
type Mensaje = {
  id: string;
  direccion: string | null;
  autor: string | null;
  contenido: string | null;
  created_at: string;
};

function horaCorta(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ChatsPage() {
  const { esAdmin } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conversacion[]>([]);
  const [activa, setActiva] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [errEnvio, setErrEnvio] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("profesionales")
      .select("id, nombre")
      .order("nombre", { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Profesional[];
        setProfesionales(list);
        if (list.length > 0) setSelId(list[0].id);
        setLoading(false);
      });
  }, []);

  async function cargarConvs(pid: string) {
    const { data } = await supabase
      .from("conversaciones")
      .select("id, lead_id, estado, bot_activo, ultimo_mensaje_at, leads(nombre)")
      .eq("profesional_id", pid)
      .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false });
    setConvs((data ?? []) as Conversacion[]);
  }

  useEffect(() => {
    setActiva(null);
    setMensajes([]);
    if (selId) {
      cargarConvs(selId);
      supabase
        .from("respuestas_rapidas")
        .select("texto")
        .eq("profesional_id", selId)
        .order("orden", { ascending: true })
        .then(({ data }) => setRespuestas(((data ?? []) as { texto: string }[]).map((r) => r.texto)));
    } else {
      setConvs([]);
      setRespuestas([]);
    }
  }, [selId]);

  async function abrir(c: Conversacion) {
    setActiva(c);
    setErrEnvio(null);
    const { data } = await supabase
      .from("mensajes")
      .select("id, direccion, autor, contenido, created_at")
      .eq("conversacion_id", c.id)
      .order("created_at", { ascending: true });
    setMensajes((data ?? []) as Mensaje[]);
  }

  async function toggleBot(c: Conversacion) {
    const nuevo = !c.bot_activo;
    setActiva((a) => (a ? { ...a, bot_activo: nuevo } : a));
    setConvs((prev) => prev.map((x) => (x.id === c.id ? { ...x, bot_activo: nuevo } : x)));
    await supabase.from("conversaciones").update({ bot_activo: nuevo }).eq("id", c.id);
  }

  async function enviar() {
    if (!texto.trim() || !activa || !selId) return;
    const contenido = texto.trim();
    setTexto("");
    setErrEnvio(null);
    // La función manda el mensaje por WhatsApp y lo guarda con el estado real.
    const { error } = await supabase.functions.invoke("whatsapp-send", {
      body: { conversacion_id: activa.id, texto: contenido },
    });
    if (error) {
      setErrEnvio("No se pudo entregar por WhatsApp (quedó guardado igual). Revisá la conexión o si pasaron 24 hs.");
    }
    abrir(activa);
    cargarConvs(selId);
  }

  function nombreConv(c: Conversacion) {
    return c.leads?.nombre || "Lead sin nombre";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
          <p className="text-sm text-muted-foreground">
            Conversaciones de WhatsApp. Apagá el bot para contestar vos.
          </p>
        </div>
        {esAdmin && (
          <Select value={selId ?? undefined} onValueChange={setSelId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Elegí un cliente" />
            </SelectTrigger>
            <SelectContent>
              {profesionales.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[20rem_1fr] gap-4">
        {/* Lista de conversaciones */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {convs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Todavía no hay conversaciones. Van a aparecer acá cuando los leads escriban por
              WhatsApp (al conectar Meta).
            </p>
          ) : (
            <ul className="divide-y max-h-[70vh] overflow-y-auto">
              {convs.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrir(c)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      activa?.id === c.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nombreConv(c)}</p>
                      <p className="text-xs text-muted-foreground">{horaCorta(c.ultimo_mensaje_at)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.bot_activo ? "bg-muted text-muted-foreground" : "bg-foreground text-background"
                      }`}
                    >
                      {c.bot_activo ? "Bot" : "Humano"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conversación abierta */}
        <div className="rounded-lg border bg-card flex flex-col min-h-[70vh]">
          {!activa ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Elegí una conversación para ver los mensajes.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="font-medium">{nombreConv(activa)}</p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {activa.bot_activo ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    {activa.bot_activo ? "Bot responde" : "Vos respondés"}
                  </span>
                  <Switch checked={activa.bot_activo} onCheckedChange={() => toggleBot(activa)} />
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {mensajes.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
                ) : (
                  mensajes.map((m) => {
                    const saliente = m.direccion === "saliente";
                    return (
                      <div key={m.id} className={`flex ${saliente ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                            saliente ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.contenido}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              saliente ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {m.autor} · {horaCorta(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {errEnvio && (
                <p className="px-3 pt-2 text-xs text-destructive">{errEnvio}</p>
              )}
              {!activa.bot_activo && respuestas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t px-3 pt-2">
                  {respuestas.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTexto(r)}
                      title={r}
                      className="max-w-[14rem] truncate rounded-full border bg-secondary px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar();
                }}
                className="flex items-center gap-2 border-t p-3"
              >
                <Input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={
                    activa.bot_activo
                      ? "Apagá el bot para tomar la conversación…"
                      : "Escribí tu respuesta…"
                  }
                />
                <Button type="submit" size="icon" className="shrink-0" disabled={!texto.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
