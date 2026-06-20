import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil } from "@/lib/perfil";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/automatizaciones")({
  component: AutomatizacionesPage,
});

type Profesional = { id: string; nombre: string | null };
type Etapa = { id: string; nombre: string };
type Regla = {
  id: string;
  nombre: string;
  activa: boolean;
  evento: string;
  etapa_id: string | null;
  tarea_titulo: string | null;
  tarea_dias: number;
};

function AutomatizacionesPage() {
  const { esAdmin, perfil, loading: perfilLoading } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pid = esAdmin ? selId : perfil?.profesional_id ?? null;
  // El cliente solo entra si el admin le prendió el módulo premium (el admin siempre entra).
  const habilitado = esAdmin || perfil?.modulos?.["automatizaciones"] === true;

  useEffect(() => {
    if (!esAdmin) {
      setLoading(false);
      return;
    }
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
  }, [esAdmin]);

  if (loading || perfilLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (!habilitado) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Este módulo no está disponible en tu plan.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Reglas que se ejecutan solas cuando entra o avanza un lead.
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

      {pid ? (
        <ReglasCard key={pid} profesionalId={pid} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Elegí un cliente para configurar sus automatizaciones.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReglasCard({ profesionalId }: { profesionalId: string }) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [nombre, setNombre] = useState("");
  const [evento, setEvento] = useState("lead_nuevo");
  const [etapaId, setEtapaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dias, setDias] = useState("1");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [e, r] = await Promise.all([
      supabase
        .from("etapas_pipeline")
        .select("id, nombre")
        .eq("profesional_id", profesionalId)
        .order("orden", { ascending: true }),
      supabase
        .from("reglas_automatizacion")
        .select("id, nombre, activa, evento, etapa_id, tarea_titulo, tarea_dias")
        .eq("profesional_id", profesionalId)
        .order("created_at", { ascending: false }),
    ]);
    setEtapas((e.data ?? []) as Etapa[]);
    setReglas((r.data ?? []) as Regla[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function agregar(ev: React.FormEvent) {
    ev.preventDefault();
    setErr(null);
    if (!nombre.trim()) {
      setErr("Poné un nombre para la regla.");
      return;
    }
    if (evento === "lead_en_etapa" && !etapaId) {
      setErr("Elegí la etapa que dispara la regla.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reglas_automatizacion").insert({
      profesional_id: profesionalId,
      nombre: nombre.trim(),
      evento,
      etapa_id: evento === "lead_en_etapa" ? etapaId : null,
      accion: "crear_tarea",
      tarea_titulo: titulo.trim() || null,
      tarea_dias: Math.max(0, parseInt(dias, 10) || 0),
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setNombre("");
    setEvento("lead_nuevo");
    setEtapaId("");
    setTitulo("");
    setDias("1");
    load();
  }

  async function toggle(r: Regla) {
    setReglas((prev) => prev.map((x) => (x.id === r.id ? { ...x, activa: !x.activa } : x)));
    await supabase.from("reglas_automatizacion").update({ activa: !r.activa }).eq("id", r.id);
  }

  async function borrar(id: string) {
    await supabase.from("reglas_automatizacion").delete().eq("id", id);
    load();
  }

  function descripcion(r: Regla) {
    const cuando =
      r.evento === "lead_nuevo"
        ? "Cuando entra un lead nuevo"
        : `Cuando un lead llega a "${etapas.find((e) => e.id === r.etapa_id)?.nombre ?? "una etapa"}"`;
    return `${cuando} → crear tarea "${r.tarea_titulo || "Seguimiento"}" (vence en ${r.tarea_dias} día${
      r.tarea_dias === 1 ? "" : "s"
    })`;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Reglas activas</CardTitle>
          <CardDescription>Se ejecutan solas, sin que nadie tenga que acordarse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reglas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay reglas. Creá la primera abajo.</p>
          ) : (
            reglas.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Zap
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      r.activa ? "text-foreground" : "text-muted-foreground/40"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">{descripcion(r)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={r.activa} onCheckedChange={() => toggle(r)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => borrar(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nueva regla</CardTitle>
          <CardDescription>Elegí cuándo se dispara y qué tarea crea.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={agregar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regla-nombre">Nombre de la regla</Label>
              <Input
                id="regla-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Llamar a leads nuevos"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="regla-evento">Cuándo</Label>
                <Select value={evento} onValueChange={setEvento}>
                  <SelectTrigger id="regla-evento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_nuevo">Cuando entra un lead nuevo</SelectItem>
                    <SelectItem value="lead_en_etapa">Cuando un lead llega a una etapa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {evento === "lead_en_etapa" && (
                <div className="space-y-2">
                  <Label htmlFor="regla-etapa">Etapa</Label>
                  <Select value={etapaId} onValueChange={setEtapaId}>
                    <SelectTrigger id="regla-etapa">
                      <SelectValue placeholder="Elegí la etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {etapas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-4">
              <div className="space-y-2">
                <Label htmlFor="regla-titulo">Tarea a crear</Label>
                <Input
                  id="regla-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Llamar al lead (vacío = se arma solo)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regla-dias">Vence en (días)</Label>
                <Input
                  id="regla-dias"
                  type="number"
                  min="0"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? "Creando..." : "Crear regla"}
              </Button>
              {err && <span className="text-sm text-destructive">{err}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
