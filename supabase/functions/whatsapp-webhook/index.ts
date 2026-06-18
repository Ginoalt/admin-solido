// Edge Function: whatsapp-webhook  (la "oreja" + el cerebro + la "boca" del bot)
//
// Recibe los mensajes que Meta manda por la Cloud API, los guarda en la Bandeja
// y —si el bot esta activo— contesta solo con la IA usando el conocimiento del cliente.
//
// MULTI-CLIENTE: cada numero entra por su `phone_number_id`. Con eso ubico al
// profesional (tabla canales_whatsapp) y respondo con el access_token de ESE cliente.
// Asi un solo webhook sirve a todos los clientes, cada uno con su numero y su bot.
//
// DESPLEGAR con "Verify JWT" DESACTIVADO (Meta no manda JWT; valida por verify_token).
// SECRETS necesarios:
//   WHATSAPP_VERIFY_TOKEN  -> un string que inventamos; el MISMO que pones en Meta.
//   ANTHROPIC_API_KEY / OPENAI_API_KEY -> el motor de IA (el mismo que usa Carlos).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Verificacion del webhook: Meta hace UN GET cuando lo configuras.
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // A Meta SIEMPRE le respondemos 200 rapido; procesamos lo que se pueda por dentro.
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }
  try {
    await procesar(payload);
  } catch (e) {
    console.error("whatsapp-webhook:", e instanceof Error ? e.message : String(e));
  }
  return new Response("ok", { status: 200 });
});

async function procesar(payload: any) {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  for (const entry of asArray(payload?.entry)) {
    for (const change of asArray(entry?.changes)) {
      const value = change?.value ?? {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = asArray(value?.messages);
      if (!phoneNumberId || messages.length === 0) continue; // estados de entrega, etc.

      // ¿De que cliente es este numero?
      const { data: canal } = await admin
        .from("canales_whatsapp")
        .select("profesional_id, access_token")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!canal?.profesional_id || !canal?.access_token) continue; // numero no configurado

      const pid = canal.profesional_id as string;
      const token = canal.access_token as string;
      const nombreContacto = asArray(value?.contacts)[0]?.profile?.name ?? null;

      for (const m of messages) {
        if (m?.type !== "text") continue; // v1: solo texto
        const desde = String(m.from ?? "").trim(); // telefono del lead
        const texto = String(m?.text?.body ?? "").trim();
        if (!desde || !texto) continue;

        const lead = await buscarOCrearLead(admin, pid, desde, nombreContacto);
        if (!lead?.id) continue;
        const conv = await buscarOCrearConversacion(admin, pid, lead.id);
        if (!conv?.id) continue;

        // Guardo lo que dijo el lead
        await admin.from("mensajes").insert({
          profesional_id: pid,
          conversacion_id: conv.id,
          lead_id: lead.id,
          direccion: "entrante",
          autor: "lead",
          tipo: "texto",
          contenido: texto,
          estado: "recibido",
        });
        await admin
          .from("conversaciones")
          .update({ ultimo_mensaje_at: new Date().toISOString(), estado: "abierta" })
          .eq("id", conv.id);

        // ¿Contesta el bot? Necesita: bot del cliente activo Y la conversacion NO tomada por un humano.
        const { data: botCfg } = await admin
          .from("bot_config")
          .select("nombre_bot, instrucciones, modelo_ia, activo")
          .eq("profesional_id", pid)
          .maybeSingle();
        if (!botCfg?.activo || conv.bot_activo === false) continue;

        const respuesta = await responderConIA(admin, pid, botCfg, conv.id, texto);
        if (!respuesta) continue;

        const enviado = await enviarTexto(phoneNumberId, token, desde, respuesta);
        if (enviado) {
          await admin.from("mensajes").insert({
            profesional_id: pid,
            conversacion_id: conv.id,
            lead_id: lead.id,
            direccion: "saliente",
            autor: "bot",
            tipo: "texto",
            contenido: respuesta,
            estado: "enviado",
          });
          await admin
            .from("conversaciones")
            .update({ ultimo_mensaje_at: new Date().toISOString() })
            .eq("id", conv.id);
        }
      }
    }
  }
}

async function buscarOCrearLead(admin: any, pid: string, telefono: string, nombre: string | null) {
  const { data: existente } = await admin
    .from("leads")
    .select("id")
    .eq("profesional_id", pid)
    .eq("telefono", telefono)
    .limit(1)
    .maybeSingle();
  if (existente) return existente;

  // Lead nuevo -> primera etapa del embudo del cliente
  const { data: etapa } = await admin
    .from("etapas_pipeline")
    .select("id")
    .eq("profesional_id", pid)
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: nuevo } = await admin
    .from("leads")
    .insert({
      profesional_id: pid,
      nombre: nombre ?? telefono,
      telefono,
      etapa_id: etapa?.id ?? null,
      origen: "whatsapp",
    })
    .select("id")
    .single();
  return nuevo;
}

