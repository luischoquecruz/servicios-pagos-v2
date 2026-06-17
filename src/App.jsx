import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
applyPlugin(jsPDF);

const mobileBreak = 768;
const useMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < mobileBreak);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < mobileBreak);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
};

const SEReparto = { UNIDAD: "unidad", HABITACIONES: "habitaciones", PERSONAS: "personas" };
const SERVICIOS_POR_DEFECTO = [
  { id: "alquiler", label: "Alquiler", icon: "🏠", unit: "", tipo: "fijo", requerido: true, reparto: SEReparto.UNIDAD },
  { id: "agua", label: "Agua Potable", icon: "💧", unit: "m³", tipo: "consumo", reparto: SEReparto.PERSONAS },
  { id: "luz", label: "Electricidad", icon: "⚡", unit: "kWh", tipo: "consumo", reparto: SEReparto.HABITACIONES },
  { id: "gas", label: "Gas", icon: "🔥", unit: "kg", tipo: "consumo", reparto: SEReparto.HABITACIONES },
  { id: "internet", label: "Internet", icon: "🌐", unit: "", tipo: "fijo", reparto: SEReparto.UNIDAD },
  { id: "otros", label: "Otros", icon: "📋", unit: "", tipo: "fijo", reparto: SEReparto.UNIDAD },
];

const CONFIG_DEFAULT = {
  orgNombre: "EGI",
  orgSubtitulo: "Sistema de Cobro de Alquileres-Servicios",
  appTitulo: "Cobro de Alquileres y Servicios Básicos",
  appSubtitulo: "Complete el formulario para registrar su pago",

  colorPrimario: "#065f46",
  colorAcento: "#059669",
  colorFondo: "#f0fdf4",
  colorFondoAlt: "#d1fae5",

  appsScriptUrl: "https://script.google.com/macros/s/AKfycbzdt_Zhngv9nYvmuZVi3X0L4hoEibO0MMhuh9SXFsWSejfwWqqxjGexoZkicOdjknOf2g/exec",
  storageKey: "alquileres_pagos_local",
  storageKeyPersonas: "alquileres_personas_local",
  storageKeyTarifas: "alquileres_tarifas_local",
  storageKeyLiquidacion: "alquileres_liquidacion_local",
  storageKeyServicios: "alquileres_servicios_local",
  storageKeyUsuarios: "alquileres_usuarios_local",

  metodosPago: ["Efectivo", "Transferencia", "Depósito", "Cheque", "Otro"],
  metodosIconos: { "Efectivo": "💵", "Transferencia": "🏦", "Depósito": "🏧", "Cheque": "📝", "Otro": "🔄" },

  periodos: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ],

  textos: {
    botonEnviar: "💾 Registrar pago",
    mensajeExito: "✅ ¡Pago registrado correctamente!",
    placeholder: {
      inquilino: "Nombre completo del inquilino",
      inmueble: "Dirección o identificación del inmueble",
      notas: "Comprobante o notas adicionales (opcional)",
    }
  },

  mostrarCampoNotas: true,
  requiereNotas: false,
  exitoDelay: 5000,

  darkMode: false,
  darkColorPrimario: "#064e3b",
  darkColorAcento: "#10b981",
  darkColorFondo: "#022c22",
  darkColorFondoAlt: "#064e3b",
};

