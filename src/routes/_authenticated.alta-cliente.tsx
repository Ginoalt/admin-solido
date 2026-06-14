import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alta-cliente")({
  component: AltaClientePage,
});

type Plantilla = {
  etapas: string[];
  campos: { nombre: string; tipo: string; opciones: string[] }[];
  bot: { nombre_bot: string; mensaje_bienvenida: string; instrucciones: string };
};

const PLANTILLAS: Record<string, Plantilla> = {
  abogado: {
    etapas: ["Consulta", "Análisis de caso", "Contrato", "Ganado", "Perdido"],
    campos: [
      { nombre: "N° de Expediente", tipo: "texto", opciones: [] },
      { nombre: "Tipo de caso", tipo: "lista", opciones: ["Penal", "Civil", "Laboral", "Familia"] },
    ],
    bot: {
      nombre_bot: "Asistente Legal",
      mensaje_bienvenida:
        "Hola 👋 Soy el asistente del estudio. ¿En qué tema legal te puedo ayudar?",
      instrucciones:
        "Sos el asistente de un estudio jurídico. Respondé con claridad y profesionalismo. Si la consulta requiere un abogado, ofrecé agendar una consulta. No des asesoramiento legal definitivo.",
    },
  },
  medico: {
    etapas: ["Cita solicitada", "Confirmada", "Atendido", "No asistió"],
    campos: [
      { nombre: "Obra social", tipo: "texto", opciones: [] },
      { nombre: "Motivo de consulta", tipo: "texto", opciones: [] },
    ],
    bot: {
      nombre_bot: "Asistente del Consultorio",
      mensaje_bienvenida:
        "Hola 👋 Soy el asistente del consultorio. ¿Querés agendar una consulta?",
      instrucciones:
        "Sos el asistente de un consultorio médico. Sé cordial y claro. Ayudá a agendar turnos. No des diagnósticos ni indicaciones médicas; derivá siempre al profesional.",
    },
  },
  otro: {
    etapas: ["Nuevo", "En proceso", "Ganado", "Perdido"],
    campos: [],
    bot: {
      nombre_bot: "Asistente",
      mensaje_bienvenida: "Hola 👋 ¿En qué te puedo ayudar?",
      instrucciones:
        "Sos un asistente cordial y servicial. Respondé las consultas y ofrecé agendar cuando corresponda.",
    },
  },
};

function tipoDeEtapa(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("ganado") || n.includes("contrato") || n.includes("atendido")) return "ganado";
  if (n.includes("perdido") || n.includes("no asist")) return "perdido";
  return "normal";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function AltaClientePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("abogado");
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("prueba");

  // Paso 2 (bot, prellenado desde la plantilla)
  const [botNombre, setBotNombre] = useState("");
  const [botBienvenida, setBotBienvenida] = useState("");
  const [botInstrucciones, setBotInstrucciones] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plantilla = PLANTILLAS[rubro] ?? PLANTILLAS.otro;

  function irAPaso2(e: React.FormEvent) {
    e.preventDefault();
    const p = PLANTILLAS[rubro] ?? PLANTILLAS.otro;
    setBotNombre(p.bot.nombre_bot);
    setBotBienvenida(p.bot.mensaje_bienvenida);
    setBotInstrucciones(p.bot.instrucciones);
    setStep(2);
  }

  async function crear() {
    setSaving(true);
    setError(null);

    const { data: prof, error: e1 } = await supabase
      .from("profesionales")
      .insert({ nombre, rubro, email_contacto: email, estado })
      .select("id")
      .single();
    if (e1 || !prof) {
      setError(e1?.message ?? "No se pudo crear el cliente.");
      setSaving(false);
      return;
    }
    const pid = prof.id as string;

    if (plantilla.etapas.length > 0) {
      const { error: e2 } = await supabase.from("etapas_pipeline").insert(
        plantilla.etapas.map((n, i) => ({
          profesional_id: pid,
          nombre: n,
          orden: i,
          tipo: tipoDeEtapa(n),
        })),
      );
      if (e2) {
        setError(e2.message);
        setSaving(false);
        return;
      }
    }

    if (plantilla.campos.length > 0) {
      const { error: e3 } = await supabase.from("campos_personalizados").insert(
        plantilla.campos.map((c, i) => ({
          profesional_id: pid,
          nombre: c.nombre,
          clave: slugify(c.nombre),
          tipo: c.tipo,
          opciones: c.opciones,
          orden: i,
        })),
      );
      if (e3) {
        setError(e3.message);
        setSaving(false);
        return;
      }
    }

    const { error: e4 } = await supabase.from("bot_config").insert({
      profesional_id: pid,
      nombre_bot: botNombre,
      mensaje_bienvenida: botBienvenida,
      instrucciones: botInstrucciones,
      modelo_ia: "claude-haiku-4-5",
      activo: true,
    });
    if (e4) {
      setError(e4.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    navigate({ to: "/clientes" });
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          to="/clientes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Clientes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Alta de cliente</h1>
        <p className="text-sm text-muted-foreground">
          Paso {step} de 2 — en pocos pasos queda todo configurado
        </p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos del cliente</CardTitle>
            <CardDescription>
              Según el rubro, le armamos el embudo, los campos y el bot automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={irAPaso2} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alta-nombre">Nombre</Label>
                <Input
                  id="alta-nombre"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Estudio Pérez"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alta-rubro">Rubro</Label>
                  <Select value={rubro} onValueChange={setRubro}>
                    <SelectTrigger id="alta-rubro">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abogado">Abogado</SelectItem>
                      <SelectItem value="medico">Médico</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alta-estado">Estado</Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger id="alta-estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prueba">Prueba</SelectItem>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alta-email">Email de contacto</Label>
                <Input
                  id="alta-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Siguiente</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Esto se va a crear automáticamente</CardTitle>
              <CardDescription>Plantilla del rubro {rubro}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">Etapas del embudo</p>
                <div className="flex flex-wrap gap-2">
                  {plantilla.etapas.map((et) => (
                    <span key={et} className="rounded-full border px-3 py-1 text-xs">
                      {et}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Campos personalizados</p>
                {plantilla.campos.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Ninguno (lo podés agregar después)</p>
                ) : (
                  <ul className="list-disc list-inside text-muted-foreground">
                    {plantilla.campos.map((c) => (
                      <li key={c.nombre}>{c.nombre}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personalidad del bot</CardTitle>
              <CardDescription>Ya viene prellenada — ajustala si querés.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alta-bot-nombre">Nombre del bot</Label>
                <Input
                  id="alta-bot-nombre"
                  value={botNombre}
                  onChange={(e) => setBotNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alta-bot-bienvenida">Mensaje de bienvenida</Label>
                <Textarea
                  id="alta-bot-bienvenida"
                  rows={2}
                  value={botBienvenida}
                  onChange={(e) => setBotBienvenida(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alta-bot-instrucciones">Instrucciones</Label>
                <Textarea
                  id="alta-bot-instrucciones"
                  rows={4}
                  value={botInstrucciones}
                  onChange={(e) => setBotInstrucciones(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
            <Button type="button" onClick={crear} disabled={saving || !nombre}>
              <Check className="h-4 w-4" />
              {saving ? "Creando..." : "Crear cliente y configurar todo"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
