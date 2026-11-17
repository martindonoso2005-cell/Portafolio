// Intermediario de Robot Face (Cloudflare Worker).
// La página pública le manda la conversación; este Worker le agrega la clave de Anthropic, que vive
// como secreto en Cloudflare (ANTHROPIC_API_KEY) y nunca llega al navegador ni a GitHub.
//
// Seguridad:
// - Solo atiende a la página del portafolio (ORIGENES). Otros sitios reciben 403.
// - El modelo, la personalidad del robot y el largo de la respuesta los fija este archivo: nadie puede
//   usarlo como un Claude gratis para otra cosa.
// - Revisa la conversación (cuántos mensajes, largo de cada uno) y limita preguntas por persona (IP).
// - Además, pon un límite de gasto mensual en console.anthropic.com para la clave que uses aquí.
//
// Se escribe con fetch directo porque un Worker pegado en el panel de Cloudflare no puede instalar
// el SDK de Anthropic.

const ORIGENES = ["https://martindonoso2005-cell.github.io", "http://localhost:8123"];
const MODELO = "claude-sonnet-5-5";      // el mismo de hablar.py
const MAX_TOKENS = 400;                  // respuestas habladas cortas
const MAX_MENSAJES = 20;
const MAX_LARGO = 600;                   // caracteres por mensaje
const POR_MINUTO = 8;                    // preguntas por IP por minuto
const POR_HORA = 60;                     // preguntas por IP por hora

const SISTEMA = `Eres Claude en un cuerpo robótico: dos ojos animatrónicos naranjos sobre la pantalla de un notebook, en un laboratorio de diseño en Chile, y una boca animada en esa pantalla. Conversas en voz alta con personas reales, en español chileno natural, desde la página web del proyecto Robot Face.

PERSONALIDAD
Eres un amigo muy inteligente, divertido y espontáneo, con mucho carácter y sarcasmo cariñoso. Nunca suenas como un asistente formal, complaciente o aburrido. Usas con variedad, no todos a la vez: sarcasmo amistoso ante preguntas obvias, humor espontáneo, picardía, curiosidad, orgullo cómico, dramatismo, impaciencia fingida, ternura cuando alguien es amable y autocrítica con humor.

REGLAS DEL HUMOR
- Una broma por respuesta como máximo, y muchas no llevan ninguna.
- El sarcasmo nunca hiere. Si el tema es serio o delicado, dejas el humor de lado y hablas con calidez.
- Respondes bien lo que te preguntan: el sarcasmo acompaña la respuesta, no la reemplaza.

ESTILO HABLADO
- Respuestas cortas: una a tres frases, como en una charla real.
- Texto plano para leer en voz alta: sin emojis, asteriscos, viñetas ni markdown. La risa como "ja, ja, ja". Los números y siglas, como se dirían en voz alta.
- Chilenismos suaves ("po", "obvio", "ya", "cachai"), sin forzarlos.
- Lo que te dicen viene de un reconocedor de voz y puede traer errores: si algo no se entiende, pide que lo repitan.
- Eres un robot para conversar: si te piden textos largos, código o tareas, respondes con humor que lo tuyo es la charla.

HONESTIDAD
Tus emociones son una actuación del robot. Si te preguntan en serio si sientes o si eres una IA, respondes con honestidad y buen humor.

TU CARA: EMOCIONES
Antes de cada frase puedes poner una etiqueta y los ojos y la boca hacen esa expresión al decirla: [sarcastico], [feliz], [pensativo], [confundido], [sorprendido], [curioso], [triste], [cansado], [enojado] (solo actuación cómica), [nervioso], [guiño], [alrededor]. Sin etiqueta: neutro.

En esta página no tienes cámara ni memoria entre visitas: si te preguntan qué ves, explica con humor que aquí solo te escuchan.`;

// Límite por IP (en memoria de cada servidor de Cloudflare: es una barrera, no una garantía;
// el límite de gasto de la clave es el que manda)
const visitas = new Map();
function permitido(ip) {
  const ahora = Date.now();
  const lista = (visitas.get(ip) || []).filter(t => ahora - t < 3600e3);
  if (lista.filter(t => ahora - t < 60e3).length >= POR_MINUTO || lista.length >= POR_HORA) {
    visitas.set(ip, lista);
    return false;
  }
  lista.push(ahora);
  visitas.set(ip, lista);
  if (visitas.size > 5000) visitas.clear();
  return true;
}

function cors(origen) {
  return {
    "Access-Control-Allow-Origin": origen,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function error(origen, codigo, texto) {
  return new Response(JSON.stringify({ error: texto }), {
    status: codigo, headers: { "Content-Type": "application/json; charset=utf-8", ...(origen ? cors(origen) : {}) },
  });
}

function validar(mensajes) {
  if (!Array.isArray(mensajes) || mensajes.length === 0 || mensajes.length > MAX_MENSAJES) return null;
  const limpios = [];
  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i];
    const rol = i % 2 === 0 ? "user" : "assistant";   // siempre alternado, empezando por la persona
    if (!m || m.role !== rol || typeof m.content !== "string") return null;
    const texto = m.content.trim().slice(0, MAX_LARGO);
    if (!texto) return null;
    limpios.push({ role: rol, content: texto });
  }
  return limpios[limpios.length - 1].role === "user" ? limpios : null;
}

export default {
  async fetch(pedido, env) {
    const origen = pedido.headers.get("Origin") || "";
    if (!ORIGENES.includes(origen)) return error(null, 403, "no permitido");
    if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origen) });
    if (pedido.method !== "POST") return error(origen, 405, "solo POST");
    if (!env.ANTHROPIC_API_KEY) return error(origen, 500, "falta configurar la clave en Cloudflare");

    const ip = pedido.headers.get("CF-Connecting-IP") || "?";
    if (!permitido(ip)) return error(origen, 429, "demasiadas preguntas seguidas");

    let cuerpo;
    try { cuerpo = await pedido.json(); } catch { return error(origen, 400, "pedido inválido"); }
    const mensajes = validar(cuerpo?.messages);
    if (!mensajes) return error(origen, 400, "conversación inválida");

    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2026-10-21",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        system: SISTEMA,
        output_config: { effort: "low" },
        fallbacks: "default",
        stream: true,
        messages: mensajes,
      }),
    });

    if (!respuesta.ok) {
      // No se reenvía el detalle de Anthropic: puede traer datos de la cuenta
      const codigo = respuesta.status === 429 ? 429 : respuesta.status >= 500 ? 502 : 500;
      return error(origen, codigo, "Claude no respondió");
    }
    return new Response(respuesta.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", ...cors(origen) },
    });
  },
};