function PanelConfig({ config, setConfig, onClose, onSaveConfig, onSavePersonas, onSaveServicios, onSaveTarifas, onSaveLiquidaciones, onSaveUsuarios, gasUrl }) {
  const [tab, setTab] = useState("identidad");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  const set = (key, val) => setConfig(p => ({ ...p, [key]: val }));
  const setTexto = (key, val) => setConfig(p => ({ ...p, textos: { ...p.textos, [key]: val } }));

  const inp = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 7,
    padding: "8px 11px", fontSize: 13, boxSizing: "border-box",
    background: "var(--bg-card)", fontFamily: "monospace",
    color: "var(--text-main)"
  };
  const tabStyle = (id) => ({
    padding: "8px 14px", fontSize: 12, fontWeight: 600, border: "none",
    cursor: "pointer", borderBottom: tab === id ? `3px solid ${config.colorAcento}` : "3px solid transparent",
    background: "transparent", color: tab === id ? config.colorAcento : "var(--text-secondary)"
  });
  const label = (txt) => (
    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{txt}</label>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "var(--bg-card)", borderRadius: 14, width: "min(700px, 96vw)",
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "var(--shadow-xl)"
      }}>
        <div style={{ background: config.colorPrimario, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>⚙️ Panel de Configuración</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>✕ Cerrar</button>
        </div>
        <div style={{ borderBottom: "1px solid var(--border-light)", display: "flex", flexWrap: "wrap", padding: "0 8px" }}>
          {[["identidad", "🏛️ Identidad"], ["colores", "🎨 Colores"], ["backend", "🔗 Backend"], ["formulario", "📝 Formulario"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={tabStyle(id)}>{lbl}</button>
          ))}
        </div>
        <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>
          {error && <div style={{ background: "var(--bg-error)", border: "1px solid var(--danger-text)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, color: "var(--danger-text)", fontSize: 12 }}>{error}</div>}
          {tab === "identidad" && (
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["orgNombre", "Nombre de la organización (ej: CEPI)"],
                ["orgSubtitulo", "Subtítulo / sistema (ej: Alquileres)"],
                ["appTitulo", "Título de la app"],
                ["appSubtitulo", "Descripción debajo del título"],
              ].map(([key, lbl]) => (
                <div key={key}>
                  {label(lbl)}
                  <input value={config[key]} onChange={e => set(key, e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
                </div>
              ))}
              <div>
                {label("Texto botón Enviar")}
                <input value={config.textos.botonEnviar} onChange={e => setTexto("botonEnviar", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
              </div>
              <div>
                {label("Mensaje de éxito")}
                <input value={config.textos.mensajeExito} onChange={e => setTexto("mensajeExito", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
              </div>
            </div>
          )}
          {tab === "colores" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["colorPrimario", "Color primario (header, botones)"],
                ["colorAcento", "Color de acento (seleccionado, links)"],
                ["colorFondo", "Fondo gradiente inicio"],
                ["colorFondoAlt", "Fondo gradiente fin"],
              ].map(([key, lbl]) => (
                <div key={key}>
                  {label(lbl)}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={config[key]} onChange={e => set(key, e.target.value)}
                      style={{ width: 40, height: 34, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                    <input value={config[key]} onChange={e => set(key, e.target.value)}
                      style={{ ...inp, width: "auto", flex: 1 }} />
                  </div>
                </div>
              ))}
              <div style={{ gridColumn: "1/-1", padding: 12, background: "var(--bg-muted)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                Vista previa del header:
                <div style={{ marginTop: 8, background: `linear-gradient(135deg,${config.colorPrimario},${config.colorAcento})`, borderRadius: 8, padding: "12px 16px", color: "#fff" }}>
                  <div style={{ fontSize: 10, opacity: .8, letterSpacing: 2 }}>{config.orgNombre} — {config.orgSubtitulo}</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{config.appTitulo}</div>
                </div>
              </div>
            </div>
          )}
          {tab === "backend" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                {label("URL Google Apps Script")}
                <input value={config.appsScriptUrl} onChange={e => set("appsScriptUrl", e.target.value)} style={inp} placeholder="https://script.google.com/macros/s/..." />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Deja vacío para usar solo almacenamiento local (localStorage)</div>
              </div>
              <div>
                {label("Clave de localStorage (pagos)")}
                <input value={config.storageKey} onChange={e => set("storageKey", e.target.value)} style={inp} />
              </div>
              <div>
                {label("Clave de localStorage (personas)")}
                <input value={config.storageKeyPersonas} onChange={e => set("storageKeyPersonas", e.target.value)} style={inp} />
              </div>
              <div>
                {label("Clave de localStorage (tarifas)")}
                <input value={config.storageKeyTarifas} onChange={e => set("storageKeyTarifas", e.target.value)} style={inp} />
              </div>
              <div>
                {label("Clave de localStorage (servicios)")}
                <input value={config.storageKeyServicios} onChange={e => set("storageKeyServicios", e.target.value)} style={inp} />
              </div>
              <div>
                {label("Clave de localStorage (liquidaciones)")}
                <input value={config.storageKeyLiquidacion} onChange={e => set("storageKeyLiquidacion", e.target.value)} style={inp} />
              </div>
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={async () => {
                  if (!onSaveConfig) return;
                  setSyncStatus("saving");
                  try { await onSaveConfig(); setSyncStatus("ok"); setTimeout(() => setSyncStatus(""), 3000);
                  } catch { setSyncStatus("error"); setTimeout(() => setSyncStatus(""), 3000); }
                }} disabled={syncStatus==="saving" || !config.appsScriptUrl}
                  style={{ background: config.appsScriptUrl ? config.colorPrimario : "var(--text-muted)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: config.appsScriptUrl ? "pointer" : "not-allowed", fontSize: 12, alignSelf: "flex-start" }}>
                  {syncStatus==="saving" ? "Guardando..." : "💾 Guardar configuración"}
                </button>
                {onSavePersonas && gasUrl && (
                  <button onClick={async () => { try { await onSavePersonas(); } catch {} }}
                    style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12, alignSelf: "flex-start" }}>
                    ☁️ Sincronizar personas
                  </button>
                )}
                {onSaveServicios && gasUrl && (
                  <button onClick={async () => { try { await onSaveServicios(); } catch {} }}
                    style={{ background: "#0f766e", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12, alignSelf: "flex-start" }}>
                    ☁️ Sincronizar servicios
                  </button>
                )}
                {onSaveTarifas && gasUrl && (
                  <button onClick={async () => { try { await onSaveTarifas(); } catch {} }}
                    style={{ background: "#b45309", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12, alignSelf: "flex-start" }}>
                    ☁️ Sincronizar tarifas
                  </button>
                )}
                {onSaveLiquidaciones && gasUrl && (
                  <button onClick={async () => { try { await onSaveLiquidaciones(); } catch {} }}
                    style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12, alignSelf: "flex-start" }}>
                    ☁️ Sincronizar liquidaciones
                  </button>
                )}
                {onSaveUsuarios && gasUrl && (
                  <button onClick={async () => { try { await onSaveUsuarios(); } catch {} }}
                    style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12, alignSelf: "flex-start" }}>
                    ☁️ Sincronizar usuarios
                  </button>
                )}
                {syncStatus==="ok" && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--tag-pagado-text)" }}>✅ Configuración guardada</span>}
                {syncStatus==="error" && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--danger-text)" }}>❌ Error al guardar</span>}
              </div>
            </div>
          )}
          {tab === "formulario" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                {label("Mostrar campo Notas / Comprobante")}
                <input type="checkbox" checked={config.mostrarCampoNotas} onChange={e => set("mostrarCampoNotas", e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
              </div>
              <div>
                {label("Notas requerido")}
                <input type="checkbox" checked={config.requiereNotas} onChange={e => set("requiereNotas", e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--border-light)", padding: "12px 20px", background: "var(--bg-muted)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => { setConfig(CONFIG_DEFAULT); onClose(); }}
            style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
            Restaurar valores por defecto
          </button>
          <button onClick={onClose} style={{ background: config.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "8px 20px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
            ✓ Aplicar y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

async function apiGet(url) {
  if (!url) throw new Error("NO_URL");
  const r = await fetch(url);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

async function apiPost(url, payload) {
  if (!url) throw new Error("NO_URL");
  return fetch(url + "?", {
    method: "POST", body: JSON.stringify(payload),
    headers: { "Content-Type": "text/plain" }
  });
}

async function apiLoadConfig(url) {
  if (!url) return null;
  try {
    const r = await fetch(url + "?", {
      method: "POST",
      body: JSON.stringify({ action: "loadConfig" }),
      headers: { "Content-Type": "text/plain" }
    });
    const j = await r.json();
    return j.ok ? j.config : null;
  } catch { return null; }
}

async function apiSaveConfig(url, config) {
  if (!url) return;
  await fetch(url + "?", {
    method: "POST",
    body: JSON.stringify({ action: "saveConfig", config }),
    headers: { "Content-Type": "text/plain" }
  });
}

function LoginModal({ open, onLogin, onClose, config }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 14, width: "min(360px, 92vw)", padding: 24, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-main)", marginBottom: 16, textAlign: "center" }}>🔐 Iniciar sesión</div>
        {error && <div style={{ background: "var(--bg-error)", border: "1px solid var(--danger-text)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, color: "var(--danger-text)", fontSize: 12, textAlign: "center" }}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Usuario / Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }} placeholder="admin" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Contraseña</label>
          <input type="password" value={password} onKeyDown={e => { if (e.key === "Enter") { setError(""); const u = onLogin(email, password); if (!u) setError("Credenciales incorrectas"); } }} onChange={e => setPassword(e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }} placeholder="••••••" />
        </div>
        <button onClick={() => { setError(""); const u = onLogin(email, password); if (!u) setError("Credenciales incorrectas"); }} style={{ width: "100%", background: config.colorPrimario, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, cursor: "pointer", fontSize: 14, marginBottom: 8 }}>Ingresar</button>
        <button onClick={() => { setEmail(""); setPassword(""); setError(""); onClose(); }} style={{ width: "100%", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "11px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
      </div>
    </div>
  );
}

function VistaInquilino({ cfg, usuario, personas, liquidaciones, servicios, tarifas, onLogout }) {
  const isMobile = useMobile();
  const persona = useMemo(() => {
    if (!usuario.personaId) return null;
    return personas.find(p => String(p.id) === String(usuario.personaId)) || null;
  }, [usuario, personas]);
  const personaNombre = persona ? persona.nombre : usuario.nombre;

  const pagosLocal = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(cfg.storageKey) || "[]"); } catch { return []; }
  }, [cfg.storageKey]);

  const deudaPeriodoActual = useMemo(() => {
    const now = new Date();
    const mes = meses[now.getMonth()];
    const anio = String(now.getFullYear());
    const key = periodoKey(mes, anio);
    const liq = liquidaciones[key];
    if (!liq || !persona) return 0;
    const pid = String(persona.id);
    const srvData = liq.servicios || liq;
    const inqData = liq.inquilinos || {};
    const asignados = inqData[pid]?.servicios || [];
    let debe = 0;
    servicios.forEach(s => {
      const liqSrv = srvData[s.id];
      if (!liqSrv) return;
      const tf = Number(liqSrv.totalFactura) || 0;
      if (tf <= 0) return;
      const marked = asignados.length === 0 || asignados.includes(s.id);
      if (!marked) return;
      const r = liqSrv.reparto || s.reparto;
      if (r === SEReparto.UNIDAD) { debe += tf; return; }
      const idsConServicio = Object.entries(inqData).filter(([_, v]) => v.servicios && v.servicios.includes(s.id)).map(([id]) => id);
      const baseFiltradas = getPersonasSnapshot(liq, personas);
      const filtradas = idsConServicio.length ? baseFiltradas.filter(x => idsConServicio.includes(String(x.id))) : baseFiltradas;
      if (filtradas.length === 0) return;
      const factores = liq.factores || {};
      const factor = r === SEReparto.HABITACIONES ? (Number(factores[pid]?.habitaciones) || Number(persona.habitaciones) || 1) : (Number(factores[pid]?.personas) || Number(persona.personas) || 1);
      const totalFactor = calcTotalFactor(filtradas, r, factores);
      debe += totalFactor > 0 ? Math.round(tf * factor / totalFactor * 10) / 10 : 0;
    });
    const pagado = pagosLocal.filter(pg => {
      if (pg.periodoMes !== mes || String(pg.periodoAnio) !== anio || pg.estado !== "Pagado") return false;
      if (String(pg.personaId) === pid) return true;
      if (pg.inquilino && persona.nombre && pg.inquilino.toLowerCase() === persona.nombre.toLowerCase()) return true;
      return false;
    }).reduce((s, pg) => s + Number(pg.total || 0), 0);
    return Math.round((debe - pagado) * 10) / 10;
  }, [liquidaciones, persona, servicios, pagosLocal]);

  const historial = useMemo(() => {
    if (!persona) return [];
    const pid = String(persona.id);
    const items = pagosLocal.filter(pg => {
      if (pg.estado !== "Pagado") return false;
      if (String(pg.personaId) === pid) return true;
      if (pg.inquilino && persona.nombre && pg.inquilino.toLowerCase() === persona.nombre.toLowerCase()) return true;
      return false;
    }).sort((a, b) => b.id - a.id);
    return items;
  }, [pagosLocal, persona]);

  const inp = { width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)", textAlign: "right" };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg,${cfg.colorFondo} 0%,${cfg.colorFondoAlt} 100%)`, padding: isMobile ? "16px 10px" : "24px 16px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: `linear-gradient(135deg,${cfg.colorPrimario},${cfg.colorAcento})`, borderRadius: 16, padding: isMobile ? "16px" : "20px 24px", marginBottom: 20, color: "#fff" }}>
          <div style={{ fontSize: 10, opacity: .7, letterSpacing: 2 }}>{cfg.orgNombre} — {cfg.orgSubtitulo}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>👋 Hola, {personaNombre}</div>
          <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>Panel del inquilino</div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>🚪 Cerrar sesión</button>
          </div>
        </div>

        {deudaPeriodoActual > 0 && (
          <div style={{ background: "var(--bg-error)", border: "1px solid var(--danger-text)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "var(--danger-text)", fontWeight: 600, fontSize: 13 }}>⚠️ Deuda del período actual</div>
            <div style={{ color: "var(--danger-text)", fontWeight: 900, fontSize: 20 }}>Bs.- {fmtMoney(deudaPeriodoActual)}</div>
          </div>
        )}

        {historial.length === 0 ? (
          <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 30, textAlign: "center", border: "1px dashed var(--border-light)", color: "var(--text-muted)", fontSize: 13 }}>
            No hay pagos registrados a su nombre.
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-light)", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", fontWeight: 700, fontSize: 14, color: "var(--text-main)", borderBottom: "1px solid var(--border-light)" }}>
              📋 Historial de pagos ({historial.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "var(--text-main)" }}>
                <thead>
                  <tr style={{ background: cfg.colorPrimario, color: "#fff" }}>
                    <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 600, fontSize: 10 }}>Fecha</th>
                    <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Período</th>
                    <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Total</th>
                    <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{s.fecha}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{s.periodoMes} {s.periodoAnio}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: cfg.colorAcento }}>Bs.- {fmtMoney(Number(s.total) || 0)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{s.metodo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VistaAdminUsuariosForm({ usuarios, setUsuarios, personas, cfg, onSaveUsuarios }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("inquilino");
  const [personaId, setPersonaId] = useState("");
  const [msg, setMsg] = useState("");
  const inp = { width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" };
  const guardar = async () => {
    if (!nombre.trim() || !email.trim() || !password.trim()) { setMsg("Completar nombre, email y contraseña"); return; }
    const nuevas = [...usuarios, { id: Date.now(), nombre: nombre.trim(), email: email.trim(), password: password.trim(), rol, personaId: personaId || null }];
    setUsuarios(nuevas);
    if (onSaveUsuarios) await onSaveUsuarios(nuevas);
    setNombre(""); setEmail(""); setPassword(""); setPersonaId("");
    setMsg("✅ Usuario creado");
    setTimeout(() => setMsg(""), 3000);
  };
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-light)", padding: 14 }}>
      {msg && <div style={{ background: "var(--bg-success)", border: "1px solid var(--tag-pagado-text)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, color: "var(--tag-pagado-text)", fontSize: 12 }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Nombre</label><input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} placeholder="Nombre del usuario" /></div>
        <div><label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Email / Usuario</label><input value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="email@ejemplo.com" /></div>
        <div><label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Contraseña</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="••••••" /></div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Rol</label>
          <select value={rol} onChange={e => setRol(e.target.value)} style={inp}>
            <option value="inquilino">Inquilino</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        {rol === "inquilino" && (
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Vincular a persona (opcional)</label>
            <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={inp}>
              <option value="">— Sin vínculo —</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
      </div>
      <button onClick={guardar} disabled={!nombre.trim() || !email.trim() || !password.trim()}
        style={{ marginTop: 10, background: cfg.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: nombre.trim() && email.trim() && password.trim() ? "pointer" : "not-allowed", fontSize: 12 }}>
        ➕ Crear usuario
      </button>
    </div>
  );
}

function BuscadorPersonas({ personas, value, onChange, placeholder }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.inmueble || "").toLowerCase().includes(busqueda.toLowerCase())
  );
  const perSel = personas.find(p => String(p.id) === String(value));

  const estilos = {
    contenedor: { position: "relative" },
    disparador: { width:"100%", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", fontSize:13, boxSizing:"border-box", background:"var(--bg-card)", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"border-color .2s" },
    dropdown: { position:"absolute", top:"100%", left:0, right:0, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, marginTop:5, zIndex:100, boxShadow:"var(--shadow-lg)", maxHeight:320, display:"flex", flexDirection:"column", overflow:"hidden" },
    inputBusqueda: { width:"100%", border:"1px solid var(--border)", borderRadius:6, padding:"6px 10px", fontSize:12, boxSizing:"border-box", outline:"none", background:"var(--bg-card)", color:"var(--text-main)" },
  };

  return (<>
    <div ref={ref} style={estilos.contenedor}>
      <div onClick={() => setAbierto(!abierto)} style={estilos.disparador}>
        <span style={{ color: perSel ? "var(--text-main)" : "var(--text-muted)" }}>
          {perSel ? `${perSel.nombre}${perSel.inmueble ? ` — ${perSel.inmueble}` : ""}` : placeholder || "-- Seleccione un inquilino --"}
        </span>
        <span style={{ fontSize:10, color:"var(--text-secondary)" }}>{abierto ? "▲" : "▼"}</span>
      </div>
      {abierto && (
        <div style={estilos.dropdown}>
          <div style={{ padding:8, borderBottom:"1px solid var(--border-light)" }}>
            <input autoFocus value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              placeholder="Buscar persona o inmueble..." style={estilos.inputBusqueda} />
          </div>
          <div style={{ overflowY:"auto", flex:1 }}>
            {filtradas.length===0 ? (
              <div style={{ padding:12, textAlign:"center", color:"var(--text-muted)", fontSize:12 }}>Sin resultados</div>
            ) : filtradas.map(p => (
              <div key={p.id} onClick={() => { onChange(p); setAbierto(false); setBusqueda(""); }}
                style={{ padding:"8px 12px", cursor:"pointer", fontSize:13, background:String(p.id)===String(value)?"var(--bg-accent)":"transparent", color:"var(--text-main)", borderBottom:"1px solid var(--border-light)", transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-muted)"}
                onMouseLeave={e=>e.currentTarget.style.background=String(p.id)===String(value)?"var(--bg-accent)":"transparent"}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nombre}</div>
                {p.inmueble && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.inmueble}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </>);
}

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = s => { if (!s) return ""; const d = s.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return s; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const fmtDateTime = s => { if (!s) return ""; try { return new Date(s).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return s; } };
const fmtMoney = n => { if (n === "" || n === undefined || n === null) return ""; return Number(n).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
const fmtNum = n => { if (n === "" || n === undefined || n === null) return ""; return Number(n).toLocaleString("es-ES"); };
const mesActual = () => { const m = new Date().getMonth(); return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m]; };
const anioActual = () => new Date().getFullYear();
const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const periodoKey = (mes, anio) => `${anio}-${String(meses.indexOf(mes) + 1).padStart(2, "0")}`;

const emptyForm = () => ({
  fecha: today(), personaId: "", inquilino: "",
  periodoMes: mesActual(), periodoAnio: anioActual(),
  metodo: "", notas: "", montoRecibido: "",
});

const getLiq = (liquidaciones, mes, anio) => {
  const key = periodoKey(mes, anio);
  return liquidaciones[key] || null;
};

const calcTotalFactor = (personas, reparto, factores) => {
  if (reparto === SEReparto.UNIDAD) return personas.length;
  if (reparto === SEReparto.HABITACIONES) return personas.reduce((s, p) => s + (Number(factores?.[String(p.id)]?.habitaciones) || Number(p.habitaciones) || 1), 0);
  return personas.reduce((s, p) => s + (Number(factores?.[String(p.id)]?.personas) || Number(p.personas) || 1), 0);
};

const obtenerIdsConServicio = (liqPeriodo, servicioId) => {
  if (!liqPeriodo || !liqPeriodo.inquilinos) return null;
  const ids = [];
  Object.entries(liqPeriodo.inquilinos).forEach(([pid, data]) => {
    if (data.servicios && data.servicios.includes(servicioId)) ids.push(pid);
  });
  return ids;
};

const getPersonasSnapshot = (liqPeriodo, personas) => {
  const factores = liqPeriodo?.factores || {};
  const ids = Object.keys(factores);
  if (ids.length === 0) return personas;
  const base = personas.filter(p => ids.includes(String(p.id)));
  ids.forEach(id => { if (!base.find(p => String(p.id) === id)) base.push({ id, habitaciones: factores[id].habitaciones, personas: factores[id].personas }); });
  return base;
};

const calcMontoServicio = (servicio, liqPeriodo, persona, personas) => {
  if (!liqPeriodo || !liqPeriodo.servicios || !liqPeriodo.servicios[servicio.id]) return 0;
  const liq = liqPeriodo.servicios[servicio.id];
  const totalFactura = Number(liq.totalFactura) || 0;
  if (totalFactura <= 0) return 0;
  const reparto = liq.reparto || servicio.reparto;
  if (reparto === SEReparto.UNIDAD) return totalFactura;
  if (!persona) return 0;
  const idsConServicio = obtenerIdsConServicio(liqPeriodo, servicio.id);
  const basePersonas = getPersonasSnapshot(liqPeriodo, personas);
  const personasFiltradas = idsConServicio ? basePersonas.filter(p => idsConServicio.includes(String(p.id))) : basePersonas;
  if (personasFiltradas.length === 0) return 0;
  const factores = liqPeriodo.factores || {};
  const pid = String(persona.id);
  const factor = reparto === SEReparto.HABITACIONES
    ? (Number(factores[pid]?.habitaciones) || Number(persona.habitaciones) || 1)
    : (Number(factores[pid]?.personas) || Number(persona.personas) || 1);
  const totalFactor = calcTotalFactor(personasFiltradas, reparto, factores);
  if (totalFactor <= 0) return 0;
  return Math.round(totalFactura * factor / totalFactor * 10) / 10;
};

function VistaPublica({ cfg, personas, tarifas, onLoginClick, toggleDarkMode, liquidaciones, servicios, onSetConfig }) {
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const C = cfg;
  const isMobile = useMobile();
  const T = cfg.textos;
  const [setupUrl, setSetupUrl] = useState(C.appsScriptUrl);

  const serviciosConsumo = useMemo(() => servicios.filter(s => s.tipo === "consumo"), [servicios]);
  const serviciosFijo = useMemo(() => servicios.filter(s => s.tipo === "fijo"), [servicios]);
  const activas = useMemo(() => personas.filter(p => p.activo !== false), [personas]);

  const liqPeriodo = getLiq(liquidaciones, form.periodoMes, form.periodoAnio);
  const personaSel = personas.find(p => String(p.id) === String(form.personaId));

  const serviciosAsignados = useMemo(() => {
    if (!liqPeriodo || !liqPeriodo.inquilinos || !personaSel) return servicios;
    const asignados = liqPeriodo.inquilinos[String(personaSel.id)];
    if (!asignados || !asignados.servicios) return servicios;
    return servicios.filter(s => asignados.servicios.includes(s.id));
  }, [liqPeriodo, personaSel, servicios]);

  const montos = useMemo(() => {
    const m = {};
    serviciosAsignados.forEach(s => {
      m[s.id] = calcMontoServicio(s, liqPeriodo, personaSel, activas);
    });
    return m;
  }, [serviciosAsignados, liqPeriodo, personaSel, activas]);

  const total = Object.values(montos).reduce((s, v) => s + v, 0);

  const sinLiquidacion = !liqPeriodo;

  const deudaAcumulada = useMemo(() => {
    if (!form.personaId) return { total: 0, detalles: [] };
    const pid = String(form.personaId);
    const personaSel = personas.find(p => String(p.id) === pid);
    if (!personaSel) return { total: 0, detalles: [] };
    const detalles = [];
    try {
      const pagosLocal = JSON.parse(localStorage.getItem(C.storageKey) || "[]");
      Object.entries(liquidaciones).forEach(([k, v]) => {
        const [y, m] = k.split("-");
        const mesLabel = meses[Number(m) - 1];
        const srvData = v.servicios || v;
        const inqData = v.inquilinos || {};
        let debe = 0;
        const serviciosDebe = {};
        const asignados = inqData[pid]?.servicios || [];
        servicios.forEach(s => {
          const liq = srvData[s.id];
          if (!liq) return;
          const totalFactura = Number(liq.totalFactura) || 0;
          if (totalFactura <= 0) return;
          const marked = asignados.length === 0 || asignados.includes(s.id);
          if (!marked) return;
          const r = liq.reparto || s.reparto;
          let monto;
          if (r === SEReparto.UNIDAD) {
            monto = totalFactura;
          } else {
            const idsConServicio = Object.entries(inqData).filter(([_, v2]) => v2.servicios && v2.servicios.includes(s.id)).map(([id]) => id);
            const baseFiltradas = getPersonasSnapshot(v, activas);
            const personasFiltradas = idsConServicio.length ? baseFiltradas.filter(x => idsConServicio.includes(String(x.id))) : baseFiltradas;
            if (personasFiltradas.length === 0) return;
            const factores = v.factores || {};
            const factor = r === SEReparto.HABITACIONES ? (Number(factores[pid]?.habitaciones) || Number(personaSel.habitaciones) || 1) : (Number(factores[pid]?.personas) || Number(personaSel.personas) || 1);
            const totalFactor = calcTotalFactor(personasFiltradas, r, factores);
            monto = totalFactor > 0 ? Math.round(totalFactura * factor / totalFactor * 10) / 10 : 0;
          }
          debe += monto;
          serviciosDebe[s.id] = monto;
        });
        if (debe <= 0) return;
        const pagado = pagosLocal.filter(pg => {
          if (pg.periodoMes !== mesLabel || String(pg.periodoAnio) !== y || pg.estado !== "Pagado") return false;
          if (String(pg.personaId) === pid) return true;
          if (pg.inquilino && personaSel.nombre && pg.inquilino.toLowerCase() === personaSel.nombre.toLowerCase()) return true;
          return false;
        }).reduce((s, pg) => s + Number(pg.total || 0), 0);
        const saldo = Math.round((debe - pagado) * 10) / 10;
        if (saldo <= 0) return;
        const fc = v.factores?.[pid];
        const factorHab = fc?.habitaciones ?? Number(personaSel.habitaciones) ?? 1;
        const factorPers = fc?.personas ?? Number(personaSel.personas) ?? 1;
        detalles.push({ key: k, periodo: mesLabel + " " + y, debe, pagado, saldo, servicios: serviciosDebe, factorHab, factorPers });
      });
    } catch { return { total: 0, detalles: [] }; }
    const total = detalles.reduce((s, d) => s + d.saldo, 0);
    return { total, detalles };
  }, [form.personaId, liquidaciones, servicios, personas, activas, C.storageKey]);

  const imprimirDeudaAcumulada = () => {
    const dd = deudaAcumulada.detalles;
    if (!dd || dd.length === 0) return;
    const w = window.open("", "_blank", "width=800,height=700");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Deuda acumulada</title><style>
      body{font-family:Arial,sans-serif;margin:20px;font-size:12px;color:#1e293b}
      h2{font-size:16px;margin:0 0 4px}
      .sub{font-size:11px;color:#64748b;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#065f46;color:#fff;padding:6px 8px;text-align:center;font-size:10px}
      th:first-child{text-align:left}
      td{padding:5px 8px;text-align:center;border-bottom:1px solid #e2e8f0}
      td:first-child{text-align:left;font-weight:700}
      .tfoot td{font-weight:700;font-size:12px;border-top:2px solid #1e293b}
      .srv-row{background:#f8fafc}
      .total{color:#059669}
      .pagado{color:#065f46}
      .saldo{color:#dc2626;font-weight:700}
      .tarifa{font-size:9px;color:#94a3b8}
      @media print{body{margin:10px}}
    </style></head><body>
    <h2>Deuda acumulada de períodos anteriores</h2>
    <div class="sub">${personaSel?.nombre || ""} ${personaSel?.inmueble ? "— " + personaSel.inmueble : ""}</div>
    <h3 style="font-size:13px;margin:16px 0 8px;color:#1e293b">📋 Costo de servicios adeudados por período</h3>
     <table>
     <thead><tr>
       <th>Período</th>
       <th>Hab.</th>
       <th>Pers.</th>
       ${servicios.map(s => `<th>${s.icon}</th>`).join("")}
     </tr></thead>
     <tbody>${dd.map(d => {
       const tarifasPeriodo = tarifas[d.key] || {};
       return `<tr>
         <td>${d.periodo}</td>
         <td style="text-align:center">${d.factorHab || "—"}</td>
         <td style="text-align:center">${d.factorPers || "—"}</td>
         ${servicios.map(s => {
           if (!d.servicios?.[s.id]) return '<td>—</td>';
           const tarifa = tarifasPeriodo[s.id];
           return `<td>${tarifa ? "Bs.- " + fmtMoney(tarifa) : "—"}</td>`;
         }).join("")}
       </tr>`;
     }).join("")}</tbody></table>
    <h3 style="font-size:13px;margin:16px 0 8px;color:#1e293b">💰 Detalle de deuda por período</h3>
     <table>
     <thead><tr>
       <th>Período</th>
       <th>Hab.</th>
       <th>Pers.</th>
       ${servicios.map(s => `<th>${s.icon}</th>`).join("")}
       <th>Debe</th>
       <th>Pagado</th>
       <th>Saldo</th>
     </tr></thead>
     <tbody>${dd.map(d => {
       const tarifasPeriodo = tarifas[d.key] || {};
       return `<tr>
         <td>${d.periodo}</td>
         <td style="text-align:center">${d.factorHab || "—"}</td>
         <td style="text-align:center">${d.factorPers || "—"}</td>
         ${servicios.map(s => {
           const monto = d.servicios?.[s.id] || 0;
           const tarifa = tarifasPeriodo[s.id];
           const tarifaStr = tarifa ? `<div class="tarifa">Bs.- ${fmtMoney(tarifa)}</div>` : "";
           return `<td>${monto > 0 ? '<div>Bs.- ' + fmtMoney(monto) + '</div>' + tarifaStr : "—"}</td>`;
         }).join("")}
         <td class="total">Bs.- ${fmtMoney(d.debe)}</td>
         <td class="pagado">${d.pagado > 0 ? "Bs.- " + fmtMoney(d.pagado) : "—"}</td>
         <td class="saldo">Bs.- ${fmtMoney(d.saldo)}</td>
       </tr>`;
     }).join("")}</tbody>
     <tfoot><tr class="tfoot">
       <td>Total</td>
       <td></td>
       <td></td>
      ${servicios.map(s => {
        const totalSrv = dd.reduce((sum, d) => sum + (d.servicios?.[s.id] || 0), 0);
        return `<td>${totalSrv > 0 ? "Bs.- " + fmtMoney(totalSrv) : "—"}</td>`;
      }).join("")}
      <td class="total">Bs.- ${fmtMoney(dd.reduce((s, d) => s + d.debe, 0))}</td>
      <td class="pagado">Bs.- ${fmtMoney(dd.reduce((s, d) => s + d.pagado, 0))}</td>
      <td class="saldo">Bs.- ${fmtMoney(deudaAcumulada.total)}</td>
    </tr></tfoot>
    </table></body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handlePersonaChange = (p) => {
    setForm(prev => ({ ...prev, personaId: String(p.id), inquilino: p.nombre }));
  };

  const inp = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, boxSizing: "border-box",
    background: "var(--bg-card)", color: "var(--text-main)"
  };

  const labelReparto = (r) => {
    if (r === SEReparto.HABITACIONES) return "🏠 por habitaciones";
    if (r === SEReparto.PERSONAS) return "👥 por personas";
    return "🏷️ 1 pago";
  };

  const mostrarDetalleReparto = (s) => {
    if (!liqPeriodo || !liqPeriodo[s.id]) return null;
    const liq = liqPeriodo[s.id];
    const r = liq.reparto || s.reparto;
    if (r === SEReparto.UNIDAD) return null;
    const factores = liqPeriodo.factores || {};
    const pid = String(personaSel?.id);
    const factor = r === SEReparto.HABITACIONES ? (Number(factores[pid]?.habitaciones) || Number(personaSel?.habitaciones) || 1) : (Number(factores[pid]?.personas) || Number(personaSel?.personas) || 1);
    const totalFactor = calcTotalFactor(getPersonasSnapshot(liqPeriodo, activas), r, factores);
    return (
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
        Factor: {fmtNum(factor)} de {fmtNum(totalFactor)} ({labelReparto(r)})
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg,${C.colorFondo} 0%,${C.colorFondoAlt} 100%)`, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: isMobile ? "16px 10px" : "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 600 }}>
        <div style={{ background: `linear-gradient(135deg,${C.colorPrimario},${C.colorAcento})`, borderRadius: 16, padding: isMobile ? "16px 16px" : "22px 24px", marginBottom: 20, color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 10 : 11, letterSpacing: 3, opacity: .8, textTransform: "uppercase", marginBottom: 4 }}>{C.orgNombre} — {C.orgSubtitulo}</div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800 }}>{C.appTitulo}</div>
          <div style={{ fontSize: isMobile ? 11 : 12, opacity: .75, marginTop: 4 }}>{C.appSubtitulo}</div>
        </div>

        {!C.appsScriptUrl && personas.length === 0 && (
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: 20, boxShadow: "var(--shadow-md)", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)", marginBottom: 6 }}>Conectar con Google Sheets</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Ingresa la URL de tu despliegue de Google Apps Script para sincronizar los datos almacenados.
            </div>
            <input value={setupUrl} onChange={e => setSetupUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 12, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)", marginBottom: 10, fontFamily: "monospace" }} />
            <button onClick={() => { if (setupUrl && onSetConfig) onSetConfig(setupUrl); }} disabled={!setupUrl}
              style={{ width: "100%", background: setupUrl ? C.colorPrimario : "var(--text-muted)", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: setupUrl ? "pointer" : "not-allowed", fontSize: 13 }}>
              Conectar y cargar datos
            </button>
          </div>
        )}

        {error && (
          <div style={{ background: "var(--bg-error)", border: "1px solid var(--danger-text)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: "var(--danger-text)", fontSize: 13 }}>{error}</div>
        )}

        {sinLiquidacion && (
          <div style={{ background: "var(--bg-warning)", border: "1px solid var(--star)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: "var(--star)", fontSize: 12, textAlign: "center" }}>
            ⚠️ No hay liquidación configurada para {form.periodoMes} {form.periodoAnio}. Consulte al administrador.
          </div>
        )}

        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: isMobile ? 16 : 24, boxShadow: "var(--shadow-md)" }}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Inquilino *</label>
              <BuscadorPersonas personas={activas} value={form.personaId} onChange={handlePersonaChange} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Período (Mes) *</label>
                <select value={form.periodoMes} onChange={e => setF("periodoMes", e.target.value)} style={inp}>
                  {meses.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Año</label>
                <input type="number" value={form.periodoAnio} onChange={e => setF("periodoAnio", e.target.value)} style={inp} />
              </div>
            </div>

            {form.personaId && form.periodoMes && form.periodoAnio ? (
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 10 }}>
                Detalle de montos
                {liqPeriodo && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>(Liquidación {form.periodoMes} {form.periodoAnio})</span>}
              </div>

              {serviciosAsignados.map(s => {
                const monto = montos[s.id];
                const serviciosData = liqPeriodo ? (liqPeriodo.servicios || liqPeriodo) : null;
                if (!serviciosData || !serviciosData[s.id]) {
                  return (
                    <div key={s.id} style={{ marginBottom: 6, opacity: .5 }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                        {s.icon} {s.label} — Sin datos de liquidación
      </div>
      </div>
  );
}
                const liq = serviciosData[s.id];
                const r = liq.reparto || s.reparto;
                return (
                  <div key={s.id} style={{ background: r !== SEReparto.UNIDAD ? "var(--bg-accent)" : "transparent", borderRadius: 10, padding: r !== SEReparto.UNIDAD ? "10px 12px" : "6px 0", marginBottom: r !== SEReparto.UNIDAD ? 8 : 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{s.icon} {s.label}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6, background: "var(--bg-muted)", borderRadius: 4, padding: "1px 6px" }}>
                          {labelReparto(r)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>
                        Bs.- {fmtMoney(monto)}
                      </div>
                    </div>
                    {s.tipo === "consumo" && liq.consumoTotal && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                        Consumo total: {fmtNum(liq.consumoTotal)} {s.unit} | Factura total: Bs.- {fmtMoney(liq.totalFactura)}
                      </div>
                    )}
                    {mostrarDetalleReparto(s)}
                  </div>
                );
              })}

              <div style={{ background: "var(--bg-card)", border: "2px solid var(--tag-pagado-text)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>TOTAL A PAGAR</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: C.colorAcento }}>Bs.- {fmtMoney(total)}</div>
              </div>
            </div>
            ) : null}

            {form.personaId && form.periodoMes && form.periodoAnio ? (
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14, marginTop: 12, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
                🔐 Solo los administradores pueden registrar pagos. 
                <span onClick={onLoginClick} style={{ color: C.colorAcento, cursor: "pointer", fontWeight: 600, textDecoration: "underline", marginLeft: 4 }}>Inicie sesión</span> si es administrador.
              </div>
            </div>
            ) : null}

            {deudaAcumulada.total > 0 && (
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--danger-text)" }}>
                    ⚠️ Deuda acumulada de períodos anteriores — Bs.- {fmtMoney(deudaAcumulada.total)}
                  </div>
                  <button onClick={imprimirDeudaAcumulada} style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>🖨️ Imprimir</button>
                </div>
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: "var(--text-main)" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-error)", color: "var(--danger-text)" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 10 }}>Período</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Servicios</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Pagado</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deudaAcumulada.detalles.map((d, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-muted)" }}>
                          <td style={{ padding: "5px 8px", fontWeight: 600, verticalAlign: "top" }}>{d.periodo}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            {servicios.filter(s => d.servicios && d.servicios[s.id] > 0).map(s => (
                              <div key={s.id} style={{ fontSize: 10, whiteSpace: "nowrap" }}>{s.icon} Bs.- {fmtMoney(d.servicios[s.id])}</div>
                            ))}
                            <div style={{ fontWeight: 700, fontSize: 11, marginTop: 2, borderTop: "1px solid var(--border-light)", paddingTop: 2 }}>Bs.- {fmtMoney(d.debe)}</div>
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>Bs.- {fmtMoney(d.pagado)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "var(--danger-text)" }}>Bs.- {fmtMoney(d.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--bg-error)" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700, verticalAlign: "top" }}>Total</td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          {servicios.filter(s => deudaAcumulada.detalles.some(d => d.servicios && d.servicios[s.id] > 0)).map(s => {
                            const totalSrv = deudaAcumulada.detalles.reduce((sum, d) => sum + (d.servicios?.[s.id] || 0), 0);
                            return totalSrv > 0 ? <div key={s.id} style={{ fontSize: 10, whiteSpace: "nowrap", fontWeight: 600 }}>{s.icon} Bs.- {fmtMoney(totalSrv)}</div> : null;
                          })}
                          <div style={{ fontWeight: 800, fontSize: 11, marginTop: 2, borderTop: "1px solid var(--border-light)", paddingTop: 2 }}>Bs.- {fmtMoney(deudaAcumulada.detalles.reduce((s, d) => s + d.debe, 0))}</div>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700 }}>Bs.- {fmtMoney(deudaAcumulada.detalles.reduce((s, d) => s + d.pagado, 0))}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "var(--danger-text)" }}>Bs.- {fmtMoney(deudaAcumulada.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

        <div style={{ textAlign: "center", marginTop: 16, display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
          <span onClick={onLoginClick} style={{ fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", textDecoration: "underline", transition: "color .2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-main)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-secondary)"}>
            🔐 Iniciar sesión
          </span>
          <span onClick={toggleDarkMode} style={{ fontSize: 20, cursor: "pointer", lineHeight: 1, transition: "transform .3s", display: "inline-block" }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            {cfg.darkMode ? "☀️" : "🌙"}
          </span>
        </div>
      </div>
    </div>
  );
}

function VistaPersonas({ cfg, personas, setPersonas }) {
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", inmueble: "", telefono: "", email: "", notas: "", habitaciones: "1", personas: "1", activo: true });
  const [busqueda, setBusqueda] = useState("");
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.inmueble || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.telefono || "").includes(busqueda)
  );

  const personaEmpty = () => ({ nombre: "", inmueble: "", telefono: "", email: "", notas: "", habitaciones: "1", personas: "1", activo: true });

  const guardar = () => {
    if (!form.nombre.trim()) return;
    const nuevas = editando
      ? personas.map(p => p.id === editando ? { ...form, id: editando } : p)
      : [...personas, { ...form, id: Date.now() }];
    setPersonas(nuevas);
    if (cfg.appsScriptUrl) {
      apiPost(cfg.appsScriptUrl, { action: "savePersonas", data: nuevas }).catch(() => {});
    }
    setEditando(null);
    setForm(personaEmpty());
  };

  const editar = (p) => {
    setEditando(p.id);
    setForm({ nombre: p.nombre, inmueble: p.inmueble || "", telefono: p.telefono || "", email: p.email || "", notas: p.notas || "", habitaciones: String(p.habitaciones || 1), personas: String(p.personas || 1), activo: p.activo !== false });
  };

  const eliminar = (id) => {
    if (!confirm("¿Eliminar esta persona?")) return;
    const nuevas = personas.filter(p => p.id !== id);
    setPersonas(nuevas);
    if (cfg.appsScriptUrl) {
      apiPost(cfg.appsScriptUrl, { action: "savePersonas", data: nuevas }).catch(() => {});
    }
    if (editando === id) { setEditando(null); setForm(personaEmpty()); }
  };

  const inp = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 7,
    padding: "8px 11px", fontSize: 13, boxSizing: "border-box",
    background: "var(--bg-card)", color: "var(--text-main)"
  };
  const label = (txt) => (
    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{txt}</label>
  );

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14 }}>{personas.length} persona(s) registradas</div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 10 }}>{editando ? "✏️ Editar persona" : "➕ Agregar persona"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>{label("Nombre *")}<input value={form.nombre} onChange={e => setF("nombre", e.target.value)} style={inp} placeholder="Nombre completo" /></div>
          <div>{label("Teléfono")}<input value={form.telefono} onChange={e => setF("telefono", e.target.value)} style={inp} placeholder="Ej: 0981 123 456" /></div>
          <div>{label("Inmueble")}<input value={form.inmueble} onChange={e => setF("inmueble", e.target.value)} style={inp} placeholder="Dirección / identificación" /></div>
          <div>{label("Email")}<input value={form.email} onChange={e => setF("email", e.target.value)} style={inp} placeholder="correo@ejemplo.com" /></div>
          <div>{label("🏠 Habitaciones (para reparto de Electricidad/Gas)")}<input type="number" value={form.habitaciones} onChange={e => setF("habitaciones", e.target.value)} style={inp} min="1" step="1" /></div>
          <div>{label("👥 Personas (para reparto de Agua)")}<input type="number" value={form.personas} onChange={e => setF("personas", e.target.value)} style={inp} min="1" step="1" /></div>
          <div style={{ gridColumn: "1/-1" }}>{label("Notas")}<input value={form.notas} onChange={e => setF("notas", e.target.value)} style={inp} placeholder="Observaciones (opcional)" /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={guardar} disabled={!form.nombre.trim()}
            style={{ background: cfg.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: form.nombre.trim() ? "pointer" : "not-allowed", fontSize: 12 }}>
            {editando ? "💾 Guardar cambios" : "➕ Agregar"}
          </button>
          {editando && (
            <button onClick={() => { setEditando(null); setForm(personaEmpty()); }}
              style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          )}
        </div>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...inp, width: "100%" }} placeholder="Buscar por nombre, inmueble o teléfono..." />
      </div>
      {filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>
          {personas.length === 0 ? "No hay personas registradas. Agregue la primera arriba." : "Sin resultados de búsqueda"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtradas.map(p => (
            <div key={p.id} style={{ border: "1px solid var(--border-light)", borderRadius: 10, padding: 12, background: "var(--bg-card)", display: "flex", gap: 12, alignItems: "center", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ background: "var(--bg-accent)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: cfg.colorAcento }}>{p.nombre.charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: p.activo !== false ? "var(--text-main)" : "var(--text-muted)" }}>{p.nombre} {p.activo === false && <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>(inactivo)</span>}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3 }}>
                  {p.inmueble && <span style={{ background: "var(--tag-inquilino)", color: "var(--tag-inquilino-text)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>🏠 {p.inmueble}</span>}
                  {p.telefono && <span style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>📞 {p.telefono}</span>}
                  {p.email && <span style={{ background: "var(--tag-metodo)", color: "var(--tag-metodo-text)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>✉️ {p.email}</span>}
                  <span style={{ background: "var(--bg-accent)", color: "var(--text-secondary)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>🏠 {p.habitaciones || 1} hab.</span>
                  <span style={{ background: "var(--bg-accent)", color: "var(--text-secondary)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>👥 {p.personas || 1} pers.</span>
                  <span onClick={() => { const nuevas = personas.map(x => x.id === p.id ? { ...x, activo: x.activo === false ? true : false } : x); setPersonas(nuevas); if (cfg.appsScriptUrl) apiPost(cfg.appsScriptUrl, { action: "savePersonas", data: nuevas }).catch(() => {}); }}
                    style={{ background: p.activo !== false ? "var(--tag-pagado)" : "var(--bg-warning)", color: p.activo !== false ? "var(--tag-pagado-text)" : "var(--star)", borderRadius: 6, padding: "1px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    {p.activo !== false ? "✅ Activo" : "⏸ Inactivo"}
                  </span>
                </div>
                {p.notas && <div style={{ fontSize: 11, color: "var(--text-comment)", fontStyle: "italic", marginTop: 2 }}>{p.notas}</div>}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => editar(p)} style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                <button onClick={() => eliminar(p.id)} style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaTarifas({ cfg, tarifas, setTarifas, servicios }) {
  const serviciosConsumo = useMemo(() => servicios.filter(s => s.tipo === "consumo"), [servicios]);
  const [mes, setMes] = useState(mesActual());
  const [anio, setAnio] = useState(anioActual());
  const key = periodoKey(mes, anio);
  const tarifasPorDefecto = useMemo(() => {
    const d = {};
    serviciosConsumo.forEach(s => { d[s.id] = 0; });
    return d;
  }, [serviciosConsumo]);
  const tarifasActuales = tarifas[key] || { ...tarifasPorDefecto };
  const [edit, setEdit] = useState({ ...tarifasActuales });
  const [msg, setMsg] = useState("");

  useEffect(() => { setEdit({ ...tarifasActuales }); }, [key, tarifas]);

  const guardar = () => {
    const nuevas = { ...tarifas, [key]: { ...edit } };
    setTarifas(nuevas);
    if (cfg.appsScriptUrl) {
      apiPost(cfg.appsScriptUrl, { action: "saveTarifas", data: nuevas }).catch(() => {});
    }
    setMsg("✅ Tarifas guardadas para " + mes + " " + anio);
    setTimeout(() => setMsg(""), 3000);
  };

  const cargarPeriodo = (k) => {
    const [y, m] = k.split("-");
    setMes(meses[Number(m) - 1]);
    setAnio(Number(y));
  };

  const inp = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 7,
    padding: "8px 11px", fontSize: 13, boxSizing: "border-box",
    background: "var(--bg-card)", color: "var(--text-main)", textAlign: "right"
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14 }}>
        Gestión de Tarifas por Consumo
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, display: "block" }}>
          Haga clic en un período del historial para cargar y actualizar sus tarifas.
        </span>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Mes</label>
            <select value={mes} onChange={e => setMes(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--bg-card)", color: "var(--text-main)" }}>
              {meses.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Año</label>
            <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--bg-card)", color: "var(--text-main)" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>&nbsp;</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-muted)", borderRadius: 7, padding: "8px 12px", whiteSpace: "nowrap" }}>
              {Object.keys(tarifas).includes(key) ? "✅ Configurado" : "⚠️ Sin configurar"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {serviciosConsumo.map(s => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "center", background: "var(--bg-muted)", borderRadius: 8, padding: "10px 14px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.unit ? `Precio por ${s.unit}` : "Total en Bs.-"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Bs.-</span>
                <input type="number" value={edit[s.id] || ""} onChange={e => setEdit(prev => ({ ...prev, [s.id]: e.target.value }))}
                  style={inp} min="0" step="100" placeholder="0" />
                {s.unit && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>/{s.unit}</span>}
              </div>
              {s.unit && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" value={edit[s.id + "_consumo"] || ""} onChange={e => setEdit(prev => ({ ...prev, [s.id + "_consumo"]: e.target.value }))}
                    style={{ ...inp, width: "100%" }} min="0" step="1" placeholder={`Consumo (${s.unit})`} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", flexShrink: 0 }}>{s.unit}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={guardar} style={{ background: cfg.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            💾 Guardar tarifas para {mes} {anio}
          </button>
          {msg && <span style={{ fontSize: 12, color: "var(--tag-pagado-text)", fontWeight: 600 }}>{msg}</span>}
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 8 }}>Historial de tarifas</div>
      {Object.keys(tarifas).length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>No hay tarifas configuradas aún</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-light)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: cfg.colorPrimario, color: "#fff" }}>
                <th style={{ padding: "9px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: .5, textTransform: "uppercase" }}>Período</th>
                {serviciosConsumo.map(s => (
                  <th key={s.id} style={{ padding: "9px 10px", textAlign: "center", fontWeight: 600, fontSize: 11, letterSpacing: .5, textTransform: "uppercase" }}>{s.icon} {s.label}</th>
                ))}
                <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 600, fontSize: 11, letterSpacing: .5, textTransform: "uppercase" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tarifas).sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => {
                const [y, m] = k.split("-");
                const label = `${meses[Number(m) - 1]} ${y}`;
                return (
                  <tr key={k} style={{ background: "var(--bg-card)", cursor: "pointer", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-accent)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--bg-card)"}>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--border-light)", fontWeight: 700 }}>{label}</td>
                    {serviciosConsumo.map(s => {
                      const consumo = v[s.id + "_consumo"];
                      return (
                        <td key={s.id} style={{ padding: "7px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center" }}>
                          <div>Bs.- {fmtNum(v[s.id] || 0)}{s.unit ? `/${s.unit}` : ""}</div>
                          {consumo ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtNum(consumo)} {s.unit}</div> : null}
                        </td>
                      );
                    })}
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center" }}>
                      <button onClick={() => cargarPeriodo(k)} style={{ background: cfg.colorPrimario, color: "#fff", border: "none", borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VistaLiquidaciones({ cfg, personas, liquidaciones, setLiquidaciones, servicios, pagos, tarifas }) {
  const activas = personas.filter(p => p.activo !== false);
  const [mes, setMes] = useState(mesActual());
  const [anio, setAnio] = useState(anioActual());
  const key = periodoKey(mes, anio);
  const liqActual = liquidaciones[key] || null;
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState("");
  const [expandKey, setExpandKey] = useState(null);

  const tarifasPeriodo = tarifas[key] || {};

  useEffect(() => {
    setEdit(liqActual ? JSON.parse(JSON.stringify(liqActual)) : null);
  }, [key, liquidaciones]);

  const getServicios = () => {
    if (!edit) return {};
    return edit.servicios || edit;
  };
  const getInquilinos = () => {
    if (!edit) return {};
    return edit.inquilinos || {};
  };

  const setLiqServicio = (servicioId, campo, valor) => {
    setEdit(prev => {
      const base = prev || { servicios: {}, inquilinos: {} };
      if (!base.servicios) base.servicios = {};
      return { ...base, servicios: { ...base.servicios, [servicioId]: { ...(base.servicios[servicioId] || {}), [campo]: valor } } };
    });
  };

  const toggleServicioInquilino = (personaId, servicioId) => {
    setEdit(prev => {
      const base = prev || { servicios: {}, inquilinos: {} };
      if (!base.inquilinos) base.inquilinos = {};
      const actual = base.inquilinos[personaId];
      const lista = actual ? [...(actual.servicios || [])] : [];
      const idx = lista.indexOf(servicioId);
      if (idx >= 0) lista.splice(idx, 1);
      else lista.push(servicioId);
      return { ...base, inquilinos: { ...base.inquilinos, [personaId]: { ...(actual || {}), servicios: lista } } };
    });
  };

  const toggleAllServicio = (servicioId) => {
    setEdit(prev => {
      const base = prev || { servicios: {}, inquilinos: {} };
      if (!base.inquilinos) base.inquilinos = {};
      const inq = base.inquilinos;
      const allChecked = activas.every(p => (inq[String(p.id)]?.servicios || []).includes(servicioId));
      const nuevos = { ...inq };
      activas.forEach(p => {
        const pid = String(p.id);
        const actual = nuevos[pid];
        const lista = actual ? [...(actual.servicios || [])] : [];
        if (allChecked) {
          const idx = lista.indexOf(servicioId);
          if (idx >= 0) lista.splice(idx, 1);
        } else {
          if (!lista.includes(servicioId)) lista.push(servicioId);
        }
        nuevos[pid] = { ...(actual || {}), servicios: lista };
      });
      return { ...base, inquilinos: nuevos };
    });
  };

  const guardar = () => {
    const sinTarifa = servicios.filter(s => !Number(tarifasPeriodo[s.id]));
    if (sinTarifa.length > 0) {
      setMsg("⚠️ Complete la tarifa de " + sinTarifa.map(s => s.label).join(", ") + " antes de guardar");
      setTimeout(() => setMsg(""), 4000);
      return;
    }
    const data = { servicios: {}, inquilinos: {} };
    const srv = getServicios();
    servicios.forEach(s => {
      const liq = srv[s.id] ? { ...srv[s.id] } : {};
      const monto = Number(tarifasPeriodo[s.id]) || 0;
      liq.totalFactura = monto;
      liq.reparto = liq.reparto || s.reparto;
      if (monto > 0 && liq.reparto !== SEReparto.UNIDAD && activas.length > 0) {
        const totalFactor = calcTotalFactor(activas, liq.reparto);
        liq.valorPorFactor = totalFactor > 0 ? Math.round(monto / totalFactor * 10) / 10 : 0;
      }
      data.servicios[s.id] = liq;
    });
    data.inquilinos = getInquilinos();
    data.factores = {};
    activas.forEach(p => {
      data.factores[String(p.id)] = { habitaciones: Number(p.habitaciones) || 1, personas: Number(p.personas) || 1 };
    });
    setLiquidaciones(prev => ({ ...prev, [key]: data }));
    if (cfg.appsScriptUrl) {
      apiPost(cfg.appsScriptUrl, { action: "saveLiquidaciones", data: { ...liquidaciones, [key]: data } }).catch(() => {});
    }
    setMsg("✅ Liquidación guardada para " + mes + " " + anio);
    setTimeout(() => setMsg(""), 3000);
  };

  const inp = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 7,
    padding: "8px 11px", fontSize: 13, boxSizing: "border-box",
    background: "var(--bg-card)", color: "var(--text-main)", textAlign: "right"
  };
  const inpSel = { ...inp, textAlign: "left" };

  const labelReparto = (r) => {
    if (r === SEReparto.HABITACIONES) return "🏠 Por habitaciones";
    if (r === SEReparto.PERSONAS) return "👥 Por personas";
    return "🏷️ 1 solo pago";
  };

  const repartoOptions = [
    { value: SEReparto.UNIDAD, label: "1 solo pago (por unidad)" },
    { value: SEReparto.HABITACIONES, label: "Por cantidad de habitaciones" },
    { value: SEReparto.PERSONAS, label: "Por cantidad de personas" },
  ];

  const totalesPorInquilino = (liqData) => {
    const result = {};
    const srvData = liqData.servicios || liqData;
    const inqData = liqData.inquilinos || {};
    activas.forEach(p => {
      const pid = String(p.id);
      const asignados = inqData[pid]?.servicios || [];
      let total = 0;
      const detalles = {};
      servicios.forEach(s => {
        const liq = srvData[s.id];
        if (!liq) { detalles[s.id] = 0; return; }
        const totalFactura = Number(liq.totalFactura) || 0;
        if (totalFactura <= 0) { detalles[s.id] = 0; return; }
        const marked = asignados.length === 0 || asignados.includes(s.id);
        if (!marked) { detalles[s.id] = 0; return; }
        const r = liq.reparto || s.reparto;
        if (r === SEReparto.UNIDAD) {
          detalles[s.id] = totalFactura;
        } else {
          const idsConServicio = Object.entries(inqData).filter(([_, v]) => v.servicios && v.servicios.includes(s.id)).map(([id]) => id);
          const baseFiltradas = getPersonasSnapshot(liqData, personas);
          const personasFiltradas = idsConServicio.length ? baseFiltradas.filter(x => idsConServicio.includes(String(x.id))) : baseFiltradas;
          if (personasFiltradas.length === 0) { detalles[s.id] = 0; return; }
          const factores = liqData.factores || {};
          const factor = r === SEReparto.HABITACIONES ? (Number(factores[pid]?.habitaciones) || Number(p.habitaciones) || 1) : (Number(factores[pid]?.personas) || Number(p.personas) || 1);
          const totalFactor = calcTotalFactor(personasFiltradas, r, factores);
          detalles[s.id] = totalFactor > 0 ? Math.round(totalFactura * factor / totalFactor * 10) / 10 : 0;
        }
        total += detalles[s.id];
      });
      result[pid] = { nombre: p.nombre, inmueble: p.inmueble, detalles, total };
    });
    return result;
  };

  const pagoEstaPagado = (k, pid) => {
    const [y, m] = k.split("-");
    const mesLabel = meses[Number(m) - 1];
    const p = activas.find(x => String(x.id) === String(pid));
    return pagos.some(pg => {
      if (pg.periodoMes !== mesLabel || String(pg.periodoAnio) !== y || pg.estado !== "Pagado") return false;
      if (String(pg.personaId) === String(pid)) return true;
      if (p && pg.inquilino && p.nombre && pg.inquilino.toLowerCase() === p.nombre.toLowerCase()) return true;
      return false;
    });
  };

  const construirHtmlReporte = (k, v) => {
    const [y, m] = k.split("-");
    const label = `${meses[Number(m) - 1]} ${y}`;
    const totInq = totalesPorInquilino(v);
    const totalesLiq = Object.values(totInq).reduce((s, i) => s + i.total, 0);
    const srvData = v.servicios || v;
    const inqData = v.inquilinos || {};
    const factores = v.factores || {};
    const filas = activas.map(p => {
      const pid = String(p.id);
      const datos = totInq[pid];
      const pagado = pagoEstaPagado(k, pid);
      const fc = v.factores?.[pid];
      if (!datos || datos.total <= 0) return null;
      const serviciosConCargo = servicios.filter(s => datos.detalles[s.id] > 0);
      const showHab = serviciosConCargo.some(s => (srvData[s.id]?.reparto || s.reparto) === SEReparto.HABITACIONES);
      const showPers = serviciosConCargo.some(s => (srvData[s.id]?.reparto || s.reparto) === SEReparto.PERSONAS);
      return `<tr>
        <td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;font-weight:700">${datos.nombre}${datos.inmueble ? "<br><span style=font-size:10px;color:#64748b>" + datos.inmueble + "</span>" : ""}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px">${showHab && fc ? fc.habitaciones : ""}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px">${showPers && fc ? fc.personas : ""}</td>
        ${servicios.map(s => `<td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;text-align:center">${datos.detalles[s.id] > 0 ? "Bs.- " + fmtMoney(datos.detalles[s.id]) : "—"}</td>`).join("\n")}
        <td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700">Bs.- ${fmtMoney(datos.total)}</td>
        <td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;text-align:center">${pagado ? "✅ Pagado" : "⏳ Pendiente"}</td>
      </tr>`;
    }).filter(Boolean).join("\n");
    const serviciosFactor = servicios.map(s => {
      const liq = srvData[s.id];
      if (!liq || !Number(liq.totalFactura)) return null;
      const r = liq.reparto || s.reparto;
      if (r === SEReparto.UNIDAD) return null;
      const idsConServicio = Object.entries(inqData)
        .filter(([_, val]) => val.servicios && val.servicios.includes(s.id))
        .map(([id]) => id);
      const personasFiltradas = idsConServicio.length
        ? activas.filter(p => idsConServicio.includes(String(p.id)))
        : activas;
      const sumFactor = personasFiltradas.reduce((acc, p) => {
        const pid = String(p.id);
        const fv = r === SEReparto.HABITACIONES
          ? (Number(factores[pid]?.habitaciones) || Number(p.habitaciones) || 1)
          : (Number(factores[pid]?.personas) || Number(p.personas) || 1);
        return acc + fv;
      }, 0);
      return { sumFactor, reparto: r };
    });
    const sumas = servicios.map((s, idx) => {
      const sumSrv = Object.values(totInq).reduce((sum, i) => sum + (i.detalles[s.id] || 0), 0);
      const sf = serviciosFactor[idx];
      const factorLabel = sf != null
        ? `<br><span style="font-size:9px;color:#475569">${sf.sumFactor} ${sf.reparto === SEReparto.HABITACIONES ? 'hab.' : 'pers.'}</span>`
        : '';
      const content = sumSrv > 0 ? "Bs.- " + fmtMoney(sumSrv) + factorLabel : "—";
      return `<td style="padding:5px 7px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;line-height:1.4">${content}</td>`;
    }).join("\n");
    const tarifasHtml = servicios.filter(s => srvData[s.id] && Number(srvData[s.id].totalFactura) > 0).map(s => {
      const rep = srvData[s.id].reparto || s.reparto;
      const repLabel = rep === SEReparto.HABITACIONES ? "🏠 x hab." : rep === SEReparto.PERSONAS ? "👥 x pers." : "🏷️ 1 pago";
      return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #e2e8f0;font-size:11px">
        <span>${s.icon} ${s.label} <span style="color:#64748b;font-size:10px">${repLabel}</span></span>
        <span style="font-weight:600">Bs.- ${fmtMoney(srvData[s.id].totalFactura)}</span>
      </div>`;
    }).join("\n");
    const css = `* { margin:0;padding:0;box-sizing:border-box; }
  .report-wrap { font:13px/1.5 system-ui,sans-serif; color:#1e293b; padding:24px; max-width:800px; margin:0 auto; }
  .header { text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #065f46; }
  .header h1 { font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#065f46;margin-bottom:2px; }
  .header h2 { font-size:16px;font-weight:800; }
  .header .periodo { font-size:13px;color:#64748b;margin-top:4px; }
  table { width:100%;border-collapse:collapse;font-size:12px;margin-top:10px; }
  th { background:#065f46;color:#fff;padding:7px 8px;text-align:center;font-size:10px;letter-spacing:.5px;text-transform:uppercase; }
  td { padding:5px 7px;border-bottom:1px solid #e2e8f0; }
  .total-row td { font-weight:800;font-size:13px;background:#f1f5f9; }
  .footer { text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px; }
  .resumen { display:flex;gap:16px;justify-content:center;margin-top:10px;font-size:12px; }
  .resumen div { background:#f1f5f9;padding:6px 14px;border-radius:6px; }`;
    const bodyHtml = `
<div class="report-wrap">
<div class="header">
  <h1>${cfg.orgNombre} — ${cfg.orgSubtitulo}</h1>
  <h2>Informe de Liquidación</h2>
  <div class="periodo">${label}</div>
  <div class="resumen">
    <div>💰 Total: Bs.- ${fmtMoney(totalesLiq)}</div>
    <div>✅ Pagado(s): ${activas.filter(p => pagoEstaPagado(k, String(p.id))).length}</div>
    <div>⏳ Pendiente(s): ${activas.filter(p => !pagoEstaPagado(k, String(p.id))).length}</div>
  </div>
  </div>
  ${tarifasHtml ? `
  <div style="margin:12px 0;padding:10px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#065f46;margin-bottom:6px">💰 Tarifas del Período</div>
    ${tarifasHtml}
  </div>` : ""}
  <table>
  <thead><tr>
    <th style="text-align:left">Inquilino</th>
    <th style="font-size:9px">Hab.</th>
    <th style="font-size:9px">Pers.</th>
    ${servicios.map(s => `<th>${s.icon} ${s.label}</th>`).join("\n")}
    <th>Total</th>
    <th>Estado</th>
  </tr></thead>
  <tbody>${filas}</tbody>
  <tfoot><tr class="total-row">
    <td>Totales</td>
    <td></td>
    <td></td>
    ${sumas}
    <td style="text-align:center">Bs.- ${fmtMoney(totalesLiq)}</td>
    <td></td>
  </tr></tfoot>
</table>
<div class="footer">Documento generado el ${new Date().toLocaleDateString("es-ES")} — ${cfg.orgNombre} Alquileres</div>
</div>`;
    return { label, totalesLiq, bodyHtml, css };
  };

  const imprimirReporte = (k, v) => {
    const { label, bodyHtml, css } = construirHtmlReporte(k, v);
    const w = window.open("", "_blank", "width=700,height=600");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe — ${label} — ${cfg.orgNombre}</title>
<style>${css}
  .toolbar { text-align:center;padding:10px 0;margin-bottom:12px;border-bottom:1px solid #e2e8f0; }
  .toolbar button { background:#065f46;color:#fff;border:none;padding:7px 16px;border-radius:4px;cursor:pointer;font:13px/1.5 system-ui,sans-serif;margin:0 4px; }
  .toolbar button:hover { background:#047857; }
  @media print { .toolbar { display:none; } }
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨️ Imprimir</button>
  <button onclick="window.close()">✖️ Cerrar</button>
</div>
${bodyHtml}
</body></html>`);
    w.document.close();
  };

  const descargarPDF = (k, v) => {
    const [y, m] = k.split("-");
    const label = `${meses[Number(m) - 1]} ${y}`;
    const totInq = totalesPorInquilino(v);
    const totalesLiq = Object.values(totInq).reduce((s, i) => s + i.total, 0);
    const srvData = v.servicios || v;
    const pagados = activas.filter(p => pagoEstaPagado(k, String(p.id))).length;
    const pendientes = activas.length - pagados;
    const tarifas = servicios.filter(s => srvData[s.id] && Number(srvData[s.id].totalFactura) > 0);

    const shortLabel = s => s.label.length > 6 ? s.label.slice(0, 5).trim() + "." : s.label;

    const columns = [
      { header: "Inquilino", dataKey: "nombre" },
      { header: "Hab.", dataKey: "hab" },
      { header: "Pers.", dataKey: "pers" },
      ...servicios.map(s => ({ header: shortLabel(s), dataKey: `srv_${s.id}` })),
      { header: "Total", dataKey: "total" },
      { header: "Estado", dataKey: "estado" },
    ];

    const rows = activas.map(p => {
      const pid = String(p.id);
      const datos = totInq[pid];
      if (!datos || datos.total <= 0) return null;
      const fc = v.factores?.[pid];
      const pagado = pagoEstaPagado(k, pid);
      const serviciosConCargo = servicios.filter(s => datos.detalles[s.id] > 0);
      const showHab = serviciosConCargo.some(s => (srvData[s.id]?.reparto || s.reparto) === SEReparto.HABITACIONES);
      const showPers = serviciosConCargo.some(s => (srvData[s.id]?.reparto || s.reparto) === SEReparto.PERSONAS);
      const row = {
        nombre: datos.nombre,
        hab: showHab && fc ? String(fc.habitaciones) : "",
        pers: showPers && fc ? String(fc.personas) : "",
        total: `Bs.- ${fmtMoney(datos.total)}`,
        estado: pagado ? "Pagado" : "Pendiente",
      };
      servicios.forEach(s => { row[`srv_${s.id}`] = datos.detalles[s.id] > 0 ? `Bs.- ${fmtMoney(datos.detalles[s.id])}` : ""; });
      return row;
    }).filter(Boolean);

    const totalRow = { nombre: "Totales", hab: "", pers: "", total: `Bs.- ${fmtMoney(totalesLiq)}`, estado: "" };
    servicios.forEach(s => {
      const sumSrv = Object.values(totInq).reduce((sum, i) => sum + (i.detalles[s.id] || 0), 0);
      totalRow[`srv_${s.id}`] = sumSrv > 0 ? `Bs.- ${fmtMoney(sumSrv)}` : "";
    });
    rows.push(totalRow);

    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pw = doc.internal.pageSize.getWidth();
    const green = [6, 95, 70];
    const lightGray = [241, 245, 249];
    const margin = 14;

    doc.setFontSize(9);
    doc.setTextColor(...green);
    doc.text(cfg.orgNombre, pw / 2, 14, { align: "center" });
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Informe de Liquidaci\u00f3n", pw / 2, 21, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(label, pw / 2, 28, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("Total:", margin, 36);
    doc.setFont(undefined, "bold");
    doc.text(`Bs.- ${fmtMoney(totalesLiq)}`, margin + 14, 36);
    doc.setFont(undefined, "normal");
    doc.setTextColor(6, 95, 70);
    doc.text(`Pagado(s): ${pagados}`, margin + 65, 36);
    doc.setTextColor(180, 83, 9);
    doc.text(`Pendiente(s): ${pendientes}`, margin + 105, 36);

    let yStart = 44;
    if (tarifas.length > 0) {
      yStart = 50;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, yStart - 4, pw - margin * 2, tarifas.length * 5 + 10, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setFont(undefined, "bold");
      doc.setTextColor(...green);
      doc.text("Tarifas del Periodo", margin + 4, yStart + 1);
      doc.setFont(undefined, "normal");
      yStart += 6;
      tarifas.forEach((srv, i) => {
        const liq = srvData[srv.id];
        const rep = liq.reparto || srv.reparto;
        const repLabel = rep === SEReparto.HABITACIONES ? "x hab." : rep === SEReparto.PERSONAS ? "x pers." : "1 pago";
        const lineLabel = `${srv.label} (${repLabel})`;
        doc.setTextColor(30, 41, 59);
        doc.text(lineLabel, margin + 4, yStart + i * 5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Bs.- ${fmtMoney(liq.totalFactura)}`, pw - margin - 4, yStart + i * 5, { align: "right" });
      });
      yStart += tarifas.length * 5 + 4;
    }

    doc.autoTable({
      columns,
      body: rows,
      startY: yStart,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [...green], fontSize: 7, halign: "center", textColor: 255 },
      bodyStyles: { textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        nombre: { halign: "left" },
        hab: { halign: "center", cellWidth: 8 },
        pers: { halign: "center", cellWidth: 8 },
        total: { halign: "center" },
        estado: { halign: "center" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.dataKey === "estado") {
          const val = data.cell.raw?.toString() || "";
          if (val === "Pagado") { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = "bold"; }
          else { data.cell.styles.textColor = [180, 83, 9]; data.cell.styles.fontStyle = "bold"; }
        }
        if (data.section === "body" && data.row.index === rows.length - 1) {
          data.cell.styles.fillColor = lightGray;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [30, 41, 59];
        }
      },
    });

    const footer = `Documento generado el ${new Date().toLocaleDateString("es-ES")} \u2014 ${cfg.orgNombre} Alquileres`;
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(footer, pw / 2, doc.internal.pageSize.height - 10, { align: "center" });
    }

    doc.save(`Informe-${label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14 }}>
        Gestión de Liquidaciones Mensuales
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, display: "block" }}>
          Tarifas registradas para {mes} {anio}. Asigne los servicios a cada inquilino y guarde.
        </span>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Mes</label>
            <select value={mes} onChange={e => setMes(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--bg-card)", color: "var(--text-main)" }}>
              {meses.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Año</label>
            <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--bg-card)", color: "var(--text-main)" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>&nbsp;</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", background: liqActual ? "var(--bg-success)" : "var(--bg-warning)", borderRadius: 7, padding: "8px 12px", whiteSpace: "nowrap", fontWeight: 600 }}>
              {liqActual ? "✅ Configurado" : "⚠️ Sin configurar"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Tarifas del período</div>
          {servicios.map(s => {
            const srv = getServicios();
            const liq = srv[s.id] || null;
            const reparto = liq?.reparto || s.reparto;
            const tarifaActual = Number(tarifasPeriodo[s.id]) || 0;
            const consumoActual = tarifasPeriodo[s.id + "_consumo"];
            const totalFactor = tarifaActual > 0 && reparto !== SEReparto.UNIDAD && activas.length > 0
              ? calcTotalFactor(activas, reparto) : 0;
            const porFactor = totalFactor > 0 ? tarifaActual / totalFactor : 0;
            const etiquetaFactor = reparto === SEReparto.HABITACIONES ? "hab" : "pers";
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", background: "var(--bg-muted)", borderRadius: 8, padding: "10px 14px" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {tarifaActual > 0
                      ? `Bs.- ${fmtNum(tarifaActual)}${s.unit ? `/${s.unit}` : ""}`
                      : "Bs.- 0"}
                    {consumoActual ? ` · ${fmtNum(consumoActual)} ${s.unit}` : ""}
                    {porFactor > 0 ? ` · Bs.- ${fmtMoney(porFactor)}/${etiquetaFactor}` : ""}
                    {" · "}
                    <span style={{ color: "var(--text-secondary)" }}>{labelReparto(reparto)}</span>
                  </div>
                </div>
                <select value={reparto} onChange={e => setLiqServicio(s.id, "reparto", e.target.value)}
                  style={{ ...inpSel, width: "auto", minWidth: 150 }}>
                  {repartoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {tarifaActual > 0 && (
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Total factura</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: cfg.colorAcento }}>Bs.- {fmtMoney(tarifaActual)}</div>
                    {porFactor > 0 && (
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                        Bs.- {fmtMoney(porFactor)}/{etiquetaFactor} × {fmtNum(totalFactor)} {etiquetaFactor}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {activas.length > 0 && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 10 }}>
              👥 Asignación de servicios por inquilino
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>(marque qué servicios aplica a cada uno)</span>
            </div>
            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-light)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "var(--text-main)" }}>
                <thead>
                    <tr style={{ background: cfg.colorPrimario, color: "#fff" }}>
                      <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Inquilino</th>
                      {servicios.map(s => {
                        const inq = getInquilinos();
                        const allChecked = activas.length > 0 && activas.every(p => (inq[String(p.id)]?.servicios || []).includes(s.id));
                        return (
                          <th key={s.id} style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10, cursor: "pointer" }} onClick={() => toggleAllServicio(s.id)}>
                            <div>{s.icon}<br/>{s.label}</div>
                            <div style={{ fontSize: 9, marginTop: 2, opacity: .8 }}>{allChecked ? "☑ Todos" : "☐ Todos"}</div>
                          </th>
                        );
                      })}
                    </tr>
                </thead>
                <tbody>
                  {activas.map(p => {
                    const inq = getInquilinos();
                    const asignados = inq[String(p.id)]?.servicios || [];
                    return (
                      <tr key={p.id} style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "5px 8px", fontWeight: 700 }}>
                          <div>{p.nombre}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>🏠 {p.habitaciones || 1} hab · 👥 {p.personas || 1} pers</div>
                        </td>
                        {servicios.map(s => {
                          const marcado = asignados.includes(s.id);
                          return (
                            <td key={s.id} style={{ padding: "5px 8px", textAlign: "center" }}>
                              <input type="checkbox" checked={marcado} onChange={() => toggleServicioInquilino(String(p.id), s.id)}
                                style={{ width: 16, height: 16, cursor: "pointer", accentColor: cfg.colorPrimario }} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={guardar} style={{ background: cfg.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            💾 Guardar liquidación para {mes} {anio}
          </button>
          {msg && <span style={{ fontSize: 12, color: "var(--tag-pagado-text)", fontWeight: 600 }}>{msg}</span>}
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 8 }}>Historial de liquidaciones</div>
      {Object.keys(liquidaciones).length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>No hay liquidaciones configuradas aún</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(liquidaciones).sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => {
            const [y, m] = k.split("-");
            const label = `${meses[Number(m) - 1]} ${y}`;
            const srvData = v.servicios || v;
            const inqData = v.inquilinos || {};
            const expandido = expandKey === k;
            const totalPagados = activas.filter(p => pagoEstaPagado(k, String(p.id))).length;
            const totalPendientes = activas.length - totalPagados;
            const totInq = totalesPorInquilino(v);
            const totalesLiq = Object.values(totInq).reduce((s, i) => s + i.total, 0);

            const totalesServicio = {};
            const factoresServicio = {};
            const srvData2 = v.servicios || v;
            const inqData2 = v.inquilinos || {};
            const losFactores = v.factores || {};
            servicios.forEach(s => {
              totalesServicio[s.id] = Object.values(totInq).reduce((sum, i) => sum + (i.detalles[s.id] || 0), 0);
              const liq2 = srvData2[s.id];
              if (!liq2) { factoresServicio[s.id] = null; return; }
              if (Number(liq2.totalFactura) <= 0) { factoresServicio[s.id] = null; return; }
              const r2 = liq2.reparto || s.reparto;
              if (r2 === SEReparto.UNIDAD) { factoresServicio[s.id] = null; return; }
              const idsCS = Object.entries(inqData2).filter(([_, x]) => x.servicios && x.servicios.includes(s.id)).map(([id]) => id);
              const base2 = getPersonasSnapshot(v, activas);
              const filt2 = idsCS.length ? base2.filter(x => idsCS.includes(String(x.id))) : base2;
              if (filt2.length === 0) { factoresServicio[s.id] = null; return; }
              factoresServicio[s.id] = calcTotalFactor(filt2, r2, losFactores);
            });

            return (
              <div key={k} style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-light)", overflow: "hidden" }}>
                <div onClick={() => setExpandKey(expandido ? null : k)}
                  style={{ padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none", transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-muted)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {servicios.map(s => {
                        const st = totalesServicio[s.id];
                        return st > 0 ? <span key={s.id} style={{ marginRight: 8 }}>{s.icon} Bs.- {fmtMoney(st)}</span> : null;
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                      Bs.- {fmtMoney(totalesLiq)} total | {totalPagados} pagado(s) · {totalPendientes} pendiente(s)
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                      {servicios.map(s => {
                        const ft = factoresServicio[s.id];
                        if (ft == null || ft <= 0) return null;
                        const r2 = (v.servicios?.[s.id]?.reparto) || s.reparto;
                        const label = r2 === SEReparto.HABITACIONES ? "hab" : "pers";
                        return <span key={s.id} style={{ marginRight: 8 }}>{s.icon} {fmtNum(ft)} {label}</span>;
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); imprimirReporte(k, v); }} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                      🖨️ Imprimir
                    </button>
                    <button onClick={e => { e.stopPropagation(); descargarPDF(k, v); }} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                      📄 PDF
                    </button>
                    {totalPendientes === 0 && totalPagados > 0 && <span style={{ fontSize: 10, color: "var(--tag-pagado-text)", background: "var(--bg-success)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>✅ Todo pagado</span>}
                    <span style={{ fontSize: 12, color: "var(--text-muted)", transition: "transform .2s", transform: expandido ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                  </div>
                </div>

                {expandido && (
                  <div style={{ borderTop: "1px solid var(--border-light)", padding: 12 }}>
                    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: "var(--text-main)" }}>
                        <thead>
                          <tr style={{ background: cfg.colorPrimario, color: "#fff" }}>
                            <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 600, fontSize: 10 }}>Inquilino</th>
                            {servicios.map(s => (
                              <th key={s.id} style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>{s.icon} {s.label}</th>
                            ))}
                            <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Total</th>
                            <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activas.map(p => {
                            const pid = String(p.id);
                            const datos = totInq[pid];
                            const pagado = pagoEstaPagado(k, pid);
                            if (!datos || datos.total <= 0) return null;
                            return (
                              <tr key={pid} style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 700, color: "var(--text-main)" }}>
                                  <div>{datos.nombre}</div>
                                  {datos.inmueble && <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{datos.inmueble}</div>}
                                </td>
                                {servicios.map(s => (
                                  <td key={s.id} style={{ padding: "6px 8px", textAlign: "center", color: datos.detalles[s.id] > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                                    {datos.detalles[s.id] > 0 ? `Bs.- ${fmtMoney(datos.detalles[s.id])}` : "—"}
                                  </td>
                                ))}
                                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: cfg.colorAcento }}>
                                  Bs.- {fmtMoney(datos.total)}
                                </td>
                                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                  {pagado
                                    ? <span style={{ fontSize: 10, color: "var(--tag-pagado-text)", background: "var(--bg-success)", padding: "2px 8px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>✅ Pagado</span>
                                    : <span style={{ fontSize: 10, color: "var(--star)", background: "var(--bg-warning)", padding: "2px 8px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>⏳ Pendiente</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "var(--bg-muted)" }}>
                            <td style={{ padding: "6px 8px", fontWeight: 700, fontSize: 12, color: "var(--text-main)" }}>Totales</td>
                            {servicios.map(s => {
                              const sumSrv = Object.values(totInq).reduce((sum, i) => sum + (i.detalles[s.id] || 0), 0);
                              return (
                                <td key={s.id} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, color: "var(--text-main)" }}>
                                  {sumSrv > 0 ? `Bs.- ${fmtMoney(sumSrv)}` : "—"}
                                </td>
                              );
                            })}
                            <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 800, fontSize: 13, color: cfg.colorAcento }}>
                              Bs.- {fmtMoney(totalesLiq)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VistaServicios({ cfg, servicios, setServicios }) {
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ label: "", icon: "📦", unit: "", tipo: "fijo", reparto: SEReparto.UNIDAD, requerido: false });
  const [msg, setMsg] = useState("");
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const formEmpty = () => ({ label: "", icon: "📦", unit: "", tipo: "fijo", reparto: SEReparto.UNIDAD, requerido: false });

  const guardar = () => {
    if (!form.label.trim()) return;
    if (editando) {
      setServicios(prev => prev.map(s => s.id === editando ? { ...form, id: editando } : s));
      setMsg("✅ Servicio actualizado");
    } else {
      const id = form.label.toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Date.now();
      setServicios(prev => [...prev, { ...form, id }]);
      setMsg("✅ Servicio agregado");
    }
    setEditando(null);
    setForm(formEmpty());
    setTimeout(() => setMsg(""), 3000);
  };

  const editar = (s) => {
    setEditando(s.id);
    setForm({ label: s.label, icon: s.icon, unit: s.unit || "", tipo: s.tipo, reparto: s.reparto, requerido: !!s.requerido });
  };

  const eliminar = (id) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    setServicios(prev => prev.filter(s => s.id !== id));
    if (editando === id) { setEditando(null); setForm(formEmpty()); }
  };

  const inp = {
    width: "100%", border: "1px solid var(--border)", borderRadius: 7,
    padding: "8px 11px", fontSize: 13, boxSizing: "border-box",
    background: "var(--bg-card)", color: "var(--text-main)"
  };
  const label = (txt) => (
    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{txt}</label>
  );

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14 }}>{servicios.length} servicio(s) configurados</div>
      {msg && <div style={{ background: "var(--bg-success)", border: "1px solid var(--tag-pagado-text)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, color: "var(--tag-pagado-text)", fontSize: 12 }}>{msg}</div>}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 10 }}>{editando ? "✏️ Editar servicio" : "➕ Agregar servicio"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <div>{label("Nombre *")}<input value={form.label} onChange={e => setF("label", e.target.value)} style={inp} placeholder="Ej: Agua Potable" /></div>
          <div>{label("Icono (emoji)")}<input value={form.icon} onChange={e => setF("icon", e.target.value)} style={inp} placeholder="💧" /></div>
          <div>{label("Unidad (solo consumo)")}<input value={form.unit} onChange={e => setF("unit", e.target.value)} style={inp} placeholder="m³, kWh, kg" /></div>
          <div>{label("Tipo")}
            <select value={form.tipo} onChange={e => setF("tipo", e.target.value)} style={inp}>
              <option value="fijo">Fijo (monto directo)</option>
              <option value="consumo">Consumo (con unidad)</option>
            </select>
          </div>
          <div>{label("Método de reparto")}
            <select value={form.reparto} onChange={e => setF("reparto", e.target.value)} style={inp}>
              <option value={SEReparto.UNIDAD}>1 solo pago (por unidad)</option>
              <option value={SEReparto.HABITACIONES}>Por cantidad de habitaciones</option>
              <option value={SEReparto.PERSONAS}>Por cantidad de personas</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.requerido} onChange={e => setF("requerido", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: cfg.colorPrimario }} />
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>Requerido en el formulario</label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={guardar} disabled={!form.label.trim()}
            style={{ background: cfg.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, cursor: form.label.trim() ? "pointer" : "not-allowed", fontSize: 12 }}>
            {editando ? "💾 Guardar cambios" : "➕ Agregar"}
          </button>
          {editando && (
            <button onClick={() => { setEditando(null); setForm(formEmpty()); }}
              style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          )}
        </div>
      </div>

      {servicios.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>No hay servicios configurados. Agregue el primero arriba.</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-light)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: cfg.colorPrimario, color: "#fff" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Icono</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Nombre</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Tipo</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Reparto</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Unidad</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Req.</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map(s => (
                <tr key={s.id} style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", fontSize: 20, textAlign: "center", color: "var(--text-main)" }}>{s.icon}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", fontWeight: 700, color: "var(--text-main)" }}>{s.label}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center", fontSize: 11, color: "var(--text-main)" }}>{s.tipo === "consumo" ? "📊 Consumo" : "💰 Fijo"}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center", fontSize: 11, color: "var(--text-main)" }}>
                    {s.reparto === SEReparto.UNIDAD ? "🏷️ Unidad" : s.reparto === SEReparto.HABITACIONES ? "🏠 Habitaciones" : "👥 Personas"}
                  </td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center", fontSize: 11, color: "var(--text-main)" }}>{s.unit || "—"}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center", color: "var(--text-main)" }}>{s.requerido ? "✅" : "—"}</td>
                  <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", textAlign: "center", color: "var(--text-main)" }}>
                    <button onClick={() => editar(s)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => eliminar(s.id)} style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", marginLeft: 4 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
        Los cambios en servicios afectan a nuevas liquidaciones. Las liquidaciones existentes conservan los datos del momento.
      </div>
    </div>
  );
}

const normalizeKeys = (obj) => {
  const r = {};
  Object.entries(obj).forEach(([k, v]) => { r[k.charAt(0).toLowerCase() + k.slice(1)] = v; });
  return r;
};

function VistaAdmin({ cfg, personas, setPersonas, tarifas, setTarifas, liquidaciones, setLiquidaciones, onLogout, onConfig, toggleDarkMode, servicios, setServicios, usuarios, setUsuarios, onSaveUsuarios }) {
  const C = cfg;
  const isMobile = useMobile();
  const [tab, setTab] = useState("historial");
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const tabRef = useRef(null);
  const [hasScroll, setHasScroll] = useState(false);
  const [rango, setRango] = useState({ desde: today().slice(0, 7) + "-01", hasta: today() });
  const [filtroInquilino, setFiltroInquilino] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    const el = tabRef.current;
    if (!el) return;
    const check = () => setHasScroll(el.scrollWidth > el.clientWidth);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => { el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, []);

  // Payment registration state
  const [pagoForm, setPagoForm] = useState(emptyForm());
  const [pagoSaved, setPagoSaved] = useState(false);
  const [pagoLoading, setPagoLoading] = useState(false);
  const [pagoError, setPagoError] = useState("");
  const setPagoF = (k, v) => setPagoForm(p => ({ ...p, [k]: v }));

  const pagoLiqPeriodo = getLiq(liquidaciones, pagoForm.periodoMes, pagoForm.periodoAnio);
  const pagoPersonaSel = personas.find(p => String(p.id) === String(pagoForm.personaId));

  const pagoServiciosAsignados = useMemo(() => {
    if (!pagoLiqPeriodo || !pagoLiqPeriodo.inquilinos || !pagoPersonaSel) return servicios;
    const asignados = pagoLiqPeriodo.inquilinos[String(pagoPersonaSel.id)];
    if (!asignados || !asignados.servicios) return servicios;
    return servicios.filter(s => asignados.servicios.includes(s.id));
  }, [pagoLiqPeriodo, pagoPersonaSel, servicios]);

  const activas = useMemo(() => personas.filter(p => p.activo !== false), [personas]);

  const pagoMontos = useMemo(() => {
    const m = {};
    pagoServiciosAsignados.forEach(s => {
      m[s.id] = calcMontoServicio(s, pagoLiqPeriodo, pagoPersonaSel, activas);
    });
    return m;
  }, [pagoServiciosAsignados, pagoLiqPeriodo, pagoPersonaSel, activas]);

  const pagoTotal = Object.values(pagoMontos).reduce((s, v) => s + v, 0);
  const pagoSinLiq = !pagoLiqPeriodo;

  const serviciosFijo = useMemo(() => servicios.filter(s => s.tipo === "fijo"), [servicios]);
  const serviciosConsumo = useMemo(() => servicios.filter(s => s.tipo === "consumo"), [servicios]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      if (C.appsScriptUrl) {
        const data = await apiGet(C.appsScriptUrl);
        if (Array.isArray(data) && data.length > 0) {
          let normalizados = data.map(normalizeKeys);
          const personasLocal = JSON.parse(localStorage.getItem(CONFIG_DEFAULT.storageKeyPersonas) || "[]");
          normalizados = normalizados.map(pg => {
            if (!pg.personaId && pg.inquilino) {
              const match = personasLocal.find(p => p.nombre.toLowerCase().trim() === pg.inquilino.toLowerCase().trim());
              if (match) pg.personaId = String(match.id);
            }
            return pg;
          });
          setPagos(normalizados);
          localStorage.setItem(C.storageKey, JSON.stringify(normalizados));
        }
      } else {
        const local = JSON.parse(localStorage.getItem(C.storageKey) || "[]");
        setPagos(local);
      }
    } catch {
      const local = JSON.parse(localStorage.getItem(C.storageKey) || "[]");
      setPagos(local);
    } finally { setLoading(false); }
  }, [C.appsScriptUrl, C.storageKey]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => { if (tab === "resumen-persona") cargar(); }, [tab, cargar]);

  useEffect(() => {
    if (C.appsScriptUrl) {
      apiPost(C.appsScriptUrl, { action: "getPersonas" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && j.data.length > 0) setPersonas(j.data);
      }).catch(e => console.error("GAS load personas:", e));
      apiPost(C.appsScriptUrl, { action: "loadServicios" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && j.data.length > 0) setServicios(j.data);
      }).catch(e => console.error("GAS load servicios:", e));
      apiPost(C.appsScriptUrl, { action: "loadTarifas" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && typeof j.data === "object" && Object.keys(j.data).length > 0) setTarifas(j.data);
      }).catch(e => console.error("GAS load tarifas:", e));
      apiPost(C.appsScriptUrl, { action: "loadLiquidaciones" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && typeof j.data === "object" && Object.keys(j.data).length > 0) setLiquidaciones(j.data);
      }).catch(e => console.error("GAS load liquidaciones:", e));
    }
  }, [C.appsScriptUrl]);

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      if (C.appsScriptUrl) {
        const res = await apiPost(C.appsScriptUrl, { action: "delete", id });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
      }
      const nueva = pagos.filter(s => s.id !== id);
      setPagos(nueva);
      localStorage.setItem(C.storageKey, JSON.stringify(nueva));
    } catch { alert("Error al eliminar"); }
  };

  const imprimirBoletaAdmin = (pago) => {
    const w = window.open("", "_blank", "width=400,height=600");
    const servDetalle = pagoServiciosAsignados.filter(s => Number(pagoMontos[s.id]) > 0)
      .map(s => `<div class="item"><span>${s.icon} ${s.label}</span><span class="mon">Bs.- ${fmtMoney(pagoMontos[s.id])}</span></div>`).join("\n");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Boleta — ${C.orgNombre}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font:12px/1.4 "Courier New",monospace; color:#1e293b; padding:16px; max-width:320px; margin:0 auto; }
  .header { text-align:center; margin-bottom:14px; padding-bottom:10px; border-bottom:2px dashed #065f46; }
  .header h1 { font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#065f46; }
  .header h2 { font-size:15px;font-weight:800;margin:2px 0; }
  .info { font-size:11px;margin-bottom:10px; }
  .info div { padding:2px 0; }
  .items { border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1; padding:8px 0; margin-bottom:10px; }
  .item { display:flex;justify-content:space-between;padding:3px 0;font-size:12px; }
  .item .mon { font-weight:700; }
  .total-row { display:flex;justify-content:space-between;font-weight:800;font-size:15px;padding:6px 0;border-top:2px solid #065f46;margin-top:4px; }
  .footer { text-align:center;margin-top:14px;font-size:9px;color:#94a3b8;border-top:1px dashed #cbd5e1;padding-top:8px; }
  .footer .gracias { font-size:11px;color:#065f46;font-weight:700;margin-bottom:4px; }
  @media print { body { padding:10px; } }
</style></head><body>
<div class="header"><h1>${C.orgNombre}</h1><h2>${C.appTitulo}</h2><div style="font-size:10px;color:#64748b">${C.orgSubtitulo}</div></div>
<div class="info">
  <div><b>Inquilino:</b> ${pago.inquilino}</div>
  <div><b>Recibido:</b> Bs.- ${fmtMoney(Number(pago.montoRecibido) || 0)}</div>
  <div><b>Cambio:</b> Bs.- ${fmtMoney(Number(pago.cambio) || 0)}</div>
  <div><b>Período:</b> ${pago.periodoMes} ${pago.periodoAnio}</div>
  <div><b>Fecha:</b> ${fmtDate(pago.fecha)}</div>
  <div><b>Método:</b> ${pago.metodo}</div>
</div>
<div class="items">${servDetalle}</div>
<div class="total-row"><span>TOTAL</span><span>Bs.- ${fmtMoney(pagoTotal)}</span></div>
${pago.notas ? `<div style="font-size:10px;color:#92400e;font-style:italic;margin-top:6px">"${pago.notas}"</div>` : ""}
<div class="footer">
  <div class="gracias">¡Gracias por su pago!</div>
  <div>Recibo generado el ${new Date().toLocaleString("es-ES")}</div>
</div>
<script>window.onload=setTimeout(()=>{window.print();window.close()},500)</script>
</body></html>`);
    w.document.close();
  };

  const handlePagoSubmit = async () => {
    if (pagoSinLiq) { setPagoError("No hay liquidación configurada para este período."); return; }
    const req = ["inquilino", "metodo", "fecha"];
    if (C.requiereNotas) req.push("notas");
    if (req.some(k => !pagoForm[k])) { setPagoError("Complete todos los campos obligatorios (*)."); return; }
    const recibido = Number(pagoForm.montoRecibido);
    if (isNaN(recibido) || recibido <= 0) { setPagoError("Indique el monto recibido."); return; }
    if (recibido < pagoTotal) { setPagoError(`El monto recibido (Bs.- ${fmtMoney(recibido)}) es menor al total (Bs.- ${fmtMoney(pagoTotal)}).`); return; }
    if (pagoTotal <= 0) { setPagoError("El total a pagar debe ser mayor a cero."); return; }
    const existentes = JSON.parse(localStorage.getItem(C.storageKey) || "[]");
    if (existentes.some(pg =>
      String(pg.personaId) === String(pagoForm.personaId) &&
      pg.periodoMes === pagoForm.periodoMes &&
      String(pg.periodoAnio) === String(pagoForm.periodoAnio) &&
      pg.estado === "Pagado"
    )) {
      setPagoError(`⚠️ ${pagoPersonaSel?.nombre || "Esta persona"} ya registró un pago para ${pagoForm.periodoMes} ${pagoForm.periodoAnio}. No se permiten pagos duplicados.`);
      return;
    }
    setPagoError(""); setPagoLoading(true);
    const nuevo = {
      ...pagoForm,
      id: Date.now(), creadoEn: new Date().toISOString(),
      cambio: Math.round((recibido - pagoTotal) * 10) / 10,
      ...pagoMontos,
      total: pagoTotal, estado: "Pagado"
    };
    try {
      const local = JSON.parse(localStorage.getItem(C.storageKey) || "[]");
      localStorage.setItem(C.storageKey, JSON.stringify([...local, nuevo]));
      if (C.appsScriptUrl) await apiPost(C.appsScriptUrl, nuevo);
      setPagoSaved(true);
      imprimirBoletaAdmin(nuevo);
      setTimeout(() => { setPagoSaved(false); setPagoForm(emptyForm()); }, C.exitoDelay || 5000);
    } catch {
      setPagoSaved(true);
      imprimirBoletaAdmin(nuevo);
      setTimeout(() => { setPagoSaved(false); setPagoForm(emptyForm()); }, C.exitoDelay || 5000);
    } finally { setPagoLoading(false); }
  };

  const filtrados = pagos.filter(s =>
    s.fecha >= rango.desde && s.fecha <= rango.hasta
    && (!filtroInquilino || (s.inquilino || "").toLowerCase().includes(filtroInquilino.toLowerCase()))
    && (!filtroMetodo || s.metodo === filtroMetodo)
    && (!filtroEstado || s.estado === filtroEstado)
  );

  const totalGeneral = filtrados.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalesServicios = useMemo(() => {
    const t = {};
    servicios.forEach(sv => { t[sv.id] = filtrados.reduce((sum, i) => sum + Number(i[sv.id] || 0), 0); });
    return t;
  }, [filtrados, servicios]);

  const chartColors = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#6366f1","#14b8a6","#e11d48","#84cc16"];
  const chartData = useMemo(() => {
    const svActivos = servicios.filter(sv => filtrados.some(i => Number(i[sv.id]) > 0));
    if (!svActivos.length) return null;
    const groups = {};
    filtrados.forEach(i => {
      const key = `${String(i.periodoAnio || "")}-${String(i.periodoMes || "")}`;
      if (!groups[key]) { groups[key] = {}; svActivos.forEach(sv => groups[key][sv.id] = 0); }
      svActivos.forEach(sv => { groups[key][sv.id] += Number(i[sv.id]) || 0; });
    });
    const periods = Object.entries(groups).filter(([k]) => k !== "-").sort((a, b) => a[0].localeCompare(b[0])).map(([k, vals]) => {
      const total = Object.values(vals).reduce((s, v) => s + v, 0);
      return { key: k, label: k.replace("-", " "), vals, total };
    });
    return { periods, svActivos, maxVal: Math.max(...periods.map(p => p.total), 1) };
  }, [filtrados, servicios]);

  const imprimirRecibo = (s) => {
    const w = window.open("", "_blank", "width=500,height=700");
    const servDetalleFijo = serviciosFijo.filter(sv => s[sv.id] > 0 && Number(s[sv.id]) > 0)
      .map(sv => `<div class="field"><div class="lbl">${sv.icon} ${sv.label}</div><div class="val">Bs.- ${fmtMoney(s[sv.id])}</div></div>`).join("\n");
    const servDetalleConsumo = serviciosConsumo.filter(sv => (s[`${sv.id}Consumo`] || s[sv.id]) > 0)
      .map(sv => {
        const consumoTotal = Number(s[`${sv.id}Consumo`]) || 0;
        const facturaTotal = Number(s[`${sv.id}Factura`]) || 0;
        const monto = Number(s[sv.id]) || 0;
        if (consumoTotal > 0 && facturaTotal > 0) {
          return `<div class="field"><div class="lbl">${sv.icon} ${sv.label}</div><div class="val">${fmtNum(consumoTotal)} ${sv.unit} total × Bs.- ${fmtMoney(facturaTotal)} → Bs.- ${fmtMoney(monto)}</div></div>`;
        }
        return `<div class="field"><div class="lbl">${sv.icon} ${sv.label}</div><div class="val">Bs.- ${fmtMoney(monto)}</div></div>`;
      }).join("\n");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo — ${C.orgNombre}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font:14px/1.6 system-ui,sans-serif; color:#1e293b; padding:30px; max-width:480px; margin:0 auto; color-scheme:light; }
  .header { text-align:center; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #065f46; }
  .header h1 { font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#065f46;margin-bottom:2px; }
  .header h2 { font-size:18px;font-weight:800;color:#1e293b; }
  .field { display:flex;padding:6px 0;border-bottom:1px solid #e2e8f0; }
  .field .lbl { width:120px;font-weight:700;color:#64748b;font-size:12px;flex-shrink:0; }
  .field .val { flex:1;color:#1e293b; }
  .total-row { display:flex;justify-content:space-between;background:#065f46;color:#fff;padding:10px 12px;border-radius:6px;margin-top:10px;font-weight:800;font-size:16px; }
  .footer { text-align:center;margin-top:24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px; }
  @media print { body { padding:20px; } .no-print { display:none; } }
</style></head><body>
<div class="header"><h1>${C.orgNombre} — ${C.orgSubtitulo}</h1><h2>Recibo de Pago</h2></div>
<div class="field"><div class="lbl">Fecha</div><div class="val">${fmtDate(s.fecha)}</div></div>
<div class="field"><div class="lbl">Período</div><div class="val">${s.periodoMes || ""} ${s.periodoAnio || ""}</div></div>
<div class="field"><div class="lbl">Inquilino</div><div class="val">${s.inquilino || "—"}</div></div>
<div class="field"><div class="lbl">Recibido</div><div class="val">Bs.- ${fmtMoney(Number(s.montoRecibido) || 0)}</div></div>
<div class="field"><div class="lbl">Cambio</div><div class="val">Bs.- ${fmtMoney(Number(s.cambio) || 0)}</div></div>
<div class="field"><div class="lbl">Método</div><div class="val">${s.metodo || "—"}</div></div>
${servDetalleFijo}
${servDetalleConsumo}
<div class="total-row"><span>TOTAL PAGADO</span><span>Bs.- ${fmtMoney(s.total)}</span></div>
${s.notas ? `<div style="margin-top:10px;font-size:11px;color:#64748b;font-style:italic">"${s.notas}"</div>` : ""}
<div class="footer">Recibo generado el ${new Date().toLocaleDateString()} — ${C.orgNombre} Alquileres</div>
<button class="no-print" onclick="window.print();window.close()" style="display:block;margin:20px auto 0;background:#065f46;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-weight:700;cursor:pointer;font-size:14px">🖨️ Imprimir recibo</button>
<script>window.onload=setTimeout(()=>{window.print()},500)</script>
</body></html>`);
    w.document.close();
  };

  const imprimirTodo = () => {
    if (filtrados.length === 0) return;
    const w = window.open("", "_blank", "width=700,height=700");
    const cards = [...filtrados].reverse().map(s => {
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid">
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">
          <span style="background:#d1fae5;color:#065f46;border-radius:4px;padding:0 7px;font-size:10px;font-weight:600">Pagado</span>
          <span style="background:#f1f5f9;color:#475569;border-radius:4px;padding:0 7px;font-size:10px">${fmtDate(s.fecha)}</span>
          <span style="background:#e0e7ff;color:#3730a3;border-radius:4px;padding:0 7px;font-size:10px">${s.metodo || "—"}</span>
          <span style="background:#fce7f3;color:#9d174d;border-radius:4px;padding:0 7px;font-size:10px">${s.periodoMes || ""} ${s.periodoAnio || ""}</span>
        </div>
        <div style="font-weight:700;font-size:13px">${s.inquilino || "—"}</div>
        <div style="font-size:12px;color:#64748b">Recibido: Bs.- ${fmtMoney(Number(s.montoRecibido) || 0)}${s.cambio ? ` | Cambio: Bs.- ${fmtMoney(Number(s.cambio) || 0)}` : ""}</div>
        <div style="font-size:13px;color:#059669;font-weight:700;margin-top:3px">Bs.- ${fmtMoney(s.total)}</div>
        ${s.notas ? `<div style="font-size:10px;color:#92400e;font-style:italic">"${s.notas}"</div>` : ""}
      </div>`;
    }).join("\n");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Todos los Pagos — ${C.orgNombre}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font:13px/1.5 system-ui,sans-serif; color:#1e293b; padding:30px; max-width:700px; margin:0 auto; color-scheme:light; }
  .header { text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #065f46; }
  .header h1 { font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#065f46;margin-bottom:2px; }
  .header h2 { font-size:17px;font-weight:800;color:#1e293b; }
  .header .count { font-size:11px;color:#64748b;margin-top:4px; }
  .footer { text-align:center;margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px; }
  @media print { body { padding:20px; } .no-print { display:none; } }
</style></head><body>
<div class="header"><h1>${C.orgNombre} — ${C.orgSubtitulo}</h1><h2>Reporte de Pagos</h2><div class="count">Total: ${filtrados.length} registro(s) — Bs.- ${fmtMoney(totalGeneral)}</div></div>
${cards}
<div class="footer">Documento generado el ${new Date().toLocaleDateString()} — ${C.orgNombre} Alquileres</div>
<button class="no-print" onclick="window.print();window.close()" style="display:block;margin:20px auto 0;background:#065f46;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-weight:700;cursor:pointer;font-size:14px">🖨️ Imprimir todo</button>
<script>window.onload=setTimeout(()=>{window.print()},500)</script>
</body></html>`);
    w.document.close();
  };

  const imprimirResumenPersonas = () => {
    const w = window.open("", "_blank", "width=800,height=700");
    const rows = [];
    activas.forEach(p => {
      const pid = String(p.id);
      let totalDebe = 0, totalPagado = 0;
      const periods = [];
      Object.entries(liquidaciones).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => {
        const [y, m] = k.split("-");
        const mesLabel = meses[Number(m) - 1];
        const totInq = (() => {
          const result = {};
          const srvData = v.servicios || v;
          const inqData = v.inquilinos || {};
          activas.forEach(p2 => {
            const pid2 = String(p2.id);
            const asignados = inqData[pid2]?.servicios || [];
            let total = 0;
            const detalles = {};
            servicios.forEach(s => {
              const liq = srvData[s.id];
              if (!liq) { detalles[s.id] = 0; return; }
              const totalFactura = Number(liq.totalFactura) || 0;
              if (totalFactura <= 0) { detalles[s.id] = 0; return; }
              const marked = asignados.length === 0 || asignados.includes(s.id);
              if (!marked) { detalles[s.id] = 0; return; }
              const r = liq.reparto || s.reparto;
              if (r === SEReparto.UNIDAD) { detalles[s.id] = totalFactura; }
              else {
                const idsConServicio = Object.entries(inqData).filter(([_, v2]) => v2.servicios && v2.servicios.includes(s.id)).map(([id]) => id);
                const baseFiltradas = getPersonasSnapshot(v, personas);
                const personasFiltradas = idsConServicio.length ? baseFiltradas.filter(x => idsConServicio.includes(String(x.id))) : baseFiltradas;
                if (personasFiltradas.length === 0) { detalles[s.id] = 0; return; }
                const factores = v.factores || {};
                const factor = r === SEReparto.HABITACIONES ? (Number(factores[pid2]?.habitaciones) || Number(p2.habitaciones) || 1) : (Number(factores[pid2]?.personas) || Number(p2.personas) || 1);
                const totalFactor = calcTotalFactor(personasFiltradas, r, factores);
                detalles[s.id] = totalFactor > 0 ? Math.round(totalFactura * factor / totalFactor * 10) / 10 : 0;
              }
              total += detalles[s.id];
            });
            result[pid2] = { detalles, total };
          });
          return result;
        })();
        const datos = totInq[pid];
        if (!datos || datos.total <= 0) return;
        const pagadoMonto = pagos.filter(pg => {
          if (pg.periodoMes !== mesLabel || String(pg.periodoAnio) !== y || pg.estado !== "Pagado") return false;
          if (String(pg.personaId) === pid) return true;
          if (pg.inquilino && p.nombre && pg.inquilino.toLowerCase() === p.nombre.toLowerCase()) return true;
          return false;
        }).reduce((s, pg) => s + Number(pg.total || 0), 0);
        totalDebe += datos.total;
        totalPagado += pagadoMonto;
        periods.push({ label: `${mesLabel} ${y}`, debe: datos.total, detalles: datos.detalles, pagado: pagadoMonto, saldo: Math.round((datos.total - pagadoMonto) * 10) / 10 });
      });
      if (periods.length === 0) return;
      const saldoTotal = Math.round((totalDebe - totalPagado) * 10) / 10;
      rows.push({ nombre: p.nombre, inmueble: p.inmueble, periods, totalDebe, totalPagado, saldoTotal });
    });
    const tarifasHtml = (() => {
      const keys = Object.keys(liquidaciones).sort();
      if (keys.length === 0) return "";
      return `
        <div style="font-size:13px;font-weight:700;margin:12px 0 4px;color:#1e293b">📋 Costo de servicios por período</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px">
          <thead><tr style="background:#475569;color:#fff">
            <th style="padding:4px 8px;text-align:left;font-size:9px">Período</th>
            ${servicios.map(s => `<th style="padding:4px 8px;text-align:center;font-size:9px">${s.icon}</th>`).join("")}
          </tr></thead>
          <tbody>${keys.map(k => {
            const [y, m] = k.split("-");
            const mesLabel = meses[Number(m) - 1];
            const tf = tarifas[k] || {};
            return `<tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:4px 8px;font-weight:600">${mesLabel} ${y}</td>
              ${servicios.map(s => {
                const t = tf[s.id];
                return `<td style="padding:4px 8px;text-align:center">${t ? "Bs.- " + fmtMoney(t) : "—"}</td>`;
              }).join("")}
            </tr>`;
          }).join("")}</tbody>
        </table>`;
    })();
    const perHtml = rows.map(data => `
      <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid">
        <div style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px">
          <div><strong style="font-size:14px">${data.nombre}</strong>${data.inmueble ? `<span style="color:#64748b;margin-left:6px;font-size:12px">${data.inmueble}</span>` : ""}</div>
          <div style="font-size:11px">Debe: <strong style="color:#059669">Bs.- ${fmtMoney(data.totalDebe)}</strong> | Pagado: <strong style="color:#065f46">Bs.- ${fmtMoney(data.totalPagado)}</strong> | Saldo: <strong style="color:${data.saldoTotal > 0 ? "#dc2626" : "#065f46"}">Bs.- ${fmtMoney(data.saldoTotal)}</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:#065f46;color:#fff">
            <th style="padding:6px 8px;text-align:left;font-size:10px">Período</th>
            ${servicios.map(s => `<th style="padding:6px 8px;text-align:center;font-size:10px">${s.icon}</th>`).join("")}
            <th style="padding:6px 8px;text-align:center;font-size:10px">Debe</th>
            <th style="padding:6px 8px;text-align:center;font-size:10px">Pagó</th>
            <th style="padding:6px 8px;text-align:center;font-size:10px">Saldo</th>
          </tr></thead>
          <tbody>${data.periods.map(per => `<tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:5px 8px;font-weight:700">${per.label}</td>
            ${servicios.map(s => `<td style="padding:5px 8px;text-align:center">${per.detalles[s.id] > 0 ? "Bs.- " + fmtMoney(per.detalles[s.id]) : "—"}</td>`).join("")}
            <td style="padding:5px 8px;text-align:center;font-weight:700;color:#059669">Bs.- ${fmtMoney(per.debe)}</td>
            <td style="padding:5px 8px;text-align:center;font-weight:700;color:#065f46">${per.pagado > 0 ? "Bs.- " + fmtMoney(per.pagado) : "—"}</td>
            <td style="padding:5px 8px;text-align:center;font-weight:700;color:${per.saldo > 0 ? "#dc2626" : "#065f46"}">${per.saldo > 0 ? "Bs.- " + fmtMoney(per.saldo) : "✅ Pagado"}</td>
          </tr>`).join("")}</tbody>
          <tfoot><tr style="background:#f1f5f9;font-weight:700">
            <td style="padding:5px 8px">TOTAL</td>
            ${servicios.map(s => {
              const totalSrv = data.periods.reduce((sum, per) => sum + (per.detalles[s.id] || 0), 0);
              return `<td style="padding:5px 8px;text-align:center">${totalSrv > 0 ? "Bs.- " + fmtMoney(totalSrv) : "—"}</td>`;
            }).join("")}
            <td style="padding:5px 8px;text-align:center;color:#059669">Bs.- ${fmtMoney(data.totalDebe)}</td>
            <td style="padding:5px 8px;text-align:center;color:#065f46">Bs.- ${fmtMoney(data.totalPagado)}</td>
            <td style="padding:5px 8px;text-align:center;color:${data.saldoTotal > 0 ? "#dc2626" : "#065f46"}">Bs.- ${fmtMoney(data.saldoTotal)}</td>
          </tr></tfoot>
        </table>
      </div>
    `).join("\n");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Resumen por Persona — ${C.orgNombre}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font:13px/1.5 system-ui,sans-serif; color:#1e293b; padding:30px; max-width:800px; margin:0 auto; color-scheme:light; }
  .header { text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #065f46; }
  .header h1 { font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#065f46;margin-bottom:2px; }
  .header h2 { font-size:17px;font-weight:800; }
  .header .count { font-size:11px;color:#64748b;margin-top:4px; }
  .footer { text-align:center;margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px; }
  @media print { body { padding:20px; } .no-print { display:none; } }
</style></head><body>
<div class="header"><h1>${C.orgNombre} — ${C.orgSubtitulo}</h1><h2>Resumen de Pagos por Persona</h2><div class="count">${rows.length} persona(s) — ${Object.keys(liquidaciones).length} período(s)</div></div>
${tarifasHtml}
${perHtml}
<div class="footer">Documento generado el ${new Date().toLocaleDateString()} — ${C.orgNombre} Alquileres</div>
<button class="no-print" onclick="window.print();window.close()" style="display:block;margin:20px auto 0;background:#065f46;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-weight:700;cursor:pointer;font-size:14px">🖨️ Imprimir PDF</button>
<script>window.onload=setTimeout(()=>{window.print()},500)</script>
</body></html>`);
    w.document.close();
  };

  const inp2 = { border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", fontSize: 12, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" };
  const tabBtn = (id, label, icon) => (
    <button onClick={() => setTab(id)} style={{ padding: isMobile ? "8px 10px" : "10px 16px", fontWeight: 600, fontSize: isMobile ? 12 : 13, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, borderBottom: tab === id ? `3px solid ${C.colorAcento}` : "3px solid transparent", background: "transparent", color: tab === id ? C.colorAcento : "var(--text-secondary)", transition: "color .2s, border-color .2s" }}
      onMouseEnter={e => { if (tab !== id) e.currentTarget.style.color = "var(--text-main)" }}
      onMouseLeave={e => { if (tab !== id) e.currentTarget.style.color = "var(--text-secondary)" }}>
      {icon} {label}
    </button>
  );
  const tabBtnSidebar = (id, label, icon) => (
    <button onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 16px", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", textAlign: "left", background: tab === id ? "rgba(255,255,255,.12)" : "transparent", color: tab === id ? "#fff" : "rgba(255,255,255,.7)", borderLeft: tab === id ? `3px solid #fff` : "3px solid transparent", transition: "all .15s" }}
      onMouseEnter={e => { if (tab !== id) e.currentTarget.style.background = "rgba(255,255,255,.05)"; }}
      onMouseLeave={e => { if (tab !== id) e.currentTarget.style.background = "transparent"; }}>
      <span style={{ fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  const sidebar = (
    <div style={{ width: 230, flexShrink: 0, background: `linear-gradient(180deg,${C.colorPrimario},${C.colorAcento})`, display: "flex", flexDirection: "column", overflow: "auto" }}>
      <div style={{ padding: "16px 16px 8px", color: "#fff" }}>
        <div style={{ fontSize: 10, opacity: .8, letterSpacing: 2, textTransform: "uppercase" }}>{C.orgNombre} — {C.orgSubtitulo}</div>
        <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>Panel Administrador</div>
      </div>
      <nav style={{ flex: 1, paddingTop: 4 }}>
        {tabBtnSidebar("nuevo-pago", "Registrar Pago", "💳")}
        {tabBtnSidebar("historial", `Historial (${pagos.length})`, "📋")}
        {tabBtnSidebar("informe", "Resumen Financiero", "📊")}
        {tabBtnSidebar("resumen-persona", "Resumen por Persona", "🧾")}
        {tabBtnSidebar("liquidaciones", "Liquidaciones", "📄")}
        {tabBtnSidebar("servicios", `Servicios (${servicios.length})`, "📦")}
        {tabBtnSidebar("personas", `Personas (${personas.length})`, "👥")}
        {tabBtnSidebar("tarifas", "Tarifas", "💰")}
        {tabBtnSidebar("usuarios", "Usuarios", "🔐")}
      </nav>
      {!cfg.appsScriptUrl && (
        <div style={{ margin: "0 10px 6px", padding: "6px 10px", background: "rgba(255,255,255,.12)", borderRadius: 6, textAlign: "center" }}>
          <div style={{ color: "#fff", fontSize: 10, fontWeight: 600, opacity: .85 }}>📁 Solo Local</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 9, marginTop: 1 }}>Sin conexión a GAS</div>
        </div>
      )}
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,.12)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onConfig} title="Configurar" style={{ flex: 1, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 6, padding: "6px 10px", fontWeight: 600, cursor: "pointer", fontSize: 11, textAlign: "center" }}>⚙️</button>
        <button onClick={cargar} title="Actualizar" style={{ flex: 1, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 6, padding: "6px 10px", fontWeight: 600, cursor: "pointer", fontSize: 11, textAlign: "center" }}>{loading ? "⏳" : "🔄"}</button>
        <button onClick={toggleDarkMode} title="Modo oscuro" style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 6, padding: "6px 10px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>{C.darkMode ? "☀️" : "🌙"}</button>
        <button onClick={onLogout} title="Salir" style={{ flex: 1, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 6, padding: "6px 10px", fontWeight: 600, cursor: "pointer", fontSize: 11, textAlign: "center" }}>Salir</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-muted)", fontFamily: "sans-serif", display: "flex" }}>
      {!isMobile && sidebar}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {isMobile && (
        <div style={{ background: `linear-gradient(135deg,${C.colorPrimario},${C.colorAcento})`, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: isMobile ? 10 : 11, opacity: .8, letterSpacing: 2, textTransform: "uppercase" }}>{C.orgNombre} — {C.orgSubtitulo}</div>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16 }}>Panel Administrador</div>
        </div>
        {!cfg.appsScriptUrl && <div style={{ background: "rgba(255,255,255,.15)", borderRadius: 5, padding: "2px 8px", fontSize: 9, fontWeight: 600, opacity: .8, whiteSpace: "nowrap" }}>📁 Solo Local</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={onConfig} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, padding: isMobile ? "4px 10px" : "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: isMobile ? 11 : 12 }}>⚙️ Configurar</button>
          <button onClick={cargar} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, padding: isMobile ? "4px 10px" : "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: isMobile ? 11 : 12 }}>{loading ? "⏳" : "🔄"} Actualizar</button>
          <button onClick={toggleDarkMode} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, padding: isMobile ? "4px 8px" : "6px 10px", fontWeight: 600, cursor: "pointer", fontSize: isMobile ? 14 : 16 }}>{C.darkMode ? "☀️" : "🌙"}</button>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, padding: isMobile ? "4px 10px" : "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: isMobile ? 11 : 12 }}>Salir</button>
        </div>
      </div>
      )}
      {isMobile && (
      <div style={{ position: "relative", borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
        <div ref={tabRef} style={{ padding: "0 6px", display: "flex", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", scrollBehavior: "smooth" }}>
          {tabBtn("nuevo-pago", "Pago", "💳")}
          {tabBtn("historial", `Hist. (${pagos.length})`, "📋")}
          {tabBtn("informe", "Financiero", "📊")}
          {tabBtn("resumen-persona", "x Persona", "🧾")}
          {tabBtn("liquidaciones", "Liq.", "📄")}
          {tabBtn("servicios", `Srv. (${servicios.length})`, "📦")}
          {tabBtn("personas", `Pers. (${personas.length})`, "👥")}
          {tabBtn("tarifas", "Tarifas", "💰")}
          {tabBtn("usuarios", "Usuarios", "🔐")}
        </div>
        {hasScroll && <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 36, background: "linear-gradient(to right, transparent, var(--bg-card))", pointerEvents: "none" }} />}
        {hasScroll && <div onClick={() => { tabRef.current.scrollBy({ left: 200, behavior: "smooth" }); }} style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, borderRadius: "50%", background: "var(--bg-card)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", boxShadow: "0 1px 3px rgba(0,0,0,.15)", zIndex: 2 }}>›</div>}
      </div>
      )}

      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1200, margin: "0 auto", flex: 1, width: "100%" }}>
        {tab === "nuevo-pago" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            {pagoSaved && (
              <div style={{ background: "var(--bg-success)", border: "1px solid var(--tag-pagado-text)", borderRadius: 12, padding: isMobile ? "14px 16px" : "20px 24px", marginBottom: 16, color: "var(--tag-pagado-text)", textAlign: "center", animation: "fadeIn .3s" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>¡Pago registrado con éxito!</div>
                <div style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>Total: Bs.- {fmtMoney(pagoTotal)}</div>
                <button onClick={() => {
                  const n = { ...pagoForm, total: pagoTotal, ...pagoMontos, id: Date.now() };
                  imprimirBoletaAdmin(n);
                }} style={{ marginTop: 10, background: "#fff", color: "var(--tag-pagado-text)", border: "2px solid var(--tag-pagado-text)", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  🖨️ Imprimir boleta
                </button>
              </div>
            )}
            {pagoError && (
              <div style={{ background: "var(--bg-error)", border: "1px solid var(--danger-text)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: "var(--danger-text)", fontSize: 13 }}>{pagoError}</div>
            )}
            {pagoSinLiq && pagoForm.periodoMes && pagoForm.periodoAnio && (
              <div style={{ background: "var(--bg-warning)", border: "1px solid var(--star)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: "var(--star)", fontSize: 12, textAlign: "center" }}>
                ⚠️ No hay liquidación configurada para {pagoForm.periodoMes} {pagoForm.periodoAnio}. Cree una en la pestaña Liquidaciones.
              </div>
            )}
            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: isMobile ? 16 : 24, boxShadow: "var(--shadow-md)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14 }}>💳 Registrar nuevo pago</div>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Fecha de pago *</label>
                    <input type="date" value={pagoForm.fecha} onChange={e => setPagoF("fecha", e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Método de pago *</label>
                    <select value={pagoForm.metodo} onChange={e => setPagoF("metodo", e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }}>
                      <option value="">-- Seleccione --</option>
                      {C.metodosPago.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Inquilino *</label>
                  <BuscadorPersonas personas={activas} value={pagoForm.personaId} onChange={(p) => setPagoForm(prev => ({ ...prev, personaId: String(p.id), inquilino: p.nombre }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Período (Mes) *</label>
                    <select value={pagoForm.periodoMes} onChange={e => setPagoF("periodoMes", e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }}>
                      {meses.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Año</label>
                    <input type="number" value={pagoForm.periodoAnio} onChange={e => setPagoF("periodoAnio", e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }} />
                  </div>
                </div>
                {pagoForm.personaId && pagoForm.periodoMes && pagoForm.periodoAnio ? (
                  <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 10 }}>
                      Detalle de montos
                      {pagoLiqPeriodo && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>(Liquidación {pagoForm.periodoMes} {pagoForm.periodoAnio})</span>}
                    </div>
                    {pagoServiciosAsignados.map(s => {
                      const monto = pagoMontos[s.id];
                      const serviciosData = pagoLiqPeriodo ? (pagoLiqPeriodo.servicios || pagoLiqPeriodo) : null;
                      if (!serviciosData || !serviciosData[s.id]) {
                        return <div key={s.id} style={{ marginBottom: 6, opacity: .5 }}>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{s.icon} {s.label} — Sin datos de liquidación</div>
                        </div>;
                      }
                      const liq = serviciosData[s.id];
                      const r = liq.reparto || s.reparto;
                      const labelR = r === SEReparto.HABITACIONES ? "🏠 por habitaciones" : r === SEReparto.PERSONAS ? "👥 por personas" : "🏷️ 1 pago";
                      return (
                        <div key={s.id} style={{ background: r !== SEReparto.UNIDAD ? "var(--bg-accent)" : "transparent", borderRadius: 10, padding: r !== SEReparto.UNIDAD ? "10px 12px" : "6px 0", marginBottom: r !== SEReparto.UNIDAD ? 8 : 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{s.icon} {s.label}</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6, background: "var(--bg-muted)", borderRadius: 4, padding: "1px 6px" }}>{labelR}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>Bs.- {fmtMoney(monto)}</div>
                          </div>
                          {s.tipo === "consumo" && liq.consumoTotal && (
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Consumo total: {fmtNum(liq.consumoTotal)} {s.unit} | Factura total: Bs.- {fmtMoney(liq.totalFactura)}</div>
                          )}
                          {r !== SEReparto.UNIDAD && (
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                              Factor: {fmtNum(r === SEReparto.HABITACIONES ? Number(pagoLiqPeriodo?.factores?.[String(pagoPersonaSel?.id)]?.habitaciones) || Number(pagoPersonaSel?.habitaciones) || 1 : Number(pagoLiqPeriodo?.factores?.[String(pagoPersonaSel?.id)]?.personas) || Number(pagoPersonaSel?.personas) || 1)} de {fmtNum(calcTotalFactor(getPersonasSnapshot(pagoLiqPeriodo, activas), r, pagoLiqPeriodo?.factores))} ({labelR})
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ background: "var(--bg-card)", border: "2px solid var(--tag-pagado-text)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)" }}>TOTAL A PAGAR</div>
                      <div style={{ fontWeight: 900, fontSize: 22, color: C.colorAcento }}>Bs.- {fmtMoney(pagoTotal)}</div>
                    </div>
                  </div>
                ) : null}
                {pagoForm.personaId && pagoForm.periodoMes && pagoForm.periodoAnio ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Monto recibido *</label>
                      <input type="number" step="0.1" min="0" value={pagoForm.montoRecibido} onChange={e => setPagoF("montoRecibido", e.target.value)} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)" }} placeholder="0" />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Cambio</label>
                      <div style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", boxSizing: "border-box", background: "var(--bg-muted)", color: Number(pagoForm.montoRecibido) >= pagoTotal ? "var(--tag-pagado-text)" : "var(--danger-text)", display: "flex", alignItems: "center", fontWeight: 700, fontSize: 16 }}>
                        {pagoForm.montoRecibido !== "" && Number(pagoForm.montoRecibido) >= pagoTotal
                          ? `Bs.- ${fmtMoney(Math.round((Number(pagoForm.montoRecibido) - pagoTotal) * 10) / 10)}`
                          : pagoForm.montoRecibido !== "" && Number(pagoForm.montoRecibido) < pagoTotal
                            ? `Faltan Bs.- ${fmtMoney(Math.round((pagoTotal - Number(pagoForm.montoRecibido)) * 10) / 10)}`
                            : "—"}
                      </div>
                    </div>
                  </div>
                ) : null}
                {C.mostrarCampoNotas && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Notas / Comprobante{C.requiereNotas ? " *" : ""}</label>
                    <textarea value={pagoForm.notas} onChange={e => setPagoF("notas", e.target.value)} rows={2} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", fontSize: 13, boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-main)", resize: "vertical" }} placeholder="Comprobante o notas adicionales (opcional)" />
                  </div>
                )}
              </div>
              <button onClick={handlePagoSubmit} disabled={pagoLoading || pagoSinLiq}
                style={{ width: "100%", marginTop: 18, background: pagoLoading || pagoSinLiq ? "var(--text-muted)" : C.colorPrimario, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontWeight: 800, cursor: pagoLoading || pagoSinLiq ? "not-allowed" : "pointer", fontSize: 15, transition: "opacity .2s, background .2s" }}
                onMouseEnter={e => { if (!pagoLoading) e.currentTarget.style.opacity = ".85" }}
                onMouseLeave={e => { if (!pagoLoading) e.currentTarget.style.opacity = "1" }}>
                {pagoLoading ? "Guardando..." : "💾 Registrar pago"}
              </button>
            </div>
          </div>
        )}

        {tab === "historial" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>Historial de pagos — {pagos.length} registro(s)</span>
              {!C.appsScriptUrl && <span style={{ fontSize: 11, color: "var(--star)", background: "var(--bg-warning)", padding: "2px 8px", borderRadius: 6 }}>⚠ Modo local</span>}
              <button onClick={imprimirTodo} style={{ marginLeft: "auto", background: C.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>🖨️ Imprimir filtrados</button>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 12, marginBottom: 14, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
                {[{ label: "Desde", key: "desde" }, { label: "Hasta", key: "hasta" }].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input type="date" value={rango[f.key]} onChange={e => setRango(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...inp2, width: "100%" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Inquilino</label>
                  <input value={filtroInquilino} onChange={e => setFiltroInquilino(e.target.value)} style={{ ...inp2, width: "100%" }} placeholder="Buscar..." />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Método</label>
                  <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} style={{ ...inp2, width: "100%" }}>
                    <option value="">Todos</option>{C.metodosPago.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Estado</label>
                  <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...inp2, width: "100%" }}>
                    <option value="">Todos</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>
            </div>
            {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Cargando...</div>
              : pagos.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>Sin registros de pago</div>
                : filtrados.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>Sin pagos en este período</div>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...filtrados].reverse().map(s => (
                      <div key={s.id} style={{ border: "1px solid var(--border-light)", borderRadius: 10, padding: isMobile ? 10 : 14, background: "var(--bg-card)", display: "flex", gap: isMobile ? 8 : 12, alignItems: "flex-start", boxShadow: "var(--shadow-sm)", transition: "box-shadow .2s, transform .2s" }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-1px)" }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none" }}>
                        <div style={{ background: "var(--bg-success)", borderRadius: 8, padding: isMobile ? "6px 6px" : "8px 10px", textAlign: "center", minWidth: isMobile ? 65 : 85, flexShrink: 0 }}>
                          <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 800, color: C.colorAcento }}>Bs.-</div>
                          <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "var(--tag-pagado-text)" }}>{fmtMoney(s.total)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
                            <span style={{ background: "var(--tag-pagado)", color: "var(--tag-pagado-text)", borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>✅ {s.estado || "Pagado"}</span>
                            <span style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>{fmtDate(s.fecha)}</span>
                            <span style={{ background: "var(--tag-metodo)", color: "var(--tag-metodo-text)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>{(C.metodosIconos[s.metodo] || "💳")} {s.metodo}</span>
                            <span style={{ background: "var(--tag-inquilino)", color: "var(--tag-inquilino-text)", borderRadius: 6, padding: "1px 8px", fontSize: 11 }}>{s.periodoMes || ""} {s.periodoAnio || ""}</span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{s.inquilino}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{s.inmueble}</div>
                          {s.notas && <div style={{ fontSize: 11, color: "var(--text-comment)", fontStyle: "italic", marginTop: 2 }}>"{s.notas}"</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                          <button onClick={() => imprimirRecibo(s)} style={{ background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer", transition: "background .15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-accent)"}
                            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-muted)"}
                            title="Imprimir recibo">🖨️</button>
                          <button onClick={() => eliminar(s.id)} style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        )}

        {tab === "informe" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14 }}>Resumen Financiero por Período</div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 18, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                {[{ label: "Desde", key: "desde" }, { label: "Hasta", key: "hasta" }].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input type="date" value={rango[f.key]} onChange={e => setRango(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...inp2, width: "100%" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Inquilino</label>
                  <input value={filtroInquilino} onChange={e => setFiltroInquilino(e.target.value)} style={{ ...inp2, width: "100%" }} placeholder="Filtrar..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Método</label>
                  <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} style={{ ...inp2, width: "100%" }}>
                    <option value="">Todos</option>{C.metodosPago.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Estado</label>
                  <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...inp2, width: "100%" }}>
                    <option value="">Todos</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Total pagos", val: filtrados.length, color: C.colorAcento, bg: "var(--bg-accent)" },
                { label: "Monto total", val: `Bs.- ${fmtMoney(totalGeneral)}`, color: "var(--tag-pagado-text)", bg: "var(--bg-success)" },
                { label: "Inquilinos únicos", val: new Set(filtrados.map(s => s.inquilino)).size, color: "var(--tag-inquilino-text)", bg: "var(--tag-inquilino)" },
                { label: "Método común", val: (() => { const m = {}; filtrados.forEach(s => { m[s.metodo] = (m[s.metodo] || 0) + 1; }); return Object.entries(m).sort((a,b) => b[1]-a[1])[0]?.[0] || "—"; })(), color: "var(--tag-metodo-text)", bg: "var(--tag-metodo)" },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: "14px 8px", textAlign: "center", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? `repeat(${Math.min(servicios.length, 2)},1fr)` : `repeat(${Math.min(servicios.length, 4)},1fr)`, gap: 10, marginBottom: 18 }}>
              {servicios.filter(sv => totalesServicios[sv.id] > 0).map(sv => (
                <div key={sv.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{sv.icon} {sv.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>Bs.- {fmtMoney(totalesServicios[sv.id])}</div>
                </div>
              ))}
            </div>

            {chartData && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16, marginBottom: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 12 }}>📈 Historial de Consumo por Servicio</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, minHeight: 200, paddingBottom: 24, position: "relative", overflowX: "auto" }}>
                  {chartData.periods.map((per, pi) => (
                    <div key={per.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 50 }}>
                      <div style={{ display: "flex", flexDirection: "column-reverse", width: "100%", height: 180, alignItems: "center", justifyContent: "flex-start" }}>
                        {chartData.svActivos.map((sv, si) => {
                          const h = per.total > 0 ? Math.max((per.vals[sv.id] / chartData.maxVal) * 160, per.vals[sv.id] > 0 ? 4 : 0) : 0;
                          return h > 0 ? (
                            <div key={sv.id} style={{ width: isMobile ? "100%" : "80%", height, background: chartColors[si % chartColors.length], borderRadius: "2px 2px 0 0", marginBottom: 1, transition: "height .3s", position: "relative" }}>
                              {per.vals[sv.id] > chartData.maxVal * 0.1 && (
                                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap" }}>Bs.-{fmtMoney(per.vals[sv.id])}</div>
                              )}
                            </div>
                          ) : null;
                        })}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, textAlign: "center", writingMode: isMobile ? "vertical-lr" : "horizontal-tb", transform: isMobile ? "rotate(180deg)" : "none" }}>{per.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--border-light)" }}>
                  {chartData.svActivos.map((sv, si) => (
                    <div key={sv.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: chartColors[si % chartColors.length] }} />
                      {sv.icon} {sv.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtrados.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                {C.metodosPago.map(m => {
                  const total = filtrados.filter(s => s.metodo === m).length;
                  return total > 0 ? (
                    <div key={m} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{C.metodosIconos[m] || "💳"}</span>
                      <div><div style={{ fontWeight: 700, fontSize: 13 }}>{total}</div><div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{m}</div></div>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>Sin pagos en el período</div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 8 }}>Desglose por Inquilino</div>
                <div style={{ overflowX: "auto", marginBottom: 18, borderRadius: 10, border: "1px solid var(--border-light)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.colorPrimario, color: "#fff" }}>
                        <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>#</th>
                        <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Inquilino</th>
                        <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Pagos</th>
                        {servicios.filter(sv => totalesServicios[sv.id] > 0).map(sv => (
                          <th key={sv.id} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>{sv.icon} {sv.label}</th>
                        ))}
                        <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grupos = {};
                        const svActivos = servicios.filter(sv => totalesServicios[sv.id] > 0);
                        filtrados.forEach(s => {
                          const key = s.inquilino;
                          if (!grupos[key]) {
                            const base = { inquilino: s.inquilino, pagos: [], total: 0 };
                            svActivos.forEach(sv => { base[sv.id] = 0; });
                            grupos[key] = base;
                          }
                          grupos[key].pagos.push(s);
                          svActivos.forEach(sv => { grupos[key][sv.id] += Number(s[sv.id] || 0); });
                          grupos[key].total += Number(s.total || 0);
                        });
                        return Object.values(grupos).map((g, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-muted)" }}>
                            <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-light)", textAlign: "center", fontWeight: 700, color: C.colorAcento }}>{i + 1}</td>
                            <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-light)" }}>{g.inquilino}</td>
                            <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-light)", textAlign: "center", fontWeight: 700 }}>{g.pagos.length}</td>
                            {svActivos.map(sv => (
                              <td key={sv.id} style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-light)", textAlign: "right" }}>{g[sv.id] ? fmtMoney(g[sv.id]) : "—"}</td>
                            ))}
                            <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-light)", textAlign: "right", fontWeight: 700, color: C.colorAcento }}>{fmtMoney(g.total)}</td>
                          </tr>
                        ));
                      })()}
                      <tr style={{ background: "var(--bg-muted)", fontWeight: 700 }}>
                        <td colSpan={2} style={{ padding: "6px 8px", textAlign: "right" }}>TOTAL</td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>{filtrados.length}</td>
                        {servicios.filter(sv => totalesServicios[sv.id] > 0).map(sv => (
                          <td key={sv.id} style={{ padding: "6px 8px", textAlign: "right" }}>{totalesServicios[sv.id] ? fmtMoney(totalesServicios[sv.id]) : "—"}</td>
                        ))}
                        <td style={{ padding: "6px 8px", textAlign: "right", color: C.colorAcento }}>{fmtMoney(totalGeneral)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => window.print()} style={{ background: C.colorPrimario, color: "#fff", border: "none", borderRadius: 8, padding: "11px 26px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🖨️ Imprimir informe</button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "resumen-persona" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>Resumen de pagos por persona</span>
              <button onClick={() => imprimirResumenPersonas()} style={{ marginLeft: "auto", background: C.colorPrimario, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>🖨️ Imprimir PDF</button>
            </div>
            {personas.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: 10 }}>No hay personas registradas</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(() => {
                  const perPersonData = {};
                  activas.forEach(p => {
                    const pid = String(p.id);
                    const periods = [];
                    let totalDebe = 0, totalPagado = 0;
                    Object.entries(liquidaciones).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => {
                      const [y, m] = k.split("-");
                      const mesLabel = meses[Number(m) - 1];
                      const totInq = (() => {
                        const result = {};
                        const srvData = v.servicios || v;
                        const inqData = v.inquilinos || {};
                        activas.forEach(p2 => {
                          const pid2 = String(p2.id);
                          const asignados = inqData[pid2]?.servicios || [];
                          let total = 0;
                          const detalles = {};
                          servicios.forEach(s => {
                            const liq = srvData[s.id];
                            if (!liq) { detalles[s.id] = 0; return; }
                            const totalFactura = Number(liq.totalFactura) || 0;
                            if (totalFactura <= 0) { detalles[s.id] = 0; return; }
                            const marked = asignados.length === 0 || asignados.includes(s.id);
                            if (!marked) { detalles[s.id] = 0; return; }
                            const r = liq.reparto || s.reparto;
                            if (r === SEReparto.UNIDAD) {
                              detalles[s.id] = totalFactura;
                            } else {
                              const idsConServicio = Object.entries(inqData).filter(([_, v2]) => v2.servicios && v2.servicios.includes(s.id)).map(([id]) => id);
                              const baseFiltradas = getPersonasSnapshot(v, activas);
                              const personasFiltradas = idsConServicio.length ? baseFiltradas.filter(x => idsConServicio.includes(String(x.id))) : baseFiltradas;
                              if (personasFiltradas.length === 0) { detalles[s.id] = 0; return; }
                              const factores = v.factores || {};
                              const factor = r === SEReparto.HABITACIONES ? (Number(factores[pid2]?.habitaciones) || Number(p2.habitaciones) || 1) : (Number(factores[pid2]?.personas) || Number(p2.personas) || 1);
                              const totalFactor = calcTotalFactor(personasFiltradas, r, factores);
                              detalles[s.id] = totalFactor > 0 ? Math.round(totalFactura * factor / totalFactor * 10) / 10 : 0;
                            }
                            total += detalles[s.id];
                          });
                          result[pid2] = { detalles, total };
                        });
                        return result;
                      })();
                      const datos = totInq[pid];
                      if (!datos || datos.total <= 0) return;
                      const pagadoTotal = pagos.filter(pg => {
                        if (pg.periodoMes !== mesLabel || String(pg.periodoAnio) !== y || pg.estado !== "Pagado") return false;
                        if (String(pg.personaId) === pid) return true;
                        if (pg.inquilino && p.nombre && pg.inquilino.toLowerCase() === p.nombre.toLowerCase()) return true;
                        return false;
                      }).reduce((s, pg) => s + Number(pg.total || 0), 0);
                      totalDebe += datos.total;
                      totalPagado += pagadoTotal;
                      periods.push({
                        label: `${mesLabel} ${y}`,
                        debe: datos.total,
                        detalles: datos.detalles,
                        pagado: pagadoTotal,
                        saldo: Math.round((datos.total - pagadoTotal) * 10) / 10
                      });
                    });
                    if (periods.length > 0) {
                      perPersonData[pid] = { nombre: p.nombre, inmueble: p.inmueble, periods, totalDebe, totalPagado, saldoTotal: Math.round((totalDebe - totalPagado) * 10) / 10 };
                    }
                  });
                  return Object.entries(perPersonData).map(([pid, data]) => (
                    <div key={pid} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-light)", background: "var(--bg-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-main)" }}>{data.nombre}</span>
                          {data.inmueble && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-secondary)" }}>{data.inmueble}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                          <span>Total debe: <strong style={{ color: C.colorAcento }}>Bs.- {fmtMoney(data.totalDebe)}</strong></span>
                          <span>Total pagado: <strong style={{ color: "var(--tag-pagado-text)" }}>Bs.- {fmtMoney(data.totalPagado)}</strong></span>
                          <span>Saldo: <strong style={{ color: data.saldoTotal > 0 ? "var(--danger-text)" : "var(--tag-pagado-text)" }}>Bs.- {fmtMoney(data.saldoTotal)}</strong></span>
                        </div>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: "var(--text-main)" }}>
                          <thead>
                            <tr style={{ background: cfg.colorPrimario, color: "#fff" }}>
                              <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 600, fontSize: 10 }}>Período</th>
                              {servicios.map(s => (
                                <th key={s.id} style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>{s.icon} {s.label}</th>
                              ))}
                              <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Debe</th>
                              <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Pagó</th>
                              <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: 600, fontSize: 10 }}>Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.periods.map(per => (
                              <tr key={per.label} style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 700, color: "var(--text-main)" }}>{per.label}</td>
                                {servicios.map(s => (
                                  <td key={s.id} style={{ padding: "6px 8px", textAlign: "center", color: per.detalles[s.id] > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                                    {per.detalles[s.id] > 0 ? `Bs.- ${fmtMoney(per.detalles[s.id])}` : "—"}
                                  </td>
                                ))}
                                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: C.colorAcento }}>Bs.- {fmtMoney(per.debe)}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "var(--tag-pagado-text)" }}>{per.pagado > 0 ? `Bs.- ${fmtMoney(per.pagado)}` : "—"}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: per.saldo > 0 ? "var(--danger-text)" : "var(--tag-pagado-text)" }}>
                                  {per.saldo > 0 ? `Bs.- ${fmtMoney(per.saldo)}` : "✅"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "var(--bg-muted)", fontWeight: 700 }}>
                              <td style={{ padding: "6px 8px", color: "var(--text-main)" }}>TOTAL</td>
                              {servicios.map(s => {
                                const totalSrv = data.periods.reduce((sum, per) => sum + (per.detalles[s.id] || 0), 0);
                                return (
                                  <td key={s.id} style={{ padding: "6px 8px", textAlign: "center", color: "var(--text-main)" }}>
                                    {totalSrv > 0 ? `Bs.- ${fmtMoney(totalSrv)}` : "—"}
                                  </td>
                                );
                              })}
                              <td style={{ padding: "6px 8px", textAlign: "center", color: C.colorAcento }}>Bs.- {fmtMoney(data.totalDebe)}</td>
                              <td style={{ padding: "6px 8px", textAlign: "center", color: "var(--tag-pagado-text)" }}>Bs.- {fmtMoney(data.totalPagado)}</td>
                              <td style={{ padding: "6px 8px", textAlign: "center", color: data.saldoTotal > 0 ? "var(--danger-text)" : "var(--tag-pagado-text)" }}>Bs.- {fmtMoney(data.saldoTotal)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        {tab === "liquidaciones" && (
          <VistaLiquidaciones cfg={cfg} personas={personas} liquidaciones={liquidaciones} setLiquidaciones={setLiquidaciones} servicios={servicios} pagos={pagos} tarifas={tarifas} />
        )}

        {tab === "servicios" && (
          <VistaServicios cfg={cfg} servicios={servicios} setServicios={setServicios} />
        )}

        {tab === "personas" && (
          <VistaPersonas cfg={cfg} personas={personas} setPersonas={setPersonas} servicios={servicios} />
        )}

        {tab === "tarifas" && (
          <VistaTarifas cfg={cfg} tarifas={tarifas} setTarifas={setTarifas} servicios={servicios} />
        )}

        {tab === "usuarios" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>🔐 Gestión de usuarios ({usuarios.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {usuarios.map(u => (
                <div key={u.id} style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-light)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: u.rol === "admin" ? cfg.colorPrimario : "var(--bg-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {u.rol === "admin" ? "🔐" : "👤"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{u.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email} · {u.rol === "admin" ? "Administrador" : "Inquilino"}</div>
                  </div>
                  <button onClick={() => {
                    if (!confirm("¿Eliminar usuario " + u.nombre + "?")) return;
                    setUsuarios(usuarios.filter(x => x.id !== u.id));
                  }} style={{ background: "var(--danger-bg)", color: "var(--danger-text)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginBottom: 10 }}>➕ Nuevo usuario</div>
              <VistaAdminUsuariosForm usuarios={usuarios} setUsuarios={setUsuarios} personas={personas} cfg={cfg} onSaveUsuarios={onSaveUsuarios} />
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState(
    window.location.hash === "#admin" ? "admin" : "publico"
  );
  const [config, setConfig] = useState({ ...CONFIG_DEFAULT, darkMode: false });
  const [showConfig, setShowConfig] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [tarifas, setTarifas] = useState({});
  const [liquidaciones, setLiquidaciones] = useState({});
  const [servicios, setServicios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const primeraVez = useRef(true);
  const usuariosGasLoaded = useRef(false);

  useEffect(() => {
    const savedCfg = localStorage.getItem("alquileres_config");
    let cfg = null;
    if (savedCfg) { try { cfg = JSON.parse(savedCfg); setConfig(prev => ({ ...prev, ...cfg, darkMode: prev.darkMode })); } catch {} }
    const saved = localStorage.getItem(CONFIG_DEFAULT.storageKeyPersonas);
    if (saved) { try { setPersonas(JSON.parse(saved)); } catch {} }
    const savedTarifas = localStorage.getItem(CONFIG_DEFAULT.storageKeyTarifas);
    if (savedTarifas) { try { setTarifas(JSON.parse(savedTarifas)); } catch {} }
    const savedLiq = localStorage.getItem(CONFIG_DEFAULT.storageKeyLiquidacion);
    if (savedLiq) { try { setLiquidaciones(JSON.parse(savedLiq)); } catch {} }
    const savedSrv = localStorage.getItem(CONFIG_DEFAULT.storageKeyServicios);
    if (savedSrv) { try { setServicios(JSON.parse(savedSrv)); } catch {} }
    if (!savedSrv) { setServicios(SERVICIOS_POR_DEFECTO); }
    const savedUsers = localStorage.getItem(CONFIG_DEFAULT.storageKeyUsuarios);
    if (savedUsers) {
      try {
        const u = JSON.parse(savedUsers);
        if (u.length > 0) { setUsuarios(u); } else { throw new Error("empty"); }
      } catch (e) {
        setUsuarios([{ id: 1, nombre: "Administrador", email: "admin", password: "admin123", rol: "admin", personaId: null }]);
      }
    } else {
      setUsuarios([{ id: 1, nombre: "Administrador", email: "admin", password: "admin123", rol: "admin", personaId: null }]);
    }
    const url = (cfg && cfg.appsScriptUrl) || CONFIG_DEFAULT.appsScriptUrl;
    if (url) {
      const sk = cfg || CONFIG_DEFAULT;
      apiLoadConfig(url).then(c => { if (c && Object.keys(c).length > 0) { setConfig(prev => ({ ...prev, ...c, darkMode: prev.darkMode })); } });
      apiGet(url).then(pagos => {
        if (pagos && Array.isArray(pagos) && pagos.length > 0) {
          let normalizados = pagos.map(normalizeKeys);
          const personasLocal = JSON.parse(localStorage.getItem(CONFIG_DEFAULT.storageKeyPersonas) || "[]");
          normalizados = normalizados.map(pg => {
            if (!pg.personaId && pg.inquilino) {
              const match = personasLocal.find(p => p.nombre.toLowerCase().trim() === pg.inquilino.toLowerCase().trim());
              if (match) pg.personaId = String(match.id);
            }
            return pg;
          });
          localStorage.setItem(sk.storageKey, JSON.stringify(normalizados));
        }
      }).catch(e => console.error("GAS load pagos:", e));
      apiPost(url, { action: "getPersonas" }).then(r => r.json()).then(j => {
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) { setPersonas(j.data); localStorage.setItem(sk.storageKeyPersonas, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load personas:", e));
      apiPost(url, { action: "loadServicios" }).then(r => r.json()).then(j => {
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) { setServicios(j.data); localStorage.setItem(sk.storageKeyServicios, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load servicios:", e));
      apiPost(url, { action: "loadTarifas" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && typeof j.data === "object" && Object.keys(j.data).length > 0) { setTarifas(j.data); localStorage.setItem(sk.storageKeyTarifas, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load tarifas:", e));
      apiPost(url, { action: "loadLiquidaciones" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && typeof j.data === "object" && Object.keys(j.data).length > 0) { setLiquidaciones(j.data); localStorage.setItem(sk.storageKeyLiquidacion, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load liquidaciones:", e));
      apiPost(url, { action: "loadUsuarios" }).then(r => r.json()).then(j => {
        if (j.ok) { usuariosGasLoaded.current = true; }
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) {
          const localData = localStorage.getItem(sk.storageKeyUsuarios);
          const localUsers = localData ? JSON.parse(localData) : [];
          const merged = [...j.data];
          localUsers.forEach(lu => { if (!merged.find(mu => String(mu.id) === String(lu.id))) merged.push(lu); });
          if (merged.length > 0) { setUsuarios(merged); localStorage.setItem(sk.storageKeyUsuarios, JSON.stringify(merged)); }
        }
      }).catch(e => console.error("GAS load usuarios:", e));
    }
  }, []);

  useEffect(() => {
    if (config.appsScriptUrl) {
      const url = config.appsScriptUrl;
      apiLoadConfig(url).then(c => { if (c && Object.keys(c).length > 0) { setConfig(prev => ({ ...prev, ...c, darkMode: prev.darkMode })); } });
      apiGet(url).then(pagos => {
        if (pagos && Array.isArray(pagos) && pagos.length > 0) {
          let normalizados = pagos.map(normalizeKeys);
          const personasLocal = JSON.parse(localStorage.getItem(config.storageKeyPersonas) || "[]");
          normalizados = normalizados.map(pg => {
            if (!pg.personaId && pg.inquilino) {
              const match = personasLocal.find(p => p.nombre.toLowerCase().trim() === pg.inquilino.toLowerCase().trim());
              if (match) pg.personaId = String(match.id);
            }
            return pg;
          });
          localStorage.setItem(config.storageKey, JSON.stringify(normalizados));
        }
      }).catch(e => console.error("GAS load pagos:", e));
      apiPost(url, { action: "getPersonas" }).then(r => r.json()).then(j => {
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) { setPersonas(j.data); localStorage.setItem(config.storageKeyPersonas, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load personas:", e));
      apiPost(url, { action: "loadServicios" }).then(r => r.json()).then(j => {
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) { setServicios(j.data); localStorage.setItem(config.storageKeyServicios, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load servicios:", e));
      apiPost(url, { action: "loadTarifas" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && typeof j.data === "object" && Object.keys(j.data).length > 0) { setTarifas(j.data); localStorage.setItem(config.storageKeyTarifas, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load tarifas:", e));
      apiPost(url, { action: "loadLiquidaciones" }).then(r => r.json()).then(j => {
        if (j.ok && j.data && typeof j.data === "object" && Object.keys(j.data).length > 0) { setLiquidaciones(j.data); localStorage.setItem(config.storageKeyLiquidacion, JSON.stringify(j.data)); }
      }).catch(e => console.error("GAS load liquidaciones:", e));
      apiPost(url, { action: "loadUsuarios" }).then(r => r.json()).then(j => {
        if (j.ok) { usuariosGasLoaded.current = true; }
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) {
          const localData = localStorage.getItem(config.storageKeyUsuarios);
          const localUsers = localData ? JSON.parse(localData) : [];
          const merged = [...j.data];
          localUsers.forEach(lu => { if (!merged.find(mu => String(mu.id) === String(lu.id))) merged.push(lu); });
          if (merged.length > 0) { setUsuarios(merged); localStorage.setItem(config.storageKeyUsuarios, JSON.stringify(merged)); }
        }
      }).catch(e => console.error("GAS load usuarios:", e));
    }
  }, [config.appsScriptUrl]);

  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    localStorage.setItem("alquileres_config", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    const url = getGasUrl();
    if (!url) return;
    const timer = setTimeout(() => {
      apiSaveConfig(url, config).catch(e => console.error("GAS save config error:", e));
    }, 2000);
    return () => clearTimeout(timer);
  }, [config]);

  useEffect(() => {
    if (servicios.length > 0) localStorage.setItem(config.storageKeyServicios, JSON.stringify(servicios));
  }, [servicios, config.storageKeyServicios]);

  useEffect(() => {
    localStorage.setItem(config.storageKeyPersonas, JSON.stringify(personas));
  }, [personas, config.storageKeyPersonas]);

  useEffect(() => {
    localStorage.setItem(config.storageKeyTarifas, JSON.stringify(tarifas));
  }, [tarifas, config.storageKeyTarifas]);

  useEffect(() => {
    localStorage.setItem(config.storageKeyLiquidacion, JSON.stringify(liquidaciones));
  }, [liquidaciones, config.storageKeyLiquidacion]);

  useEffect(() => {
    document.body.classList.toggle("dark", config.darkMode);
  }, [config.darkMode]);

  useEffect(() => {
    localStorage.setItem(config.storageKeyUsuarios, JSON.stringify(usuarios));
  }, [usuarios, config.storageKeyUsuarios]);

  const effectiveConfig = useMemo(() => {
    if (!config.darkMode) return config;
    return { ...config, colorPrimario: config.darkColorPrimario, colorAcento: config.darkColorAcento, colorFondo: config.darkColorFondo, colorFondoAlt: config.darkColorFondoAlt };
  }, [config]);

  const toggleDarkMode = () => setConfig(prev => ({ ...prev, darkMode: !prev.darkMode }));

  const handleSaveConfig = async () => {
    const url = getGasUrl();
    if (!url) return;
    await apiSaveConfig(url, config);
  };

  const handleSavePersonas = async () => {
    const url = getGasUrl();
    if (!url) return;
    await apiPost(url, { action: "savePersonas", data: personas });
  };

  const handleSaveServicios = async () => {
    const url = getGasUrl();
    if (!url) return;
    await apiPost(url, { action: "saveServicios", data: servicios });
  };

  const handleSaveTarifas = async () => {
    const url = getGasUrl();
    if (!url) return;
    await apiPost(url, { action: "saveTarifas", data: tarifas });
  };

  const handleSaveLiquidaciones = async () => {
    const url = getGasUrl();
    if (!url) return;
    await apiPost(url, { action: "saveLiquidaciones", data: liquidaciones });
  };

  const getGasUrl = () => config.appsScriptUrl || CONFIG_DEFAULT.appsScriptUrl;

  const handleSaveUsuarios = async (data) => {
    const url = getGasUrl();
    if (!url) return;
    await apiPost(url, { action: "saveUsuarios", data: data || usuarios });
  };

  useEffect(() => {
    const url = getGasUrl();
    if (url && usuarios.length > 0 && usuariosGasLoaded.current) {
      apiPost(url, { action: "saveUsuarios", data: usuarios })
        .then(r => r.json())
        .then(j => { if (!j.ok) console.error("GAS save usuarios error:", j.error); })
        .catch(e => console.error("GAS save usuarios network error:", e));
    }
  }, [usuarios, config.appsScriptUrl]);

  const handleLogin = (email, password) => {
    let users = usuarios;
    if (users.length === 0) {
      try { const s = localStorage.getItem(config.storageKeyUsuarios); if (s) { const p = JSON.parse(s); if (p.length > 0) users = p; } } catch (e) {}
    }
    const user = users.find(u => String(u.password) === password.trim() && (u.email?.toLowerCase() === email.trim().toLowerCase() || u.nombre?.toLowerCase() === email.trim().toLowerCase()));
    if (!user) return null;
    setUsuarioActual(user);
    setLoginOpen(false);
    if (user.rol === "admin") {
      window.location.hash = "admin";
      setMode("admin");
    } else {
      setMode("inquilino");
    }
    return user;
  };

  const handleLogout = () => {
    setUsuarioActual(null);
    window.location.hash = "";
    setMode("publico");
  };

  return (
    <>
      {showConfig && (
        <PanelConfig config={config} setConfig={setConfig} onClose={() => setShowConfig(false)} onSaveConfig={handleSaveConfig} onSavePersonas={handleSavePersonas} onSaveServicios={handleSaveServicios} onSaveTarifas={handleSaveTarifas} onSaveLiquidaciones={handleSaveLiquidaciones} onSaveUsuarios={handleSaveUsuarios} gasUrl={getGasUrl()} />
      )}
      <LoginModal open={loginOpen} onLogin={handleLogin} onClose={() => setLoginOpen(false)} config={effectiveConfig} />
      {mode === "admin"
        ? <VistaAdmin cfg={effectiveConfig} personas={personas} setPersonas={setPersonas} tarifas={tarifas} setTarifas={setTarifas} liquidaciones={liquidaciones} setLiquidaciones={setLiquidaciones} servicios={servicios} setServicios={setServicios} usuarios={usuarios} setUsuarios={setUsuarios} onLogout={handleLogout} onConfig={() => setShowConfig(true)} toggleDarkMode={toggleDarkMode} onSaveUsuarios={handleSaveUsuarios} />
        : mode === "inquilino"
          ? <VistaInquilino cfg={effectiveConfig} usuario={usuarioActual} personas={personas} liquidaciones={liquidaciones} servicios={servicios} tarifas={tarifas} onLogout={handleLogout} />
          : <VistaPublica cfg={effectiveConfig} personas={personas} tarifas={tarifas} liquidaciones={liquidaciones} servicios={servicios} onLoginClick={() => setLoginOpen(true)} toggleDarkMode={toggleDarkMode} onSetConfig={(url) => { setConfig(prev => ({ ...prev, appsScriptUrl: url })); }} />
      }
    </>
  );
}
