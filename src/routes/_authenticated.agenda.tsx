import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type Profesional = { id: string; nombre: string | null };
type LeadMin = { id: string; nombre: string | null };
type Cita = {
  id: string;
  lead_id: string | null;
  fecha_hora: string;
  estado: string | null;
  origen_agenda: string | null;
};

const ESTADOS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  atendida: "Atendida",
  no_show: "No asistió",
  cancelada: "Cancelada",
};

const COLOR_ESTADO: Record<string, string> = {
  agendada: "bg-blue-500",
  confirmada: "bg-emerald-500",
  atendida: "bg-green-600",
  no_show: "bg-amber-500",
  cancelada: "bg-rose-500",
};

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function horaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Calendario mensual con las citas en cada día
function CalendarioMes({
  citas,
  leadNombre,
}: {
  citas: Cita[];
  leadNombre: (id: string | null) => string;
}) {
  const hoy = new Date();
  const [ym, setYm] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });

  const primerDiaSemana = new Date(ym.y, ym.m, 1).getDay();
  const diasEnMes = new Date(ym.y, ym.m + 1, 0).getDate();

  const porDia: Record<number, Cita[]> = {};
  for (const c of citas) {
    const d = new Date(c.fecha_hora);
    if (d.getFullYear() === ym.y && d.getMonth() === ym.m) {
      (porDia[d.getDate()] ??= []).push(c);
    }
  }
  for (const k in porDia) porDia[k].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

  const celdas: (number | null)[] = [];
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  function mover(delta: number) {
    setYm((p) => {
      const nm = p.m + delta;
      return { y: p.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  const esHoy = (d: number) =>
    hoy.getFullYear() === ym.y && hoy.getMonth() === ym.m && hoy.getDate() === d;

  return (
    <div className="mb-4 rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize">
          {MESES_LARGOS[ym.m]} {ym.y}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mover(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setYm({ y: hoy.getFullYear(), m: hoy.getMonth() })}
          >
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mover(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {celdas.map((d, i) => (
          <div
            key={i}
            className={`min-h-[5rem] rounded-md border p-1 ${d == null ? "bg-muted/20" : ""}`}
          >
            {d != null && (
              <>
                <div
                  className={`text-xs ${
                    esHoy(d)
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {d}
                </div>
                <div className="mt-1 space-y-1">
                  {(porDia[d] ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1 rounded bg-muted/60 px-1 py-0.5 text-[10px] leading-tight"
                      title={`${horaCorta(c.fecha_hora)} · ${leadNombre(c.lead_id)}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          COLOR_ESTADO[c.estado ?? "agendada"] ?? "bg-muted-foreground"
                        }`}
                      />
                      <span className="truncate">
                        {horaCorta(c.fecha_hora)} {leadNombre(c.lead_id)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaPage() {
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [leads, setLeads] = useState<LeadMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNueva, setOpenNueva] = useState(false);
  const [deleting, setDeleting] = useState<Cita | null>(null);
  const [delErr, setDelErr] = useState<string | null>(null);
  const { esAdmin } = useMiPerfil();

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

  async function load(profesionalId: string) {
    setError(null);
    const [citasRes, leadsRes] = await Promise.all([
      supabase
        .from("citas")
        .select("id, lead_id, fecha_hora, estado, origen_agenda")
        .eq("profesional_id", profesionalId)
        .order("fecha_hora", { ascending: true }),
      supabase
        .from("leads")
        .select("id, nombre")
        .eq("profesional_id", profesionalId)
        .order("nombre", { ascending: true }),
    ]);
    if (citasRes.error) return setError(citasRes.error.message);
    setCitas((citasRes.data ?? []) as Cita[]);
    setLeads((leadsRes.data ?? []) as LeadMin[]);
  }

  useEffect(() => {
    if (selId) load(selId);
    else {
      setCitas([]);
      setLeads([]);
    }
  }, [selId]);

  function leadNombre(id: string | null): string {
    if (!id) return "—";
    return leads.find((l) => l.id === id)?.nombre || "Lead";
  }

  async function cambiarEstado(citaId: string, estado: string) {
    setCitas((prev) =>
      prev.map((c) => (c.id === citaId ? { ...c, estado } : c)),
    );
    const { error } = await supabase.from("citas").update({ estado }).eq("id", citaId);
    if (error && selId) load(selId);
  }

  async function confirmarBorrado() {
    if (!deleting) return;
    setDelErr(null);
    const { error } = await supabase.from("citas").delete().eq("id", deleting.id);
    if (error) {
      setDelErr(error.message);
      return;
    }
    setDeleting(null);
    if (selId) load(selId);
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
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no hay clientes. Creá uno en la sección <strong>Clientes</strong> para
          gestionar sus citas.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">Citas agendadas por cliente</p>
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
          <Dialog open={openNueva} onOpenChange={setOpenNueva}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Nueva cita
              </Button>
            </DialogTrigger>
            <NuevaCitaDialog
              profesionalId={selId!}
              leads={leads}
              onCreated={() => {
                setOpenNueva(false);
                if (selId) load(selId);
              }}
            />
          </Dialog>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <CalendarioMes citas={citas} leadNombre={leadNombre} />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="w-12 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {citas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Sin citas
                </TableCell>
              </TableRow>
            ) : (
              citas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{formatFecha(c.fecha_hora)}</TableCell>
                  <TableCell>{leadNombre(c.lead_id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          COLOR_ESTADO[c.estado ?? "agendada"] ?? "bg-muted-foreground"
                        }`}
                      />
                      <Select
                        value={c.estado ?? "agendada"}
                        onValueChange={(v) => cambiarEstado(c.id, v)}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ESTADOS).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.origen_agenda ?? "manual"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(c)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${formatFecha(deleting.fecha_hora)} — ${leadNombre(deleting.lead_id)}. `
                : ""}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {delErr && <p className="text-sm text-destructive">{delErr}</p>}
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
    </div>
  );
}

function NuevaCitaDialog({
  profesionalId,
  leads,
  onCreated,
}: {
  profesionalId: string;
  leads: LeadMin[];
  onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState("agendada");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) {
      setError("Elegí fecha y hora.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("citas").insert({
      profesional_id: profesionalId,
      lead_id: leadId || null,
      fecha_hora: new Date(fecha).toISOString(),
      estado,
      origen_agenda: "manual",
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
        <DialogTitle>Nueva cita</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cita-lead">Lead</Label>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente no tiene leads todavía. Podés crear la cita sin lead o cargar
              uno en el CRM.
            </p>
          ) : (
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger id="cita-lead">
                <SelectValue placeholder="Elegí un lead (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre || "Sin nombre"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cita-fecha">Fecha y hora</Label>
          <Input
            id="cita-fecha"
            type="datetime-local"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cita-estado">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger id="cita-estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ESTADOS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Crear cita"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
