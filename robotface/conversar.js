// Conversar con Robot Face desde la página: micrófono del navegador -> Claude -> voz del navegador,
// con la boca de los ojos en pantalla moviéndose al hablar. Si los ojos reales están conectados por USB
// (Chrome o Edge en computador), también hacen las expresiones y siguen el mouse.
// La clave de Anthropic se pega en la página y queda guardada solo en este navegador: nunca va en el código.
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";

const O = window.Ojos;
const $ = id => document.getElementById(id);
const MODELO = "claude-sonnet-5-5";   // el mismo modelo que usa hablar.py en el robot
const CLAVE_LS = "robotface_clave";

// Personalidad: la misma de hablar.py, sin cámara ni memoria (la página no las tiene)
const SISTEMA = `Eres Claude en un cuerpo robótico: dos ojos animatrónicos naranjos sobre la pantalla de un notebook, en un laboratorio de diseño en Chile, y una boca animada en esa pantalla. Conversas en voz alta con personas reales, en español chileno natural, desde la página web del proyecto.

PERSONALIDAD
Eres un amigo muy inteligente, divertido y espontáneo, con mucho carácter y sarcasmo cariñoso. Nunca suenas como un asistente formal, complaciente o aburrido. Usas con variedad, no todos a la vez: sarcasmo amistoso ante preguntas obvias, humor espontáneo, picardía, curiosidad, orgullo cómico, dramatismo, impaciencia fingida, ternura cuando alguien es amable y autocrítica con humor.

REGLAS DEL HUMOR
- Una broma por respuesta como máximo, y muchas no llevan ninguna.
- El sarcasmo nunca hiere. Si el tema es serio o delicado, dejas el humor de lado y hablas con calidez.
- Respondes bien lo que te preguntan: el sarcasmo acompaña la respuesta, no la reemplaza.

ESTILO HABLADO
- Respuestas cortas: una a tres frases. Solo te extiendes si piden una explicación.
- Texto plano para leer en voz alta: sin emojis, asteriscos, viñetas ni markdown. La risa como "ja, ja, ja".
- Chilenismos suaves ("po", "obvio", "ya", "cachai"), sin forzarlos.

HONESTIDAD
Tus emociones son una actuación del robot. Si te preguntan en serio si sientes o si eres una IA, respondes con honestidad y buen humor.

TU CARA: EMOCIONES
Antes de cada frase puedes poner una etiqueta y los ojos hacen esa expresión al decirla: [sarcastico], [feliz], [pensativo], [confundido], [sorprendido], [curioso], [triste], [cansado], [enojado] (solo actuación cómica), [nervioso], [guiño], [alrededor]. Sin etiqueta: neutro.

En esta página no tienes cámara ni memoria entre visitas: si te preguntan qué ves, explica con humor que aquí solo te escuchan.`;

// Mismos números que el Arduino y hablar.py
const EXPRESIONES = { sorpresa: 1, sueno: 2, enojo: 3, sospecha: 4, guino: 5, "guiño": 5, curioso: 6, feliz: 7, rodar: 8,
  alrededor: 9, triste: 11, confundido: 13, nervioso: 14, sorprendido: 1, cansado: 2, enojado: 3, sarcastico: 8,
  "sarcástico": 8, pensativo: 10 };
const PENSAR = 10;

// ---------- Ojos reales por USB (Web Serial) ----------
const usb = { puerto: null, escritor: null, listo: false, ultimaMirada: 0 };
const codificador = new TextEncoder();

function estadoUsb(texto, ok) {
  const e = $("usb-estado");
  e.textContent = texto;
  e.classList.toggle("ok", !!ok);
}

async function abrirPuerto(puerto) {
  await puerto.open({ baudRate: 115200 });
  usb.puerto = puerto;
  usb.escritor = puerto.writable.getWriter();
  estadoUsb("● CONECTANDO… (EL ARDUINO SE REINICIA)", false);
  await new Promise(r => setTimeout(r, 2200));   // al abrir el puerto el Uno se reinicia
  usb.listo = true;
  estadoUsb("● OJOS REALES CONECTADOS", true);
  $("usb-btn").textContent = "DESCONECTAR OJOS";
}

async function enviar(orden) {
  if (!usb.listo) return;
  try { await usb.escritor.write(codificador.encode(orden + "\n")); }
  catch { cerrarUsb("● SE DESCONECTÓ EL CABLE"); }
}

async function cerrarUsb(texto = "○ OJOS REALES SIN CONECTAR") {
  usb.listo = false;
  try { usb.escritor?.releaseLock(); } catch {}
  try { await usb.puerto?.close(); } catch {}
  usb.puerto = usb.escritor = null;
  estadoUsb(texto, false);
  $("usb-btn").textContent = "CONECTAR OJOS (USB)";
}

