import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Users, Workflow, CalendarDays, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inicio")({
  component: InicioPage,
});

type CitaProxima = {
  id: string;
  fecha_hora: string;
  estado: string | null;
  profesionales: { nombre: string | null } | null;
  leads: { nombre: string | null } | null;
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
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Una fila de barra horizontal simple
function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type Embudo = {
  enProceso: number;
  ganados: number;
  perdidos: number;
  sinEtapa: number;
};

function InicioPage() {
  const [clientes, setClientes] = useState(0);
  const [clientesActivos, setClientesActivos] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [proximasCount, setProximasCount] = useState(0);
  const [citasSemana, setCitasSemana] = useState(0);
  const [proximas, setProximas] = useState<CitaProxima[]>([]);
  const [embudo, setEmbudo] = useState<Embudo>({
    enProceso: 0,
    ganados: 0,
    perdidos: 0,
    sinEtapa: 0,
  });
  const [citasPorEstado, setCitasPorEstado] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { esAdmin } = useMiPerfil();

  useEffect(() => {
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const semanaIso = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    async function load() {
      const [cTot, cAct, leadsRes, citasProx, citasFuturas, citasEstadosRes, citasSemanaRes] =
        await Promise.all([
          supabase.from("profesionales").select("*", { count: "exact", head: true }),
          supabase
            .from("profesionales")
            .select("*", { count: "exact", head: true })
            .eq("estado", "activo"),
          supabase.from("leads").select("id, etapas_pipeline(tipo)"),
          supabase
            .from("citas")
            .select("id, fecha_hora, estado, profesionales(nombre), leads(nombre)")
            .gte("fecha_hora", ahoraIso)
            .order("fecha_hora", { ascending: true })
            .limit(6),
          supabase
            .from("citas")
            .select("*", { count: "exact", head: true })
            .gte("fecha_hora", ahoraIso),
          supabase.from("citas").select("estado"),
          supabase
            .from("citas")
            .select("*", { count: "exact", head: true })
            .gte("fecha_hora", ahoraIso)
            .lte("fecha_hora", semanaIso),
        ]);

      setClientes(cTot.count ?? 0);
      setClientesActivos(cAct.count ?? 0);
      setProximas((citasProx.data ?? []) as CitaProxima[]);
      setProximasCount(citasFuturas.count ?? 0);
      setCitasSemana(citasSemanaRes.count ?? 0);

      // Embudo: agrupar leads por el tipo de su etapa
      const leadsArr = (leadsRes.data ?? []) as {
        etapas_pipeline: { tipo: string | null } | null;
      }[];
      const emb: Embudo = { enProceso: 0, ganados: 0, perdidos: 0, sinEtapa: 0 };
      for (const l of leadsArr) {
        const tipo = l.etapas_pipeline?.tipo;
        if (!l.etapas_pipeline) emb.sinEtapa++;
        else if (tipo === "ganado") emb.ganados++;
        else if (tipo === "perdido") emb.perdidos++;
        else emb.enProceso++;
      }
      setEmbudo(emb);
      setLeadsCount(leadsArr.length);

      // Citas por estado
      const citasEst = (citasEstadosRes.data ?? []) as { estado: string | null }[];
      const porEstado: Record<string, number> = {};
      for (const c of citasEst) {
        const k = c.estado ?? "agendada";
        porEstado[k] = (porEstado[k] ?? 0) + 1;
      }
      setCitasPorEstado(porEstado);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  const cerrados = embudo.ganados + embudo.perdidos;
  const tasaGanados = cerrados > 0 ? Math.round((embudo.ganados / cerrados) * 100) : null;

  const stats = [
    {
      label: "Clientes",
      valor: String(clientes),
      detalle: `${clientesActivos} activos`,
      icon: Users,
      to: "/clientes" as const,
    },
    {
      label: "Leads",
      valor: String(leadsCount),
      detalle: "en todos los embudos",
      icon: Workflow,
      to: "/crm" as const,
    },
    {
      label: "Citas próximas",
      valor: String(proximasCount),
      detalle: `${citasSemana} en los próximos 7 días`,
      icon: CalendarDays,
      to: "/agenda" as const,
    },
    {
      label: "Tasa de ganados",
      valor: tasaGanados != null ? `${tasaGanados}%` : "—",
      detalle:
        cerrados > 0
          ? `${embudo.ganados} ganados / ${embudo.perdidos} perdidos`
          : "sin casos cerrados aún",
      icon: Trophy,
      to: "/crm" as const,
    },
  ];

  const maxEmbudo = Math.max(
    embudo.enProceso,
    embudo.ganados,
    embudo.perdidos,
    embudo.sinEtapa,
    1,
  );
  const maxCitas = Math.max(1, ...Object.values(citasPorEstado));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="text-sm text-muted-foreground">Resumen de tu operación</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.filter((s) => esAdmin || s.label !== "Clientes").map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {s.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{s.valor}</div>
                  <p className="text-xs text-muted-foreground mt-1">{s.detalle}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Embudo de leads</CardTitle>
            <CardDescription>Todos los clientes, por situación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leadsCount === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay leads.</p>
            ) : (
              <>
                <BarRow label="En proceso" value={embudo.enProceso} max={maxEmbudo} color="bg-blue-500" />
                <BarRow label="Ganados" value={embudo.ganados} max={maxEmbudo} color="bg-emerald-500" />
                <BarRow label="Perdidos" value={embudo.perdidos} max={maxEmbudo} color="bg-rose-500" />
                <BarRow
                  label="Sin etapa"
                  value={embudo.sinEtapa}
                  max={maxEmbudo}
                  color="bg-muted-foreground/40"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Citas por estado</CardTitle>
            <CardDescription>Cómo vienen tus consultas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(citasPorEstado).length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay citas.</p>
            ) : (
              Object.keys(ESTADOS).map((k) => (
                <BarRow
                  key={k}
                  label={ESTADOS[k]}
                  value={citasPorEstado[k] ?? 0}
                  max={maxCitas}
                  color={COLOR_ESTADO[k] ?? "bg-primary"}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas citas</CardTitle>
          <CardDescription>Las que vienen, ordenadas por fecha.</CardDescription>
        </CardHeader>
        <CardContent>
          {proximas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay citas próximas.</p>
          ) : (
            <ul className="divide-y">
              {proximas.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {c.leads?.nombre || "Sin lead"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.profesionales?.nombre || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatFecha(c.fecha_hora)}</p>
                    <p className="text-xs text-muted-foreground">
                      {ESTADOS[c.estado ?? "agendada"] ?? c.estado}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
