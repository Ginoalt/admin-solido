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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Users, Trophy, Target, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
});

type Profesional = { id: string; nombre: string | null };
type Lead = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  origen: string | null;
  created_at: string;
  etapas_pipeline: { nombre: string | null; tipo: string | null } | null;
};
type Cita = { estado: string | null; fecha_hora: string };

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function ReportesPage() {
  const { esAdmin, perfil, loading: perfilLoading } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pid = esAdmin ? selId : perfil?.profesional_id ?? null;
  const habilitado = esAdmin || perfil?.modulos?.["reportes"] === true;

  useEffect(() => {
    if (!esAdmin) {
      setLoading(false);
      return;
    }
    const pre =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("cliente") : null;
    supabase
      .from("profesionales")
      .select("id, nombre")
      .order("nombre", { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Profesional[];
        setProfesionales(list);
        if (list.length > 0) setSelId(pre && list.some((p) => p.id === pre) ? pre : list[0].id);
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
      <div className="p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Este módulo no está disponible en tu plan.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">Tus números, con filtro por período y exportación.</p>
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
        <ReportesCard key={pid} profesionalId={pid} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Elegí un cliente para ver sus reportes.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportesCard({ profesionalId }: { profesionalId: string }) {
  const [periodo, setPeriodo] = useState("90");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    const dias = periodo === "todo" ? null : parseInt(periodo, 10);
    const desde = dias ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString() : null;

    async function load() {
      let qLeads = supabase
        .from("leads")
        .select("id, nombre, telefono, origen, created_at, etapas_pipeline(nombre, tipo)")
        .eq("profesional_id", profesionalId);
      let qCitas = supabase.from("citas").select("estado, fecha_hora").eq("profesional_id", profesionalId);
      if (desde) {
        qLeads = qLeads.gte("created_at", desde);
        qCitas = qCitas.gte("fecha_hora", desde);
      }
      const [l, c] = await Promise.all([qLeads, qCitas]);
      if (!activo) return;
      setLeads((l.data ?? []) as Lead[]);
      setCitas((c.data ?? []) as Cita[]);
      setCargando(false);
    }
    load();
    return () => {
      activo = false;
    };
  }, [profesionalId, periodo]);

  const totalLeads = leads.length;
  const ganados = leads.filter((l) => l.etapas_pipeline?.tipo === "ganado").length;
  const tasaCierre = totalLeads > 0 ? Math.round((ganados / totalLeads) * 100) : 0;
  const atendidas = citas.filter((c) => c.estado === "atendida").length;
  const noShow = citas.filter((c) => c.estado === "no_show").length;

  const porOrigen = agrupar(leads, (l) => l.origen || "Sin origen");
  const porEtapa = agrupar(leads, (l) => l.etapas_pipeline?.nombre || "Sin etapa");
  const porMes = agruparMes(leads);
  const maxMes = Math.max(1, ...porMes.map((m) => m.count));

  function exportar() {
    const filas: string[][] = [["Nombre", "Teléfono", "Origen", "Etapa", "Fecha"]];
    for (const l of leads) {
      filas.push([
        l.nombre || "",
        l.telefono || "",
        l.origen || "",
        l.etapas_pipeline?.nombre || "",
        fechaCorta(l.created_at),
      ]);
    }
    const csv = filas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reportes-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
            <SelectItem value="365">Último año</SelectItem>
            <SelectItem value="todo">Todo el historial</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={exportar} disabled={leads.length === 0}>
          <Download className="h-4 w-4" />
          Exportar a Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Leads" valor={String(totalLeads)} icon={Users} />
        <Stat label="Ganados" valor={String(ganados)} icon={Trophy} />
        <Stat label="Tasa de cierre" valor={`${tasaCierre}%`} icon={Target} />
        <Stat label="Citas atendidas" valor={`${atendidas}`} detalle={`${noShow} no-show`} icon={CalendarDays} />
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Calculando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Breakdown titulo="Leads por origen" total={totalLeads} filas={porOrigen} />
            <Breakdown titulo="Leads por etapa" total={totalLeads} filas={porEtapa} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Leads por mes</CardTitle>
              <CardDescription>Cómo evolucionó la entrada de leads.</CardDescription>
            </CardHeader>
            <CardContent>
              {porMes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {porMes.map((m) => (
                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1 h-full">
                      <div className="flex items-end w-full h-full justify-center">
                        <div
                          className="w-7 rounded-t bg-foreground"
                          style={{ height: `${(m.count / maxMes) * 100}%` }}
                          title={`${m.count} leads`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  valor,
  detalle,
  icon: Icon,
}: {
  label: string;
  valor: string;
  detalle?: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{valor}</div>
        {detalle && <p className="text-[11px] text-muted-foreground mt-1">{detalle}</p>}
      </CardContent>
    </Card>
  );
}

function Breakdown({
  titulo,
  total,
  filas,
}: {
  titulo: string;
  total: number;
  filas: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...filas.map((f) => f.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          filas.map((f) => (
            <div key={f.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{f.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {f.count}
                  {total > 0 && ` · ${Math.round((f.count / total) * 100)}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${(f.count / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function agrupar(leads: Lead[], key: (l: Lead) => string): { label: string; count: number }[] {
  const mapa = new Map<string, number>();
  for (const l of leads) {
    const k = key(l);
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function agruparMes(leads: Lead[]): { key: string; label: string; count: number }[] {
  const mapa = new Map<string, { label: string; count: number }>();
  for (const l of leads) {
    const d = new Date(l.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const prev = mapa.get(k);
    if (prev) prev.count++;
    else mapa.set(k, { label: MESES[d.getMonth()], count: 1 });
  }
  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([key, v]) => ({ key, label: v.label, count: v.count }));
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
}
