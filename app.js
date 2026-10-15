const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const KEY = "tesoro.session";           // { team_id, secret } -> recupera el progreso al recargar
let S = JSON.parse(localStorage.getItem(KEY) || "null");
let state = null, offset = 0, tick = null, busy = false;

const show = (id) => ["join", "game", "end"].forEach((x) => ($("#" + x).hidden = x !== id));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
const creds = () => ({ p_team: S.team_id, p_secret: S.secret });

/* ---------- registro ---------- */
function addPlayer() {
  const n = document.querySelectorAll(".pl").length;
  if (n >= 6) return;
  const d = document.createElement("div");
  d.className = "panel pl";
  d.innerHTML = `<strong>Participante ${n + 1}</strong>
    <label>Nombre y apellido<input type="text" class="f-name" autocomplete="name"></label>
    <div class="row">
      <label>Edad<input type="number" class="f-age" min="5" max="99" inputmode="numeric"></label>
      <label>Teléfono<input type="tel" class="f-phone" autocomplete="tel"></label>
    </div>
    <label>Instagram<input type="text" class="f-ig" placeholder="@usuario" autocapitalize="none"></label>
    <label class="check" hidden><input type="checkbox" class="f-guardian"><span>Tengo autorización de madre, padre o tutor (menor de 18).</span></label>`;
  d.querySelector(".f-age").addEventListener("input", (e) => {
    d.querySelector(".check").hidden = !(+e.target.value > 0 && +e.target.value < 18);
  });
  $("#players").appendChild(d);
}

async function join() {
  const msg = $("#joinMsg");
  msg.textContent = "";
  if (!$("#consent").checked) return (msg.textContent = "Tenés que aceptar el consentimiento para participar.");
  const players = [...document.querySelectorAll(".pl")].map((p) => ({
    full_name: p.querySelector(".f-name").value, age: +p.querySelector(".f-age").value,
    phone: p.querySelector(".f-phone").value, instagram: p.querySelector(".f-ig").value,
    guardian_ok: p.querySelector(".f-guardian").checked, consent: true,
  }));
  if (players.some((p) => !p.full_name.trim() || !p.age || !p.phone.trim()))
    return (msg.textContent = "Completá nombre, edad y teléfono de cada participante.");
  try {
    S = await rpc("register_team", { p_code: $("#code").value, p_name: $("#tname").value, p_players: players });
    localStorage.setItem(KEY, JSON.stringify(S));
    await refresh();
  } catch (e) { msg.textContent = e.message; }
}

/* ---------- estado del juego ---------- */
async function refresh() {
  try {
    state = await rpc("get_state", creds());
  } catch (e) {
    if (/inválido/i.test(e.message)) { localStorage.removeItem(KEY); S = null; return init(); }
    return setMsg("Sin conexión. Reintentá en unos segundos.", "bad");   // el progreso vive en el servidor
  }
  offset = new Date(state.now) - Date.now();
  render();
}

function render() {
  const s = state;
  $("#title").textContent = "Búsqueda del tesoro";
  $("#rank").hidden = false;
  if (s.finished || !s.point) {
    show("end");
    $("#outro").textContent = s.outro || "Completaron todos los puntos.";
    $("#finalScore").textContent = s.score;
    return loadRank();
  }
  show("game");
  $("#teamName").textContent = s.team;
  $("#progress").textContent = `Punto ${s.point.ord} de ${s.total}`;
  $("#score").textContent = s.score;
  $("#clue").textContent = s.point.clue;
  $("#challengeQ").textContent = s.point.challenge || "Desafío";
  $("#hintText").textContent = s.point.hint ? "Pista extra: " + s.point.hint : "";
  const hb = $("#hintBtn");
  hb.hidden = !(s.point.has_hint && !s.point.hint);
  hb.textContent = `Pedir pista extra (−${s.hint_cost} puntos)`;
  $("#story").innerHTML = (s.intro ? `<p>${esc(s.intro)}</p>` : "") + s.story.map((t) => `<p>${esc(t)}</p>`).join("");
  clearInterval(tick);
  tick = setInterval(clock, 1000);
  clock();
  loadRank();
}

