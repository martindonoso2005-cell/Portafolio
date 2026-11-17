// Robot Face en vivo desde la página, como el panel del proyecto (web/panel.js + hablar.py):
// - Boca de caricatura en la "pantalla del notebook" (mismo dibujo y mismas formas por emoción que hablar.py).
// - Conversación solo por voz, manos libres: escucha con el micrófono, responde Claude, habla en voz alta.
// - Si los ojos reales están conectados por USB (Chrome o Edge), hacen cada emoción y siguen el mouse.
// La clave de Anthropic se pega en la página y queda guardada solo en este navegador: nunca va en el código.
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";

const O = window.Ojos;
const $ = id => document.getElementById(id);
const MODELO = "claude-sonnet-5-5";   // el mismo modelo que usa hablar.py en el robot
const CLAVE_LS = "robotface_clave";

// Personalidad de hablar.py, sin cámara ni memoria (la página no las tiene)
const SISTEMA = `Eres Claude en un cuerpo robótico: dos ojos animatrónicos naranjos sobre la pantalla de un notebook, en un laboratorio de diseño en Chile, y una boca animada en esa pantalla. Conversas en voz alta con personas reales, en español chileno natural, desde la página web del proyecto.

PERSONALIDAD
Eres un amigo muy inteligente, divertido y espontáneo, con mucho carácter y sarcasmo cariñoso. Nunca suenas como un asistente formal, complaciente o aburrido. Usas con variedad, no todos a la vez: sarcasmo amistoso ante preguntas obvias, humor espontáneo, picardía, curiosidad, orgullo cómico, dramatismo, impaciencia fingida, ternura cuando alguien es amable y autocrítica con humor.

REGLAS DEL HUMOR
- Una broma por respuesta como máximo, y muchas no llevan ninguna.
- El sarcasmo nunca hiere. Si el tema es serio o delicado, dejas el humor de lado y hablas con calidez.
- Respondes bien lo que te preguntan: el sarcasmo acompaña la respuesta, no la reemplaza.

ESTILO HABLADO
- Respuestas cortas: una a tres frases, como en una charla real. Solo te extiendes si piden una explicación.
- Texto plano para leer en voz alta: sin emojis, asteriscos, viñetas ni markdown. La risa como "ja, ja, ja". Los números y siglas, como se dirían en voz alta.
- Chilenismos suaves ("po", "obvio", "ya", "cachai"), sin forzarlos.
- Lo que te dicen viene de un reconocedor de voz y puede traer errores: si algo no se entiende, pide que lo repitan.

HONESTIDAD
Tus emociones son una actuación del robot. Si te preguntan en serio si sientes o si eres una IA, respondes con honestidad y buen humor.

TU CARA: EMOCIONES
Antes de cada frase puedes poner una etiqueta y los ojos y la boca hacen esa expresión al decirla: [sarcastico], [feliz], [pensativo], [confundido], [sorprendido], [curioso], [triste], [cansado], [enojado] (solo actuación cómica), [nervioso], [guiño], [alrededor]. Sin etiqueta: neutro.

En esta página no tienes cámara ni memoria entre visitas: si te preguntan qué ves, explica con humor que aquí solo te escuchan.`;

// Mismos números que el Arduino y hablar.py
const EXPRESIONES = { sorpresa: 1, sueno: 2, enojo: 3, sospecha: 4, guino: 5, "guiño": 5, curioso: 6, feliz: 7, rodar: 8,
  alrededor: 9, triste: 11, confundido: 13, nervioso: 14, sorprendido: 1, cansado: 2, enojado: 3, sarcastico: 8,
  "sarcástico": 8, pensativo: 10 };
const PENSAR = 10;