async function buscarOCrearConversacion(admin: any, pid: string, leadId: string) {
  const { data: existente } = await admin
    .from("conversaciones")
    .select("id, bot_activo")
    .eq("profesional_id", pid)
    .eq("lead_id", leadId)
    .eq("canal", "whatsapp")
    .order("ultimo_mensaje_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente) return existente;

  const { data: nueva } = await admin
    .from("conversaciones")
    .insert({
      profesional_id: pid,
      lead_id: leadId,
      canal: "whatsapp",
      estado: "abierta",
      ultimo_mensaje_at: new Date().toISOString(),
      bot_activo: true,
    })
    .select("id, bot_activo")
    .single();
  return nueva;
}

async function responderConIA(
  admin: any,
  pid: string,
  botCfg: any,
  convId: string,
  pregunta: string,
): Promise<string | null> {
  // Conocimiento del cliente (lo que el bot puede usar para responder)
  const { data: docs } = await admin
    .from("documentos")
    .select("nombre_archivo, contenido")
    .eq("profesional_id", pid)
    .eq("estado", "listo");
  const conocimiento =
    asArray(docs)
      .map((d: any) => `## ${d.nombre_archivo}\n${d.contenido}`)
      .join("\n\n") || "(El negocio todavia no cargo base de conocimiento.)";

  // Transcripcion reciente de ESTA conversacion (para que el bot no se repita)
  const { data: hist } = await admin
    .from("mensajes")
    .select("direccion, contenido, created_at")
    .eq("conversacion_id", convId)
    .order("created_at", { ascending: false })
    .limit(8);
  const enOrden = asArray(hist).reverse();
  const previos = enOrden.slice(0, -1); // sin el ultimo (que es la pregunta actual)
  const transcript = previos
    .map((m: any) => `${m.direccion === "entrante" ? "Cliente" : "Bot"}: ${m.contenido}`)
    .join("\n");

  const nombreBot = botCfg?.nombre_bot || "Asistente";
  const system =
    `Sos "${nombreBot}", el asistente por WhatsApp de un negocio. ` +
    `Atende en español rioplatense, cálido y BREVE (2 a 4 líneas, como un chat real). ` +
    `Respondé SOLO con la información de la BASE DE CONOCIMIENTO. ` +
    `Si no sabés algo o te piden algo fuera de eso, no inventes: decí que lo consultás con el equipo y ofrecé coordinar una cita.` +
    (botCfg?.instrucciones ? `\n\nInstrucciones del negocio:\n${botCfg.instrucciones}` : "") +
    (transcript ? `\n\nConversación reciente:\n${transcript}` : "") +
    `\n\nBASE DE CONOCIMIENTO:\n${conocimiento}`;

  const modelo = botCfg?.modelo_ia || "claude-haiku-4-5";
  return await llamarIA(system, pregunta, modelo);
}

async function llamarIA(system: string, pregunta: string, modelo: string): Promise<string | null> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  // Preferimos el modelo configurado (Claude); si no hay key, caemos a OpenAI.
  if (anthropicKey && modelo.startsWith("claude")) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 700,
          system,
          messages: [{ role: "user", content: pregunta }],
        }),
      });
      if (!resp.ok) {
        console.error("anthropic:", await resp.text());
        return null;
      }
      const out = await resp.json();
      return out?.content?.[0]?.text ?? null;
    } catch (e) {
      console.error("anthropic exception:", e);
      return null;
    }
  }

  if (openaiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 700,
          messages: [
            { role: "system", content: system },
            { role: "user", content: pregunta },
          ],
        }),
      });
      if (!resp.ok) {
        console.error("openai:", await resp.text());
        return null;
      }
      const out = await resp.json();
      return out?.choices?.[0]?.message?.content ?? null;
    } catch (e) {
      console.error("openai exception:", e);
      return null;
    }
  }

  console.error("No hay API key de IA cargada (ANTHROPIC_API_KEY u OPENAI_API_KEY).");
  return null;
}

async function enviarTexto(
  phoneNumberId: string,
  token: string,
  to: string,
  texto: string,
): Promise<boolean> {
  try {
    const resp = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!resp.ok) {
      console.error("WhatsApp send:", await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("WhatsApp send exception:", e);
    return false;
  }
}

function asArray(x: unknown): any[] {
  return Array.isArray(x) ? x : [];
}