function clock() {
  const left = Math.max(0, new Date(state.ends_at) - (Date.now() + offset));
  const f = (n) => String(Math.floor(n)).padStart(2, "0");
  $("#clock").textContent = `${f(left / 3600000)}:${f((left / 60000) % 60)}:${f((left / 1000) % 60)}`;
}

function setMsg(t, cls) { const m = $("#msg"); m.textContent = t; m.className = "msg " + (cls || ""); }

/* ---------- acciones ---------- */
function getPos() {
  return new Promise((res, rej) =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(res, (e) => rej(new Error(e.message)),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })   // una lectura puntual: no gasta batería en segundo plano
      : rej(new Error("tu navegador no soporta geolocalización")));
}

async function submit(useBackup) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("#game button").forEach((b) => (b.disabled = true));
  try {
    let pos = null;
    if (!useBackup) {
      setMsg("Buscando señal GPS…");
      try { pos = await getPos(); }
      catch (e) { return setMsg("No pude obtener tu ubicación (" + e.message + "). Revisá los permisos o usá el código manual.", "bad"); }
    }
    setMsg("Validando…");
    const r = await rpc("submit_arrival", {
      ...creds(), p_lat: pos?.coords.latitude ?? null, p_lon: pos?.coords.longitude ?? null,
      p_acc: pos?.coords.accuracy ?? null, p_token: $("#token").value.trim(),
      p_backup: useBackup ? $("#backup").value : null, p_answer: $("#answer").value,
    });
    if (!r.ok) return setMsg(r.error + (r.distance_m != null ? ` (estás a unos ${r.distance_m} m)` : ""), "bad");
    ["#token", "#answer", "#backup"].forEach((i) => ($(i).value = ""));
    setMsg(`¡Punto logrado! +${r.pts} puntos`, "ok");
    await refresh();
  } catch (e) { setMsg(e.message, "bad"); }
  finally { busy = false; document.querySelectorAll("#game button").forEach((b) => (b.disabled = false)); }
}

async function scan() {
  $("#reader").hidden = false;
  const q = new Html5Qrcode("reader");
  try {
    await q.start({ facingMode: "environment" }, { fps: 5, qrbox: 220 }, (txt) => {
      $("#token").value = txt;
      q.stop().then(() => ($("#reader").hidden = true));
    });
  } catch (e) { $("#reader").hidden = true; setMsg("No pude abrir la cámara. Pegá el código a mano.", "bad"); }
}

async function hint() {
  try { await rpc("use_hint", creds()); await refresh(); } catch (e) { setMsg(e.message, "bad"); }
}

async function loadRank() {
  try {
    const rows = await rpc("leaderboard", {});
    const f = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
    $("#rankBody").innerHTML = rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${r.done}</td><td>${f(r.elapsed_s)}</td></tr>`).join("");
  } catch (_) { /* el ranking es secundario */ }
}

function init() {
  if (S) { refresh(); return; }
  show("join");
  $("#rank").hidden = false;
  loadRank();
  if (!document.querySelectorAll(".pl").length) addPlayer();
}

$("#addPlayer").onclick = addPlayer;
$("#joinBtn").onclick = join;
$("#arriveBtn").onclick = () => submit(false);
$("#backupBtn").onclick = () => submit(true);
$("#scanBtn").onclick = scan;
$("#hintBtn").onclick = hint;
// Ahorro de batería: el ranking se refresca cada 30 s y solo con la pantalla visible
setInterval(() => { if (!document.hidden) loadRank(); }, 30000);
// Al volver a la app (recarga, pérdida de conexión) se re-sincroniza con el servidor
document.addEventListener("visibilitychange", () => { if (!document.hidden && S) refresh(); });
init();
