import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracion")({
  component: ConfiguracionPage,
});

type Profesional = { id: string; nombre: string | null };

function ConfiguracionPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (profesionales.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no hay clientes. Creá uno en la sección <strong>Clientes</strong> para
          configurar su bot.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Conexión de WhatsApp y personalidad del bot, por cliente
          </p>
        </div>
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
      </div>

      {selId && <CanalCard key={`canal-${selId}`} profesionalId={selId} />}
      {selId && <TypebotCard key={`typebot-${selId}`} profesionalId={selId} />}
      {selId && <BotCard key={`bot-${selId}`} profesionalId={selId} />}
      {selId && <CamposCard key={`campos-${selId}`} profesionalId={selId} />}
      {selId && <EtapasCard key={`etapas-${selId}`} profesionalId={selId} />}
      {selId && <ConocimientoCard key={`conoc-${selId}`} profesionalId={selId} />}
    </div>
  );
}

const WEBHOOK_URL =
  "https://goygizqyithyqzctiljk.supabase.co/functions/v1/typebot-lead";

function FilaCopiar({
  etiqueta,
  valor,
  cual,
  copiado,
  onCopiar,
}: {
  etiqueta: string;
  valor: string;
  cual: string;
  copiado: string | null;
  onCopiar: (texto: string, cual: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{etiqueta}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={valor} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onCopiar(valor, cual)}
        >
          {copiado === cual ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado === cual ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

function TypebotCard({ profesionalId }: { profesionalId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [campos, setCampos] = useState<{ clave: string }[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profesionales")
      .select("webhook_token")
      .eq("id", profesionalId)
      .maybeSingle()
      .then(({ data }) => setToken((data?.webhook_token as string) ?? null));
    supabase
      .from("campos_personalizados")
      .select("clave")
      .eq("profesional_id", profesionalId)
      .order("orden", { ascending: true })
      .then(({ data }) => setCampos((data ?? []) as { clave: string }[]));
  }, [profesionalId]);

  function copiar(texto: string, cual: string) {
    navigator.clipboard?.writeText(texto);
    setCopiado(cual);
    setTimeout(() => setCopiado(null), 1500);
  }

  const cuerpo = JSON.stringify(
    {
      profesional_id: profesionalId,
      nombre: "Juan Pérez",
      telefono: "+54 9 11 1234 5678",
      email: "juan@mail.com",
      fecha_cita: "2026-06-20T15:00:00Z",
      datos_extra: Object.fromEntries(campos.map((c) => [c.clave, ""])),
    },
    null,
    2,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexión del Typebot (entrada de leads)</CardTitle>
        <CardDescription>
          Pegá estos datos en el Typebot de este cliente (paso "Enviar a un webhook") y sus leads
          entran solos a su CRM. Cada cliente tiene su propio token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FilaCopiar
          etiqueta="URL del webhook (método POST)"
          valor={WEBHOOK_URL}
          cual="url"
          copiado={copiado}
          onCopiar={copiar}
        />
        <FilaCopiar
          etiqueta="Header → x-webhook-token"
          valor={token ?? "…"}
          cual="token"
          copiado={copiado}
          onCopiar={copiar}
        />
        <FilaCopiar
          etiqueta="profesional_id (de este cliente)"
          valor={profesionalId}
          cual="pid"
          copiado={copiado}
          onCopiar={copiar}
        />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Cuerpo (JSON) de ejemplo</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => copiar(cuerpo, "body")}>
              {copiado === "body" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado === "body" ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <Textarea readOnly value={cuerpo} rows={10} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">
            Reemplazá los valores de ejemplo por los del lead en el Typebot. Lo de{" "}
            <strong>datos_extra</strong> son los campos personalizados de este cliente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type Campo = {
  id: string;
  nombre: string;
  clave: string;
  tipo: string;
  opciones: string[] | null;
  orden: number;
};

const TIPOS: Record<string, string> = {
  texto: "Texto",
  numero: "Número",
  fecha: "Fecha",
  lista: "Lista de opciones",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function CamposCard({ profesionalId }: { profesionalId: string }) {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [opciones, setOpciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("campos_personalizados")
      .select("id, nombre, clave, tipo, opciones, orden")
      .eq("profesional_id", profesionalId)
      .order("orden", { ascending: true });
    setCampos((data ?? []) as Campo[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const clave = slugify(nombre);
    if (!clave) {
      setErr("Poné un nombre válido para el campo.");
      setSaving(false);
      return;
    }
    const opcionesArr =
      tipo === "lista"
        ? opciones
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
    const { error } = await supabase.from("campos_personalizados").insert({
      profesional_id: profesionalId,
      nombre,
      clave,
      tipo,
      opciones: opcionesArr,
      orden: campos.length,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setNombre("");
    setTipo("texto");
    setOpciones("");
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("campos_personalizados").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campos personalizados</CardTitle>
        <CardDescription>
          Columnas a medida para los leads de este cliente (ej. "N° de Expediente").
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {campos.length > 0 && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {TIPOS[c.tipo] ?? c.tipo}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campo-nombre">Nombre del campo</Label>
              <Input
                id="campo-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="N° de Expediente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campo-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="campo-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {tipo === "lista" && (
            <div className="space-y-2">
              <Label htmlFor="campo-opciones">Opciones (separadas por coma)</Label>
              <Input
                id="campo-opciones"
                value={opciones}
                onChange={(e) => setOpciones(e.target.value)}
                placeholder="Penal, Civil, Laboral"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" />
              {saving ? "Agregando..." : "Agregar campo"}
            </Button>
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CanalCard({ profesionalId }: { profesionalId: string }) {
  const [rowId, setRowId] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [estado, setEstado] = useState("prueba");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("canales_whatsapp")
      .select("id, numero, phone_number_id, waba_id, access_token, estado")
      .eq("profesional_id", profesionalId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRowId(data.id as string);
          setNumero((data.numero as string) ?? "");
          setPhoneNumberId((data.phone_number_id as string) ?? "");
          setWabaId((data.waba_id as string) ?? "");
          setAccessToken((data.access_token as string) ?? "");
          setEstado((data.estado as string) ?? "prueba");
        }
      });
  }, [profesionalId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);
    const payload = {
      profesional_id: profesionalId,
      numero,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: accessToken,
      estado,
    };
    let error = null;
    if (rowId) {
      ({ error } = await supabase.from("canales_whatsapp").update(payload).eq("id", rowId));
    } else {
      const res = await supabase.from("canales_whatsapp").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setRowId(res.data.id as string);
    }
    setSaving(false);
    if (error) setErr(error.message);
    else setMsg("Guardado");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexión de WhatsApp</CardTitle>
        <CardDescription>
          Datos del número de Meta de este cliente. En Fase 1 va el número de prueba.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="numero">Número de WhatsApp</Label>
            <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="+54 9 11 ..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone-id">Phone number ID (Meta)</Label>
              <Input id="phone-id" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waba-id">WABA ID (Meta)</Label>
              <Input id="waba-id" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Access token</Label>
            <Input
              id="token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Se guarda en tu base (protegido por RLS)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estado-canal">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger id="estado-canal" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prueba">Prueba</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar conexión"}
            </Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BotCard({ profesionalId }: { profesionalId: string }) {
  const [rowId, setRowId] = useState<string | null>(null);
  const [nombreBot, setNombreBot] = useState("");
  const [mensajeBienvenida, setMensajeBienvenida] = useState("");
  const [instrucciones, setInstrucciones] = useState("");
  const [modeloIa, setModeloIa] = useState("claude-haiku-4-5");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("bot_config")
      .select("id, nombre_bot, mensaje_bienvenida, instrucciones, modelo_ia, activo")
      .eq("profesional_id", profesionalId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRowId(data.id as string);
          setNombreBot((data.nombre_bot as string) ?? "");
          setMensajeBienvenida((data.mensaje_bienvenida as string) ?? "");
          setInstrucciones((data.instrucciones as string) ?? "");
          setModeloIa((data.modelo_ia as string) ?? "claude-haiku-4-5");
          setActivo((data.activo as boolean) ?? true);
        }
      });
  }, [profesionalId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);
    const payload = {
      profesional_id: profesionalId,
      nombre_bot: nombreBot,
      mensaje_bienvenida: mensajeBienvenida,
      instrucciones,
      modelo_ia: modeloIa,
      activo,
    };
    let error = null;
    if (rowId) {
      ({ error } = await supabase.from("bot_config").update(payload).eq("id", rowId));
    } else {
      const res = await supabase.from("bot_config").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setRowId(res.data.id as string);
    }
    setSaving(false);
    if (error) setErr(error.message);
    else setMsg("Guardado");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalidad del bot</CardTitle>
        <CardDescription>
          Cómo se presenta y responde el bot de este cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre-bot">Nombre del bot</Label>
            <Input
              id="nombre-bot"
              value={nombreBot}
              onChange={(e) => setNombreBot(e.target.value)}
              placeholder="Ej: Asistente del Estudio Pérez"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bienvenida">Mensaje de bienvenida</Label>
            <Textarea
              id="bienvenida"
              rows={2}
              value={mensajeBienvenida}
              onChange={(e) => setMensajeBienvenida(e.target.value)}
              placeholder="Hola 👋 Soy el asistente del Estudio. ¿En qué te puedo ayudar?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrucciones">Instrucciones</Label>
            <Textarea
              id="instrucciones"
              rows={5}
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              placeholder="Tono, qué puede y qué no puede responder, cuándo ofrecer agendar una consulta, etc."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo de IA</Label>
              <Select value={modeloIa} onValueChange={setModeloIa}>
                <SelectTrigger id="modelo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5 (rápido y económico)</SelectItem>
                  <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6 (más capaz)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activo">Bot activo</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
                <span className="text-sm text-muted-foreground">
                  {activo ? "Responde automáticamente" : "Pausado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar bot"}
            </Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type Etapa = {
  id: string;
  nombre: string;
  orden: number;
  tipo: string | null;
};

const TIPOS_ETAPA: Record<string, string> = {
  normal: "Normal",
  ganado: "Ganado",
  perdido: "Perdido",
};

function EtapasCard({ profesionalId }: { profesionalId: string }) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Etapa | null>(null);

  async function load() {
    const { data } = await supabase
      .from("etapas_pipeline")
      .select("id, nombre, orden, tipo")
      .eq("profesional_id", profesionalId)
      .order("orden", { ascending: true });
    setEtapas((data ?? []) as Etapa[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setErr("Poné un nombre para la etapa.");
      return;
    }
    setSaving(true);
    setErr(null);
    const maxOrden = etapas.reduce((m, et) => Math.max(m, et.orden), -1);
    const { error } = await supabase.from("etapas_pipeline").insert({
      profesional_id: profesionalId,
      nombre,
      orden: maxOrden + 1,
      tipo,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setNombre("");
    setTipo("normal");
    load();
  }

  async function renombrar(id: string, nuevo: string) {
    await supabase.from("etapas_pipeline").update({ nombre: nuevo }).eq("id", id);
  }

  async function mover(index: number, dir: number) {
    const target = index + dir;
    if (target < 0 || target >= etapas.length) return;
    const a = etapas[index];
    const b = etapas[target];
    await Promise.all([
      supabase.from("etapas_pipeline").update({ orden: b.orden }).eq("id", a.id),
      supabase.from("etapas_pipeline").update({ orden: a.orden }).eq("id", b.id),
    ]);
    load();
  }

  async function confirmarBorrado() {
    if (!deleting) return;
    await supabase.from("etapas_pipeline").delete().eq("id", deleting.id);
    setDeleting(null);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapas del embudo</CardTitle>
        <CardDescription>
          Las columnas del Kanban de este cliente. Renombralas, reordenalas o borralas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {etapas.length > 0 && (
          <div className="space-y-2">
            {etapas.map((et, i) => (
              <div key={et.id} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-7"
                    disabled={i === 0}
                    onClick={() => mover(i, -1)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-7"
                    disabled={i === etapas.length - 1}
                    onClick={() => mover(i, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  defaultValue={et.nombre}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== et.nombre) {
                      renombrar(et.id, e.target.value);
                    }
                  }}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-16 text-center">
                  {TIPOS_ETAPA[et.tipo ?? "normal"] ?? et.tipo}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting(et)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex items-end gap-2 flex-wrap">
          <div className="space-y-2 flex-1 min-w-40">
            <Label htmlFor="etapa-nombre">Nueva etapa</Label>
            <Input
              id="etapa-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Negociación"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="etapa-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="etapa-tipo" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS_ETAPA).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </form>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la etapa "{deleting?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Los leads que estén en esta etapa quedan sin etapa (no se borran). Después los
              podés reasignar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarBorrado();
              }}
            >
              Sí, borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type Documento = {
  id: string;
  nombre_archivo: string | null;
  contenido: string | null;
};

function ConocimientoCard({ profesionalId }: { profesionalId: string }) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [nombre, setNombre] = useState("");
  const [contenido, setContenido] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("documentos")
      .select("id, nombre_archivo, contenido")
      .eq("profesional_id", profesionalId)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as Documento[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !contenido.trim()) {
      setErr("Poné un título y el contenido.");
      return;
    }
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("documentos").insert({
      profesional_id: profesionalId,
      nombre_archivo: nombre,
      contenido,
      tipo: "texto",
      estado: "listo",
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setNombre("");
    setContenido("");
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("documentos").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de conocimiento</CardTitle>
        <CardDescription>
          Lo que el bot va a usar para responder: servicios, precios, preguntas
          frecuentes, políticas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {docs.length > 0 && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Vista previa</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nombre_archivo}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {d.contenido}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(d.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conoc-nombre">Título</Label>
            <Input
              id="conoc-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Servicios y precios"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conoc-contenido">Contenido</Label>
            <Textarea
              id="conoc-contenido"
              rows={6}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Pegá acá el saber del cliente: qué ofrece, precios, horarios, preguntas frecuentes y sus respuestas..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" />
              {saving ? "Guardando..." : "Agregar"}
            </Button>
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