// Forma de la boca para cada emoción (FORMAS_EMOCION de hablar.py)
const FORMAS_EMOCION = {
  feliz: { sonrisa: .8 }, sorpresa: { ancho: .5, sonrisa: 0, abre: .45 }, sorprendido: { ancho: .5, sonrisa: 0, abre: .45 },
  triste: { sonrisa: -.6, ancho: .85 }, enojo: { sonrisa: -.35, ancho: .8, ladeo: 0 }, enojado: { sonrisa: -.35, ancho: .8, ladeo: 0 },
  sospecha: { sonrisa: .05, ladeo: .35, lado: -.05 }, sarcastico: { sonrisa: .4, ladeo: .55, lado: .06 },
  "sarcástico": { sonrisa: .4, ladeo: .55, lado: .06 }, guino: { sonrisa: .6, ladeo: .3 }, "guiño": { sonrisa: .6, ladeo: .3 },
  curioso: { ancho: .65, abre: .15 }, confundido: { sonrisa: -.1, ladeo: "duda", lado: .05 },
  nervioso: { sonrisa: .1, ancho: .8, ladeo: "tiembla" }, cansado: { ancho: .75, sonrisa: -.1 },
  pensativo: { ancho: .55, sonrisa: .05, lado: .12, ladeo: .35 },
};
const DURA_EMOCION = 4;

// ---------- Estado en vivo (como estado.modo de hablar.py) ----------
const vivo = { encendido: false, modo: "apagado", dormida: false, emocion: "", tEmocion: 0, mic: 0, tu: "", robot: "" };
const COLORES_MODO = { iniciando: "#5a5a6e", escuchando: "#46beff", oyendo: "#5affaa", pensando: "#aa78ff", hablando: "#ff8c28", error: "#ff3c3c", apagado: "#55534a" };
const NOMBRE_MODO = { iniciando: "PARTIENDO", escuchando: "ESCUCHANDO", oyendo: "TE OYE", pensando: "PENSANDO", hablando: "HABLANDO", error: "ERROR", apagado: "APAGADO" };

function modo(m) {
  vivo.modo = m;
  $("modo-luz").style.background = vivo.dormida && m === "escuchando" ? "#ff7d1e" : COLORES_MODO[m];
  $("modo-texto").textContent = vivo.dormida && m === "escuchando" ? "DURMIENDO · HÁBLALE PARA DESPERTARLO" : NOMBRE_MODO[m];
}
function subtitulos() {
  $("sub-tu").textContent = vivo.tu;
  $("sub-robot").textContent = vivo.robot;
}

// ---------- Boca (dibujarBoca de web/panel.js, copia de dibujar_forma_boca de hablar.py) ----------
const lienzo = $("boca"), g = lienzo.getContext("2d");
const forma = { abierta: 0, ancho: 1, sonrisa: .3, lado: 0, ladeo: 0 };

