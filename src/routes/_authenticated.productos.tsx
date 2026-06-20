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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Package, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/productos")({
  component: ProductosPage,
});

type Profesional = { id: string; nombre: string | null };
type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  stock: number;
  stock_minimo: number;
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

function ProductosPage() {
  const { esAdmin, perfil, loading: perfilLoading } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pid = esAdmin ? selId : perfil?.profesional_id ?? null;
  const habilitado = esAdmin || perfil?.modulos?.["productos"] === true;

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
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Tu catálogo y el control de stock, en un solo lugar.
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
        <ProductosCard key={pid} profesionalId={pid} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Elegí un cliente para ver su catálogo.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProductosCard({ profesionalId }: { profesionalId: string }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, categoria, precio, stock, stock_minimo")
      .eq("profesional_id", profesionalId)
      .order("created_at", { ascending: false });
    setProductos((data ?? []) as Producto[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!nombre.trim()) {
      setErr("Poné un nombre para el producto.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("productos").insert({
      profesional_id: profesionalId,
      nombre: nombre.trim(),
      categoria: categoria.trim() || null,
      precio: Math.max(0, parseFloat(precio) || 0),
      stock: Math.max(0, parseInt(stock, 10) || 0),
      stock_minimo: Math.max(0, parseInt(stockMin, 10) || 0),
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setNombre("");
    setCategoria("");
    setPrecio("");
    setStock("");
    setStockMin("");
    load();
  }

  async function actualizar(id: string, campo: "precio" | "stock", valor: number) {
    const v = Math.max(0, campo === "precio" ? valor : Math.round(valor));
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
    await supabase.from("productos").update({ [campo]: v }).eq("id", id);
  }

  async function borrar(id: string) {
    await supabase.from("productos").delete().eq("id", id);
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  const total = productos.length;
  const valorInventario = productos.reduce((s, p) => s + p.precio * p.stock, 0);
  const bajoStock = productos.filter((p) => p.stock <= p.stock_minimo).length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Productos" valor={String(total)} icon={Package} />
        <StatCard label="Valor del inventario" valor={money(valorInventario)} icon={Package} />
        <StatCard
          label="Con stock bajo"
          valor={String(bajoStock)}
          icon={AlertTriangle}
          alerta={bajoStock > 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>
            Editá el precio o el stock directo en la tabla. El stock en rojo está por debajo del mínimo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay productos. Agregá el primero abajo.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="w-32">Precio</TableHead>
                    <TableHead className="w-24">Stock</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((p) => {
                    const bajo = p.stock <= p.stock_minimo;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{p.categoria || "—"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={p.precio}
                            className="h-8"
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v !== p.precio) actualizar(p.id, "precio", v);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            defaultValue={p.stock}
                            className={`h-8 ${bajo ? "text-destructive font-semibold" : ""}`}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10) || 0;
                              if (v !== p.stock) actualizar(p.id, "stock", v);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => borrar(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar producto</CardTitle>
          <CardDescription>Cargá un producto nuevo a tu catálogo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={agregar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-nombre">Nombre</Label>
                <Input
                  id="prod-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Remera blanca M"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-categoria">Categoría</Label>
                <Input
                  id="prod-categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ej: Indumentaria"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-precio">Precio</Label>
                <Input
                  id="prod-precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-stock">Stock inicial</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-stockmin">Stock mínimo</Label>
                <Input
                  id="prod-stockmin"
                  type="number"
                  min="0"
                  value={stockMin}
                  onChange={(e) => setStockMin(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? "Agregando..." : "Agregar producto"}
              </Button>
              {err && <span className="text-sm text-destructive">{err}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({
  label,
  valor,
  icon: Icon,
  alerta,
}: {
  label: string;
  valor: string;
  icon: typeof Package;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${alerta ? "text-destructive" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${alerta ? "text-destructive" : ""}`}>{valor}</div>
      </CardContent>
    </Card>
  );
}
