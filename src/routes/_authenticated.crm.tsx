import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  component: CrmPage,
});

type Profesional = { id: string; nombre: string | null; rubro: string | null };
type Etapa = {
  id: string;
  nombre: string;
  orden: number;
  color: string | null;
  tipo: string | null;
};
type Lead = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  etapa_id: string | null;
};

// Plantillas de etapas por rubro (se siembran la primera vez)
const PLANTILLAS: Record<string, string[]> = {
  abogado: ["Consulta", "Análisis de caso", "Contrato", "Ganado", "Perdido"],
  medico: ["Cita solicitada", "Confirmada", "Atendido", "No asistió"],
  otro: ["Nuevo", "En proceso", "Ganado", "Perdido"],
};

function tipoDeEtapa(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("ganado") || n.includes("contrato") || n.includes("atendido")) return "ganado";
  if (n.includes("perdido") || n.includes("no asist")) return "perdido";
  return "normal";
}

function CrmPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNuevo, setOpenNuevo] = useState(false);

  const seleccionado = useMemo(
    () => profesionales.find((p) => p.id === selId) ?? null,
    [profesionales, selId],
  );

  // Cargar la lista de clientes una vez
  useEffect(() => {
    supabase
      .from("profesionales")
      .select("id, nombre, rubro")
      .order("nombre", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else {
          const list = (data ?? []) as Profesional[];
          setProfesionales(list);
          if (list.length > 0) setSelId(list[0].id);
        }
        setLoading(false);
      });
  }, []);

  // Cargar etapas + leads del cliente seleccionado
  async function loadTablero(profesionalId: string) {
    setError(null);
    const [etapasRes, leadsRes] = await Promise.all([
      supabase
        .from("etapas_pipeline")
        .select("id, nombre, orden, color, tipo")
        .eq("profesional_id", profesionalId)
        .order("orden", { ascending: true }),
      supabase
        .from("leads")
        .select("id, nombre, telefono, email, etapa_id")
        .eq("profesional_id", profesionalId)
        .order("created_at", { ascending: false }),
    ]);
    if (etapasRes.error) return setError(etapasRes.error.message);
    if (leadsRes.error) return setError(leadsRes.error.message);
    setEtapas((etapasRes.data ?? []) as Etapa[]);
    setLeads((leadsRes.data ?? []) as Lead[]);
  }

  useEffect(() => {
    if (selId) loadTablero(selId);
    else {
      setEtapas([]);
      setLeads([]);
    }
  }, [selId]);

  // Sembrar etapas por defecto según el rubro
  async function sembrarEtapas() {
    if (!seleccionado) return;
    const plantilla = PLANTILLAS[seleccionado.rubro ?? "otro"] ?? PLANTILLAS.otro;
    const filas = plantilla.map((nombre, i) => ({
      profesional_id: seleccionado.id,
      nombre,
      orden: i,
      tipo: tipoDeEtapa(nombre),
    }));
    const { error } = await supabase.from("etapas_pipeline").insert(filas);
    if (error) setError(error.message);
    else loadTablero(seleccionado.id);
  }

  // Mover un lead a otra etapa
  async function moverLead(leadId: string, etapaId: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, etapa_id: etapaId } : l)),
    );
    const { error } = await supabase
      .from("leads")
      .update({ etapa_id: etapaId })
      .eq("id", leadId);
    if (error && selId) loadTablero(selId);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  if (profesionales.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no hay clientes. Creá uno en la sección <strong>Clientes</strong> para
          empezar a gestionar sus leads.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">Embudo de leads por cliente</p>
        </div>
        <div className="flex items-center gap-2">
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
          {etapas.length > 0 && (
            <Dialog open={openNuevo} onOpenChange={setOpenNuevo}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo lead
                </Button>
              </DialogTrigger>
              <NuevoLeadDialog
                profesionalId={selId!}
                etapas={etapas}
                onCreated={() => {
                  setOpenNuevo(false);
                  if (selId) loadTablero(selId);
                }}
              />
            </Dialog>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {etapas.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Este cliente todavía no tiene un embudo configurado.
          </p>
          <Button className="mt-4" onClick={sembrarEtapas}>
            Crear etapas por defecto
          </Button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {etapas.map((etapa) => {
            const leadsEtapa = leads.filter((l) => l.etapa_id === etapa.id);
            return (
              <div key={etapa.id} className="w-72 shrink-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-sm font-medium">{etapa.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {leadsEtapa.length}
                  </span>
                </div>
                <div className="space-y-2 rounded-lg bg-muted/40 p-2 min-h-24">
                  {leadsEtapa.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-md border bg-card p-3 shadow-sm"
                    >
                      <p className="text-sm font-medium">{lead.nombre || "Sin nombre"}</p>
                      {lead.telefono && (
                        <p className="text-xs text-muted-foreground">{lead.telefono}</p>
                      )}
                      <Select
                        value={lead.etapa_id ?? undefined}
                        onValueChange={(v) => moverLead(lead.id, v)}
                      >
                        <SelectTrigger className="mt-2 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {etapas.map((e) => (
                            <SelectItem key={e.id} value={e.id} className="text-xs">
                              {e.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NuevoLeadDialog({
  profesionalId,
  etapas,
  onCreated,
}: {
  profesionalId: string;
  etapas: Etapa[];
  onCreated: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [etapaId, setEtapaId] = useState(etapas[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("leads").insert({
      profesional_id: profesionalId,
      nombre,
      telefono,
      email,
      etapa_id: etapaId || null,
      origen: "manual",
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuevo lead</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lead-nombre">Nombre</Label>
          <Input
            id="lead-nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-telefono">Teléfono</Label>
          <Input
            id="lead-telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-email">Email</Label>
          <Input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-etapa">Etapa</Label>
          <Select value={etapaId} onValueChange={setEtapaId}>
            <SelectTrigger id="lead-etapa">
              <SelectValue placeholder="Elegí una etapa" />
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Crear lead"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
