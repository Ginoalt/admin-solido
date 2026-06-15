// Edge Function: asistente-ia ("Carlos", el gerente comercial con IA)
// Lee los datos del CRM del que pregunta (admin = todo, cliente = lo suyo) y
// responde con IA. Sirve con OpenAI (GPT) O Anthropic (Claude) — elige según
// qué key esté cargada. Desplegar con "Verify JWT" ACTIVADO.
//
// SECRETS (cargar UNO de los dos, mañana):
//   - OPENAI_API_KEY     -> usa GPT (gpt-4o-mini)
//   - ANTHROPIC_API_KEY  -> usa Claude (claude-haiku-4-5)
// Opcional: IA_PROVEEDOR = "openai" | "anthropic" para forzar uno si cargaste ambos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELO_OPENAI = "gpt-4o-mini";
const MODELO_ANTHROPIC = "claude-haiku-4-5";

type Mensaje = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // ¿Qué motor usamos? El que tenga key (o el forzado por IA_PROVEEDOR).
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const forzado = (Deno.env.get("IA_PROVEEDOR") ?? "").toLowerCase();
  const proveedor =
    forzado === "openai" || forzado === "anthropic"
      ? forzado
      : openaiKey
        ? "openai"
        : anthropicKey
          ? "anthropic"
          : "";
  if (!proveedor || (proveedor === "openai" && !openaiKey) || (proveedor === "anthropic" && !anthropicKey)) {
    return json({ error: "Falta la API key (cargá OPENAI_API_KEY o ANTHROPIC_API_KEY)" }, 500);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Identificar al que pregunta y su alcance
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "No autorizado" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "No autorizado" }, 401);

  const { data: perfil } = await admin
    .from("perfiles")
    .select("rol, profesional_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const esAdmin = perfil?.rol === "admin";
  const pid = perfil?.profesional_id ?? null;
  if (!esAdmin && !pid) return json({ error: "Perfil sin datos asociados" }, 403);

  // 2. Datos del CRM (con el mismo alcance que ve la persona)
  const scope = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
    esAdmin ? q : q.eq("profesional_id", pid!);

  const ahoraIso = new Date().toISOString();
  const [leadsRes, citasRes, proxRes] = await Promise.all([
    scope(admin.from("leads").select("etapa_id, etapas_pipeline(nombre, tipo)") as any),
    scope(admin.from("citas").select("estado") as any),
    scope(
      admin
        .from("citas")
        .select("fecha_hora, leads(nombre)")
        .gte("fecha_hora", ahoraIso)
        .order("fecha_hora", { ascending: true })
        .limit(10) as any,
    ),
  ]);

  const leads = (leadsRes.data ?? []) as any[];
  const citas = (citasRes.data ?? []) as any[];
  const proximas = (proxRes.data ?? []) as any[];

  const porEtapa: Record<string, number> = {};
  for (const l of leads) {
    const n = l.etapas_pipeline?.nombre ?? "Sin etapa";
    porEtapa[n] = (porEtapa[n] ?? 0) + 1;
  }
  const porEstado: Record<string, number> = {};
  for (const c of citas) {
    const e = c.estado ?? "agendada";
    porEstado[e] = (porEstado[e] ?? 0) + 1;
  }
  const atendidas = porEstado["atendida"] ?? 0;
  const noShow = porEstado["no_show"] ?? 0;
  const tasa = atendidas + noShow > 0 ? Math.round((atendidas / (atendidas + noShow)) * 100) : 0;

  const contexto = [
    `Total de leads: ${leads.length}`,
    `Leads por etapa: ${JSON.stringify(porEtapa)}`,
    `Citas por estado: ${JSON.stringify(porEstado)}`,
    `Tasa de asistencia: ${tasa}% (${atendidas} atendidas, ${noShow} no-show)`,
    `Próximas citas: ${proximas.map((p) => p.leads?.nombre ?? "lead").join(", ") || "ninguna"}`,
  ].join("\n");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const pregunta = String(body?.pregunta ?? "").trim();
  if (!pregunta) return json({ error: "Falta la pregunta" }, 400);
  const historial: Mensaje[] = (Array.isArray(body?.historial) ? body.historial : [])
    .filter((m: any) => m?.role && m?.text)
    .map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

  const system =
    "Sos Carlos, un gerente comercial con IA que asesora sobre un CRM. " +
    "Respondé en español rioplatense, claro y accionable, en pocas líneas o con bullets. " +
    "Basate SOLO en los datos del CRM que te paso. Si faltan datos, decilo sin inventar.\n\n" +
    "Datos actuales del CRM:\n" +
    contexto;

  const mensajes: Mensaje[] = [...historial, { role: "user", content: pregunta }];

  // 3. Llamar al motor de IA elegido
  try {
    const respuesta =
      proveedor === "openai"
        ? await llamarOpenAI(openaiKey!, system, mensajes)
        : await llamarAnthropic(anthropicKey!, system, mensajes);
    return json({ respuesta, proveedor }, 200);
  } catch (e) {
    return json({ error: `Error de la IA: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  function json(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function llamarOpenAI(key: string, system: string, mensajes: Mensaje[]): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELO_OPENAI,
      max_tokens: 1024,
      messages: [{ role: "system", content: system }, ...mensajes],
    }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const out = await resp.json();
  return out?.choices?.[0]?.message?.content ?? "No pude generar una respuesta.";
}

async function llamarAnthropic(key: string, system: string, mensajes: Mensaje[]): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO_ANTHROPIC,
      max_tokens: 1024,
      system,
      messages: mensajes,
    }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const out = await resp.json();
  return out?.content?.[0]?.text ?? "No pude generar una respuesta.";
}
