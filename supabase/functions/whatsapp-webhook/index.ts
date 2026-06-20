// Edge Function: whatsapp-webhook  (la "oreja" + el cerebro + la "boca" del bot)
//
// Recibe los mensajes entrantes, los guarda en la Bandeja y —si el bot esta activo—
// contesta solo con la IA usando el conocimiento del cliente.
//
// SOPORTA DOS PROVEEDORES (campo canales_whatsapp.proveedor):
//   'meta'      -> Meta Cloud API (oficial). El mensaje entra con phone_number_id.
//   'evolution' -> Evolution API (no oficial, servidor propio). Entra con el nombre de instancia.
// El MISMO webhook sirve a los dos: detecta el formato del payload y ubica al cliente.
// De ahi en adelante, todo es igual (guardar, bot, responder). Solo cambia COMO se envia.
//
// MULTI-CLIENTE: cada numero/instancia ubica a su profesional y responde con SUS datos.
//
// DESPLEGAR con "Verify JWT" DESACTIVADO (ni Meta ni Evolution mandan JWT).
// En Meta se valida el alta por WHATSAPP_VERIFY_TOKEN. Evolution no hace GET de verificacion.
// SECRETS necesarios:
//   WHATSAPP_VERIFY_TOKEN  -> un string que inventamos; el MISMO que pones en Meta.
//   ANTHROPIC_API_KEY / OPENAI_API_KEY -> el motor de IA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";
// Campos del canal que necesitamos para guardar Y para responder por cualquier proveedor.
const CAMPOS_CANAL =
  "profesional_id, proveedor, phone_number_id, access_token, evolution_url, evolution_instance, evolution_api_key";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Verificacion del webhook: Meta hace UN GET cuando lo configuras. (Evolution no.)
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

  // Siempre respondemos 200 rapido; procesamos lo que se pueda por dentro.
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

  // Meta trae `entry` (array). Evolution trae `event`/`instance`. Asi distinguimos el formato.
  if (Array.isArray(payload?.entry)) {
    await procesarMeta(admin, payload);
  } else if (payload?.event || payload?.instance) {
    await procesarEvolution(admin, payload);
  }
}

// ---- META (Cloud API) ----------------------------------------------------------------
async function procesarMeta(admin: any, payload: any) {
  for (const entry of asArray(payload?.entry)) {
    for (const change of asArray(entry?.changes)) {
      const value = change?.value ?? {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = asArray(value?.messages);
      if (!phoneNumberId || messages.length === 0) continue; // estados de entrega, etc.

      // ¿De que cliente es este numero?
      const { data: canal } = await admin
        .from("canales_whatsapp")
        .select(CAMPOS_CANAL)
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!canal?.profesional_id) continue; // numero no configurado

      const nombreContacto = asArray(value?.contacts)[0]?.profile?.name ?? null;

      for (const m of messages) {
        if (m?.type !== "text") continue; // v1: solo texto
        const desde = String(m.from ?? "").trim(); // telefono del lead
        const texto = String(m?.text?.body ?? "").trim();
        if (!desde || !texto) continue;
        await manejarEntrante(admin, canal, desde, texto, nombreContacto);
      }
    }
  }
}

// ---- EVOLUTION (no oficial) ----------------------------------------------------------
// Evento que nos importa: "messages.upsert" (mensaje nuevo). Formato tipico:
//   { event:"messages.upsert", instance:"...", data:{ key:{ remoteJid, fromMe }, pushName, message:{...} } }
async function procesarEvolution(admin: any, payload: any) {
  const evento = String(payload?.event ?? "").toLowerCase().replace(/[._]/g, "");
  if (evento && evento !== "messagesupsert") return; // ignoramos status, presence, etc.

  const instancia = payload?.instance;
  if (!instancia) return;

  const { data: canal } = await admin
    .from("canales_whatsapp")
    .select(CAMPOS_CANAL)
    .eq("evolution_instance", instancia)
    .maybeSingle();
  if (!canal?.profesional_id) return; // instancia no configurada

  // data puede venir como objeto o como array de mensajes.
  for (const d of (Array.isArray(payload?.data) ? payload.data : [payload?.data])) {
    if (!d?.key || d.key.fromMe) continue; // sin clave o es eco de lo que mandamos nosotros
    const jid = String(d.key.remoteJid ?? "");
    // Salteamos grupos, estados y newsletters; atendemos solo el chat 1 a 1.
    if (jid.endsWith("@g.us") || jid.endsWith("@newsletter") || jid.includes("broadcast")) continue;
    // El telefono del lead: el numero del JID clasico, o senderPn cuando el JID es del tipo nuevo (@lid).
    const phoneRaw = jid.endsWith("@s.whatsapp.net")
      ? jid.split("@")[0]
      : (d?.key?.senderPn ?? d?.senderPn ?? "");
    const desde = String(phoneRaw).replace(/\D/g, ""); // con el 9, como lo entrega WhatsApp
    const texto = String(
      d?.message?.conversation ?? d?.message?.extendedTextMessage?.text ?? "",
    ).trim();
    const nombreContacto = d?.pushName ?? null;
    if (!desde) {
      console.error("Evolution: no pude obtener un telefono del mensaje:", jid);
      continue;
    }
    if (!texto) continue;
    await manejarEntrante(admin, canal, desde, texto, nombreContacto);
  }
}

