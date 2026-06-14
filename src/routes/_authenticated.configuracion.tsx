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
import { Plus, Trash2 } from "lucide-react";

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
      {selId && <BotCard key={`bot-${selId}`} profesionalId={selId} />}
      {selId && <CamposCard key={`campos-${selId}`} profesionalId={selId} />}
      {selId && <ConocimientoCard key={`conoc-${selId}`} profesionalId={selId} />}
    </div>
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
