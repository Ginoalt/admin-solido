import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users, Workflow, CalendarDays } from "lucide-react";

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

function InicioPage() {
  const [clientes, setClientes] = useState(0);
  const [clientesActivos, setClientesActivos] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [proximasCount, setProximasCount] = useState(0);
  const [proximas, setProximas] = useState<CitaProxima[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ahora = new Date().toISOString();
    async function load() {
      const [cTot, cAct, lTot, citasProx, citasCount] = await Promise.all([
        supabase.from("profesionales").select("*", { count: "exact", head: true }),
        supabase
          .from("profesionales")
          .select("*", { count: "exact", head: true })
          .eq("estado", "activo"),
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase
          .from("citas")
          .select("id, fecha_hora, estado, profesionales(nombre), leads(nombre)")
          .gte("fecha_hora", ahora)
          .order("fecha_hora", { ascending: true })
          .limit(6),
        supabase
          .from("citas")
          .select("*", { count: "exact", head: true })
          .gte("fecha_hora", ahora),
      ]);
      setClientes(cTot.count ?? 0);
      setClientesActivos(cAct.count ?? 0);
      setLeadsCount(lTot.count ?? 0);
      setProximas((citasProx.data ?? []) as CitaProxima[]);
      setProximasCount(citasCount.count ?? 0);
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

  const stats = [
    {
      label: "Clientes",
      valor: clientes,
      detalle: `${clientesActivos} activos`,
      icon: Users,
      to: "/clientes" as const,
    },
    {
      label: "Leads",
      valor: leadsCount,
      detalle: "en todos los embudos",
      icon: Workflow,
      to: "/crm" as const,
    },
    {
      label: "Citas próximas",
      valor: proximasCount,
      detalle: "agendadas de acá en más",
      icon: CalendarDays,
      to: "/agenda" as const,
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="text-sm text-muted-foreground">Resumen de tu operación</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => {
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
