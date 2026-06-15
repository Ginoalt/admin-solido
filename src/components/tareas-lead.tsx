import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Check } from "lucide-react";

type Tarea = { id: string; titulo: string; vence: string | null; hecha: boolean };

export function TareasLead({
  profesionalId,
  leadId,
}: {
  profesionalId: string;
  leadId: string;
}) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [titulo, setTitulo] = useState("");
  const [vence, setVence] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargar() {
    const { data } = await supabase
      .from("tareas")
      .select("id, titulo, vence, hecha")
      .eq("lead_id", leadId)
      .order("hecha", { ascending: true })
      .order("vence", { ascending: true, nullsFirst: false });
    setTareas((data ?? []) as Tarea[]);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function agregar() {
    if (!titulo.trim()) return;
    setSaving(true);
    await supabase.from("tareas").insert({
      profesional_id: profesionalId,
      lead_id: leadId,
      titulo: titulo.trim(),
      vence: vence || null,
    });
    setTitulo("");
    setVence("");
    setSaving(false);
    cargar();
  }

  async function toggle(t: Tarea) {
    setTareas((prev) => prev.map((x) => (x.id === t.id ? { ...x, hecha: !x.hecha } : x)));
    await supabase.from("tareas").update({ hecha: !t.hecha }).eq("id", t.id);
    cargar();
  }

  async function borrar(id: string) {
    await supabase.from("tareas").delete().eq("id", id);
    cargar();
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <Label>Tareas / seguimientos</Label>
      {tareas.length > 0 && (
        <ul className="space-y-1">
          {tareas.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => toggle(t)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  t.hecha ? "border-emerald-500 bg-emerald-500 text-white" : "border-input"
                }`}
              >
                {t.hecha && <Check className="h-3.5 w-3.5" />}
              </button>
              <span className={`flex-1 ${t.hecha ? "text-muted-foreground line-through" : ""}`}>
                {t.titulo}
                {t.vence && <span className="ml-2 text-xs text-muted-foreground">· vence {t.vence}</span>}
              </span>
              <button type="button" onClick={() => borrar(t.id)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <Input
          placeholder="Ej: Llamar mañana, mandar presupuesto…"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
        />
        <Input type="date" className="w-40" value={vence} onChange={(e) => setVence(e.target.value)} />
        <Button type="button" variant="outline" className="shrink-0" disabled={saving || !titulo.trim()} onClick={agregar}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
