import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

type Profesional = {
  id: string;
  nombre: string | null;
  rubro: string | null;
  email_contacto: string | null;
  estado: string | null;
};

function ClientesPage() {
  const [rows, setRows] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profesionales")
      .select("id, nombre, rubro, email_contacto, estado")
      .order("nombre", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as Profesional[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Listado de profesionales</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <NuevoClienteDialog
            onCreated={() => {
              setOpen(false);
              load();
            }}
          />
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-destructive py-8">
                  {error}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Sin registros
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell>{r.rubro}</TableCell>
                  <TableCell>{r.email_contacto}</TableCell>
                  <TableCell>{r.estado}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NuevoClienteDialog({ onCreated }: { onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("abogado");
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("prueba");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("profesionales").insert({
      nombre,
      rubro,
      email_contacto: email,
      estado,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNombre("");
    setEmail("");
    setRubro("abogado");
    setEstado("prueba");
    onCreated();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuevo cliente</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rubro">Rubro</Label>
          <Select value={rubro} onValueChange={setRubro}>
            <SelectTrigger id="rubro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="abogado">Abogado</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email de contacto</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prueba">Prueba</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Crear"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}