import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMiPerfil } from "@/lib/perfil";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resumen")({
  component: ResumenPage,
});

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Profesional = { id: string; nombre: string | null };
type Metricas = {
  leadsNuevos: number;
  agendadas: number;
  atendidas: number;
  tasa: number;
  bot: number;
};

async function metricasMes(pid: string, y: number, m: number): Promise<Metricas> {
  const ini = new Date(y, m, 1).toISOString();
  const fin = new Date(y, m + 1, 1).toISOString();
  const [leadsRes, citasRes, botRes] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("profesional_id", pid)
      .gte("created_at", ini)
      .lt("created_at", fin),
    supabase
      .from("citas")
      .select("estado")
      .eq("profesional_id", pid)
      .gte("fecha_hora", ini)
      .lt("fecha_hora", fin),
    supabase
      .from("mensajes")
      .select("*", { count: "exact", head: true })
      .eq("profesional_id", pid)
      .eq("autor", "bot")
      .gte("created_at", ini)
      .lt("created_at", fin),
  ]);
  const citas = (citasRes.data ?? []) as { estado: string | null }[];
  let atendidas = 0;
  let noShow = 0;
  for (const c of citas) {
    if (c.estado === "atendida") atendidas++;
    if (c.estado === "no_show") noShow++;
  }
  const tasa = atendidas + noShow > 0 ? Math.round((atendidas / (atendidas + noShow)) * 100) : 0;
  return {
    leadsNuevos: leadsRes.count ?? 0,
    agendadas: citas.length,
    atendidas,
    tasa,
    bot: botRes.count ?? 0,
  };
}

function Delta({ valor, sufijo }: { valor: number; sufijo: string }) {
  if (valor === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> igual que el mes anterior
      </span>
    );
  const positivo = valor > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        positivo ? "text-foreground" : "text-destructive"
      }`}
    >
      {positivo ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {positivo ? "+" : ""}
      {valor}
      {sufijo} vs. mes anterior
    </span>
  );
}

function ResumenPage() {
  const { perfil, esAdmin } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const hoy = new Date();
  const [ym, setYm] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [cur, setCur] = useState<Metricas | null>(null);
  const [prev, setPrev] = useState<Metricas | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!esAdmin) return;
    supabase
      .from("profesionales")
      .select("id, nombre")
      .order("nombre", { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Profesional[];
        setProfesionales(list);
        if (list.length > 0) setSelId(list[0].id);
      });
  }, [esAdmin]);

  const pid = esAdmin ? selId : perfil?.profesional_id ?? null;

  useEffect(() => {
    if (!pid) {
      if (!esAdmin) setCargando(false);
      return;
    }
    let activo = true;
    setCargando(true);
    (async () => {
      const prevYm = ym.m === 0 ? { y: ym.y - 1, m: 11 } : { y: ym.y, m: ym.m - 1 };
      const [c, p] = await Promise.all([
        metricasMes(pid, ym.y, ym.m),
        metricasMes(pid, prevYm.y, prevYm.m),
      ]);
      if (activo) {
        setCur(c);
        setPrev(p);
        setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [pid, ym, esAdmin]);

  function mover(d: number) {
    setYm((p) => {
      const nm = p.m + d;
      return { y: p.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  const nombreCliente = esAdmin
    ? profesionales.find((p) => p.id === selId)?.nombre ?? "el cliente"
    : null;

  const cards = cur
    ? [
        { label: "Leads nuevos", valor: cur.leadsNuevos, delta: cur.leadsNuevos - (prev?.leadsNuevos ?? 0), sufijo: "" },
        { label: "Citas agendadas", valor: cur.agendadas, delta: cur.agendadas - (prev?.agendadas ?? 0), sufijo: "" },
        { label: "Citas atendidas", valor: cur.atendidas, delta: cur.atendidas - (prev?.atendidas ?? 0), sufijo: "" },
        { label: "Tasa de asistencia", valor: cur.tasa, delta: cur.tasa - (prev?.tasa ?? 0), sufijo: "%" },
        { label: "Mensajes del bot", valor: cur.bot, delta: cur.bot - (prev?.bot ?? 0), sufijo: "" },
      ]
    : [];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen del mes</h1>
          <p className="text-sm text-muted-foreground">
            El valor generado{nombreCliente ? ` para ${nombreCliente}` : ""}, mes a mes.
          </p>
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
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mover(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-44 text-center text-lg font-semibold capitalize">
          {MESES[ym.m]} {ym.y}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mover(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {cargando ? (
        <p className="text-center text-sm text-muted-foreground py-12">Cargando...</p>
      ) : !pid ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          Elegí un cliente para ver su resumen.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold">
                  {c.valor}
                  {c.sufijo}
                </div>
                <div className="mt-2">
                  <Delta valor={c.delta} sufijo={c.sufijo} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
