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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pin, PinOff, Send, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipo")({
  component: EquipoPage,
});

type Profesional = { id: string; nombre: string | null };
type Miembro = { id: string; nombre: string | null; email: string | null; rol: string | null };
type Yo = { id: string; nombre: string };
type Comunicado = {
  id: string;
  autor_id: string | null;
  autor_nombre: string | null;
  contenido: string;
  fijado: boolean;
  created_at: string;
};

function cuando(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function EquipoPage() {
  const { esAdmin, perfil, loading: perfilLoading } = useMiPerfil();
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [yo, setYo] = useState<Yo | null>(null);

  const pid = esAdmin ? selId : perfil?.profesional_id ?? null;
  const habilitado = esAdmin || perfil?.modulos?.["equipo"] === true;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", u.id)
        .maybeSingle()
        .then(({ data: p }) => setYo({ id: u.id, nombre: (p?.nombre as string) || u.email || "Usuario" }));
    });
  }, []);

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
      <div className="p-8 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Este módulo no está disponible en tu plan.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground">
            Sumá a tu equipo y compartí comunicados dentro del CRM.
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
        <>
          <ComunicadosCard key={`com-${pid}`} profesionalId={pid} yo={yo} esAdmin={esAdmin} />
          <MiembrosCard key={`mie-${pid}`} profesionalId={pid} esAdmin={esAdmin} miId={yo?.id ?? null} />
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Elegí un cliente para ver su equipo.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComunicadosCard({
  profesionalId,
  yo,
  esAdmin,
}: {
  profesionalId: string;
  yo: Yo | null;
  esAdmin: boolean;
}) {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("comunicados")
      .select("id, autor_id, autor_nombre, contenido, fijado, created_at")
      .eq("profesional_id", profesionalId)
      .order("fijado", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Comunicado[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId]);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const contenido = texto.trim();
    if (!contenido) return;
    setSending(true);
    const { error } = await supabase.from("comunicados").insert({
      profesional_id: profesionalId,
      autor_id: yo?.id ?? null,
      autor_nombre: yo?.nombre ?? "Usuario",
      contenido,
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setTexto("");
    load();
  }

  async function fijar(c: Comunicado) {
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, fijado: !x.fijado } : x)));
    await supabase.from("comunicados").update({ fijado: !c.fijado }).eq("id", c.id);
    load();
  }

  async function borrar(id: string) {
    await supabase.from("comunicados").delete().eq("id", id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comunicados</CardTitle>
        <CardDescription>
          Mensajes y avisos del equipo. Fijá los importantes para que queden arriba.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={publicar} className="space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Escribí un comunicado para el equipo…"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={sending || !texto.trim()}>
              <Send className="h-4 w-4" />
              {sending ? "Publicando..." : "Publicar"}
            </Button>
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>

        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay comunicados.</p>
          ) : (
            items.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-3 ${c.fijado ? "bg-secondary/60 border-foreground/20" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm whitespace-pre-wrap">{c.contenido}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.fijado && "📌 "}
                      {c.autor_nombre || "Alguien"} · {cuando(c.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={c.fijado ? "Dejar de fijar" : "Fijar"}
                      onClick={() => fijar(c)}
                    >
                      {c.fijado ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    {(esAdmin || c.autor_id === yo?.id) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Borrar"
                        onClick={() => borrar(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiembrosCard({
  profesionalId,
  esAdmin,
  miId,
}: {
  profesionalId: string;
  esAdmin: boolean;
  miId: string | null;
}) {
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc(
      "miembros_equipo",
      esAdmin ? { p_profesional_id: profesionalId } : {},
    );
    setMiembros((data ?? []) as Miembro[]);
  }

  useEffect(() => {
    load();
  }, [profesionalId, esAdmin]);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!email.trim() || password.length < 6) {
      setErr("Poné un email y una contraseña de al menos 6 caracteres.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("equipo-miembros", {
      body: {
        action: "invitar",
        email: email.trim(),
        password,
        nombre: nombre.trim() || null,
        profesional_id: esAdmin ? profesionalId : undefined,
      },
    });
    setSaving(false);
    if (error || !data?.ok) {
      setErr(data?.error || error?.message || "No se pudo invitar.");
      return;
    }
    setNombre("");
    setEmail("");
    setPassword("");
    setMsg("Miembro agregado.");
    load();
  }

  async function quitar(id: string) {
    setErr(null);
    setMsg(null);
    const { data, error } = await supabase.functions.invoke("equipo-miembros", {
      body: { action: "quitar", member_id: id },
    });
    if (error || !data?.ok) {
      setErr(data?.error || error?.message || "No se pudo quitar.");
      return;
    }
    setMiembros((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Miembros del equipo</CardTitle>
        <CardDescription>
          Cada miembro entra con su propio usuario y comparte todo el workspace (leads, agenda, chats…).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {miembros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay miembros cargados.</p>
          ) : (
            miembros.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.nombre || m.email || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.email}
                    {m.rol === "admin" && " · admin"}
                  </p>
                </div>
                {m.rol !== "admin" && m.id !== miId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    title="Quitar del equipo"
                    onClick={() => quitar(m.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={invitar} className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Sumar un miembro
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="miem-nombre">Nombre</Label>
              <Input id="miem-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="miem-email">Email</Label>
              <Input id="miem-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="miem-pass">Contraseña temporal</Label>
            <Input
              id="miem-pass"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres (la comparte con el miembro)"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" />
              {saving ? "Agregando..." : "Agregar miembro"}
            </Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            {err && <span className="text-sm text-destructive">{err}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