function curva(p0, p1, p2, n = 40) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    out.push([(1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]]);
  }
  return out;
}
function trazo(pts) { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); }
function dibujarBoca(ancho, alto, f, labios) {
  const W = Math.min(ancho * .45, alto * 1.1) * f.ancho;
  const cx = ancho / 2 + f.lado * ancho, cy = alto * .45;
  const abierta = W * .38 * f.abierta, subida = W * .16 * f.sonrisa, ladeo = W * .12 * f.ladeo;
  const izq = [cx - W / 2, cy - subida + ladeo], der = [cx + W / 2, cy - subida - ladeo];
  g.lineWidth = Math.max(8, W * .055); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = labios;
  if (abierta < 3) { trazo(curva(izq, [cx, cy + subida * 1.5], der)); g.stroke(); return; }
  const arriba = curva(izq, [cx, cy - abierta * .7 + subida * .6], der);
  const abajo = curva(der, [cx, cy + abierta * 2 + subida * 1.4], izq);
  g.save();
  trazo(arriba.concat(abajo)); g.closePath(); g.fillStyle = "rgb(55,12,22)"; g.fill(); g.clip();
  const altoDientes = Math.min(abierta * .28, W * .06);
  trazo(arriba.concat(arriba.slice().reverse().map(([x, y]) => [x, y + altoDientes]))); g.fillStyle = "rgb(245,242,235)"; g.fill();
  if (abierta > W * .1) {
    g.beginPath(); g.ellipse(cx, cy + abierta * 1.15 + subida * .5, W * .275, abierta * .5, 0, 0, Math.PI * 2);
    g.fillStyle = "rgb(225,85,105)"; g.fill();
  }
  g.restore();
  trazo(arriba); g.stroke(); trazo(abajo); g.stroke();
}
const CICLO = 3.6;
function zetas(ancho, alto, t) {
  const cx = ancho / 2, cy = alto * .45, W = Math.min(ancho * .45, alto * 1.1);
  for (let k = 0; k < 5; k++) {
    const f = (t / (CICLO * 2.5) + k / 5) % 1, tam = 14 + 40 * f;
    g.globalAlpha = Math.min(1, f * 4) * (1 - f);
    g.fillStyle = "rgb(255,125,30)"; g.font = `bold ${tam}px Helvetica, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(k % 2 ? "z" : "Z", cx + W * .42 + f * W * .45 + 10 * Math.sin(t * 2 + k), cy - W * .05 - f * alto * .38);
  }
  g.globalAlpha = 1;
}
function ronquido(t) { const f = (t % CICLO) / CICLO; return f < .45 ? Math.sin(f / .45 * Math.PI / 2) : Math.max(0, 1 - (f - .45) / .2); }

// La voz del navegador no entrega el audio, así que la boca sigue las letras de la palabra que dice
const habla = { palabra: "", t0: 0, dur: 1 };
function vozAhora(ahora) {
  if (!habla.palabra) return { nivel: 0, abierta: .5, redonda: 0, estirada: 0, agudeza: 0 };
  const i = Math.floor((ahora - habla.t0) / habla.dur * habla.palabra.length);
  const c = habla.palabra[i];
  if (!c) return { nivel: .1, abierta: .5, redonda: 0, estirada: 0, agudeza: 0 };
  const v = { a: [1, 0, 0], á: [1, 0, 0], e: [.5, 0, 1], é: [.5, 0, 1], i: [.2, 0, 1], í: [.2, 0, 1], o: [.6, 1, 0], ó: [.6, 1, 0], u: [.3, 1, 0], ú: [.3, 1, 0] }[c];
  if (v) return { nivel: 1, abierta: v[0], redonda: v[1], estirada: v[2], agudeza: 0 };
  return { nivel: .45, abierta: .3, redonda: 0, estirada: .3, agudeza: "sszcfxj".includes(c) ? 1 : 0 };
}

const inicio = performance.now();
function cuadro(ahora) {
  const t = (ahora - inicio) / 1000;
  // Que el lienzo tenga la resolución de la pantalla
  const r = lienzo.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (lienzo.width !== Math.round(r.width * dpr)) { lienzo.width = Math.round(r.width * dpr); lienzo.height = Math.round(r.height * dpr); }

  const m = vivo.modo, dormida = vivo.dormida && m === "escuchando";
  const obj = { abierta: 0, ancho: 1 + .01 * Math.sin(t * 1.5), sonrisa: .35, lado: 0, ladeo: 0 };
  if (!vivo.encendido) Object.assign(obj, { ancho: .7, sonrisa: 0 });
  else if (dormida) { const q = ronquido(t); Object.assign(obj, { abierta: .15 + .8 * q, ancho: .32 + .1 * q, sonrisa: -.05, ladeo: .05 * Math.sin(t * .7) }); }
  else if (m === "hablando") {
    const v = vozAhora(ahora), abrir = Math.min(1, v.nivel * .8);
    obj.abierta = abrir * (.5 + .65 * v.abierta) * (1 - .45 * v.agudeza);
    obj.ancho = 1 - .12 * abrir - .4 * v.redonda * Math.min(1, abrir * 2) + .14 * v.estirada + .12 * v.agudeza;
    obj.sonrisa = .25 + .1 * v.estirada;
  } else if (m === "oyendo") {
    const aja = Math.max(0, Math.sin(t * .9)) ** 12;
    obj.sonrisa = .55 + .08 * Math.sin(t * 1.3) + .2 * aja; obj.ancho = 1 + .02 * Math.sin(t * 1.3) + .05 * aja;
  } else if (m === "escuchando") { obj.ancho = 1 + .025 * Math.sin(t * 1.2); obj.sonrisa = .35 + .04 * Math.sin(t * .6); }
  else if (m === "pensando") Object.assign(obj, { ancho: .55, sonrisa: .05, lado: .12, ladeo: .35 + .15 * Math.sin(t * 3) });
  else if (m === "error") obj.sonrisa = -.5;
  // La emoción de lo que dice (mientras habla y un rato después)
  const fe = FORMAS_EMOCION[vivo.emocion];
  if (vivo.encendido && !dormida && fe && (m === "hablando" || ahora - vivo.tEmocion < DURA_EMOCION * 1000)) {
    for (const [k, val] of Object.entries(fe)) {
      const x = val === "duda" ? -.35 + .15 * Math.sin(t * 4) : val === "tiembla" ? .08 * Math.sin(t * 25) : val;
      if (k === "abre") { if (m !== "hablando") obj.abierta = Math.max(obj.abierta, x); } else obj[k] = x;
    }
  }
  for (const k in obj) forma[k] += (obj[k] - forma[k]) * (k === "abierta" && obj[k] > forma[k] ? .6 : .3);

  g.fillStyle = "#000"; g.fillRect(0, 0, lienzo.width, lienzo.height);
  dibujarBoca(lienzo.width, lienzo.height, forma, vivo.encendido ? "rgb(255,125,30)" : "#3a3830");
  if (dormida) zetas(lienzo.width, lienzo.height, t);
  // La boquita de los ojos dibujados acompaña
  O.hablar(m === "hablando" ? forma.abierta : 0);

  // Barra del micrófono
  $("mic-nivel").style.width = Math.sqrt(Math.min(1, vivo.mic / .3)) * 100 + "%";
  $("mic-nivel").classList.toggle("voz", vivo.mic > .04);
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// Los ojos dibujados se duermen solos si nadie se mueve: la boca también
O.alCambiar(n => {
  if (n === 15) vivo.dormida = true;
  else if (n === 16) vivo.dormida = false;
  if (vivo.encendido) modo(vivo.modo);
});

// ---------- Ojos reales por USB (Web Serial) ----------
const usb = { puerto: null, escritor: null, listo: false, ultimaMirada: 0 };
const codificador = new TextEncoder();
function estadoUsb(texto, ok) { const e = $("usb-estado"); e.textContent = texto; e.classList.toggle("ok", !!ok); }
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
  try { await usb.escritor.write(codificador.encode(orden + "\n")); } catch { cerrarUsb("● SE DESCONECTÓ EL CABLE"); }
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
  navigator.serial.getPorts().then(p => { if (p.length) abrirPuerto(p[0]).catch(() => estadoUsb("○ OJOS REALES SIN CONECTAR", false)); });
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
O.alCambiar(n => { if (n && n !== 16) enviar(`E ${n}`); });

// ---------- Clave ----------
function leerClave() { try { return localStorage.getItem(CLAVE_LS) || ""; } catch { return ""; } }
function mostrarClave() {
  const hay = !!leerClave();
  $("clave-form").hidden = hay;
  $("clave-lista").hidden = !hay;
  $("btn-encender").disabled = !hay || !Reconocer;
}
function aviso(t) { $("aviso").textContent = t; }
$("clave-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("clave").value.trim();
  if (!v.startsWith("sk-ant-")) return aviso("ESA NO PARECE UNA CLAVE DE ANTHROPIC (EMPIEZA CON sk-ant-).");
  try { localStorage.setItem(CLAVE_LS, v); } catch { return aviso("ESTE NAVEGADOR NO DEJA GUARDAR LA CLAVE."); }
  $("clave").value = ""; aviso(""); mostrarClave();
});
$("clave-borrar").addEventListener("click", () => {
  try { localStorage.removeItem(CLAVE_LS); } catch {}
  apagar(); mostrarClave();
});

// ---------- Voz del robot ----------
let voz = null;
function elegirVoz() {
  const vs = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith("es"));
  voz = vs.find(v => /cl/i.test(v.lang)) || vs.find(v => /419|mx|us/i.test(v.lang)) || vs[0] || null;
}
if ("speechSynthesis" in window) { elegirVoz(); speechSynthesis.onvoiceschanged = elegirVoz; }
const RAPIDEZ = 1.05;

function decir(frase, emocion) {
  return new Promise(resolve => {
    if (!vivo.encendido) return resolve();
    const u = new SpeechSynthesisUtterance(frase);
    if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = "es-CL";
    u.rate = RAPIDEZ;
    u.onstart = () => {
      modo("hablando");
      vivo.robot = frase; subtitulos();
      if (emocion) { vivo.emocion = emocion; vivo.tEmocion = performance.now(); if (EXPRESIONES[emocion]) O.hacer(EXPRESIONES[emocion]); }
    };
    u.onboundary = e => {
      if (e.name && e.name !== "word") return;
      const resto = frase.slice(e.charIndex);
      const palabra = (resto.match(/^[\p{L}]+/u) || [""])[0].toLowerCase();
      habla.palabra = palabra; habla.t0 = performance.now();
      habla.dur = Math.max(160, palabra.length * 75 / RAPIDEZ);
    };
    u.onend = u.onerror = () => { habla.palabra = ""; resolve(); };
    speechSynthesis.speak(u);
  });
}

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
  let emocion = "";
  const t = frase.replace(/\[([^\]]+)\]/g, (_, et) => { emocion = et.trim().toLowerCase(); return ""; })
                 .replace(/[*_#]/g, "").replace(/\s+/g, " ").trim();
  return { t, emocion };
}

// ---------- Claude ----------
const historial = [];
let ocupado = false;

async function responder(pregunta) {
  ocupado = true;
  pararOido();
  vivo.tu = pregunta; vivo.robot = ""; subtitulos();
  historial.push({ role: "user", content: pregunta });
  while (historial.length > 20) historial.splice(0, 2);
  modo("pensando");
  O.hacer(PENSAR);

  const cliente = new Anthropic({ apiKey: leerClave(), dangerouslyAllowBrowser: true });
  let buffer = "", completo = "", cola = Promise.resolve();
  const hablar = lista => {
    for (const f of lista) {
      const { t, emocion } = limpiar(f);
      if (t) cola = cola.then(() => decir(t, emocion));
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
        buffer += ev.delta.text; completo += ev.delta.text;
        const { frases, resto } = partir(buffer, false);
        buffer = resto; hablar(frases);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") { completo = "[confundido] Mejor hablemos de otra cosa."; hablar([completo]); }
    else hablar(partir(buffer, true).frases);
    historial.push({ role: "assistant", content: completo || "…" });
    await cola;
  } catch (e) {
    historial.pop();
    const s = e?.status;
    modo("error"); O.hacer(13);
    aviso(s === 401 ? "LA CLAVE NO FUNCIONA: REVÍSALA O PEGA OTRA."
        : s === 429 ? "DEMASIADAS PREGUNTAS SEGUIDAS O SIN SALDO: ESPERA UN POCO."
        : s >= 500 ? "LOS SERVIDORES DE CLAUDE NO RESPONDEN: PRUEBA EN UN MINUTO."
        : "NO SE PUDO CONECTAR CON CLAUDE: REVISA TU INTERNET.");
    if (s === 401) { try { localStorage.removeItem(CLAVE_LS); } catch {} apagar(); mostrarClave(); ocupado = false; return; }
    await new Promise(r => setTimeout(r, 2500));
  }
  ocupado = false;
  if (vivo.encendido) { modo("escuchando"); oir(); }
}

// ---------- Oído: reconocimiento de voz del navegador + nivel del micrófono ----------
const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
let reconocer = null, oyendo = false, flujoMic = null, audio = null;

async function abrirMicrofono() {
  flujoMic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  audio = new AudioContext();
  const analizador = audio.createAnalyser();
  analizador.fftSize = 1024;
  audio.createMediaStreamSource(flujoMic).connect(analizador);
  const datos = new Float32Array(analizador.fftSize);
  (function medir() {
    if (!audio) return;
    analizador.getFloatTimeDomainData(datos);
    let s = 0; for (const x of datos) s += x * x;
    vivo.mic = vivo.mic * .7 + Math.sqrt(s / datos.length) * .3;
    requestAnimationFrame(medir);
  })();
}

function oir() {
  if (!vivo.encendido || ocupado || oyendo) return;
  reconocer = new Reconocer();
  reconocer.lang = "es-CL";
  reconocer.interimResults = true;
  reconocer.continuous = true;
  let final = "";
  reconocer.onresult = e => {
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += " " + e.results[i][0].transcript;
      else parcial += e.results[i][0].transcript;
    }
    O.hablar(0.01);   // cuenta como movimiento: no se duerme mientras le hablas
    if (vivo.dormida) { vivo.dormida = false; O.hacer(16); }   // le hablaste: despierta
    modo("oyendo");
    vivo.tu = (final + " " + parcial).trim(); subtitulos();
    if (final.trim() && !parcial) { const texto = final.trim(); final = ""; responder(texto); }
  };
  reconocer.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { aviso("EL NAVEGADOR NO DEJÓ USAR EL MICRÓFONO: DALE PERMISO EN LA BARRA DE DIRECCIÓN."); apagar(); }
  };
  reconocer.onend = () => {
    oyendo = false;
    if (vivo.modo === "oyendo" && !ocupado) modo("escuchando");
    setTimeout(oir, 250);   // el navegador corta solo cada tanto: vuelve a escuchar
  };
  try { reconocer.start(); oyendo = true; } catch {}
}
function pararOido() { try { reconocer?.abort(); } catch {} oyendo = false; }

async function encender() {
  aviso("");
  vivo.encendido = true; modo("iniciando");
  $("btn-encender").textContent = "APAGAR ROBOT";
  $("luz-general").classList.add("encendido");
  try { await abrirMicrofono(); }
  catch { aviso("EL NAVEGADOR NO DEJÓ USAR EL MICRÓFONO: DALE PERMISO EN LA BARRA DE DIRECCIÓN."); return apagar(); }
  O.hacer(16);
  modo("escuchando");
  vivo.tu = ""; vivo.robot = ""; subtitulos();
  oir();
}
function apagar() {
  vivo.encendido = false;
  pararOido();
  speechSynthesis.cancel();
  flujoMic?.getTracks().forEach(p => p.stop()); flujoMic = null;
  audio?.close(); audio = null; vivo.mic = 0;
  modo("apagado");
  $("btn-encender").textContent = "ENCENDER ROBOT";
  $("luz-general").classList.remove("encendido");
}
$("btn-encender").addEventListener("click", () => vivo.encendido ? apagar() : encender());
$("btn-callar").addEventListener("click", () => { speechSynthesis.cancel(); });

if (!Reconocer) aviso("ESTE NAVEGADOR NO RECONOCE VOZ: USA CHROME O EDGE EN UN COMPUTADOR.");
modo("apagado");
mostrarClave();
