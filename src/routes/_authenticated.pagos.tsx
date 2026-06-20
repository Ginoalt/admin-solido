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
import { Input } from "@/components/ui/input";
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
import { TrendingUp, Trophy, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pagos")({
  component: PagosPage,
});

type Profesional = { id: string; nombre: string | null };
type Lead = {
  id: string;
  nombre: string | null;
  valor: number;
  etapas_pipeline: { nombre: string | null; tipo: string | null } | null;
};

function money(n: number): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `$${Math.round(n || 0)}`;
  }
}

function PagosPage() {
  const { esAdmin, perfil, loading: perfilLoading } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pid = esAdmin ? selId : perfil?.profesional_id ?? null;
  const habilitado = esAdmin || perfil?.modulos?.["pagos"] === true;

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
          <h1 className="text-2xl font-semibold tracking-tight">Pagos & Forecast</h1>
          <p className="text-sm text-muted-foreground">
            Poné el monto de cada lead y mirá cuánta plata hay en juego.
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
        <PagosCard key={pid} profesionalId={pid} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Elegí un cliente para ver sus montos.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PagosCard({ profesionalId }: { profesionalId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);

  async function load() {
    const { data } = await supabase
      .from("leads")
      .select("id, nombre, valor, etapas_pipeline(nombre, tipo)")
      .eq("profesional_id", profesionalId)
      .order("created_at", { ascending: false });
    setLeads((data ?? []) as Lead[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function actualizar(id: string, valor: number) {
    const v = Math.max(0, valor);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, valor: v } : l)));
    await supabase.from("leads").update({ valor: v }).eq("id", id);
  }

  const tipoDe = (l: Lead) => l.etapas_pipeline?.tipo ?? "normal";
  const enEmbudo = leads.filter((l) => tipoDe(l) === "normal").reduce((s, l) => s + (l.valor || 0), 0);
  const ganado = leads.filter((l) => tipoDe(l) === "ganado").reduce((s, l) => s + (l.valor || 0), 0);
  const perdido = leads.filter((l) => tipoDe(l) === "perdido").reduce((s, l) => s + (l.valor || 0), 0);

  // Valor por etapa (solo etapas con algún monto o lead)
  const porEtapa = new Map<string, { valor: number; count: number }>();
  for (const l of leads) {
    const nombre = l.etapas_pipeline?.nombre || "Sin etapa";
    const prev = porEtapa.get(nombre) ?? { valor: 0, count: 0 };
    prev.valor += l.valor || 0;
    prev.count += 1;
    porEtapa.set(nombre, prev);
  }
  const etapas = [...porEtapa.entries()];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatMonto label="En el embudo" valor={money(enEmbudo)} sub="oportunidades abiertas" icon={TrendingUp} />
        <StatMonto label="Ganado" valor={money(ganado)} sub="ventas cerradas" icon={Trophy} acento />
        <StatMonto label="Perdido" valor={money(perdido)} sub="no concretado" icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plata por etapa</CardTitle>
          <CardDescription>Cuánto valor hay acumulado en cada etapa del embudo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {etapas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay leads.</p>
          ) : (
            etapas.map(([nombre, v]) => (
              <div key={nombre} className="flex items-center justify-between text-sm">
                <span>
                  {nombre} <span className="text-muted-foreground">· {v.count}</span>
                </span>
                <span className="font-medium tabular-nums">{money(v.valor)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Montos por lead</CardTitle>
          <CardDescription>Cargá el monto estimado de cada oportunidad. Se guarda solo.</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay leads.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="w-40">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nombre || "Sin nombre"}</TableCell>
                      <TableCell className="text-muted-foreground">{l.etapas_pipeline?.nombre || "—"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={l.valor}
                          className="h-8"
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            if (v !== l.valor) actualizar(l.id, v);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatMonto({
  label,
  valor,
  sub,
  icon: Icon,
  acento,
}: {
  label: string;
  valor: string;
  sub: string;
  icon: typeof TrendingUp;
  acento?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${acento ? "text-foreground" : ""}`}>{valor}</div>
        <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
