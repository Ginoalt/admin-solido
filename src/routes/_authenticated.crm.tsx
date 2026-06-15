import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil } from "@/lib/perfil";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CalendarPlus, Search } from "lucide-react";

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
  notas: string | null;
  datos_extra: Record<string, unknown> | null;
};
type Campo = {
  id: string;
  nombre: string;
  clave: string;
  tipo: string;
  opciones: string[] | null;
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

// ¿El lead coincide con lo que se está buscando? (nombre / teléfono / email)
function leadCoincide(lead: Lead, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [lead.nombre, lead.telefono, lead.email].some((v) =>
    (v ?? "").toLowerCase().includes(t),
  );
}

function CrmPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNuevo, setOpenNuevo] = useState(false);
  const [fichaLead, setFichaLead] = useState<Lead | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const { esAdmin } = useMiPerfil();

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
    const [etapasRes, leadsRes, camposRes] = await Promise.all([
      supabase
        .from("etapas_pipeline")
        .select("id, nombre, orden, color, tipo")
        .eq("profesional_id", profesionalId)
        .order("orden", { ascending: true }),
      supabase
        .from("leads")
        .select("id, nombre, telefono, email, etapa_id, notas, datos_extra")
        .eq("profesional_id", profesionalId)
        .order("created_at", { ascending: false }),
      supabase
        .from("campos_personalizados")
        .select("id, nombre, clave, tipo, opciones")
        .eq("profesional_id", profesionalId)
        .order("orden", { ascending: true }),
    ]);
    if (etapasRes.error) return setError(etapasRes.error.message);
    if (leadsRes.error) return setError(leadsRes.error.message);
    setEtapas((etapasRes.data ?? []) as Etapa[]);
    setLeads((leadsRes.data ?? []) as Lead[]);
    setCampos((camposRes.data ?? []) as Campo[]);
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

      {etapas.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead por nombre o teléfono..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

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
            const leadsEtapa = leads.filter(
              (l) => l.etapa_id === etapa.id && leadCoincide(l, q),
            );
            return (
              <div key={etapa.id} className="w-72 shrink-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-sm font-medium">{etapa.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {leadsEtapa.length}
                  </span>
                </div>
                <div
                  className={`space-y-2 rounded-lg p-2 min-h-24 transition-colors ${
                    dragOverEtapa === etapa.id
                      ? "bg-primary/10 ring-2 ring-primary/40"
                      : "bg-muted/40"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverEtapa !== etapa.id) setDragOverEtapa(etapa.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverEtapa(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragLeadId) {
                      const l = leads.find((x) => x.id === dragLeadId);
                      if (l && l.etapa_id !== etapa.id) moverLead(dragLeadId, etapa.id);
                    }
                    setDragLeadId(null);
                    setDragOverEtapa(null);
                  }}
                >
                  {leadsEtapa.length === 0 && (
                    <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                      Arrastrá un lead acá
                    </p>
                  )}
                  {leadsEtapa.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        setDragLeadId(lead.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragLeadId(null);
                        setDragOverEtapa(null);
                      }}
                      className={`rounded-md border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing ${
                        dragLeadId === lead.id ? "opacity-50" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFichaLead(lead)}
                        className="block w-full text-left"
                      >
                        <p className="text-sm font-medium hover:underline">
                          {lead.nombre || "Sin nombre"}
                        </p>
                        {lead.telefono && (
                          <p className="text-xs text-muted-foreground">{lead.telefono}</p>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!fichaLead} onOpenChange={(o) => !o && setFichaLead(null)}>
        {fichaLead && (
          <FichaLeadDialog
            lead={fichaLead}
            profesionalId={selId!}
            etapas={etapas}
            campos={campos}
            onSaved={() => {
              setFichaLead(null);
              if (selId) loadTablero(selId);
            }}
            onDeleted={() => {
              setFichaLead(null);
              if (selId) loadTablero(selId);
            }}
          />
        )}
      </Dialog>
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

function FichaLeadDialog({
  lead,
  profesionalId,
  etapas,
  campos,
  onSaved,
  onDeleted,
}: {
  lead: Lead;
  profesionalId: string;
  etapas: Etapa[];
  campos: Campo[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [nombre, setNombre] = useState(lead.nombre ?? "");
  const [telefono, setTelefono] = useState(lead.telefono ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [etapaId, setEtapaId] = useState(lead.etapa_id ?? "");
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [extra, setExtra] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    const d = (lead.datos_extra ?? {}) as Record<string, unknown>;
    for (const c of campos) {
      base[c.clave] = d[c.clave] != null ? String(d[c.clave]) : "";
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCampoValor(clave: string, valor: string) {
    setExtra((prev) => ({ ...prev, [clave]: valor }));
  }

  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fechaCita, setFechaCita] = useState("");
  const [agendando, setAgendando] = useState(false);
  const [citaMsg, setCitaMsg] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setDeleting(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDeleted();
  }

  async function agendarCita() {
    if (!fechaCita) {
      setError("Elegí fecha y hora para la cita.");
      return;
    }
    setAgendando(true);
    setError(null);
    setCitaMsg(null);
    const { error } = await supabase.from("citas").insert({
      profesional_id: profesionalId,
      lead_id: lead.id,
      fecha_hora: new Date(fechaCita).toISOString(),
      estado: "agendada",
      origen_agenda: "manual",
    });
    setAgendando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setFechaCita("");
    setCitaMsg("Cita agendada — la ves en la Agenda de este cliente.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const datos_extra: Record<string, string> = {};
    for (const c of campos) {
      if (extra[c.clave]) datos_extra[c.clave] = extra[c.clave];
    }
    const { error } = await supabase
      .from("leads")
      .update({
        nombre,
        telefono,
        email,
        etapa_id: etapaId || null,
        notas,
        datos_extra,
      })
      .eq("id", lead.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Ficha del lead</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ficha-nombre">Nombre</Label>
          <Input id="ficha-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ficha-telefono">Teléfono</Label>
            <Input id="ficha-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ficha-email">Email</Label>
            <Input id="ficha-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ficha-etapa">Etapa</Label>
          <Select value={etapaId} onValueChange={setEtapaId}>
            <SelectTrigger id="ficha-etapa">
              <SelectValue placeholder="Elegí una etapa" />
            </SelectTrigger>
            <SelectContent>
              {etapas.map((et) => (
                <SelectItem key={et.id} value={et.id}>
                  {et.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {campos.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground">Campos personalizados</p>
            {campos.map((c) => (
              <div key={c.id} className="space-y-2">
                <Label htmlFor={`campo-${c.clave}`}>{c.nombre}</Label>
                {c.tipo === "lista" ? (
                  <Select
                    value={extra[c.clave] || undefined}
                    onValueChange={(v) => setCampoValor(c.clave, v)}
                  >
                    <SelectTrigger id={`campo-${c.clave}`}>
                      <SelectValue placeholder="Elegí una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {(c.opciones ?? []).map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`campo-${c.clave}`}
                    type={c.tipo === "numero" ? "number" : c.tipo === "fecha" ? "date" : "text"}
                    value={extra[c.clave] ?? ""}
                    onChange={(e) => setCampoValor(c.clave, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ficha-notas">Notas</Label>
          <Textarea id="ficha-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="ficha-cita">Agendar consulta</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ficha-cita"
              type="datetime-local"
              value={fechaCita}
              onChange={(e) => setFechaCita(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={agendando}
              onClick={agendarCita}
            >
              <CalendarPlus className="h-4 w-4" />
              {agendando ? "..." : "Agendar"}
            </Button>
          </div>
          {citaMsg && <p className="text-sm text-muted-foreground">{citaMsg}</p>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="sm:justify-between gap-2">
          {!confirmDel ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="h-4 w-4" />
                Borrar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full justify-end">
              <span className="text-sm text-muted-foreground mr-auto">
                ¿Borrar este lead?
              </span>
              <Button type="button" variant="ghost" onClick={() => setConfirmDel(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
