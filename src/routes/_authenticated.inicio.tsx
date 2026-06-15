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
import {
  Users,
  Workflow,
  CalendarDays,
  CalendarCheck,
  UserX,
  Target,
  ArrowRight,
} from "lucide-react";
import { AsistenteIA } from "@/components/asistente-ia";

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

type TareaPend = {
  id: string;
  titulo: string;
  vence: string | null;
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

const COLOR_TIPO: Record<string, string> = {
  ganado: "bg-emerald-500",
  perdido: "bg-rose-500",
  normal: "bg-blue-500",
};

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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

// Medidor de media luna (gauge)
function Gauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const cx = 100, cy = 100, r = 80;
  const theta = ((180 - (v / 100) * 180) * Math.PI) / 180;
  const ex = cx + r * Math.cos(theta);
  const ey = cy - r * Math.sin(theta);
  const bg = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fg = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  const color = v >= 70 ? "#10b981" : v >= 40 ? "#f59e0b" : "#f43f5e";
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
      <path d={bg} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" strokeLinecap="round" />
      <path d={fg} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" />
      <text x="100" y="92" textAnchor="middle" className="fill-foreground" fontSize="30" fontWeight="700">
        {Math.round(v)}%
      </text>
    </svg>
  );
}

// Barra horizontal simple
function BarRow({
  label,
  value,
  max,
  color,
  monto,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  monto?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {monto ? `${value} · ${monto}` : value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type EtapaAgg = { nombre: string; orden: number; tipo: string; count: number };

function InicioPage() {
  const { esAdmin } = useMiPerfil();
  const [loading, setLoading] = useState(true);

  const [clientes, setClientes] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [citasTotal, setCitasTotal] = useState(0);
  const [atendidas, setAtendidas] = useState(0);
  const [noShow, setNoShow] = useState(0);
  const [proximasCount, setProximasCount] = useState(0);

  const [pipeline, setPipeline] = useState<EtapaAgg[]>([]);
  const [porEstado, setPorEstado] = useState<Record<string, number>>({});
  const [porMes, setPorMes] = useState<{ label: string; agendadas: number; atendidas: number }[]>([]);
  const [porDia, setPorDia] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [proximas, setProximas] = useState<CitaProxima[]>([]);
  const [sinMarcar, setSinMarcar] = useState<CitaProxima[]>([]);
  const [pendientes, setPendientes] = useState<TareaPend[]>([]);

  useEffect(() => {
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const semanaIso = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    async function load() {
      const [cTot, leadsRes, citasRes, proximasRes, sinMarcarRes, proxCount, tareasRes] =
        await Promise.all([
        supabase.from("profesionales").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("etapa_id, etapas_pipeline(nombre, orden, tipo)"),
        supabase.from("citas").select("fecha_hora, estado"),
        supabase
          .from("citas")
          .select("id, fecha_hora, estado, profesionales(nombre), leads(nombre)")
          .gte("fecha_hora", ahoraIso)
          .order("fecha_hora", { ascending: true })
          .limit(6),
        supabase
          .from("citas")
          .select("id, fecha_hora, estado, profesionales(nombre), leads(nombre)")
          .lt("fecha_hora", ahoraIso)
          .in("estado", ["agendada", "confirmada"])
          .order("fecha_hora", { ascending: false })
          .limit(6),
        supabase
          .from("citas")
          .select("*", { count: "exact", head: true })
          .gte("fecha_hora", ahoraIso)
          .lte("fecha_hora", semanaIso),
        supabase
          .from("tareas")
          .select("id, titulo, vence, leads(nombre)")
          .eq("hecha", false)
          .order("vence", { ascending: true, nullsFirst: false })
          .limit(8),
      ]);

      setClientes(cTot.count ?? 0);
      setProximas((proximasRes.data ?? []) as CitaProxima[]);
      setSinMarcar((sinMarcarRes.data ?? []) as CitaProxima[]);
      setProximasCount(proxCount.count ?? 0);
      setPendientes((tareasRes.data ?? []) as TareaPend[]);

      // Pipeline por etapa (agrupado por nombre, conservando orden y tipo)
      const leadsArr = (leadsRes.data ?? []) as {
        etapa_id: string | null;
        etapas_pipeline: { nombre: string | null; orden: number | null; tipo: string | null } | null;
      }[];
      setLeadsCount(leadsArr.length);
      const mapaEtapas = new Map<string, EtapaAgg>();
      for (const l of leadsArr) {
        const e = l.etapas_pipeline;
        if (!e || !e.nombre) continue;
        const prev = mapaEtapas.get(e.nombre);
        if (prev) prev.count++;
        else
          mapaEtapas.set(e.nombre, {
            nombre: e.nombre,
            orden: e.orden ?? 99,
            tipo: e.tipo ?? "normal",
            count: 1,
          });
      }
      setPipeline([...mapaEtapas.values()].sort((a, b) => a.orden - b.orden));

      // Citas: estados, por mes, por día
      const citasArr = (citasRes.data ?? []) as { fecha_hora: string; estado: string | null }[];
      setCitasTotal(citasArr.length);

      const estados: Record<string, number> = {};
      const dias = [0, 0, 0, 0, 0, 0, 0];
      let at = 0;
      let ns = 0;

      const meses: { key: string; label: string; agendadas: number; atendidas: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        meses.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MESES[d.getMonth()], agendadas: 0, atendidas: 0 });
      }
      const idxMes = new Map(meses.map((m, i) => [m.key, i]));

      for (const c of citasArr) {
        const est = c.estado ?? "agendada";
        estados[est] = (estados[est] ?? 0) + 1;
        if (est === "atendida") at++;
        if (est === "no_show") ns++;
        const d = new Date(c.fecha_hora);
        dias[d.getDay()]++;
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        const mi = idxMes.get(k);
        if (mi != null) {
          meses[mi].agendadas++;
          if (est === "atendida") meses[mi].atendidas++;
        }
      }

      setPorEstado(estados);
      setAtendidas(at);
      setNoShow(ns);
      setPorDia(dias);
      setPorMes(meses.map((m) => ({ label: m.label, agendadas: m.agendadas, atendidas: m.atendidas })));

      setLoading(false);
    }
    load();
  }, []);

  async function completarTarea(id: string) {
    setPendientes((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tareas").update({ hecha: true }).eq("id", id);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  const conResultado = atendidas + noShow;
  const tasaAsistencia = conResultado > 0 ? Math.round((atendidas / conResultado) * 100) : 0;
  const hoyStr = new Date().toISOString().slice(0, 10);

  const stats = [
    { label: "Leads", valor: String(leadsCount), detalle: "en todos los embudos", icon: Workflow, to: "/crm" as const, adminOnly: false },
    { label: "Citas agendadas", valor: String(citasTotal), detalle: "en total", icon: CalendarDays, to: "/agenda" as const, adminOnly: false },
    { label: "Atendidas", valor: String(atendidas), detalle: "citas concretadas", icon: CalendarCheck, to: "/agenda" as const, adminOnly: false },
    { label: "No-show", valor: String(noShow), detalle: "no se presentaron", icon: UserX, to: "/agenda" as const, adminOnly: false },
    { label: "Tasa de asistencia", valor: `${tasaAsistencia}%`, detalle: `${conResultado} con resultado`, icon: Target, to: "/agenda" as const, adminOnly: false },
    { label: "Clientes", valor: String(clientes), detalle: "activos en la plataforma", icon: Users, to: "/clientes" as const, adminOnly: true },
  ].filter((s) => esAdmin || !s.adminOnly);

  const maxMes = Math.max(1, ...porMes.map((m) => Math.max(m.agendadas, m.atendidas)));
  const maxPipeline = Math.max(1, ...pipeline.map((p) => p.count));
  const maxEstado = Math.max(1, ...Object.values(porEstado));
  const maxDia = Math.max(1, ...porDia);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen en vivo de tu operación</p>
      </div>

      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to}>
              <Card className="transition-colors hover:bg-muted/40 h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{s.valor}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">{s.detalle}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Citas por mes + gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Citas por mes</CardTitle>
            <CardDescription>Últimos 12 meses — agendadas vs. atendidas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-44">
              {porMes.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="flex items-end justify-center gap-0.5 w-full h-full">
                    <div
                      className="w-2.5 rounded-t bg-blue-500"
                      style={{ height: `${(m.agendadas / maxMes) * 100}%` }}
                      title={`${m.agendadas} agendadas`}
                    />
                    <div
                      className="w-2.5 rounded-t bg-emerald-500"
                      style={{ height: `${(m.atendidas / maxMes) * 100}%` }}
                      title={`${m.atendidas} atendidas`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Agendadas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Atendidas
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasa de asistencia</CardTitle>
            <CardDescription>Atendidas sobre citas con resultado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <Gauge value={tasaAsistencia} />
            <p className="text-xs text-muted-foreground mt-2">
              {atendidas} atendidas / {noShow} no-show
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline + estados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline por etapa</CardTitle>
            <CardDescription>Leads en cada etapa del embudo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay leads con etapa.</p>
            ) : (
              pipeline.map((p) => (
                <BarRow
                  key={p.nombre}
                  label={p.nombre}
                  value={p.count}
                  max={maxPipeline}
                  color={COLOR_TIPO[p.tipo] ?? "bg-blue-500"}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Citas por estado</CardTitle>
            <CardDescription>Cómo vienen tus consultas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(porEstado).length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay citas.</p>
            ) : (
              Object.keys(ESTADOS).map((k) => (
                <BarRow
                  key={k}
                  label={ESTADOS[k]}
                  value={porEstado[k] ?? 0}
                  max={maxEstado}
                  color={COLOR_ESTADO[k] ?? "bg-primary"}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Citas por día de la semana */}
      <Card>
        <CardHeader>
          <CardTitle>Citas por día de la semana</CardTitle>
          <CardDescription>En qué días se concentran tus citas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-36">
            {porDia.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                <div className="flex items-end w-full h-full justify-center">
                  <div
                    className="w-8 rounded-t bg-primary"
                    style={{ height: `${(n / maxDia) * 100}%` }}
                    title={`${n} citas`}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{DIAS[i]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Próximas citas + sin marcar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Próximas citas · 7 días ({proximasCount})</CardTitle>
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
                      <p className="text-sm font-medium">{c.leads?.nombre || "Sin lead"}</p>
                      <p className="text-xs text-muted-foreground">{c.profesionales?.nombre || "—"}</p>
                    </div>
                    <p className="text-sm">{formatFecha(c.fecha_hora)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Citas sin marcar
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>Pasaron y no cargaste el resultado.</CardDescription>
          </CardHeader>
          <CardContent>
            {sinMarcar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todo al día. 🎉</p>
            ) : (
              <ul className="divide-y">
                {sinMarcar.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{c.leads?.nombre || "Sin lead"}</p>
                      <p className="text-xs text-muted-foreground">{c.profesionales?.nombre || "—"}</p>
                    </div>
                    <span className="text-xs text-amber-600">sin marcar</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tareas pendientes</CardTitle>
          <CardDescription>Seguimientos por hacer. Marcá la casilla cuando los completes.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés tareas pendientes. 🎉</p>
          ) : (
            <ul className="divide-y">
              {pendientes.map((t) => {
                const vencida = t.vence ? t.vence < hoyStr : false;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2">
                    <button
                      type="button"
                      onClick={() => completarTarea(t.id)}
                      className="h-5 w-5 shrink-0 rounded border border-input hover:bg-muted"
                      title="Marcar como hecha"
                    />
                    <div className="flex-1">
                      <p className="text-sm">{t.titulo}</p>
                      <p className="text-xs text-muted-foreground">{t.leads?.nombre || "Sin lead"}</p>
                    </div>
                    {t.vence && (
                      <span className={`text-xs ${vencida ? "text-rose-600" : "text-muted-foreground"}`}>
                        {vencida ? "vencida · " : ""}
                        {t.vence}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AsistenteIA />
    </div>
  );
}