// ---- DE ACA EN ADELANTE ES IGUAL PARA LOS DOS PROVEEDORES ----------------------------
async function manejarEntrante(
  admin: any,
  canal: any,
  desde: string,
  texto: string,
  nombreContacto: string | null,
) {
  const pid = canal.profesional_id as string;
  // Canal a medio configurar (sin token de Meta, o sin datos de Evolution): no hacemos nada,
  // igual que antes. Asi no creamos leads ni gastamos IA en un numero que no puede responder.
  if (!canalConfigurado(canal)) return;

  const lead = await buscarOCrearLead(admin, pid, desde, nombreContacto);
  if (!lead?.id) return;
  const conv = await buscarOCrearConversacion(admin, pid, lead.id);
  if (!conv?.id) return;

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
  if (!botCfg?.activo || conv.bot_activo === false) return;

  const respuesta = await responderConIA(admin, pid, botCfg, conv.id, texto);
  if (!respuesta) return;

  const enviado = await enviarTexto(canal, desde, respuesta);
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

// ---- ENVIO: elige el proveedor del canal ---------------------------------------------
async function enviarTexto(canal: any, to: string, texto: string): Promise<boolean> {
  if (canal?.proveedor === "evolution") {
    return await enviarEvolution(canal, to, texto);
  }
  return await enviarMeta(canal?.phone_number_id, canal?.access_token, to, texto);
}

async function enviarMeta(
  phoneNumberId: string,
  token: string,
  to: string,
  texto: string,
): Promise<boolean> {
  if (!phoneNumberId || !token) {
    console.error("Meta mal configurado (falta phone_number_id o access_token).");
    return false;
  }
  const destino = normalizarDestinoMeta(to);
  try {
    const resp = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!resp.ok) {
      console.error(`Meta send (destino ${destino}, original ${to}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Meta send exception:", e);
    return false;
  }
}

// Evolution: se le envia al numero TAL CUAL lo da WhatsApp (con el 9 en Argentina). El servidor
// resuelve el ruteo. NO se aplica el ajuste del 9 (eso es solo un capricho de la Cloud API de Meta).
async function enviarEvolution(canal: any, to: string, texto: string): Promise<boolean> {
  const base = String(canal?.evolution_url ?? "").trim().replace(/\/+$/, "");
  const instancia = String(canal?.evolution_instance ?? "").trim();
  const apikey = String(canal?.evolution_api_key ?? "").trim();
  if (!base || !instancia || !apikey) {
    console.error("Evolution mal configurado (falta url, instancia o api key).");
    return false;
  }
  const number = String(to).replace(/\D/g, "");
  try {
    const resp = await fetch(`${base}/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { apikey, "content-type": "application/json" },
      body: JSON.stringify({ number, text: texto }),
    });
    if (!resp.ok) {
      console.error(`Evolution send (number ${number}):`, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Evolution send exception:", e);
    return false;
  }
}

// Argentina (SOLO Meta): WhatsApp ENTREGA el numero como 549XXXXXXXXXX, pero para ENVIARLE por
// la Cloud API hay que usar 54XXXXXXXXXX (sin el 9). Sin esto el mensaje rebota (error 131030).
function normalizarDestinoMeta(to: string): string {
  const limpio = String(to).replace(/\D/g, "");
  if (limpio.startsWith("549") && limpio.length === 13) {
    return "54" + limpio.slice(3);
  }
  return limpio;
}

// ¿El canal tiene TODOS los datos para enviar por su proveedor? (Meta: token; Evolution: url+instancia+key.)
function canalConfigurado(canal: any): boolean {
  if (!canal) return false;
  if (canal.proveedor === "evolution") {
    return !!(canal.evolution_url && canal.evolution_instance && canal.evolution_api_key);
  }
  return !!(canal.phone_number_id && canal.access_token);
}

function asArray(x: unknown): any[] {
  return Array.isArray(x) ? x : [];
}
