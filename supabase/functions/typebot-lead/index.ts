// Edge Function: typebot-lead (el "buzón" que recibe los leads del Typebot)
// Cada cliente usa SU propio token (profesionales.webhook_token). El lead entra
// directo a SU CRM. Desplegar con "Verify JWT" DESACTIVADO (el Typebot no manda JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const {
    profesional_id,
    nombre = null,
    telefono = null,
    email = null,
    datos_extra = {},
    fecha_cita = null,
    notas = null,
  } = body ?? {};
  if (!profesional_id) return json({ error: "Falta profesional_id" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validar el token contra el del PROPIO cliente
  const { data: prof } = await supabase
    .from("profesionales")
    .select("webhook_token")
    .eq("id", profesional_id)
    .maybeSingle();
  if (!prof || req.headers.get("x-webhook-token") !== prof.webhook_token)
    return json({ error: "No autorizado" }, 401);

  // Primera etapa del embudo del cliente (para que el lead caiga en la columna 1)
  const { data: etapa } = await supabase
    .from("etapas_pipeline")
    .select("id")
    .eq("profesional_id", profesional_id)
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      profesional_id,
      nombre,
      telefono,
      email,
      etapa_id: etapa?.id ?? null,
      origen: "typebot",
      datos_extra,
      notas,
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 400);

  if (fecha_cita) {
    await supabase.from("citas").insert({
      profesional_id,
      lead_id: lead.id,
      fecha_hora: fecha_cita,
      estado: "agendada",
      origen_agenda: "typebot",
    });
  }

  return json({ ok: true, lead_id: lead.id }, 200);

  function json(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