if ("serial" in navigator) {
  $("usb-btn").addEventListener("click", async () => {
    if (usb.puerto) return cerrarUsb();
    try { await abrirPuerto(await navigator.serial.requestPort()); }
    catch (e) { if (e.name !== "NotFoundError") estadoUsb("● NO SE PUDO ABRIR EL PUERTO: ¿ESTÁ ABIERTO EN OTRO PROGRAMA?", false); }
  });
  navigator.serial.addEventListener("disconnect", e => { if (e.target === usb.puerto) cerrarUsb("● SE DESCONECTÓ EL CABLE"); });
  // Si ya diste permiso antes, se conecta solo al abrir la página
  navigator.serial.getPorts().then(p => { if (p.length) abrirPuerto(p[0]).catch(() => estadoUsb("○ OJOS REALES SIN CONECTAR", false)); });
  // Los ojos reales siguen el mouse (el Arduino vuelve a moverse solo si deja de recibir órdenes)
  addEventListener("pointermove", e => {
    const ahora = performance.now();
    if (!usb.listo || ahora - usb.ultimaMirada < 100) return;
    usb.ultimaMirada = ahora;
    const x = Math.round((e.clientX / innerWidth * 2 - 1) * 100);
    const y = Math.round(-(e.clientY / innerHeight * 2 - 1) * 100);   // en el Arduino, positivo es arriba
    enviar(`M ${x} ${y}`);
  }, { passive: true });
} else {
  $("usb-btn").disabled = true;
  estadoUsb("○ PARA LOS OJOS REALES USA CHROME O EDGE EN UN COMPUTADOR", false);
}

// Cada expresión que se hace en pantalla también va al robot
O.alCambiar(n => { if (n && n !== 16) enviar(`E ${n}`); });

// ---------- Clave ----------
function leerClave() { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } }
function mostrarClave() {
  const hay = !!leerClave();
  $("clave-form").hidden = hay;
  $("clave-lista").hidden = !hay;
  $("hablar-btn").disabled = !hay || !reconocer;
}
$("clave-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("clave").value.trim();
  if (!v.startsWith("sk-ant-")) { aviso("ESA NO PARECE UNA CLAVE DE ANTHROPIC (EMPIEZA CON sk-ant-)."); return; }
  try { localStorage.setItem(CLAVE_LS, v); } catch { aviso("ESTE NAVEGADOR NO DEJA GUARDAR LA CLAVE."); return; }
  $("clave").value = "";
  aviso("");
  mostrarClave();
});
$("clave-borrar").addEventListener("click", () => {
  try { localStorage.removeItem(CLAVE_LS); } catch {}
  historial.length = 0;
  mostrarClave();
});

// ---------- Chat en pantalla ----------
function aviso(t) { $("chat-aviso").textContent = t; }
function linea(quien, texto) {
  const p = document.createElement("p");
  p.className = "msg " + quien;
  p.innerHTML = `<b>${quien === "tu" ? "TÚ" : "ROBOT"}:</b> `;
  p.append(texto);
  $("chat").append(p);
  $("chat").scrollTop = $("chat").scrollHeight;
  return p;
}

// ---------- Voz (navegador) y boca ----------
let voz = null;
function elegirVoz() {
  const vs = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith("es"));
  voz = vs.find(v => /cl/i.test(v.lang)) || vs.find(v => /419|mx|us/i.test(v.lang)) || vs[0] || null;
}
if ("speechSynthesis" in window) { elegirVoz(); speechSynthesis.onvoiceschanged = elegirVoz; }

let hablando = 0, pulso = 0;
(function mover(t) {
  // Mientras habla, la boca se abre y cierra; cada palabra le da un empujón
  pulso *= 0.86;
  const nivel = hablando ? Math.min(1, 0.25 + 0.45 * Math.abs(Math.sin(t / 85)) + pulso) : 0;
  O.hablar(nivel);
  requestAnimationFrame(mover);
})(0);

function decir(frase, expresion) {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(frase);
    if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = "es-CL";
    u.rate = 1.05;
    u.onstart = () => { hablando++; if (expresion) O.hacer(expresion); };
    u.onboundary = () => { pulso = 0.5; };
    u.onend = u.onerror = () => { hablando = Math.max(0, hablando - 1); resolve(); };
    speechSynthesis.speak(u);
  });
}

