import { createFileRoute, Link } from "@tanstack/react-router";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
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
import { Plus, Sparkles, Pencil, Trash2, KeyRound } from "lucide-react";

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
  const [editing, setEditing] = useState<Profesional | null>(null);
  const [deleting, setDeleting] = useState<Profesional | null>(null);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [inviting, setInviting] = useState<Profesional | null>(null);

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

  async function confirmarBorrado() {
    if (!deleting) return;
    setDelErr(null);
    const { error } = await supabase.from("profesionales").delete().eq("id", deleting.id);
    if (error) {
      setDelErr(error.message);
      return;
    }
    setDeleting(null);
    load();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Listado de profesionales</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/alta-cliente">
            <Button variant="outline">
              <Sparkles className="h-4 w-4" />
              Alta guiada
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo cliente</DialogTitle>
              </DialogHeader>
              <ClienteForm
                initial={null}
                onDone={() => {
                  setOpen(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive py-8">
                  {error}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Dar acceso" onClick={() => setInviting(r)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Editar cliente */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          {editing && (
            <ClienteForm
              key={editing.id}
              initial={editing}
              onDone={() => {
                setEditing(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Invitar cliente (dar acceso) */}
      <Dialog open={!!inviting} onOpenChange={(o) => !o && setInviting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar acceso a {inviting?.nombre}</DialogTitle>
          </DialogHeader>
          {inviting && (
            <InvitarClienteDialog
              key={inviting.id}
              cliente={inviting}
              onDone={() => setInviting(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Borrar cliente */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar a {deleting?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto borra al cliente y <strong>todo lo asociado</strong>: sus leads, etapas,
              citas, configuración del bot y conocimiento. Esta acción no se puede deshacer.
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
              Sí, borrar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClienteForm({
  initial,
  onDone,
}: {
  initial: Profesional | null;
  onDone: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [rubro, setRubro] = useState(initial?.rubro ?? "abogado");
  const [email, setEmail] = useState(initial?.email_contacto ?? "");
  const [estado, setEstado] = useState(initial?.estado ?? "prueba");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      nombre,
      rubro,
      email_contacto: email,
      estado,
    };
    const { error } = initial
      ? await supabase.from("profesionales").update(payload).eq("id", initial.id)
      : await supabase.from("profesionales").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
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
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function InvitarClienteDialog({
  cliente,
  onDone,
}: {
  cliente: Profesional;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(cliente.email_contacto ?? "");
  const [nombre, setNombre] = useState(cliente.nombre ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function generar() {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || password.length < 6) {
      setError("Necesito el email y una contraseña de al menos 6 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("invitar-cliente", {
      body: { email, password, nombre, profesional_id: cliente.id },
    });
    setSaving(false);
    if (error) {
      setError("No se pudo crear el acceso. Revisá que la función esté desplegada.");
      return;
    }
    if (!data?.ok) {
      setError(data?.error ?? "No se pudo crear el acceso.");
      return;
    }
    setListo(true);
  }

  if (listo) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          ✅ Acceso creado. Pasale estos datos al cliente para que entre:
        </p>
        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Email:</span> {email}
          </p>
          <p>
            <span className="text-muted-foreground">Contraseña:</span> {password}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onDone}>Listo</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Le creás un usuario para que entre y vea <strong>solo su propio</strong> CRM y agenda.
      </p>
      <div className="space-y-2">
        <Label htmlFor="inv-email">Email del cliente</Label>
        <Input
          id="inv-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-nombre">Nombre</Label>
        <Input id="inv-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-pass">Contraseña</Label>
        <div className="flex gap-2">
          <Input
            id="inv-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
          />
          <Button type="button" variant="outline" className="shrink-0" onClick={generar}>
            Generar
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando acceso..." : "Crear acceso"}
        </Button>
      </DialogFooter>
    </form>
  );
}