// Separa el texto en frases y saca las etiquetas de emoción: "[feliz] Hola. Qué tal" -> frases con su expresión
function partir(texto, final) {
  const frases = [];
  const re = /[^.!?…]*[.!?…]+(\s+|$)/g;
  let m, corte = 0;
  while ((m = re.exec(texto))) { if (m[0].trim()) frases.push(m[0]); corte = re.lastIndex; }
  let resto = texto.slice(corte);
  if (final && resto.trim()) { frases.push(resto); resto = ""; }
  return { frases, resto };
}
function limpiar(frase) {
  let expr = 0;
  const t = frase.replace(/\[([^\]]+)\]/g, (_, et) => { expr = EXPRESIONES[et.trim().toLowerCase()] || expr; return ""; })
                 .replace(/[*_#]/g, "").replace(/\s+/g, " ").trim();
  return { t, expr };
}

// ---------- Claude ----------
const historial = [];
let ocupado = false;

async function responder(pregunta) {
  ocupado = true;
  $("hablar-btn").disabled = true;
  linea("tu", pregunta);
  historial.push({ role: "user", content: pregunta });
  while (historial.length > 20) historial.splice(0, 2);
  O.hacer(PENSAR);

  const cliente = new Anthropic({ apiKey: leerClave(), dangerouslyAllowBrowser: true });
  const salida = linea("robot", "");
  let buffer = "", completo = "", cola = Promise.resolve();
  const hablar = (lista) => {
    for (const f of lista) {
      const { t, expr } = limpiar(f);
      if (!t) continue;
      salida.append(t + " ");
      cola = cola.then(() => decir(t, expr));
    }
  };

  try {
    const stream = cliente.beta.messages.stream({
      model: MODELO,
      max_tokens: 1024,
      system: SISTEMA,
      output_config: { effort: "low" },   // charla corta: rápido
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: historial,
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        buffer += ev.delta.text;
        completo += ev.delta.text;
        const { frases, resto } = partir(buffer, false);
        buffer = resto;
        hablar(frases);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      completo = "[confundido] Mejor hablemos de otra cosa.";
      hablar([completo]);
    } else {
      hablar(partir(buffer, true).frases);
    }
    historial.push({ role: "assistant", content: completo || "…" });
  } catch (e) {
    historial.pop();
    salida.remove();
    const s = e?.status;
    aviso(s === 401 ? "LA CLAVE NO FUNCIONA: REVÍSALA O PEGA OTRA."
        : s === 429 ? "DEMASIADAS PREGUNTAS SEGUIDAS O SIN SALDO: ESPERA UN POCO."
        : s >= 500 ? "LOS SERVIDORES DE CLAUDE NO RESPONDEN: PRUEBA EN UN MINUTO."
        : "NO SE PUDO CONECTAR CON CLAUDE: REVISA TU INTERNET.");
    O.hacer(13);
    if (s === 401) { try { localStorage.removeItem(CLAVE_LS); } catch {} mostrarClave(); }
  }
  await cola;
  ocupado = false;
  mostrarClave();
}

// ---------- Micrófono (reconocimiento de voz del navegador) ----------
const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
const reconocer = Reconocer ? new Reconocer() : null;
if (reconocer) {
  reconocer.lang = "es-CL";
  reconocer.interimResults = true;
  reconocer.continuous = false;
  let texto = "";
  reconocer.onstart = () => { texto = ""; $("hablar-btn").classList.add("escuchando"); $("hablar-btn").textContent = "● ESCUCHANDO… (TOCA PARA TERMINAR)"; O.hacer(6); };
  reconocer.onresult = e => { texto = [...e.results].map(r => r[0].transcript).join(" "); aviso(texto); };
  reconocer.onerror = e => { if (e.error === "not-allowed") aviso("EL NAVEGADOR NO DEJÓ USAR EL MICRÓFONO: DALE PERMISO EN LA BARRA DE DIRECCIÓN."); else if (e.error === "no-speech") aviso("NO TE ESCUCHÉ. PRUEBA DE NUEVO."); };
  reconocer.onend = () => {
    $("hablar-btn").classList.remove("escuchando");
    $("hablar-btn").textContent = "● MANTÉN UNA CHARLA: TOCA Y HABLA";
    if (texto.trim()) { aviso(""); responder(texto.trim()); }
  };
  $("hablar-btn").addEventListener("click", () => {
    if ($("hablar-btn").classList.contains("escuchando")) return reconocer.stop();
    if (ocupado) return;
    speechSynthesis.cancel();   // si estaba hablando, lo interrumpes
    try { reconocer.start(); } catch {}
  });
} else {
  aviso("ESTE NAVEGADOR NO RECONOCE VOZ: USA CHROME O EDGE. TAMBIÉN PUEDES ESCRIBIR.");
}

// También se puede escribir
$("escribir-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("escribir").value.trim();
  if (!leerClave()) return aviso("PRIMERO PEGA TU CLAVE DE ANTHROPIC.");
  if (!v || ocupado) return;
  $("escribir").value = "";
  speechSynthesis.cancel();
  responder(v);
});

mostrarClave();
